import type { CoachTopicId } from "@/data/coach-topics";
import { COACH_TOPICS } from "@/data/coach-topics";
import type { LearnerLevel } from "@/types/card";

export type StoredCoachCorrection = {
  wrong: string;
  better: string;
  why?: string;
};

export type StoredCoachMsg =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      corrections: StoredCoachCorrection[];
      suggestions: string[];
    };

export type CoachChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  topicId: CoachTopicId;
  customTopic: string;
  level: LearnerLevel;
  messages: StoredCoachMsg[];
  draft: string;
};

export type CoachPersistedBundle = {
  version: 1;
  activeThreadId: string;
  threads: CoachChatThread[];
};

const STORAGE_KEY = "idle_coach_sessions_v1";
export const COACH_THREADS_MAX = 40;

function isCoachTopicId(v: unknown): v is CoachTopicId {
  return typeof v === "string" && COACH_TOPICS.some((t) => t.id === v);
}

function isLearnerLevel(v: unknown): v is LearnerLevel {
  return v === "beginner" || v === "intermediate" || v === "advanced";
}

function normalizeMsg(raw: unknown): StoredCoachMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.role === "user" && typeof r.content === "string") {
    return { role: "user", content: r.content };
  }
  if (r.role === "assistant" && typeof r.content === "string") {
    const corrections = Array.isArray(r.corrections)
      ? r.corrections
          .map((c) => {
            if (!c || typeof c !== "object") return null;
            const x = c as Record<string, unknown>;
            if (typeof x.wrong !== "string" || typeof x.better !== "string") return null;
            const why =
              typeof x.why === "string" && x.why.trim() ? x.why.trim() : undefined;
            return { wrong: x.wrong, better: x.better, ...(why ? { why } : {}) };
          })
          .filter(Boolean)
      : [];
    const suggestions = Array.isArray(r.suggestions)
      ? r.suggestions.filter((s): s is string => typeof s === "string")
      : [];
    return {
      role: "assistant",
      content: r.content,
      corrections: corrections as StoredCoachCorrection[],
      suggestions,
    };
  }
  return null;
}

function normalizeThread(raw: unknown): CoachChatThread | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id.trim()) return null;
  if (!isCoachTopicId(t.topicId)) return null;
  if (!isLearnerLevel(t.level)) return null;
  const messagesRaw = Array.isArray(t.messages) ? t.messages : [];
  const messages = messagesRaw.map(normalizeMsg).filter(Boolean) as StoredCoachMsg[];
  const draft = typeof t.draft === "string" ? t.draft : "";
  const customTopic = typeof t.customTopic === "string" ? t.customTopic : "";
  const title =
    typeof t.title === "string" && t.title.trim()
      ? t.title.trim().slice(0, 80)
      : deriveThreadTitle(messages);
  const updatedAt =
    typeof t.updatedAt === "number" && Number.isFinite(t.updatedAt)
      ? t.updatedAt
      : Date.now();

  return {
    id: t.id.trim(),
    title,
    updatedAt,
    topicId: t.topicId,
    customTopic,
    level: t.level,
    messages,
    draft,
  };
}

/** Parse thread JSON (localStorage row or camelCase DB projection) */
export function parseCoachThread(raw: unknown): CoachChatThread | null {
  return normalizeThread(raw);
}

export function mergeCoachBundles(
  local: CoachPersistedBundle | null,
  remote: CoachPersistedBundle | null,
  defaultLevel: LearnerLevel,
): CoachPersistedBundle {
  if (!remote?.threads?.length) {
    if (local?.threads?.length) {
      const threads = trimThreads(local.threads);
      let activeThreadId = local.activeThreadId;
      if (!threads.some((t) => t.id === activeThreadId)) {
        activeThreadId = threads[0]!.id;
      }
      return { version: 1, activeThreadId, threads };
    }
    const t = createCoachThread(defaultLevel);
    return { version: 1, activeThreadId: t.id, threads: [t] };
  }

  if (!local?.threads?.length) {
    const threads = trimThreads(remote.threads);
    let activeThreadId = remote.activeThreadId;
    if (!threads.some((t) => t.id === activeThreadId)) {
      activeThreadId = threads[0]!.id;
    }
    return { version: 1, activeThreadId, threads };
  }

  const map = new Map<string, CoachChatThread>();
  for (const t of local.threads) map.set(t.id, t);
  for (const t of remote.threads) {
    const prev = map.get(t.id);
    if (!prev || t.updatedAt > prev.updatedAt) {
      map.set(t.id, t);
    }
  }

  const threads = trimThreads([...map.values()]);

  let activeThreadId = remote.activeThreadId;
  if (!activeThreadId || !threads.some((x) => x.id === activeThreadId)) {
    activeThreadId = local.activeThreadId;
  }
  if (!activeThreadId || !threads.some((x) => x.id === activeThreadId)) {
    activeThreadId = threads[0]!.id;
  }

  return { version: 1, activeThreadId, threads };
}

export function deriveThreadTitle(messages: StoredCoachMsg[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser || typeof firstUser.content !== "string") return "New chat";
  const s = firstUser.content.trim().replace(/\s+/g, " ");
  if (!s) return "New chat";
  return s.length > 52 ? `${s.slice(0, 52)}…` : s;
}

export function createCoachThread(level: LearnerLevel): CoachChatThread {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `coach_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    title: "New chat",
    updatedAt: Date.now(),
    topicId: "small_talk",
    customTopic: "",
    level,
    messages: [],
    draft: "",
  };
}

export function trimThreads(list: CoachChatThread[]): CoachChatThread[] {
  if (list.length <= COACH_THREADS_MAX) return list;
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.slice(0, COACH_THREADS_MAX);
}

export function loadCoachPersisted(): CoachPersistedBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.version !== 1) return null;
    const activeThreadId =
      typeof o.activeThreadId === "string" ? o.activeThreadId.trim() : "";
    const threadsRaw = Array.isArray(o.threads) ? o.threads : [];
    const threads = threadsRaw
      .map(normalizeThread)
      .filter(Boolean) as CoachChatThread[];

    if (!threads.length || !activeThreadId) return null;
    if (!threads.some((t) => t.id === activeThreadId)) return null;

    return { version: 1, activeThreadId, threads };
  } catch {
    return null;
  }
}

export function saveCoachPersisted(bundle: CoachPersistedBundle): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    /* quota */
  }
}
