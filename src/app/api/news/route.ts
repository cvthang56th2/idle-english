import { NEWS_SOURCES } from "@/lib/news-sources";
import { flattenSourceItems, parseFeedXml } from "@/lib/rss-parse";

const SOURCE_PARAM = "sources";

/** Cap per feed so merges stay balanced across sources. */
const MAX_PER_FEED = 16;

async function fetchFeedText(url: string): Promise<string> {
  const res = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(14_000),
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (compatible; IdleEnglish/1.0; +https://idle-english)",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.text();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get(SOURCE_PARAM);
  const wanted = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : NEWS_SOURCES.map((s) => s.id);

  const allowed = new Set(NEWS_SOURCES.map((s) => s.id));
  const filteredIds = wanted.filter((id) => allowed.has(id));
  const sourceList =
    filteredIds.length > 0
      ? NEWS_SOURCES.filter((s) => filteredIds.includes(s.id))
      : NEWS_SOURCES;

  const failures: Record<string, string> = {};
  const buckets = await Promise.all(
    sourceList.map(async (src) => {
      try {
        const xml = await fetchFeedText(src.feedUrl);
        const parsed = parseFeedXml(xml);
        const items = flattenSourceItems(src, parsed).slice(0, MAX_PER_FEED);
        return items;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown_error";
        failures[src.id] = msg;
        return [];
      }
    }),
  );

  const merged = buckets.flat();

  /** Stable sort: newest known date first; undated last. */
  merged.sort((a, b) => {
    const ad = a.publishedAt ?? 0;
    const bd = b.publishedAt ?? 0;
    if (bd !== ad) return bd - ad;
    return a.title.localeCompare(b.title);
  });

  const seen = new Set<string>();
  const deduped: typeof merged = [];
  for (const row of merged) {
    try {
      const canon = new URL(row.link).href;
      if (seen.has(canon)) continue;
      seen.add(canon);
      deduped.push({ ...row, link: canon });
    } catch {
      /* skip bad URLs */
    }
  }

  return Response.json(
    {
      items: deduped.slice(0, 80),
      failures: Object.keys(failures).length ? failures : undefined,
      fetchedAt: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}
