import { isYoutubeConfigured } from "@/lib/env";
import {
  isYoutubeSearchOrder,
  searchYoutubeVideos,
} from "@/lib/youtube/search-server";

function parsePublishedAfterParam(raw: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const s = raw.trim();
  if (s.length > 36) return undefined;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return undefined;
  if (t < Date.UTC(2005, 0, 1) || t > Date.now() + 60_000) return undefined;
  return new Date(t).toISOString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (!isYoutubeConfigured()) {
    return Response.json(
      {
        ok: false as const,
        error: "missing_key" as const,
        message:
          "Add YOUTUBE_API_KEY to .env.local — create a YouTube Data API v3 key in Google Cloud Console.",
        items: [] as [],
        nextPageToken: undefined as undefined,
      },
      { status: 200 },
    );
  }

  const q = searchParams.get("q")?.trim() || undefined;
  const channelId = searchParams.get("channelId")?.trim() || undefined;
  const category = searchParams.get("category")?.trim() || undefined;
  const pageToken = searchParams.get("pageToken")?.trim() || undefined;
  const rawDuration = searchParams.get("duration")?.trim();
  const videoDuration =
    rawDuration === "any" ||
    rawDuration === "short" ||
    rawDuration === "medium" ||
    rawDuration === "long"
      ? rawDuration
      : undefined;

  const rawOrder = searchParams.get("order")?.trim();
  const order =
    rawOrder && isYoutubeSearchOrder(rawOrder) ? rawOrder : undefined;

  const publishedAfter = parsePublishedAfterParam(
    searchParams.get("publishedAfter"),
  );

  const apiKey = process.env.YOUTUBE_API_KEY!.trim();
  const result = await searchYoutubeVideos({
    apiKey,
    q,
    channelId,
    categoryKey: category,
    pageToken,
    videoDuration,
    order,
    publishedAfter,
  });

  if (!result.ok) {
    const message =
      result.error === "youtube_quota"
        ? "YouTube Data API quota for this key is exhausted (search.list costs 100 units per call on the free tier). Quota resets daily, or create another API key in a Google Cloud project and set YOUTUBE_API_KEY in .env.local. Check usage: Google Cloud Console → APIs & Services → YouTube Data API v3 → Quotas."
        : (result.details ?? "YouTube API failed.");
    return Response.json(
      {
        ok: false as const,
        error: result.error,
        message,
        items: [] as [],
        nextPageToken: undefined as undefined,
      },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true as const,
    items: result.items,
    nextPageToken: result.nextPageToken,
  });
}
