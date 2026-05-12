"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Loader2,
  Mic,
  MicOff,
  Plus,
  SendHorizontal,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  COACH_TOPICS,
  startersFor,
  startersForCustom,
  type CoachTopicId,
} from "@/data/coach-topics";
import type { LearnerLevel } from "@/types/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CoachRemoteState } from "@/app/actions/coach-chats";
import { syncCoachChatBundle } from "@/app/actions/coach-chats";
import type {
  CoachChatThread,
  StoredCoachCorrection,
  StoredCoachMsg,
} from "@/lib/coach-chat-storage";
import {
  COACH_THREADS_MAX,
  createCoachThread,
  deriveThreadTitle,
  loadCoachPersisted,
  mergeCoachBundles,
  saveCoachPersisted,
  trimThreads,
} from "@/lib/coach-chat-storage";
import type { BrowserSpeechLocale } from "@/lib/web-speech";
import {
  prefetchSpeechVoices,
  speechRecognitionSupported,
  speechSynthesisSupported,
  speakText,
  startContinuousRecognition,
  stopSpeaking,
  textForSpeech,
  type RecognitionSession,
} from "@/lib/web-speech";
import { cn } from "@/lib/utils";

/** Matches generate-session-sheet level persistence */
const LS_LEVEL = "idle_generate_level_v1";
const LEVELS: LearnerLevel[] = ["beginner", "intermediate", "advanced"];

/** Must match api/coach/route.ts */
const CUSTOM_TOPIC_MAX = 400;

const LS_AUTO_READ = "idle_coach_auto_read_v1";
const LS_STT_LANG = "idle_coach_stt_lang_v1";
const LS_TTS_LANG = "idle_coach_tts_lang_v1";

const VOICE_LOCALES: BrowserSpeechLocale[] = ["en-US", "vi-VN"];

function readCoachPrefBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "1";
}

function readCoachLocale(
  key: string,
  fallback: BrowserSpeechLocale,
): BrowserSpeechLocale {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw === "vi-VN" || raw === "en-US" ? raw : fallback;
}

function readStoredLevel(): LearnerLevel | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LS_LEVEL);
  if (v && (LEVELS as string[]).includes(v)) return v as LearnerLevel;
  return null;
}

function persistLevel(next: LearnerLevel) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_LEVEL, next);
}

function renderBoldSegments(text: string): ReactNode {
  const chunks = text.split("**");
  return chunks.map((chunk, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-foreground">
        {chunk}
      </strong>
    ) : (
      <Fragment key={i}>{chunk}</Fragment>
    ),
  );
}

