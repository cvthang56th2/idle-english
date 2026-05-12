import type { SavedNewsSnapshot } from "@/types/saved-news";

const SAVED_NEWS_KEY = "idle_saved_news_v1";

export const IDLE_SAVED_NEWS_CHANGED = "idle-saved-news-changed";

export type IdleSavedNewsChangedDetail = {
  removedUrl?: string;
  addedUrl?: string;
};

function notifyNewsChanged(detail: IdleSavedNewsChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(IDLE_SAVED_NEWS_CHANGED, { detail }),
  );
}

/** Merge remote rows with local, prefer newer savedAt. */
export function mergeSavedNewsSnapshots(
  local: SavedNewsSnapshot[],
  remote: SavedNewsSnapshot[],
): SavedNewsSnapshot[] {
  const map = new Map<string, SavedNewsSnapshot>();
  for (const e of local) map.set(e.articleUrl, e);
  for (const r of remote) {
    const existing = map.get(r.articleUrl);
    if (!existing || r.savedAt >= existing.savedAt) map.set(r.articleUrl, r);
  }
  return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
}

export function syncSavedNewsFromRemote(
  remote: SavedNewsSnapshot[],
): SavedNewsSnapshot[] {
  const merged = mergeSavedNewsSnapshots(readSavedNewsSnapshots(), remote);
  writeSavedNewsSnapshots(merged);
  return merged;
}

export function readSavedNewsSnapshots(): SavedNewsSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_NEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? (parsed as SavedNewsSnapshot[]).filter(
          (p) =>
            p &&
            typeof p.articleUrl === "string" &&
            typeof p.title === "string" &&
            typeof p.sourceId === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function writeSavedNewsSnapshots(entries: SavedNewsSnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_NEWS_KEY, JSON.stringify(entries));
  } catch {
    /* noop */
  }
}

export function upsertSavedNewsSnapshot(snapshot: Omit<SavedNewsSnapshot, "savedAt"> & {
  savedAt?: number;
}) {
  const filtered = readSavedNewsSnapshots().filter(
    (e) => e.articleUrl !== snapshot.articleUrl,
  );
  filtered.unshift({
    articleUrl: snapshot.articleUrl,
    title: snapshot.title,
    sourceId: snapshot.sourceId,
    sourceLabel: snapshot.sourceLabel,
    publishedAt: snapshot.publishedAt,
    savedAt: snapshot.savedAt ?? Date.now(),
  });
  writeSavedNewsSnapshots(filtered);
  notifyNewsChanged({ addedUrl: snapshot.articleUrl });
}

export function removeSavedNewsSnapshot(articleUrl: string) {
  writeSavedNewsSnapshots(
    readSavedNewsSnapshots().filter((e) => e.articleUrl !== articleUrl),
  );
  notifyNewsChanged({ removedUrl: articleUrl });
}
