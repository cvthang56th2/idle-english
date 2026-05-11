import type { LessonCard } from "@/types/card";

const KEY = "idle_recent_cards_v1";

export function persistRecentCards(cards: LessonCard[]) {
  if (typeof window === "undefined") return;
  try {
    const sliced = cards.slice(-24);
    localStorage.setItem(KEY, JSON.stringify(sliced));
  } catch {
    /* quota / private mode */
  }
}

export function readRecentCards(): LessonCard[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LessonCard[];
  } catch {
    return null;
  }
}

const SAVED_KEY = "idle_saved_ids_v1";

export function readLocalSavedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalSavedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {
    /* noop */
  }
}

const PROGRESS_KEY = "idle_progress_v1";

export type LocalProgress = { xp: number; streak: number; lastDay: string };

export function readLocalProgress(): LocalProgress {
  if (typeof window === "undefined") {
    return { xp: 0, streak: 0, lastDay: "" };
  }
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { xp: 0, streak: 0, lastDay: "" };
    return JSON.parse(raw) as LocalProgress;
  } catch {
    return { xp: 0, streak: 0, lastDay: "" };
  }
}

export function bumpLocalProgress(): LocalProgress {
  const prev = readLocalProgress();
  const today = new Date().toISOString().slice(0, 10);
  let streak = prev.streak;
  if (!prev.lastDay) {
    streak = 1;
  } else if (prev.lastDay === today) {
    /* no streak change */
  } else {
    const prevDate = new Date(prev.lastDay + "T00:00:00Z");
    const currDate = new Date(today + "T00:00:00Z");
    const diffDays = Math.round(
      (currDate.getTime() - prevDate.getTime()) / 86_400_000,
    );
    streak = diffDays === 1 ? streak + 1 : 1;
  }

  const next: LocalProgress = {
    xp: prev.xp + 5,
    streak,
    lastDay: today,
  };

  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }

  return next;
}
