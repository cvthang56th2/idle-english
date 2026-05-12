import type { LessonCard } from "@/types/card";

export type SavedEntry = {
  id: string;
  card: LessonCard;
  savedAt: number;
};

const SAVED_ENTRIES_KEY = "idle_saved_entries_v1";

/** Dispatched after local saved entries change so the feed can sync bookmark UI. */
export const IDLE_SAVED_ENTRIES_CHANGED = "idle-saved-entries-changed";

export type IdleSavedEntriesChangedDetail = {
  removedId?: string;
  addedId?: string;
};

function notifySavedEntriesChanged(detail: IdleSavedEntriesChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(IDLE_SAVED_ENTRIES_CHANGED, { detail }),
  );
}

export function readSavedEntries(): SavedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSavedEntries(entries: SavedEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    /* noop */
  }
}

export function upsertSavedEntry(card: LessonCard) {
  const entries = readSavedEntries().filter((e) => e.id !== card.id);
  entries.unshift({
    id: card.id,
    card,
    savedAt: Date.now(),
  });
  writeSavedEntries(entries);
  notifySavedEntriesChanged({ addedId: card.id });
}

export function removeSavedEntry(id: string) {
  writeSavedEntries(readSavedEntries().filter((e) => e.id !== id));
  notifySavedEntriesChanged({ removedId: id });
}
