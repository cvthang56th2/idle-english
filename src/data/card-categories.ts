export type CardCategoryId =
  | "behavioral_interviews"
  | "system_design_voice"
  | "code_review_collab"
  | "standups_updates"
  | "salary_hiring_talk"
  | "fluent_dev_daily";

export type CardCategoryMeta = {
  id: CardCategoryId;
  label: string;
  description: string;
  /** Passed into LLM prompts to steer vocabulary and scenarios */
  promptFocus: string;
};

export const CARD_CATEGORIES: CardCategoryMeta[] = [
  {
    id: "behavioral_interviews",
    label: "Behavioral interviews",
    description: "STAR-style stories, impact, humility",
    promptFocus:
      "Behavioral software interviews: STAR framing, teamwork, conflicts, deadlines, mentorship, humility. Short speakable phrases developers can rehearse aloud.",
  },
  {
    id: "system_design_voice",
    label: "System design (speaking)",
    description: "Trade-offs, clarifying scope, narration",
    promptFocus:
      "Speaking during system design: clarifying requirements, narrating decisions, latency vs cost trade-offs, back-of-envelope talk, politely pushing back.",
  },
  {
    id: "code_review_collab",
    label: "PRs & code review",
    description: "Polite critiques, approvals, pairing",
    promptFocus:
      "Engineering collaboration in English: constructive PR feedback, approving changes, proposing alternatives without sounding blunt.",
  },
  {
    id: "standups_updates",
    label: "Standups & status",
    description: "Blockers, progress, estimates",
    promptFocus:
      "Daily sync / standups: succinct updates, blocker language, ETA phrasing for busy senior ICs.",
  },
  {
    id: "salary_hiring_talk",
    label: "Salary & hiring chats",
    description: "Comp, offers, leveling",
    promptFocus:
      "Professional English for comp discussions, leveling questions, recruiter small talk — neutral, respectful, confident tone.",
  },
  {
    id: "fluent_dev_daily",
    label: "Everyday dev English",
    description: "Slack, Zoom, hallway nuance",
    promptFocus:
      "General workplace English for developers: Slack tone, Slack vs email registers, nuanced phrases for async collaboration.",
  },
];

const IDS = new Set(CARD_CATEGORIES.map((c) => c.id));

export function isCardCategoryId(value: unknown): value is CardCategoryId {
  return typeof value === "string" && IDS.has(value as CardCategoryId);
}
