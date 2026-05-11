import type { CardContent, CardType, LearnerLevel, LessonCard } from "@/types/card";
import { parseCardContent } from "@/types/card";

/** Mirrors `supabase/migrations` seed for offline / no-env demos */
export const DEMO_LESSON_CARDS: LessonCard[] = [
  {
    id: "demo-grammar-1",
    type: "grammar_correction",
    title: "Don’t say “very like”",
    content: { wrong: "I very like it", correct: "I really like it" },
    explanation:
      '"Very" strengthens adjectives and adverbs — not verbs directly. Use “really,” “truly,” or rephrase.',
    example: "I really like this feature.",
    level: "beginner",
    tags: ["grammar", "common mistake"],
    audio_url: null,
  },
  {
    id: "demo-dev-1",
    type: "developer_english",
    title: "Ship vs deploy",
    content: { phrase: "We shipped the fix last night." },
    explanation:
      '"Ship" implies releasing value to users; "deploy" focuses on putting bits into an environment.',
    example:
      "After QA signed off, we deployed to staging and shipped to prod Friday.",
    level: "intermediate",
    tags: ["dev", "workflow"],
    audio_url: null,
  },
  {
    id: "demo-vocab-1",
    type: "vocabulary",
    title: 'Nuanced “implement”',
    content: { term: "implement", hint: "carry out / put into effect" },
    explanation:
      "Strong default verb in tech writing for turning a design into working software.",
    example: "We implemented retry logic with exponential backoff.",
    level: "intermediate",
    tags: ["writing"],
    audio_url: null,
  },
  {
    id: "demo-slang-1",
    type: "slang",
    title: "Touch grass",
    content: {
      phrase: "You should touch grass.",
      meaning: "Go outside; stop being extremely online.",
    },
    explanation:
      "Playful roast / wellness check in internet culture. Mostly informal.",
    example: "After the third refactor today… maybe touch grass?",
    level: "beginner",
    tags: ["internet", "humor"],
    audio_url: null,
  },
  {
    id: "demo-phrase-1",
    type: "phrase",
    title: "Soften a critique",
    content: { phrase: "Have we considered…?" },
    explanation:
      "Question framing avoids sounding blunt while still pushing back.",
    example: "Have we considered caching this on the edge?",
    level: "advanced",
    tags: ["meetings", "tone"],
    audio_url: null,
  },
  {
    id: "demo-pron-1",
    type: "pronunciation",
    title: "Record vs replay stress",
    content: {
      word: "record",
      note: "RE-cord (noun) vs re-CORD (verb)",
    },
    explanation: "Stress shifts meaning for many English noun/verb pairs.",
    example: "We keep a RE-cord of incidents and re-CORD new sessions.",
    level: "intermediate",
    tags: ["stress", "pairs"],
    audio_url: null,
  },
  {
    id: "demo-grammar-2",
    type: "grammar_correction",
    title: "Fewer vs less",
    content: { wrong: "Less bugs", correct: "Fewer bugs" },
    explanation: "Use “fewer” for countable things; “less” for mass nouns.",
    example: "Fewer timeouts after we tuned the pool.",
    level: "beginner",
    tags: ["grammar"],
    audio_url: null,
  },
  {
    id: "demo-dev-2",
    type: "developer_english",
    title: "LGTM",
    content: { phrase: "Looks good to me", short: "LGTM" },
    explanation:
      "Quick approval in PR reviews. Pair with concrete praise when possible.",
    example: "LGTM — nice edge-case tests!",
    level: "beginner",
    tags: ["prs", "abbrev"],
    audio_url: null,
  },
];

export function rowToLessonCard(row: {
  id: string;
  type: string;
  title: string;
  content: unknown;
  explanation: string;
  example: string;
  level: string;
  tags: string[] | null;
  audio_url: string | null;
  created_at?: string;
}): LessonCard {
  return {
    id: row.id,
    type: row.type as CardType,
    title: row.title,
    content: parseCardContent(row.content) as CardContent,
    explanation: row.explanation,
    example: row.example,
    level: row.level as LearnerLevel,
    tags: row.tags ?? [],
    audio_url: row.audio_url,
    created_at: row.created_at,
  };
}
