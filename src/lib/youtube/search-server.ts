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

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function isQuotaExceededMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("quota") && (m.includes("exceed") || m.includes("exceeded"));
}

function pickThumb(snippet: NonNullable<YoutubeSearchListResponse["items"]>[0]["snippet"]) {
  return (
    snippet?.thumbnails?.high?.url ??
    snippet?.thumbnails?.medium?.url ??
    snippet?.thumbnails?.default?.url ??
    ""
  );
}

const YOUTUBE_SEARCH_ORDERS = [
  "date",
  "rating",
  "relevance",
  "title",
  "viewCount",
] as const;

export type YoutubeSearchOrder = (typeof YOUTUBE_SEARCH_ORDERS)[number];

export function isYoutubeSearchOrder(v: string): v is YoutubeSearchOrder {
  return (YOUTUBE_SEARCH_ORDERS as readonly string[]).includes(v);
}

export async function searchYoutubeVideos(input: {
  apiKey: string;
  q?: string;
  channelId?: string;
  categoryKey?: string;
  pageToken?: string;
  /** Prefer clips under ~4 minutes (YouTube Data API “short” bucket). */
  videoDuration?: "short" | "medium" | "long" | "any";
  /** When omitted, channel searches default to `date`, else `relevance`. */
  order?: YoutubeSearchOrder;
  /** RFC 3339 — only videos published at or after this instant (search.list). */
  publishedAfter?: string;
}): Promise<
  | { ok: true; items: YoutubeSearchVideo[]; nextPageToken?: string }
  | {
      ok: false;
      error: "network" | "youtube_api" | "youtube_quota";
      details?: string;
    }
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

  const defaultOrder: YoutubeSearchOrder = input.channelId?.trim()
    ? "date"
    : "relevance";
  const order = input.order ?? defaultOrder;
  url.searchParams.set("order", order);

  if (input.channelId?.trim()) {
    url.searchParams.set("channelId", input.channelId.trim());
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
  }

  if (input.pageToken) {
    url.searchParams.set("pageToken", input.pageToken);
  }

  const pa = input.publishedAfter?.trim();
  if (pa) {
    url.searchParams.set("publishedAfter", pa);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    return { ok: false, error: "network", details: "Could not reach YouTube." };
  }

  const json = (await res.json()) as YoutubeSearchListResponse;

  if (!res.ok || json.error) {
    const raw = json.error?.message ?? res.statusText ?? "YouTube API error";
    const clean = stripHtmlTags(raw);
    const quota = isQuotaExceededMessage(clean) || isQuotaExceededMessage(raw);
    return {
      ok: false,
      error: quota ? "youtube_quota" : "youtube_api",
      details: clean,
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
