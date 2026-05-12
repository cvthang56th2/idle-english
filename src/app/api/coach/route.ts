import type { CoachTopicId } from "@/data/coach-topics";
import {
  COACH_TOPICS,
  startersFor,
  startersForCustom,
} from "@/data/coach-topics";
import {
  chatCompletionAssistantText,
  describeMissingLlmEnv,
  postChatCompletion,
  resolveServerLlm,
} from "@/lib/server-llm";
import type { LearnerLevel } from "@/types/card";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Correction = { wrong: string; better: string; why?: string };

type CoachModelPayload = {
  reply: string;
  corrections?: Correction[];
  suggestions?: string[];
};

function levelInstructions(level: LearnerLevel): string {
  switch (level) {
    case "beginner":
      return `Learner level: beginner. Use short, clear sentences and common vocabulary. Encourage attempts. If needed, give a Vietnamese gloss in parentheses once per reply for one hard word only.`;
    case "intermediate":
      return `Learner level: intermediate. Natural conversational English. Introduce useful collocations sparingly.`;
    case "advanced":
      return `Learner level: advanced. Nuance, idioms, and register (formal vs casual) when relevant. Challenge them gently.`;
    default:
      return "";
  }
}

const CUSTOM_TOPIC_MAX = 400;

function topicBlock(topicId: CoachTopicId, customTopic: string | null): string {
  const t = COACH_TOPICS.find((x) => x.id === topicId);
  const preset = t
    ? `Conversation focus: ${t.label}. ${t.scene}`
    : "Topic: general English practice.";
  const extra = customTopic?.trim();
  if (!extra) return preset;
  const safe = extra.slice(0, CUSTOM_TOPIC_MAX);
  return `${preset}\n\nLearner-defined topic (prioritize steering dialogue toward this): ${safe}`;
}

function shuffleCopy<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function parseSuggestedOpensPayload(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw.trim()) as { starters?: unknown };
    if (!Array.isArray(parsed.starters)) return null;
    const items = parsed.starters
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim().slice(0, 400));
    const seen = new Set<string>();
    const uniq = items.filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return uniq.length >= 2 ? uniq.slice(0, 3) : null;
  } catch {
    return null;
  }
}

