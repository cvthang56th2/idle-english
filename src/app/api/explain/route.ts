import {
  chatCompletionAssistantText,
  postChatCompletion,
  resolveServerLlm,
} from "@/lib/server-llm";
import type { LessonCard } from "@/types/card";

function summarizeCard(card: LessonCard): string {
  const c = card.content;
  if ("wrong" in c && "correct" in c) {
    return `Contrast "${c.wrong}" vs "${c.correct}".`;
  }
  if ("term" in c) {
    return `Vocabulary focus: "${c.term}".`;
  }
  if ("word" in c) {
    return `Pronunciation focus: "${c.word}".`;
  }
  if ("phrase" in c) {
    return `Phrase: "${c.phrase}".`;
  }
  return "";
}

function fallbackExplain(card: LessonCard): string {
  const hook = summarizeCard(card);
  return [
    hook,
    "",
    card.explanation,
    "",
    `Example: ${card.example}`,
    "",
    "Tip: say it out loud once, then reuse it in a sentence about your day.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as { card?: LessonCard };
  const card = body.card;
  if (!card) {
    return Response.json({ error: "missing_card" }, { status: 400 });
  }

  const llm = resolveServerLlm();
  if (!llm) {
    return Response.json({ text: fallbackExplain(card) });
  }

  try {
    const prompt = `You are a friendly English coach for software developers waiting on builds. Explain this lesson simply (max 120 words), with one actionable tip.

Title: ${card.title}
Type: ${card.type}
Explanation (authoritative): ${card.explanation}
Example: ${card.example}
JSON content: ${JSON.stringify(card.content)}`;

    const res = await postChatCompletion(llm, {
      messages: [
        { role: "system", content: "Be concise and encouraging." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });

    if (!res.ok) {
      return Response.json({ text: fallbackExplain(card) });
    }

    const data = await res.json();
    const text =
      chatCompletionAssistantText(data)?.trim() || fallbackExplain(card);
    return Response.json({ text });
  } catch {
    return Response.json({ text: fallbackExplain(card) });
  }
}
