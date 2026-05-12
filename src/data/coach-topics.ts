import type { LearnerLevel } from "@/types/card";

export type CoachTopicId =
  | "small_talk"
  | "work_meetings"
  | "daily_life"
  | "fix_errors"
  | "interviews"
  | "travel";

export type CoachTopic = {
  id: CoachTopicId;
  label: string;
  /** Sent to the model as scenario context */
  scene: string;
};

export const COACH_TOPICS: CoachTopic[] = [
  {
    id: "small_talk",
    label: "Small talk",
    scene:
      "Practice friendly casual conversation — hobbies, weekend plans, weather, light topics.",
  },
  {
    id: "work_meetings",
    label: "Work & meetings",
    scene:
      "Developer workplace English — standups, async updates, polite disagreement, explaining blockers.",
  },
  {
    id: "daily_life",
    label: "Daily life",
    scene:
      "Everyday situations — routines, errands, making plans with friends, describing problems.",
  },
  {
    id: "fix_errors",
    label: "Fix my English",
    scene:
      "The learner writes freely (English or mixed). Gently correct grammar, word choice, and tone; explain briefly.",
  },
  {
    id: "interviews",
    label: "Interviews",
    scene:
      "Behavioral and technical interview practice — STAR answers, clarity, confident hedging.",
  },
  {
    id: "travel",
    label: "Travel",
    scene:
      "Airports, hotels, directions, polite requests while traveling.",
  },
];

const TOPIC_LEVEL_STARTERS: Record<CoachTopicId, Record<LearnerLevel, string[]>> =
  {
    small_talk: {
      beginner: [
        "Hi! Can we talk about my weekend? I stayed home.",
        "What is a good way to greet a new coworker?",
        "How do I ask someone about their hobbies simply?",
      ],
      intermediate: [
        "Let's chat about weekend plans — mine are still up in the air.",
        "How can I keep a casual chat going without sounding stiff?",
        "Can you suggest a natural follow-up after 'How's your week been?'",
      ],
      advanced: [
        "Let's discuss how small talk differs between US and UK offices.",
        "How do I sound warm but still professional in hallway chat?",
        "Give me a nuanced opener for reconnecting with someone I barely know.",
      ],
    },
    work_meetings: {
      beginner: [
        "How do I say I am blocked on a task in simple English?",
        "Help me write one sentence for standup about yesterday.",
        "What is a polite way to ask for more time?",
      ],
      intermediate: [
        "How do I push back when scope creep shows up mid-sprint?",
        "Rewrite my update so it sounds confident but not arrogant.",
        "What's a natural phrase for 'I'll investigate and circle back'?",
      ],
      advanced: [
        "How do executives expect risks to be framed in status meetings?",
        "Help me soften critical feedback on someone else's design doc.",
        "What's idiomatic language for aligning priorities across teams?",
      ],
    },
    daily_life: {
      beginner: [
        "I want to describe my morning routine in English.",
        "How do I ask a barista for oat milk politely?",
        "Help me say I'm sick and can't join dinner tonight.",
      ],
      intermediate: [
        "Role-play rescheduling a dentist appointment over the phone.",
        "How do I complain politely when food arrives cold?",
        "Natural phrases for coordinating dinner plans by text?",
      ],
      advanced: [
        "How do native speakers soften requests in awkward social situations?",
        "I'd like nuanced language for turning down an invite without offending.",
        "Compare how people discuss money with friends across English regions.",
      ],
    },
    fix_errors: {
      beginner: [
        "I very like programming. Fix this and tell me why.",
        "Is it correct to say 'I have 25 years'?",
        "Please fix: 'Yesterday I go to store.'",
      ],
      intermediate: [
        "I'll ping you offline soon — does this sound natural at work?",
        "Spot errors: 'The data tells us we should of deployed earlier.'",
        "Does this sound rude? Rewrite it softer.",
      ],
      advanced: [
        "Critique tone and rhythm: long Slack DM about architectural concerns.",
        "Are these modal verbs calibrated correctly for executive email?",
        "Polish this paragraph for clarity without losing precision.",
      ],
    },
    interviews: {
      beginner: [
        "Help me answer 'Tell me about yourself' for a junior developer role.",
        "Simple STAR answer for working as part of a team.",
        "How do I say I don't know an answer without sounding weak?",
      ],
      intermediate: [
        "Sharpen my answer about handling production incidents.",
        "How should I explain a messy legacy codebase positively?",
        "Give me strong transitions between STAR Situation and Task.",
      ],
      advanced: [
        "Mock a principal-level system design opener for a payments team.",
        "How do I negotiate impact when my role was mostly glue work?",
        "Refine behavioral story about conflicting technical opinions.",
      ],
    },
    travel: {
      beginner: [
        "Phrases for checking in at a hotel.",
        "How do I ask where the nearest ATM is?",
        "I missed my flight — what should I tell the airline desk?",
      ],
      intermediate: [
        "Negotiate upgrading a room politely after a noisy night.",
        "How to ask locals for restaurant tips without sounding touristy?",
        "Phrases for delayed trains and compensation small talk?",
      ],
      advanced: [
        "How does UK English differ for train travel vs US?",
        "Subtle ways to escalate when customer service stalls.",
        "Explain jet lag and dietary needs smoothly at a conference hotel.",
      ],
    },
  };

/** Openers when the learner typed their own topic — references “my topic” in chat */
export function startersForCustom(level: LearnerLevel): string[] {
  switch (level) {
    case "beginner":
      return [
        "My topic is in the box above — ask me one easy question about it.",
        "Give me 5 simple English phrases I might need for my topic.",
        "I'll write one sentence about my topic — please fix my English.",
      ];
    case "intermediate":
      return [
        "Let's role-play a realistic conversation for my topic above.",
        "What phrases sound natural vs textbook for my topic?",
        "I'll explain my situation — tighten my wording without changing meaning.",
      ];
    case "advanced":
      return [
        "Push my nuance on my topic above — register, idioms, and pitfalls.",
        "Mock a harder follow-up I'd get in real life about this topic.",
        "Critique tone and rhythm on a paragraph I'll paste next.",
      ];
    default:
      return [
        "Let's role-play a realistic conversation for my topic above.",
        "What phrases sound natural vs textbook for my topic?",
        "I'll explain my situation — tighten my wording without changing meaning.",
      ];
  }
}

export function startersFor(topic: CoachTopicId, level: LearnerLevel): string[] {
  return TOPIC_LEVEL_STARTERS[topic][level];
}
