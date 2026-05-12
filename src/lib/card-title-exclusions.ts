import type { LessonCard } from "@/types/card";

/** Bound payload size for `/api/cards/generate` — newest-first while scanning the feed. */
const DEFAULT_LIMIT = 48;
const TITLE_CHARS_MAX = 160;

/** Distinct trimmed titles (case-insensitive), biased toward cards nearer the end of `cards`. */
export function collectExcludeTitles(
  cards: LessonCard[],
  limit = DEFAULT_LIMIT,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = cards.length - 1; i >= 0 && out.length < limit; i--) {
    const c = cards[i]!;
    const raw = typeof c.title === "string" ? c.title.trim() : "";
    if (!raw) continue;
    const t = raw.slice(0, TITLE_CHARS_MAX);
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
