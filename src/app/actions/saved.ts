"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(id: string) {
  return UUID_RE.test(id);
}

export async function toggleSaved(cardId: string, saved: boolean) {
  if (!isUuid(cardId)) {
    return { ok: true as const, persisted: "local" as const };
  }

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

  if (saved) {
    const { error } = await supabase.from("saved_cards").upsert(
      { user_id: user.id, card_id: cardId },
      { onConflict: "user_id,card_id" },
    );
    if (error) {
      return { ok: false as const, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("saved_cards")
      .delete()
      .eq("user_id", user.id)
      .eq("card_id", cardId);
    if (error) {
      return { ok: false as const, error: error.message };
    }
  }

  revalidatePath("/saved");
  return { ok: true as const, persisted: "remote" as const };
}

export async function fetchSavedIds(): Promise<string[]> {
  const load = async (): Promise<string[]> => {
    if (!isSupabaseConfigured()) return [];

    const supabase = await createServerSupabase();
    if (!supabase) return [];

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("saved_cards")
      .select("card_id")
      .eq("user_id", user.id);

    if (error || !data) return [];
    return data.map((row) => row.card_id as string);
  };

  return Promise.race([
    load().catch(() => []),
    new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 6000)),
  ]);
}
