"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  IDLE_SPEECH_VOICE_PREFS_CHANGED,
  readSpeechVoicePreferences,
  writeSpeechVoicePreferences,
} from "@/lib/speech-voice-preferences-storage";
import { cn } from "@/lib/utils";
import {
  prefetchSpeechVoices,
  speechSynthesisSupported,
  speakText,
} from "@/lib/web-speech";

function normalizeLangTag(lang: string): string {
  return lang.replace("_", "-").toLowerCase();
}

function filterVoicesByLangPrefix(
  voices: SpeechSynthesisVoice[],
  prefix: string,
): SpeechSynthesisVoice[] {
  const p = prefix.toLowerCase();
  return [...voices]
    .filter((v) => normalizeLangTag(v.lang).startsWith(p))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function SpeechVoiceSettings() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [prefs, setPrefs] = useState(() => readSpeechVoicePreferences());

  const refreshVoices = useCallback(() => {
    if (!speechSynthesisSupported()) return;
    setVoices([...window.speechSynthesis.getVoices()]);
  }, []);

  useEffect(() => {
    prefetchSpeechVoices();
    const id = window.setTimeout(() => refreshVoices(), 0);
    if (!speechSynthesisSupported()) {
      return () => window.clearTimeout(id);
    }
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.clearTimeout(id);
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        refreshVoices,
      );
    };
  }, [refreshVoices]);

  useEffect(() => {
    function bump() {
      setPrefs(readSpeechVoicePreferences());
    }
    window.addEventListener(IDLE_SPEECH_VOICE_PREFS_CHANGED, bump);
    return () =>
      window.removeEventListener(IDLE_SPEECH_VOICE_PREFS_CHANGED, bump);
  }, []);

  const enVoices = useMemo(
    () => filterVoicesByLangPrefix(voices, "en"),
    [voices],
  );
  const viVoices = useMemo(
    () => filterVoicesByLangPrefix(voices, "vi"),
    [voices],
  );

  const selectClass = cn(
    "mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-base",
    "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35",
  );

  if (!speechSynthesisSupported()) {
    return (
      <section className="rounded-[26px] border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Reading
        </p>
        <p className="mt-2 text-lg font-semibold leading-snug">
          Read-aloud voice
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This browser does not support speech synthesis, so voice selection is
          unavailable.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[26px] border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Reading
      </p>
      <p className="mt-2 text-lg font-semibold leading-snug">
        Read-aloud voices
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick voices for English and Vietnamese text-to-speech (lessons and
        Coach read-aloud). “Automatic” matches your system default for each
        language.
      </p>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <label htmlFor="idle-voice-en" className="text-sm font-medium">
            English (en-US)
          </label>
          <select
            id="idle-voice-en"
            className={selectClass}
            value={prefs.enVoiceUri}
            disabled={!voices.length}
            onChange={(e) =>
              startTransition(() => {
                const next = { ...prefs, enVoiceUri: e.target.value };
                writeSpeechVoicePreferences(next);
                setPrefs(readSpeechVoicePreferences());
              })
            }
          >
            <option value="">Automatic</option>
            {enVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
                {v.localService ? " · offline" : ""}
              </option>
            ))}
          </select>
          {!enVoices.length && voices.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No English voices reported by the browser — Automatic still uses
              the best match available.
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-9 rounded-xl text-xs"
            disabled={!voices.length}
            onClick={() => {
              speakText("Hello — this is your English preview.", "en-US", {
                voiceUri: prefs.enVoiceUri || null,
              });
            }}
          >
            Preview English
          </Button>
        </div>

        <div>
          <label htmlFor="idle-voice-vi" className="text-sm font-medium">
            Vietnamese (vi-VN)
          </label>
          <select
            id="idle-voice-vi"
            className={selectClass}
            value={prefs.viVoiceUri}
            disabled={!voices.length}
            onChange={(e) =>
              startTransition(() => {
                const next = { ...prefs, viVoiceUri: e.target.value };
                writeSpeechVoicePreferences(next);
                setPrefs(readSpeechVoicePreferences());
              })
            }
          >
            <option value="">Automatic</option>
            {viVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
                {v.localService ? " · offline" : ""}
              </option>
            ))}
          </select>
          {!viVoices.length && voices.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No Vietnamese voices listed — install a vi voice in system settings
              if your platform supports it, or keep Automatic.
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-9 rounded-xl text-xs"
            disabled={!voices.length}
            onClick={() => {
              speakText(
                "Xin chào — đây là giọng đọc bạn đã chọn.",
                "vi-VN",
                {
                  voiceUri: prefs.viVoiceUri || null,
                },
              );
            }}
          >
            Preview Vietnamese
          </Button>
        </div>
      </div>

      {!voices.length ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Loading voices… If this stays empty, try again after a short pause
          (some browsers load them asynchronously).
        </p>
      ) : null}
    </section>
  );
}
