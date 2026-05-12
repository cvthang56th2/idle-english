import { CARD_CATEGORIES, type CardCategoryId } from "@/data/card-categories";
import type { LearnerLevel } from "@/types/card";

export const LS_GENERATE_CATEGORIES = "idle_generate_categories_v1";
export const LS_GENERATE_LEVEL = "idle_generate_level_v1";
export const LS_GENERATE_NOTES = "idle_generate_notes_v1";

export const NOTES_MAX = 500;

/** Mirrors the defaults in `GenerateSessionSheet` when nothing is stored yet. */
export const DEFAULT_GENERATE_CATEGORY_IDS: CardCategoryId[] = [
  "fluent_dev_daily",
  "behavioral_interviews",
];

const LEVELS: LearnerLevel[] = ["beginner", "intermediate", "advanced"];

export type GenerateSessionPrefs = {
  categoryIds: CardCategoryId[];
  level: LearnerLevel;
  notes: string;
};

function readStoredCategories(): CardCategoryId[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_GENERATE_CATEGORIES);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set(CARD_CATEGORIES.map((c) => c.id));
    return parsed.filter(
      (id): id is CardCategoryId =>
        typeof id === "string" && allowed.has(id as CardCategoryId),
    );
  } catch {
    return null;
  }
}

function readStoredLevel(): LearnerLevel | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(LS_GENERATE_LEVEL);
  if (v && (LEVELS as string[]).includes(v)) return v as LearnerLevel;
  return null;
}

function readStoredNotes(): string {
  if (typeof window === "undefined") return "";
  try {
    const v = window.localStorage.getItem(LS_GENERATE_NOTES);
    if (typeof v !== "string") return "";
    return v.slice(0, NOTES_MAX);
  } catch {
    return "";
  }
}

/** Client-only: preferences for `/api/cards/generate` (sheet + automatic deck refresh). */
export function readGenerateSessionPrefs(): GenerateSessionPrefs {
  const cats = readStoredCategories();
  const categoryIds =
    cats?.length ? cats : [...DEFAULT_GENERATE_CATEGORY_IDS];
  return {
    categoryIds,
    level: readStoredLevel() ?? "intermediate",
    notes: readStoredNotes(),
  };
}
