import { isYoutubeConfigured } from "@/lib/env";
import { searchYoutubeVideos } from "@/lib/youtube/search-server";

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

  const apiKey = process.env.YOUTUBE_API_KEY!.trim();
  const result = await searchYoutubeVideos({
    apiKey,
    q,
    channelId,
    categoryKey: category,
    pageToken,
    videoDuration,
  });

  if (!result.ok) {
    return Response.json(
      {
        ok: false as const,
        error: result.error,
        message: result.details ?? "YouTube API failed.",
        items: [],
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
