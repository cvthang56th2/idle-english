import { YOUTUBE_CATEGORY_QUERIES } from "@/lib/youtube/presets";
import type { YoutubeSearchVideo } from "@/lib/youtube/types";

type YoutubeSearchListResponse = {
  items?: Array<{
    id: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  nextPageToken?: string;
  error?: { code?: number; message?: string };
};

function pickThumb(snippet: NonNullable<YoutubeSearchListResponse["items"]>[0]["snippet"]) {
  return (
    snippet?.thumbnails?.high?.url ??
    snippet?.thumbnails?.medium?.url ??
    snippet?.thumbnails?.default?.url ??
    ""
  );
}

export async function searchYoutubeVideos(input: {
  apiKey: string;
  q?: string;
  channelId?: string;
  categoryKey?: string;
  pageToken?: string;
  /** Prefer clips under ~4 minutes (YouTube Data API “short” bucket). */
  videoDuration?: "short" | "medium" | "long" | "any";
}): Promise<
  | { ok: true; items: YoutubeSearchVideo[]; nextPageToken?: string }
  | { ok: false; error: string; details?: string }
> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "12");
  url.searchParams.set("key", input.apiKey);
  url.searchParams.set("relevanceLanguage", "en");
  url.searchParams.set("safeSearch", "moderate");

  const vd =
    input.videoDuration ??
    (input.channelId?.trim() ? "any" : "short");
  if (vd !== "any") {
    url.searchParams.set("videoDuration", vd);
  }

  if (input.channelId?.trim()) {
    url.searchParams.set("channelId", input.channelId.trim());
    url.searchParams.set("order", "date");
  } else {
    let q: string;
    if (input.q?.trim()) {
      q = input.q.trim();
    } else if (
      input.categoryKey &&
      YOUTUBE_CATEGORY_QUERIES[input.categoryKey]
    ) {
      q = YOUTUBE_CATEGORY_QUERIES[input.categoryKey].q;
    } else {
      q = YOUTUBE_CATEGORY_QUERIES.explore.q;
    }
    url.searchParams.set("q", q);
    url.searchParams.set("order", "relevance");
  }

  if (input.pageToken) {
    url.searchParams.set("pageToken", input.pageToken);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    return { ok: false, error: "network", details: "Could not reach YouTube." };
  }

  const json = (await res.json()) as YoutubeSearchListResponse;

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? res.statusText ?? "YouTube API error";
    return {
      ok: false,
      error: "youtube_api",
      details: msg,
    };
  }

  const items: YoutubeSearchVideo[] = [];
  for (const row of json.items ?? []) {
    const id = row.id?.videoId;
    if (!id || !row.snippet) continue;
    items.push({
      videoId: id,
      title: row.snippet.title ?? "Untitled",
      channelTitle: row.snippet.channelTitle ?? "",
      thumbnailUrl: pickThumb(row.snippet),
      publishedAt: row.snippet.publishedAt ?? "",
    });
  }

  return {
    ok: true,
    items,
    nextPageToken: json.nextPageToken,
  };
}
