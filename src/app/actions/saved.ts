"use server";

import { revalidatePath } from "next/cache";

import type { SavedShortSnapshot } from "@/types/saved-short";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** YouTube video ids are usually 11 chars; allow a slightly wider range for API drift. */
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{6,32}$/;

function isUuid(id: string) {
  return UUID_RE.test(id);
}

function isYoutubeVideoId(id: string) {
  return YOUTUBE_VIDEO_ID_RE.test(id);
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

export async function toggleSavedShort(
  payload: Omit<SavedShortSnapshot, "savedAt">,
  saved: boolean,
) {
  if (!isYoutubeVideoId(payload.videoId)) {
    return { ok: false as const, error: "invalid_video" as const };
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
    return { ok: true as const, persisted: "local" as const };
  }

  if (saved) {
    const { error } = await supabase.from("saved_shorts").upsert(
      {
        user_id: user.id,
        video_id: payload.videoId,
        title: payload.title,
        channel_title: payload.channelTitle,
        thumbnail_url: payload.thumbnailUrl,
      },
      { onConflict: "user_id,video_id" },
    );
    if (error) {
      return { ok: false as const, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("saved_shorts")
      .delete()
      .eq("user_id", user.id)
      .eq("video_id", payload.videoId);
    if (error) {
      return { ok: false as const, error: error.message };
    }
  }

  revalidatePath("/saved");
  return { ok: true as const, persisted: "remote" as const };
}

export async function fetchSavedShortRows(): Promise<SavedShortSnapshot[]> {
  const load = async (): Promise<SavedShortSnapshot[]> => {
    if (!isSupabaseConfigured()) return [];

    const supabase = await createServerSupabase();
    if (!supabase) return [];

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("saved_shorts")
      .select("video_id, title, channel_title, thumbnail_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => ({
      videoId: row.video_id as string,
      title: row.title as string,
      channelTitle: row.channel_title as string,
      thumbnailUrl: (row.thumbnail_url as string) ?? "",
      savedAt: new Date(row.created_at as string).getTime(),
    }));
  };

  return Promise.race([
    load().catch(() => []),
    new Promise<SavedShortSnapshot[]>((resolve) =>
      setTimeout(() => resolve([]), 6000),
    ),
  ]);
}
