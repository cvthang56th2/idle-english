"use server";

import { revalidatePath } from "next/cache";

import type { CoachPersistedBundle } from "@/lib/coach-chat-storage";
import {
  COACH_THREADS_MAX,
  parseCoachThread,
  trimThreads,
} from "@/lib/coach-chat-storage";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

const MSG_MAX = 120;
const MSG_CONTENT_MAX = 12000;
const DRAFT_MAX = 8000;
const TITLE_MAX = 80;
const CUSTOM_TOPIC_MAX = 400;

export type CoachRemoteState = {
  authenticated: boolean;
  /** Null when not signed in or no Supabase — do not overwrite local-only data */
  bundle: CoachPersistedBundle | null;
};

function clampBundle(bundle: CoachPersistedBundle): CoachPersistedBundle {
  const threads = trimThreads(bundle.threads).map((t) => ({
    ...t,
    title: t.title.slice(0, TITLE_MAX),
    customTopic: t.customTopic.slice(0, CUSTOM_TOPIC_MAX),
    draft: t.draft.slice(0, DRAFT_MAX),
    messages: t.messages.slice(-MSG_MAX).map((m) => {
      if (m.role === "user") {
        return { ...m, content: m.content.slice(0, MSG_CONTENT_MAX) };
      }
      return {
        ...m,
        content: m.content.slice(0, MSG_CONTENT_MAX),
        suggestions: m.suggestions.map((s) => s.slice(0, 500)).slice(0, 12),
        corrections: m.corrections.slice(0, 8).map((c) => ({
          wrong: c.wrong.slice(0, 500),
          better: c.better.slice(0, 500),
          ...(c.why ? { why: c.why.slice(0, 500) } : {}),
        })),
      };
    }),
  }));

  let activeThreadId = bundle.activeThreadId.trim();
  if (!threads.some((t) => t.id === activeThreadId)) {
    activeThreadId = threads[0]?.id ?? "";
  }

  return { version: 1, activeThreadId, threads };
}

export async function fetchCoachChatRemote(): Promise<CoachRemoteState> {
  if (!isSupabaseConfigured()) {
    return { authenticated: false, bundle: null };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return { authenticated: false, bundle: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { authenticated: false, bundle: null };
  }

  const load = async (): Promise<CoachPersistedBundle | null> => {
    const [threadsRes, prefsRes] = await Promise.all([
      supabase
        .from("coach_chat_threads")
        .select(
          "id, title, topic_id, custom_topic, level, draft, messages, updated_at",
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(COACH_THREADS_MAX + 8),
      supabase
        .from("coach_chat_prefs")
        .select("active_thread_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const rows = threadsRes.data;
    if (threadsRes.error || !rows?.length) {
      return null;
    }

    const threads = rows
      .map((row) =>
        parseCoachThread({
          id: row.id,
          title: row.title,
          topicId: row.topic_id,
          customTopic: row.custom_topic,
          level: row.level,
          draft: row.draft,
          messages: row.messages,
          updatedAt: row.updated_at
            ? new Date(row.updated_at as string).getTime()
            : Date.now(),
        }),
      )
      .filter(Boolean) as NonNullable<ReturnType<typeof parseCoachThread>>[];

    const trimmed = trimThreads(threads);
    let activeThreadId =
      typeof prefsRes.data?.active_thread_id === "string"
        ? prefsRes.data.active_thread_id.trim()
        : "";

    if (!trimmed.some((t) => t.id === activeThreadId)) {
      activeThreadId = trimmed[0]?.id ?? "";
    }

    if (!activeThreadId || !trimmed.length) return null;

    return { version: 1, activeThreadId, threads: trimmed };
  };

  try {
    const raced = await Promise.race([
      load(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    return { authenticated: true, bundle: raced };
  } catch {
    return { authenticated: true, bundle: null };
  }
}

export async function syncCoachChatBundle(
  bundle: CoachPersistedBundle,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "no_supabase" };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return { ok: false, error: "no_client" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "no_user" };
  }

  const safe = clampBundle(bundle);
  const nextIds = new Set(safe.threads.map((t) => t.id));

  const { data: existingRows, error: existingErr } = await supabase
    .from("coach_chat_threads")
    .select("id")
    .eq("user_id", user.id);

  if (existingErr) {
    return { ok: false, error: existingErr.message };
  }

  const existingIds = new Set(
    (existingRows ?? []).map((r) => r.id as string),
  );
  const toRemove = [...existingIds].filter((id) => !nextIds.has(id));

  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from("coach_chat_threads")
      .delete()
      .eq("user_id", user.id)
      .in("id", toRemove);

    if (delErr) {
      return { ok: false, error: delErr.message };
    }
  }

  const nowIso = new Date().toISOString();
  const upsertRows = safe.threads.map((t) => ({
    user_id: user.id,
    id: t.id,
    title: t.title.slice(0, TITLE_MAX),
    topic_id: t.topicId,
    custom_topic: t.customTopic.slice(0, CUSTOM_TOPIC_MAX),
    level: t.level,
    draft: t.draft.slice(0, DRAFT_MAX),
    messages: t.messages,
    updated_at: new Date(t.updatedAt).toISOString(),
  }));

  if (upsertRows.length > 0) {
    const { error: upErr } = await supabase
      .from("coach_chat_threads")
      .upsert(upsertRows, { onConflict: "user_id,id" });

    if (upErr) {
      return { ok: false, error: upErr.message };
    }
  }

  const active =
    safe.activeThreadId && nextIds.has(safe.activeThreadId)
      ? safe.activeThreadId
      : [...nextIds][0] ?? null;

  const { error: prefErr } = await supabase.from("coach_chat_prefs").upsert(
    {
      user_id: user.id,
      active_thread_id: active,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );

  if (prefErr) {
    return { ok: false, error: prefErr.message };
  }

  revalidatePath("/coach");
  return { ok: true };
}
