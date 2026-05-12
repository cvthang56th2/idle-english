import { YOUTUBE_CATEGORY_QUERIES } from "@/lib/youtube/presets";

export type ShortsThemePresetKey = keyof typeof YOUTUBE_CATEGORY_QUERIES;

export type ShortsThemeLoad =
  | { type: "preset"; key: ShortsThemePresetKey }
  | { type: "search"; q: string };

export type ShortsTheme = {
  id: string;
  title: string;
  description: string;
  load: ShortsThemeLoad;
};

/**
 * Ordered topic “playlists”: each row is a clear learning angle + stable YouTube search routing.
 * Playback order matches API paging within one topic (scroll for more of the same theme).
 */
export const SHORTS_THEMES: ShortsTheme[] = [
  {
    id: "mixed-micro",
    title: "Micro learning mix",
    description:
      "A rotating mix of ultra-short clips—grammar hooks, vocab, and culture in small bites when you only have a minute.",
    load: { type: "preset", key: "explore" },
  },
  {
    id: "grammar-context",
    title: "Grammar in context",
    description:
      "Short explainers on tenses, articles, and sentence patterns—see the rule, then hear it in a real line.",
    load: { type: "preset", key: "grammar" },
  },
  {
    id: "pronunciation-clear",
    title: "Clear pronunciation",
    description:
      "Sounds, stress, and linking—minimal pairs and mouth clarity drills you can repeat out loud.",
    load: { type: "preset", key: "pronunciation" },
  },
  {
    id: "word-power",
    title: "Word power",
    description:
      "High-utility words and collocations—quick definitions plus examples so you remember usage, not only spelling.",
    load: { type: "preset", key: "vocabulary" },
  },
  {
    id: "listen-shadow",
    title: "Listen & shadow",
    description:
      "Short listening lines for shadowing: catch the rhythm, then mimic the speaker’s chunking and tone.",
    load: { type: "preset", key: "listening" },
  },
  {
    id: "idioms-slang",
    title: "Idioms & natural phrasing",
    description:
      "Common idioms and conversational chunks—what natives say instead of textbook sentences.",
    load: { type: "preset", key: "idioms" },
  },
  {
    id: "phrasal-core",
    title: "Phrasal verbs that matter",
    description:
      "Core phrasals grouped by meaning—up, off, out—with mini examples you can drop into speech.",
    load: { type: "preset", key: "phrasal" },
  },
  {
    id: "workplace-english",
    title: "Workplace English",
    description:
      "Polite, direct language for email, meetings, and small talk—sound confident without sounding stiff.",
    load: {
      type: "search",
      q: "business english workplace phrases professional short",
    },
  },
  {
    id: "speaking-exams",
    title: "Speaking for exams",
    description:
      "Ideas and fillers for IELTS/TOEFL-style prompts—structure an answer quickly under time pressure.",
    load: {
      type: "search",
      q: "ielts speaking tips english part 2 short lesson",
    },
  },
];

export const DEFAULT_SHORTS_THEME_ID = SHORTS_THEMES[0]?.id ?? "mixed-micro";

export function getShortsTheme(id: string): ShortsTheme {
  return SHORTS_THEMES.find((t) => t.id === id) ?? SHORTS_THEMES[0]!;
}
