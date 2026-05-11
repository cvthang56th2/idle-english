export type CardType =
  | "vocabulary"
  | "phrase"
  | "grammar_correction"
  | "slang"
  | "developer_english"
  | "pronunciation";

export type LearnerLevel = "beginner" | "intermediate" | "advanced";

export type CardContent =
  | { wrong: string; correct: string }
  | { phrase: string; meaning?: string; short?: string }
  | { term: string; hint?: string }
  | { word: string; note?: string };

export type LessonCard = {
  id: string;
  type: CardType;
  title: string;
  content: CardContent;
  explanation: string;
  example: string;
  level: LearnerLevel;
  tags: string[];
  audio_url: string | null;
  created_at?: string;
};

export function parseCardContent(raw: unknown): CardContent {
  if (!raw || typeof raw !== "object") {
    return { phrase: "", meaning: "" };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.wrong === "string" && typeof o.correct === "string") {
    return { wrong: o.wrong, correct: o.correct };
  }
  if (typeof o.term === "string") {
    return { term: o.term, hint: typeof o.hint === "string" ? o.hint : undefined };
  }
  if (typeof o.word === "string") {
    return { word: o.word, note: typeof o.note === "string" ? o.note : undefined };
  }
  if (typeof o.phrase === "string") {
    return {
      phrase: o.phrase,
      meaning: typeof o.meaning === "string" ? o.meaning : undefined,
      short: typeof o.short === "string" ? o.short : undefined,
    };
  }
  return { phrase: "", meaning: "" };
}
