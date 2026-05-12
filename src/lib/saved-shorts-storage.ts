import type { SavedShortSnapshot } from "@/types/saved-short";

const SAVED_SHORTS_KEY = "idle_saved_shorts_v1";

export type SavedShortEntry = SavedShortSnapshot;

export function mergeSavedShortSnapshots(
  local: SavedShortEntry[],
  remote: SavedShortSnapshot[],
): SavedShortEntry[] {
  const map = new Map<string, SavedShortEntry>();
  for (const e of local) map.set(e.videoId, e);
  for (const r of remote) {
    const existing = map.get(r.videoId);
    const row: SavedShortEntry = {
      videoId: r.videoId,
      title: r.title,
      channelTitle: r.channelTitle,
      thumbnailUrl: r.thumbnailUrl,
      savedAt: r.savedAt,
    };
    if (!existing || row.savedAt >= existing.savedAt) {
      map.set(r.videoId, row);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
}

/** Writes merged remote + local to storage and returns the merged list. */
export function syncSavedShortsFromRemote(remote: SavedShortSnapshot[]): SavedShortEntry[] {
  const merged = mergeSavedShortSnapshots(readSavedShortEntries(), remote);
  writeSavedShortEntries(merged);
  return merged;
}

export function readSavedShortEntries(): SavedShortEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_SHORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedShortEntry[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedShortEntries(entries: SavedShortEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_SHORTS_KEY, JSON.stringify(entries));
  } catch {
    /* noop */
  }
}

export function upsertSavedShortEntry(
  snapshot: Omit<SavedShortEntry, "savedAt"> & { savedAt?: number },
) {
  const entries = readSavedShortEntries().filter(
    (e) => e.videoId !== snapshot.videoId,
  );
  entries.unshift({
    videoId: snapshot.videoId,
    title: snapshot.title,
    channelTitle: snapshot.channelTitle,
    thumbnailUrl: snapshot.thumbnailUrl,
    savedAt: snapshot.savedAt ?? Date.now(),
  });
  writeSavedShortEntries(entries);
}

export function removeSavedShortEntry(videoId: string) {
  writeSavedShortEntries(
    readSavedShortEntries().filter((e) => e.videoId !== videoId),
  );
}