export function AiCoach({ coachRemote }: { coachRemote: CoachRemoteState }) {
  const [hydrated, setHydrated] = useState(false);
  const [threads, setThreads] = useState<CoachChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");

  const [busy, setBusy] = useState(false);
  const [autoReadAloud, setAutoReadAloud] = useState(true);
  const [sttLang, setSttLang] = useState<BrowserSpeechLocale>("en-US");
  const [ttsLang, setTtsLang] = useState<BrowserSpeechLocale>("en-US");
  const [listening, setListening] = useState(false);
  const [interimVoice, setInterimVoice] = useState("");
  const [ttsSourceKey, setTtsSourceKey] = useState<string | null>(null);
  const [topicLevelOpen, setTopicLevelOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<RecognitionSession | null>(null);
  const ttsSeqRef = useRef(0);

  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const activeThreadIdRef = useRef(activeThreadId);
  activeThreadIdRef.current = activeThreadId;

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId),
    [threads, activeThreadId],
  );

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads],
  );

  useEffect(() => {
    const levelGuess = readStoredLevel() ?? "intermediate";
    const local = loadCoachPersisted();
    const merged = mergeCoachBundles(local, coachRemote.bundle, levelGuess);
    setThreads(merged.threads);
    setActiveThreadId(merged.activeThreadId);
    prefetchSpeechVoices();
    setAutoReadAloud(readCoachPrefBool(LS_AUTO_READ, true));
    setSttLang(readCoachLocale(LS_STT_LANG, "en-US"));
    setTtsLang(readCoachLocale(LS_TTS_LANG, "en-US"));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial snapshot from server + localStorage once
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCoachPersisted({
      version: 1,
      activeThreadId,
      threads: trimThreads(threads),
    });
  }, [hydrated, threads, activeThreadId]);

  useEffect(() => {
    if (!hydrated || !coachRemote.authenticated) return;
    const t = window.setTimeout(() => {
      void syncCoachChatBundle({
        version: 1,
        activeThreadId,
        threads: trimThreads(threads),
      });
    }, 1100);
    return () => window.clearTimeout(t);
  }, [hydrated, coachRemote.authenticated, threads, activeThreadId]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (busy && listening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
      setInterimVoice("");
    }
  }, [busy, listening]);

  const patchActiveThread = useCallback(
    (patch: Partial<CoachChatThread> | ((t: CoachChatThread) => CoachChatThread)) => {
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== activeThreadIdRef.current) return t;
          const merged =
            typeof patch === "function" ? patch(t) : { ...t, ...patch };
          return {
            ...merged,
            updatedAt: Date.now(),
            title: deriveThreadTitle(merged.messages),
          };
        }),
      );
    },
    [],
  );

  const stopVoiceUi = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimVoice("");
    ttsSeqRef.current += 1;
    stopSpeaking();
    setTtsSourceKey(null);
  }, []);

  const switchThread = useCallback(
    (id: string) => {
      if (id === activeThreadIdRef.current) return;
      stopVoiceUi();
      setActiveThreadId(id);
    },
    [stopVoiceUi],
  );

  const startNewConversation = useCallback(() => {
    stopVoiceUi();
    const level =
      threadsRef.current.find((t) => t.id === activeThreadIdRef.current)
        ?.level ?? readStoredLevel() ?? "intermediate";
    const t = createCoachThread(level);
    setThreads((prev) => trimThreads([t, ...prev]));
    setActiveThreadId(t.id);
    toast.message("New conversation");
  }, [stopVoiceUi]);

  const deleteThread = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const prev = threadsRef.current;
      if (prev.length <= 1) {
        toast.message("Keep at least one chat.");
        return;
      }
      stopVoiceUi();
      let next = prev.filter((t) => t.id !== id);
      next = trimThreads(next);
      if (!next.length) {
        next = [createCoachThread(readStoredLevel() ?? "intermediate")];
      }
      const needSwitch = id === activeThreadIdRef.current;
      setThreads(next);
      if (needSwitch) setActiveThreadId(next[0]!.id);
    },
    [stopVoiceUi],
  );

  const handleAutoReadChange = useCallback((next: boolean) => {
    setAutoReadAloud(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_AUTO_READ, next ? "1" : "0");
    }
  }, []);

  const handleSttLangChange = useCallback((loc: BrowserSpeechLocale) => {
    setSttLang(loc);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_STT_LANG, loc);
    }
  }, []);

  const handleTtsLangChange = useCallback((loc: BrowserSpeechLocale) => {
    setTtsLang(loc);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_TTS_LANG, loc);
    }
  }, []);

  const speakCoachReply = useCallback(
    (content: string, sourceKey: string) => {
      if (!speechSynthesisSupported()) {
        toast.error("Read-aloud isn't supported in this browser.");
        return;
      }
      if (!textForSpeech(content)) return;

      const seq = ++ttsSeqRef.current;
      setTtsSourceKey(sourceKey);
      speakText(content, ttsLang, {
        onEnd: () => {
          if (ttsSeqRef.current !== seq) return;
          setTtsSourceKey(null);
        },
        onError: () => {
          if (ttsSeqRef.current !== seq) return;
          setTtsSourceKey(null);
        },
      });
    },
    [ttsLang],
  );

  const stopCoachSpeech = useCallback(() => {
    ttsSeqRef.current += 1;
    stopSpeaking();
    setTtsSourceKey(null);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
      setInterimVoice("");
      return;
    }

    if (!speechRecognitionSupported()) {
      toast.error("Voice typing isn't supported in this browser — try Chrome.");
      return;
    }

    stopCoachSpeech();

    const session = startContinuousRecognition(sttLang, {
      onInterim: (t) => setInterimVoice(t),
      onFinal: (t) => {
        patchActiveThread((thread) => {
          const next = t.trim();
          if (!next) return thread;
          const base = thread.draft.trim();
          const draft = base ? `${base} ${next}` : next;
          return { ...thread, draft };
        });
        setInterimVoice("");
      },
      onError: (code) => {
        if (code === "not-allowed") {
          toast.error("Microphone permission denied.");
        } else if (
          code !== "aborted" &&
          code !== "no-speech" &&
          code !== "audio-capture"
        ) {
          toast.error(`Voice input error: ${code}`);
        }
        setListening(false);
        setInterimVoice("");
        recognitionRef.current = null;
      },
      onEnded: () => {
        setListening(false);
        setInterimVoice("");
        recognitionRef.current = null;
      },
    });

    if (!session) {
      toast.error("Couldn't start the microphone.");
      return;
    }

    recognitionRef.current = session;
    setListening(true);
    setInterimVoice("");
  }, [listening, sttLang, stopCoachSpeech, patchActiveThread]);

  const topicId = activeThread?.topicId ?? "small_talk";
  const customTopic = activeThread?.customTopic ?? "";
  const level = activeThread?.level ?? "intermediate";
  const messages: StoredCoachMsg[] = activeThread?.messages ?? [];
  const draft = activeThread?.draft ?? "";

  const starters = useMemo(() => {
    const custom = customTopic.trim();
    if (custom.length > 0) {
      return startersForCustom(level);
    }
    return startersFor(topicId, level);
  }, [topicId, level, customTopic]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, activeThreadId]);

  const handleLevelPick = useCallback(
    (next: LearnerLevel) => {
      persistLevel(next);
      patchActiveThread({ level: next });
    },
    [patchActiveThread],
  );

  const handleTopicChange = useCallback(
    (next: CoachTopicId) => {
      patchActiveThread((t) =>
        t.topicId === next
          ? t
          : {
              ...t,
              topicId: next,
              messages: [],
              draft: "",
              title: "New chat",
            },
      );
    },
    [patchActiveThread],
  );

  const sendPayload = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed || busy) return;

      stopCoachSpeech();

      const tid = activeThreadIdRef.current;
      const snap = threadsRef.current.find((t) => t.id === tid);
      if (!snap) return;

      const historyForApi: { role: "user" | "assistant"; content: string }[] =
        snap.messages.map((m) =>
          m.role === "assistant"
            ? { role: "assistant", content: m.content }
            : { role: "user", content: m.content },
        );

      const nextUser: StoredCoachMsg = { role: "user", content: trimmed };

      setThreads((prev) =>
        prev.map((t) =>
          t.id !== tid
            ? t
            : {
                ...t,
                messages: [...t.messages, nextUser],
                draft: "",
                updatedAt: Date.now(),
                title: deriveThreadTitle([...t.messages, nextUser]),
              },
        ),
      );
      setBusy(true);

      try {
        const topicExtra = snap.customTopic.trim().slice(0, CUSTOM_TOPIC_MAX);

        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId: snap.topicId,
            level: snap.level,
            messages: [...historyForApi, { role: "user", content: trimmed }],
            ...(topicExtra ? { customTopic: topicExtra } : {}),
          }),
        });

        const data = (await res.json()) as {
          reply?: string;
          corrections?: StoredCoachCorrection[];
          suggestions?: string[];
          error?: string;
          fallback?: {
            reply: string;
            corrections: StoredCoachCorrection[];
            suggestions: string[];
          };
        };

        if (!res.ok) {
          if (data.fallback) {
            const assistantMsg: StoredCoachMsg = {
              role: "assistant",
              content: data.fallback.reply,
              corrections: data.fallback.corrections ?? [],
              suggestions: data.fallback.suggestions ?? [],
            };
            setThreads((prev) =>
              prev.map((t) =>
                t.id !== tid
                  ? t
                  : {
                      ...t,
                      messages: [...t.messages, assistantMsg],
                      updatedAt: Date.now(),
                      title: deriveThreadTitle([...t.messages, assistantMsg]),
                    },
              ),
            );
            toast.message("AI coach offline — showing offline tips.");
            const fbReply = data.fallback.reply.trim();
            if (autoReadAloud && fbReply) {
              const msgIdx = snap.messages.length + 1;
              queueMicrotask(() =>
                speakCoachReply(data.fallback!.reply, `${tid}-msg-${msgIdx}`),
              );
            }
          } else {
            toast.error("Could not reach the coach. Try again.");
            setThreads((prev) =>
              prev.map((t) =>
                t.id !== tid
                  ? t
                  : { ...t, messages: t.messages.slice(0, -1), updatedAt: Date.now() },
              ),
            );
          }
          return;
        }

        const replyText = (data.reply ?? "").trim();
        const assistantMsg: StoredCoachMsg = {
          role: "assistant",
          content: data.reply ?? "",
          corrections: data.corrections ?? [],
          suggestions: data.suggestions ?? [],
        };

        setThreads((prev) =>
          prev.map((t) =>
            t.id !== tid
              ? t
              : {
                  ...t,
                  messages: [...t.messages, assistantMsg],
                  updatedAt: Date.now(),
                  title: deriveThreadTitle([...t.messages, assistantMsg]),
                },
          ),
        );

        if (autoReadAloud && replyText) {
          const msgIdx = snap.messages.length + 1;
          queueMicrotask(() =>
            speakCoachReply(data.reply ?? "", `${tid}-msg-${msgIdx}`),
          );
        }
      } catch {
        toast.error("Network error.");
        setThreads((prev) =>
          prev.map((t) =>
            t.id !== tid
              ? t
              : { ...t, messages: t.messages.slice(0, -1), updatedAt: Date.now() },
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, autoReadAloud, speakCoachReply, stopCoachSpeech],
  );

  const setDraft = useCallback(
    (next: string | ((prev: string) => string)) => {
      patchActiveThread((t) => ({
        ...t,
        draft: typeof next === "function" ? next(t.draft) : next,
      }));
    },
    [patchActiveThread],
  );

  const onSubmit = useCallback(() => {
    void sendPayload(draft);
  }, [draft, sendPayload]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  if (!hydrated || !activeThread) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center px-6 py-16 text-sm">
        Loading coach…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-2 pt-1">
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">
            Chats
          </p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="ml-auto shrink-0 gap-1"
            onClick={startNewConversation}
          >
            <Plus className="size-3.5" aria-hidden />
            New
          </Button>
        </div>
        <div className="-mx-1 flex max-h-[92px] min-h-0 flex-col gap-1 overflow-hidden">
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sortedThreads.map((t) => {
              const active = t.id === activeThreadId;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex max-w-[min(200px,72vw)] shrink-0 items-center rounded-xl border transition-colors",
                    active
                      ? "border-primary bg-primary/12"
                      : "border-border bg-muted/25 hover:bg-muted/45",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => switchThread(t.id)}
                    className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-left text-xs font-medium"
                  >
                    {t.title}
                  </button>
                  {threads.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Delete ${t.title}`}
                      className="text-muted-foreground hover:text-destructive shrink-0 px-2 py-1.5"
                      onClick={(e) => deleteThread(t.id, e)}
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setTopicLevelOpen((o) => !o)}
        aria-expanded={topicLevelOpen}
        className="text-muted-foreground flex w-full shrink-0 items-center justify-between gap-2 rounded-lg py-1 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none"
      >
        <span className="text-xs font-medium tracking-wide uppercase">
          Topic & level
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 opacity-80 transition-transform duration-200",
            topicLevelOpen ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>

      {topicLevelOpen ? (
        <>
          <ScrollArea className="min-w-0 w-full shrink-0 [-ms-overflow-style:none] [scrollbar-width:none] [&>[data-slot=scroll-area-scrollbar]]:hidden">
            <div className="flex w-max max-w-none flex-nowrap gap-2 pb-1">
              {COACH_TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTopicChange(t.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    topicId === t.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </ScrollArea>

          <label className="flex shrink-0 flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">
              Your topic{" "}
              <span className="font-normal opacity-80">(optional, any language)</span>
            </span>
            <textarea
              value={customTopic}
              onChange={(e) =>
                patchActiveThread({
                  customTopic: e.target.value.slice(0, CUSTOM_TOPIC_MAX),
                })
              }
              disabled={busy}
              rows={2}
              maxLength={CUSTOM_TOPIC_MAX}
              placeholder="e.g. đàm phán lương · onboarding small talk · RFC feedback…"
              className="border-input placeholder:text-muted-foreground rounded-xl border bg-muted/20 px-3 py-2 text-sm leading-snug outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
            />
          </label>

          <div className="flex shrink-0 gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => handleLevelPick(lv)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-center text-xs font-medium capitalize transition-colors",
                  level === lv
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {lv}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border/80 bg-muted/15">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Pick a preset, add your own topic above if you like, choose a
                level, then type or use the mic. Turn on Auto-read to hear each
                coach reply. Switch chats anytime — history stays on this device.
              </p>
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Suggested opens
                </p>
                <div className="flex flex-col gap-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => void sendPayload(s)}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-left text-sm leading-snug hover:bg-muted/80 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => {
              if (m.role === "user") {
                return (
                  <div
                    key={`${activeThreadId}-u-${idx}`}
                    className="ml-8 rounded-2xl rounded-br-md bg-primary/90 px-3 py-2 text-primary-foreground text-sm leading-relaxed"
                  >
                    {m.content}
                  </div>
                );
              }

              const readToggleKey = `${activeThreadId}-msg-${idx}`;
              const isReadingThis = ttsSourceKey === readToggleKey;

              return (
                <div
                  key={`${activeThreadId}-a-${idx}`}
                  className="mr-6 space-y-2 rounded-2xl rounded-bl-md border border-border bg-background px-3 py-2 text-sm leading-relaxed shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 text-foreground">
                      {renderBoldSegments(m.content)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={cn(
                        "shrink-0",
                        isReadingThis
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary",
                      )}
                      aria-label={
                        isReadingThis ? "Stop reading" : "Read reply aloud"
                      }
                      aria-pressed={isReadingThis}
                      disabled={busy || !speechSynthesisSupported()}
                      onClick={() => {
                        if (isReadingThis) stopCoachSpeech();
                        else speakCoachReply(m.content, readToggleKey);
                      }}
                    >
                      {isReadingThis ? (
                        <Square className="size-4 fill-current" aria-hidden />
                      ) : (
                        <Volume2 className="size-4" aria-hidden />
                      )}
                    </Button>
                  </div>

                  {m.corrections.length > 0 ? (
                    <div className="border-primary/25 bg-primary/5 space-y-2 rounded-xl border px-2 py-2">
                      <p className="text-primary text-xs font-semibold uppercase tracking-wide">
                        Highlights / fixes
                      </p>
                      <ul className="space-y-2">
                        {m.corrections.map((c, j) => (
                          <li key={j} className="text-xs leading-relaxed">
                            <span className="text-destructive line-through decoration-destructive/70">
                              {c.wrong}
                            </span>
                            <span className="text-muted-foreground px-1">
                              →
                            </span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {c.better}
                            </span>
                            {c.why ? (
                              <span className="text-muted-foreground mt-0.5 block">
                                {c.why}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {m.suggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {m.suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() => void sendPayload(s)}
                          className="rounded-full border border-dashed border-border px-2.5 py-1 text-muted-foreground text-xs hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {busy ? (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Coach is thinking…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-border shrink-0 rounded-xl border bg-background p-2 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-2">
          <label className="text-muted-foreground flex items-center gap-1 text-[11px]">
            Mic
            <select
              value={sttLang}
              disabled={listening || busy}
              onChange={(e) =>
                handleSttLangChange(e.target.value as BrowserSpeechLocale)
              }
              className="border-input bg-muted/40 rounded-md border px-1.5 py-1 text-xs outline-none disabled:opacity-50"
            >
              {VOICE_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === "en-US" ? "EN" : "VI"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-muted-foreground flex items-center gap-1 text-[11px]">
            Read
            <select
              value={ttsLang}
              disabled={busy}
              onChange={(e) =>
                handleTtsLangChange(e.target.value as BrowserSpeechLocale)
              }
              className="border-input bg-muted/40 rounded-md border px-1.5 py-1 text-xs outline-none disabled:opacity-50"
            >
              {VOICE_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === "en-US" ? "EN" : "VI"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={autoReadAloud}
              disabled={busy}
              onChange={(e) => handleAutoReadChange(e.target.checked)}
              className="accent-primary size-3.5 rounded border"
            />
            Auto-read
          </label>
          <div className="flex shrink-0 items-center gap-1 sm:ml-auto">
            <Button
              type="button"
              variant={listening ? "default" : "outline"}
              size="sm"
              className="gap-1 px-2"
              disabled={busy}
              aria-pressed={listening}
              aria-label={listening ? "Stop microphone" : "Start microphone"}
              onClick={toggleListening}
            >
              {listening ? (
                <MicOff className="size-4" aria-hidden />
              ) : (
                <Mic className="size-4" aria-hidden />
              )}
              {listening ? "Stop" : "Speak"}
            </Button>
          </div>
        </div>
        <textarea
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write in English… (Shift+Enter for newline)"
          rows={2}
          className="placeholder:text-muted-foreground mb-1 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none disabled:opacity-50"
        />
        {listening ? (
          <p className="text-muted-foreground px-2 pb-2 text-[11px] leading-snug italic">
            {interimVoice.trim() ? interimVoice : "Listening… speak clearly."}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={busy || !draft.trim()}
            onClick={onSubmit}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <SendHorizontal className="size-4" aria-hidden />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
