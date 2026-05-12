import type { CoachTopicId } from "@/data/coach-topics";
import { COACH_TOPICS } from "@/data/coach-topics";
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "no_api_key",
        fallback: {
          reply:
            "Add `OPENAI_API_KEY` to your environment to chat with the AI coach. Until then, try writing one English sentence about your day and read it aloud twice.",
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

  let body: {
    topicId?: CoachTopicId;
    level?: LearnerLevel;
    messages?: ChatMessage[];
    customTopic?: string | null;
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
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          ...trimmedHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        temperature: 0.55,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      return Response.json({ error: "upstream_error" }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
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
