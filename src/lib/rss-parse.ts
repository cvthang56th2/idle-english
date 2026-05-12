import type { NewsSourceDef } from "@/lib/news-sources";

export type ParsedFeedItem = {
  title: string;
  link: string;
  pubDate?: string;
  summary?: string;
};

const HTTP_URL_RE =
  /^https?:\/\/[\w\-._~:?#[\]/@!$&'()*+,;=%]+$/i;

function stripCdata(inner: string) {
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i.exec(inner.trim());
  return m?.[1] ?? inner;
}

/** Pull first tag contents (RSS 2.0), tolerant of nested tags by non-greedy inner match. */
function firstTag(block: string, tag: string): string | undefined {
  const open = String.raw`<${tag}`;
  const i = block.toLowerCase().indexOf(open.toLowerCase());
  if (i < 0) return undefined;
  const gt = block.indexOf(">", i);
  if (gt < 0) return undefined;
  const start = gt + 1;
  const close = block.toLowerCase().indexOf(`</${tag.toLowerCase()}>`, start);
  if (close < 0) return undefined;
  const raw = block.slice(start, close).trim();
  return decodeXmlEntities(stripCdata(raw).trim()) || undefined;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/gi, " ");
}

/** Item blocks from RSS or Atom-ish `<entry>...</entry>` (best-effort). */
function sliceItems(xml: string): string[] {
  const rss = /<item\b[\s\S]*?<\/item>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rss.exec(xml)) !== null) {
    out.push(m[0]);
  }
  if (out.length) return out;

  const atom = /<entry\b[\s\S]*?<\/entry>/gi;
  while ((m = atom.exec(xml)) !== null) {
    out.push(m[0]);
  }
  return out;
}

/** Atom `<link href="..."/>`, prefer **rel=\"alternate\"**. */
function atomLinkHref(block: string): string | undefined {
  let fallback: string | undefined;
  const it = block.matchAll(/<link\b([^>]*)\/?>/gi);
  for (const m of it) {
    const attrs = m[1] ?? "";
    const hrefM =
      /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const raw = hrefM?.[2] ?? hrefM?.[3];
    if (!raw?.trim()) continue;
    const href = decodeXmlEntities(raw).trim();
    if (!HTTP_URL_RE.test(href)) continue;
    const relPart =
      /\brel\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const rel = (relPart?.[2] ?? relPart?.[3])?.toLowerCase() ?? "";
    if (rel === "alternate") return href;
    fallback = fallback ?? href;
  }
  return fallback;
}

function cleanSummary(htmlish: string) {
  const text = decodeXmlEntities(
    stripCdata(htmlish)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  return text.length > 240 ? `${text.slice(0, 237)}…` : text || undefined;
}

export function parseFeedXml(xml: string): ParsedFeedItem[] {
  const blocks = sliceItems(xml);
  const parsed: ParsedFeedItem[] = [];
  for (const block of blocks) {
    let link =
      firstTag(block, "link") ??
      atomLinkHref(block) ??
      firstTag(block, "guid");

    link = link?.trim();
    if (link && !HTTP_URL_RE.test(link)) continue;

    const title =
      firstTag(block, "title") ??
      "";
    const pubDate =
      firstTag(block, "pubDate") ?? firstTag(block, "published");
    const dcDate = firstTag(block, "dc:date"); // NPR namespace
    const effectiveDate = pubDate ?? dcDate;
    let summary =
      firstTag(block, "description") ??
      firstTag(block, "media:description") ??
      firstTag(block, "content:encoded") ??
      firstTag(block, "summary");

    summary = summary ? cleanSummary(summary) : undefined;

    if (!link || !title.trim()) continue;
    parsed.push({
      title: title.trim(),
      link: link.trim(),
      pubDate: effectiveDate ?? undefined,
      summary,
    });
  }
  return parsed;
}

export type NewsArticleDto = ParsedFeedItem & {
  sourceId: string;
  sourceLabel: string;
  /** epoch ms when parseable */
  publishedAt: number | null;
};

/** Parse millis from RFC 822-ish pubDate strings. */
export function parsedPubDate(pubDate?: string): number | null {
  if (!pubDate) return null;
  const t = Date.parse(pubDate.trim());
  return Number.isFinite(t) ? t : null;
}

export function flattenSourceItems(
  source: NewsSourceDef,
  parsed: ParsedFeedItem[],
): NewsArticleDto[] {
  const out: NewsArticleDto[] = [];
  for (const p of parsed) {
    const publishedAt = parsedPubDate(p.pubDate);
    out.push({
      ...p,
      sourceId: source.id,
      sourceLabel: source.label,
      publishedAt,
    });
  }
  return out;
}
