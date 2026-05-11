"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

const DAY_MS = 86_400_000;

function utcDayStart(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export async function pingLearnSession() {
  if (!isSupabaseConfigured()) {
    return { ok: true as const, persisted: "local" as const };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return { ok: true as const, persisted: "local" as const };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "no_user" as const };
  }

  const now = new Date();
  const today = utcDayStart(now);

  const { data: existing, error: readError } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    return { ok: false as const, error: readError.message };
  }

  let xp = existing?.xp ?? 0;
  let streak = existing?.streak ?? 0;
  const lastLearned = existing?.last_learned_at
    ? new Date(existing.last_learned_at as string)
    : null;
  const lastDay = lastLearned ? utcDayStart(lastLearned) : null;

  xp += 5;

  if (!lastDay) {
    streak = 1;
  } else if (today === lastDay) {
    /* same day — keep streak */
  } else if (today - lastDay === DAY_MS) {
    streak += 1;
  } else if (today - lastDay > DAY_MS) {
    streak = 1;
  }

  const payload = {
    user_id: user.id,
    xp,
    streak,
    last_learned_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("user_progress")
    .upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    return { ok: false as const, error: upsertError.message };
  }

  revalidatePath("/profile");
  return {
    ok: true as const,
    persisted: "remote" as const,
    xp,
    streak,
  };
}

export async function fetchProgress(): Promise<{
  xp: number;
  streak: number;
  lastLearnedAt: string | null;
}> {
  const zero = { xp: 0, streak: 0, lastLearnedAt: null as string | null };

  if (!isSupabaseConfigured()) return zero;

  const supabase = await createServerSupabase();
  if (!supabase) return zero;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return zero;

  const { data } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return zero;

  return {
    xp: data.xp ?? 0,
    streak: data.streak ?? 0,
    lastLearnedAt: data.last_learned_at ?? null,
  };
}
