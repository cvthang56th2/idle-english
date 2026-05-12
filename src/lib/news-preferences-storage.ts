import {
  NEWS_SOURCE_IDS,
  NEWS_SOURCES,
} from "@/lib/news-sources";

const KEY = "idle_news_source_prefs_v1";

/** Dispatched when enabled sources change (Profile toggles). */
export const IDLE_NEWS_PREFS_CHANGED = "idle-news-prefs-changed";

export type NewsPrefsState = {
  enabledIds: string[];
};

export const DEFAULT_NEWS_SOURCE_IDS = NEWS_SOURCES.map((s) => s.id);

function normalizeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [...DEFAULT_NEWS_SOURCE_IDS];
  const next = ids
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => NEWS_SOURCE_IDS.has(id));
  return next.length ? [...new Set(next)] : [...DEFAULT_NEWS_SOURCE_IDS];
}

export function readNewsPreferences(): NewsPrefsState {
  if (typeof window === "undefined") {
    return { enabledIds: [...DEFAULT_NEWS_SOURCE_IDS] };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { enabledIds: [...DEFAULT_NEWS_SOURCE_IDS] };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { enabledIds: [...DEFAULT_NEWS_SOURCE_IDS] };
    }
    const enabledIds = normalizeIds((parsed as { enabledIds?: unknown }).enabledIds);
    return { enabledIds };
  } catch {
    return { enabledIds: [...DEFAULT_NEWS_SOURCE_IDS] };
  }
}

export function writeNewsPreferences(next: NewsPrefsState) {
  if (typeof window === "undefined") return;
  const enabledIds = normalizeIds(next.enabledIds);
  try {
    localStorage.setItem(KEY, JSON.stringify({ enabledIds }));
  } catch {
    /* noop */
  }
}

export function toggleNewsSourceInPrefs(sourceId: string, enabled: boolean) {
  const cur = readNewsPreferences().enabledIds;
  const set = new Set(cur);
  if (enabled) set.add(sourceId);
  else set.delete(sourceId);
  const ids = [...set];
  if (!ids.length) return false;

  ids.sort((a, b) => NEWS_SOURCES.findIndex((s) => s.id === a) -
    NEWS_SOURCES.findIndex((s) => s.id === b));
  writeNewsPreferences({ enabledIds: ids });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(IDLE_NEWS_PREFS_CHANGED));
  }
}