function parseCoachPayload(raw: string): CoachModelPayload | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as CoachModelPayload;
    if (typeof parsed.reply !== "string" || !parsed.reply.trim()) return null;
    return {
      reply: parsed.reply.trim(),
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: {
    topicId?: CoachTopicId;
    level?: LearnerLevel;
    messages?: ChatMessage[];
    customTopic?: string | null;
    generateSuggestedOpens?: boolean;
    excludeStarters?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const topicId = body.topicId;
  const level = body.level;
  const messages = body.messages;
  let customTopic: string | null = null;
  if (typeof body.customTopic === "string") {
    const t = body.customTopic.trim().slice(0, CUSTOM_TOPIC_MAX);
    customTopic = t.length > 0 ? t : null;
  }

  let excludeStarters: string[] = [];
  if (Array.isArray(body.excludeStarters)) {
    excludeStarters = body.excludeStarters
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim().slice(0, 400))
      .filter(Boolean)
      .slice(0, 24);
  }

  if (body.generateSuggestedOpens === true) {
    if (
      !topicId ||
      !COACH_TOPICS.some((t) => t.id === topicId) ||
      !level ||
      !["beginner", "intermediate", "advanced"].includes(level)
    ) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const llm = resolveServerLlm();
    const presetStarters =
      customTopic !== null
        ? startersForCustom(level)
        : startersFor(topicId, level);
    if (!llm) {
      return Response.json(
        {
          error: "no_api_key",
          fallback: {
            starters: shuffleCopy(presetStarters).slice(0, 3),
          },
        },
        { status: 503 },
      );
    }

    const excludeHint =
      excludeStarters.length > 0
        ? `\nDo not repeat or closely paraphrase any of these (offer fresh angles):\n${excludeStarters.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
        : "";

    const system = [
      "You are IdleEnglish's AI coach helper.",
      topicBlock(topicId, customTopic),
      levelInstructions(level),
      `Suggest exactly 3 short English opener prompts the learner can tap to begin chatting — practical, specific to the scenario, one sentence each or two short clauses max.`,
      excludeHint,
      `Respond as ONE JSON object only (no markdown fences): {"starters":["...","...","..."]}`,
    ].join("\n");

    try {
      const res = await postChatCompletion(llm, {
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              "Generate 3 distinct suggested openers now (JSON object only).",
          },
        ],
        temperature: 0.82,
        response_format: { type: "json_object" },
      });

      const rawBody = await res.text();

      if (!res.ok) {
        let detail: string | undefined;
        try {
          const parsed = JSON.parse(rawBody) as {
            error?: { message?: string };
          };
          const msg = parsed?.error?.message;
          if (typeof msg === "string" && msg.trim()) {
            detail = msg.trim().slice(0, 800);
          }
        } catch {
          /* non-JSON error body */
        }
        return Response.json(
          {
            error: "upstream_error",
            upstreamStatus: res.status,
            ...(detail ? { detail } : {}),
          },
          { status: 502 },
        );
      }

      let data: unknown;
      try {
        data = JSON.parse(rawBody) as unknown;
      } catch {
        return Response.json({ error: "invalid_upstream_json" }, { status: 502 });
      }
      const raw = chatCompletionAssistantText(data)?.trim();
      if (!raw) {
        return Response.json({ error: "empty_model" }, { status: 502 });
      }

      const starters = parseSuggestedOpensPayload(raw);
      if (!starters) {
        return Response.json({ error: "bad_payload", raw }, { status: 502 });
      }

      return Response.json({ starters });
    } catch {
      return Response.json({ error: "exception" }, { status: 500 });
    }
  }

  const llm = resolveServerLlm();
  if (!llm) {
    return Response.json(
      {
        error: "no_api_key",
        fallback: {
          reply: `${describeMissingLlmEnv()} Until then, try writing one English sentence about your day and read it aloud twice.`,
          corrections: [],
          suggestions: [
            "Describe your last code review in one English sentence.",
            "How would you greet a teammate you haven't seen in a week?",
          ],
        },
      },
      { status: 503 },
    );
  }

  if (
    !topicId ||
    !COACH_TOPICS.some((t) => t.id === topicId) ||
    !level ||
    !["beginner", "intermediate", "advanced"].includes(level) ||
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user" || typeof last.content !== "string") {
    return Response.json({ error: "invalid_messages" }, { status: 400 });
  }

  const trimmedHistory = messages.slice(-14).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 4000),
  }));

  const system = [
    "You are IdleEnglish's friendly AI speaking partner and coach.",
    topicBlock(topicId, customTopic),
    levelInstructions(level),
    "Always stay in character as a supportive tutor; no medical, legal, or unsafe content.",
    topicId === "fix_errors"
      ? "Prioritize spotting errors in the user's LATEST message. If there are errors, list them in corrections with the exact substring that was wrong when possible."
      : "Only add corrections when the user's latest English has clear mistakes worth fixing; otherwise corrections may be empty.",
    `Respond as ONE JSON object only (no markdown fences). Keys:
- reply (string): your conversational answer to the learner; plain text or light Markdown (**bold** ok).
- corrections (array, max 5 items): objects { wrong, better, why? } drawn from the user's latest message when relevant.
- suggestions (array of 2–3 strings): short next prompts tailored to ${level} level and the selected topic.`,
    "If no corrections are needed, use an empty array for corrections.",
  ].join("\n");

  try {
    const res = await postChatCompletion(llm, {
      messages: [
        { role: "system", content: system },
        ...trimmedHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      temperature: 0.55,
      response_format: { type: "json_object" },
    });

    const rawBody = await res.text();

    if (!res.ok) {
      let detail: string | undefined;
      try {
        const parsed = JSON.parse(rawBody) as {
          error?: { message?: string };
        };
        const msg = parsed?.error?.message;
        if (typeof msg === "string" && msg.trim()) {
          detail = msg.trim().slice(0, 800);
        }
      } catch {
        /* non-JSON error body */
      }
      return Response.json(
        {
          error: "upstream_error",
          upstreamStatus: res.status,
          ...(detail ? { detail } : {}),
        },
        { status: 502 },
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(rawBody) as unknown;
    } catch {
      return Response.json({ error: "invalid_upstream_json" }, { status: 502 });
    }
    const raw = chatCompletionAssistantText(data)?.trim();
    if (!raw) {
      return Response.json({ error: "empty_model" }, { status: 502 });
    }

    const parsed = parseCoachPayload(raw);
    if (!parsed) {
      return Response.json({ error: "bad_payload", raw }, { status: 502 });
    }

    const corrections = (parsed.corrections ?? [])
      .filter(
        (c) =>
          typeof c.wrong === "string" &&
          typeof c.better === "string" &&
          c.wrong.trim() &&
          c.better.trim(),
      )
      .slice(0, 5)
      .map((c) => ({
        wrong: c.wrong.trim(),
        better: c.better.trim(),
        ...(typeof c.why === "string" && c.why.trim()
          ? { why: c.why.trim() }
          : {}),
      }));

    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => typeof s === "string" && s.trim())
      .slice(0, 4);

    return Response.json({
      reply: parsed.reply,
      corrections,
      suggestions,
    });
  } catch {
    return Response.json({ error: "exception" }, { status: 500 });
  }
}
