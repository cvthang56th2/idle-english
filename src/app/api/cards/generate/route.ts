import { randomBytes } from "node:crypto";

import {
  CARD_CATEGORIES,
  type CardCategoryId,
  isCardCategoryId,
} from "@/data/card-categories";
import type { CardType, LearnerLevel, LessonCard } from "@/types/card";
import {
  chatCompletionAssistantText,
  postChatCompletion,
  resolveServerLlm,
} from "@/lib/server-llm";
import { parseCardContent } from "@/types/card";

const CARD_TYPES: CardType[] = [
  "vocabulary",
  "phrase",
  "grammar_correction",
  "slang",
  "developer_english",
  "pronunciation",
];

const LEVELS: LearnerLevel[] = ["beginner", "intermediate", "advanced"];

function makeGenId() {
  return `gen-${randomBytes(10).toString("hex")}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const USER_NOTES_MAX = 500;

function normalizeUserNotes(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\u0000/g, "").trim();
  if (!t) return null;
  return t.slice(0, USER_NOTES_MAX);
}

type RawItem = {
  type?: unknown;
  title?: unknown;
  content?: unknown;
  explanation?: unknown;
  example?: unknown;
  level?: unknown;
  tags?: unknown;
};

function isCardType(v: unknown): v is CardType {
  return typeof v === "string" && (CARD_TYPES as string[]).includes(v);
}

function isLearnerLevel(v: unknown): v is LearnerLevel {
  return typeof v === "string" && (LEVELS as string[]).includes(v);
}

function normalizeItem(
  raw: RawItem,
  defaultLevel: LearnerLevel,
  extraTags: string[],
): LessonCard | null {
  if (typeof raw.title !== "string" || !raw.title.trim()) return null;
  if (typeof raw.explanation !== "string" || !raw.explanation.trim()) return null;
  if (typeof raw.example !== "string" || !raw.example.trim()) return null;
  if (!isCardType(raw.type)) return null;

  const level = isLearnerLevel(raw.level) ? raw.level : defaultLevel;
  const content = parseCardContent(raw.content);
  const tagList = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
    : [];

  const mergedTags = [...new Set([...tagList.map((t) => t.trim()), ...extraTags])];

  return {
    id: makeGenId(),
    type: raw.type,
    title: raw.title.trim(),
    content,
    explanation: raw.explanation.trim(),
    example: raw.example.trim(),
    level,
    tags: mergedTags,
    audio_url: null,
  };
}

/** Offline / missing key: short studio-written starters per category */
const FALLBACK_LESSONS: Partial<
  Record<CardCategoryId, Omit<LessonCard, "id">[]>
> = {
  behavioral_interviews: [
    {
      type: "phrase",
      title: 'Open strong: "Impact + scope"',
      content: {
        phrase: "I owned the ingestion pipeline serving ~120k writes per minute.",
      },
      explanation:
        "Lead with concise scope signals (ownership, throughput, severity) before deep-diving STAR.",
      example:
        "I owned the ingestion pipeline handling about 120k writes per minute, and when latency spiked, I drove the rollback decision with two concrete metrics.",
      level: "intermediate",
      tags: ["star", "metrics"],
      audio_url: null,
    },
    {
      type: "grammar_correction",
      title: 'Replace vague "many things"',
      content: {
        wrong: "I improved many things in the codebase.",
        correct: "I improved build times, flaky tests, and deployment safety.",
      },
      explanation:
        "Interviewers latch onto specifics — swap vague summaries for a bounded list of tangible outcomes.",
      example:
        "I improved flake triage workflows, shaved roughly 18 minutes off CI, and tightened release guardrails.",
      level: "beginner",
      tags: ["clarity"],
      audio_url: null,
    },
  ],
  system_design_voice: [
    {
      type: "developer_english",
      title: "Pause with structure",
      content: { phrase: "Let me restate assumptions, then propose two options." },
      explanation:
        "Buys thinking time while showing rigor — interviewers tolerate pauses framed as structure.",
      example:
        "Let me restate the assumptions — we need durable writes and tolerate ~2s staleness reads — then I’ll compare a single-region SQL core vs CQRS-lite.",
      level: "advanced",
      tags: ["frame", "design"],
      audio_url: null,
    },
    {
      type: "phrase",
      title: 'Trade-offs out loud',
      content: {
        phrase: "The trade-off is consistency vs latency here.",
      },
      explanation:
        "Naming tensions explicitly signals maturity and unlocks interviewer guidance.",
      example:
        "The trade-off is consistency vs latency here — are we optimizing for freshest reads or best-effort responsiveness?",
      level: "intermediate",
      tags: ["trade-offs"],
      audio_url: null,
    },
  ],
  code_review_collab: [
    {
      type: "phrase",
      title: "Soft disagree in reviews",
      content: {
        phrase: "Could we walk through locking guarantees on this helper?",
      },
      explanation:
        "Question framing sounds collaborative versus accusatory (“this is wrong”).",
      example:
        "Could we walk through locking guarantees here? I'm worried duplicate cron runs could reconcile twice.",
      level: "intermediate",
      tags: ["pr", "tone"],
      audio_url: null,
    },
    {
      type: "developer_english",
      title: '"Nit:" microtone',
      content: { phrase: "Nit optional: extracting this would simplify mocking." },
      explanation:
        "Prefixing trivial feedback as optional keeps psychological safety intact.",
      example:
        "Nit optional: extracting this factory would shrink the surface area we stub in integration tests.",
      level: "beginner",
      tags: ["pr"],
      audio_url: null,
    },
  ],
  standups_updates: [
    {
      type: "phrase",
      title: "Yesterday / today / blocker",
      content: { phrase: "Yesterday I merged X; today I'm validating Y." },
      explanation:
        "Triple cadence avoids rambling updates and signals predictability.",
      example:
        "Yesterday I landed the rollout flag; today I'm babysitting dashboards for error budgets; blocker is flaky staging creds rotating overnight.",
      level: "beginner",
      tags: ["standup"],
      audio_url: null,
    },
    {
      type: "vocabulary",
      title: "\"Surface\" delays honestly",
      content: { term: "slipped", hint: "moved slightly past the original ETA" },
      explanation:
        "Pair facts with corrective action — recruiters and managers respect transparency.",
      example:
        "The auth migration slipped by half a sprint because SSO vendor docs changed; mitigation is nightly dry runs.",
      level: "intermediate",
      tags: ["eta"],
      audio_url: null,
    },
  ],
  salary_hiring_talk: [
    {
      type: "phrase",
      title: 'Anchor comp politely',
      content: {
        phrase: "Given the scope and parity data, I'd expect alignment around…",
      },
      explanation:
        "Signals research + flexibility without apology spirals.",
      example:
        "Given the Staff scope and leveling guides I'm seeing externally, I'd expect alignment around mid $200s base before equity — open to unpacking total.",
      level: "advanced",
      tags: ["comp"],
      audio_url: null,
    },
    {
      type: "grammar_correction",
      title: "Swap hedgy confidence",
      content: {
        wrong: "Maybe I deserve more money?",
        correct: "I'm looking for a package that reflects the scope of the role.",
      },
      explanation:
        "Interview language should stay factual; emotional hedging reads as inexperienced.",
      example:
        "I'm aiming for compensation that mirrors the infra ownership and pager load described in loop two.",
      level: "intermediate",
      tags: ["comp"],
      audio_url: null,
    },
  ],
  fluent_dev_daily: [
    {
      type: "slang",
      title: "\"Circle back\" energy",
      content: {
        phrase: "Let’s circle back after the infra sync.",
        meaning: "Defer until a better forum without sounding dismissive.",
      },
      explanation:
        "Useful when Slack debates sprawl — keeps async tone friendly.",
      example:
        "Love the idea — let's circle back once SRE publishes the failover notes.",
      level: "beginner",
      tags: ["async"],
      audio_url: null,
    },
    {
      type: "pronunciation",
      title: "\"Deprecated\" clarity",
      content: {
        word: "deprecated",
        note: "DEP-reh-kay-ted · three syllables · stress DEP",
      },
      explanation:
        "Mispronunciation here is audible in cross-team demos — tighten it once.",
      example:
        "We deprecated the SOAP shim last quarter.",
      level: "beginner",
      tags: ["speaking"],
      audio_url: null,
    },
  ],
};

function fallbackLessonCards(
  categoryIds: CardCategoryId[],
  defaultLevel: LearnerLevel,
  count: number,
): LessonCard[] {
  const pool: Omit<LessonCard, "id">[] = [];
  for (const id of categoryIds) {
    const pack = FALLBACK_LESSONS[id];
    if (!pack?.length) continue;
    pool.push(...pack);
  }

  const out: LessonCard[] = [];
  if (!pool.length) return out;

  let i = 0;
  while (out.length < count) {
    const base = pool[i % pool.length]!;
    const level = base.level ?? defaultLevel;
    out.push({
      ...base,
      id: makeGenId(),
      level,
      tags: [
        ...base.tags.filter((t) => t !== "generated"),
        ...categoryIds,
        "generated",
      ].filter(Boolean),
    });
    i += 1;
  }
  return out;
}

async function generateLessonCardsWithLlm(
  llm: NonNullable<ReturnType<typeof resolveServerLlm>>,
  selections: typeof CARD_CATEGORIES,
  defaultLevel: LearnerLevel,
  count: number,
  userNotes: string | null,
): Promise<LessonCard[] | null> {
  const focus = selections.map((c) => `- ${c.promptFocus}`).join("\n");
  const tagHints = selections.map((c) => c.id);

  const learnerBlock = userNotes
    ? `
Learner-provided context (honor when compatible with category mix; do not invent private facts):
${userNotes}
`
    : "";

  const userPrompt = `You create bite-sized spoken English drills for developers.

Categories to blend across the batch:
${focus}
${learnerBlock}
Global constraints:
- Return JSON only: {"items":[...]}
- Produce exactly ${count} items.
- Each item fields: type, title, content, explanation, example, level, tags (string array)
- type must be one of: ${CARD_TYPES.join(", ")}
- level must be one of: ${LEVELS.join(", ")}
- title max 72 chars.
- explanation 2 sentences max - practical linguistics coaching.
- example must sound natural aloud in interviews or teamwork settings.
- content must strictly match ONE shape:
  * grammar_correction → {"wrong":string,"correct":string}
  * phrase → {"phrase":string,"meaning"?:string,"short"?:string}
  * vocabulary → {"term":string,"hint"?:string}
  * slang → {"phrase":string,"meaning"?:string}
  * pronunciation → {"word":string,"note"?:string}
  * developer_english → reuse phrase shape (phrase + optional short gloss)
- Every item tags MUST include at least two of: ${tagHints.join(", ")}, plus one extra descriptor tag.
- Themes should vary (no duplicated titles).

Default learner level fallback: ${defaultLevel}.`;

  const res = await postChatCompletion(llm, {
    messages: [
      {
        role: "system",
        content:
          "You output terse JSON packs for mobile micro-lessons — factually sober, witty only when slang cards demand it.",
      },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.55,
    response_format: { type: "json_object" },
  });

  if (!res.ok) return null;

  const data = await res.json();

  let parsed: unknown;
  try {
    const text = chatCompletionAssistantText(data) ?? "";
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    return null;
  }

  const rawItems = (parsed as { items: RawItem[] }).items.slice(0, count);

  const items: LessonCard[] = [];
  for (const raw of rawItems) {
    const card = normalizeItem(raw, defaultLevel, [...tagHints, "generated"]);
    if (card) items.push(card);
  }

  return items.length ? items : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const b = body as {
    categoryIds?: unknown;
    level?: unknown;
    count?: unknown;
    notes?: unknown;
  };

  const userNotes = normalizeUserNotes(b.notes);

  if (!Array.isArray(b.categoryIds) || b.categoryIds.length === 0) {
    return Response.json({ error: "category_ids_required" }, { status: 400 });
  }

  const categoryIds = b.categoryIds.filter(isCardCategoryId);
  if (!categoryIds.length) {
    return Response.json({ error: "no_valid_categories" }, { status: 400 });
  }

  const defaultLevel: LearnerLevel = isLearnerLevel(b.level)
    ? b.level
    : "intermediate";

  const count = clamp(
    typeof b.count === "number" && Number.isFinite(b.count) ? Math.floor(b.count) : 6,
    1,
    8,
  );

  const selections = CARD_CATEGORIES.filter((c) => categoryIds.includes(c.id));

  const llm = resolveServerLlm();

  let items: LessonCard[];

  if (llm) {
    const ai = await generateLessonCardsWithLlm(
      llm,
      selections,
      defaultLevel,
      count,
      userNotes,
    );
    items = ai ?? fallbackLessonCards(categoryIds, defaultLevel, count);
  } else {
    items = fallbackLessonCards(categoryIds, defaultLevel, count);
  }

  if (!items.length) {
    return Response.json({ error: "empty_generation" }, { status: 500 });
  }

  return Response.json({ items });
}
