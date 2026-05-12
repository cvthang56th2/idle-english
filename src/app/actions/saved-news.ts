"use server";

import { revalidatePath } from "next/cache";

import type { SavedNewsSnapshot } from "@/types/saved-news";
import { isSupabaseConfigured } from "@/lib/env";
import { getNewsSource, NEWS_SOURCE_IDS } from "@/lib/news-sources";
import { createServerSupabase } from "@/lib/supabase/server";

const URL_MAX = 2048;

function isHttpsUrl(candidate: string) {
  if (candidate.length < 10 || candidate.length > URL_MAX) return false;
  try {
    const u = new URL(candidate);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function toggleSavedNews(
  snapshot: Omit<SavedNewsSnapshot, "savedAt">,
  saved: boolean,
) {
  if (!isHttpsUrl(snapshot.articleUrl)) {
    return { ok: false as const, error: "invalid_url" as const };
  }
  const titleTrim = snapshot.title.trim();
  if (!titleTrim || titleTrim.length > 512) {
    return { ok: false as const, error: "invalid_title" as const };
  }
  if (!NEWS_SOURCE_IDS.has(snapshot.sourceId)) {
    return { ok: false as const, error: "invalid_source" as const };
  }

  const def = getNewsSource(snapshot.sourceId);
  const sourceLabelFinal = (
    snapshot.sourceLabel?.trim() || def?.label ||
    snapshot.sourceId
  ).slice(0, 256);

  if (!isSupabaseConfigured()) {
    return { ok: true as const, persisted: "local" as const };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: true as const, persisted: "local" as const };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true as const, persisted: "local" as const };
  }

  const publishedISO =
    snapshot.publishedAt != null &&
    Number.isFinite(snapshot.publishedAt)
      ? new Date(snapshot.publishedAt).toISOString()
      : null;

  if (saved) {
    const { error } = await supabase.from("saved_news").upsert(
      {
        user_id: user.id,
        article_url: snapshot.articleUrl,
        title: titleTrim,
        source_id: snapshot.sourceId,
        source_label: sourceLabelFinal,
        published_at: publishedISO,
      },
      { onConflict: "user_id,article_url" },
    );
    if (error) {
      return { ok: false as const, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("saved_news")
      .delete()
      .eq("user_id", user.id)
      .eq("article_url", snapshot.articleUrl);
    if (error) {
      return { ok: false as const, error: error.message };
    }
  }

  revalidatePath("/saved");
  return { ok: true as const, persisted: "remote" as const };
}

export async function fetchSavedNewsRows(): Promise<SavedNewsSnapshot[]> {
  const load = async (): Promise<SavedNewsSnapshot[]> => {
    if (!isSupabaseConfigured()) return [];

    const supabase = await createServerSupabase();
    if (!supabase) return [];

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("saved_news")
      .select(
        "article_url, title, source_id, source_label, published_at, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => ({
      articleUrl: row.article_url as string,
      title: row.title as string,
      sourceId: row.source_id as string,
      sourceLabel: row.source_label as string,
      publishedAt:
        row.published_at != null
          ? new Date(row.published_at as string).getTime()
          : null,
      savedAt: new Date(row.created_at as string).getTime(),
    }));
  };

  return Promise.race([
    load().catch(() => []),
    new Promise<SavedNewsSnapshot[]>((resolve) =>
      setTimeout(() => resolve([]), 6000),
    ),
  ]);
}
