/**
 * Server-side OpenAI-compatible chat completions (OpenAI, Groq, or any `/v1`-style endpoint).
 *
 * Configure with `AI_PROVIDER`: `openai` (default) | `groq` | `custom`.
 */

export type AiProviderId = "openai" | "groq" | "custom";

const DEFAULT_OPENAI_BASE = "https://api.openai.com/v1";
const DEFAULT_GROQ_BASE = "https://api.groq.com/openai/v1";

export type ResolvedServerLlm = {
  provider: AiProviderId;
  apiKey: string;
  chatCompletionsUrl: string;
  model: string;
};

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

export function chatCompletionsUrlFromBase(base: string): string {
  return `${trimTrailingSlashes(base)}/chat/completions`;
}

function normalizeProvider(raw: string | undefined): AiProviderId {
  const p = (raw ?? "openai").toLowerCase().trim();
  if (p === "groq") return "groq";
  if (p === "custom") return "custom";
  return "openai";
}

export function resolveServerLlm(): ResolvedServerLlm | null {
  const provider = normalizeProvider(process.env.AI_PROVIDER);

  if (provider === "custom") {
    const apiKey = process.env.LLM_API_KEY?.trim();
    const base = process.env.LLM_BASE_URL?.trim();
    const model = process.env.LLM_MODEL?.trim();
    if (!apiKey || !base || !model) return null;
    return {
      provider,
      apiKey,
      chatCompletionsUrl: chatCompletionsUrlFromBase(base),
      model,
    };
  }

  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) return null;
    const base = process.env.GROQ_BASE_URL?.trim() || DEFAULT_GROQ_BASE;
    const model =
      process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
    return {
      provider,
      apiKey,
      chatCompletionsUrl: chatCompletionsUrlFromBase(base),
      model,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const base = process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  return {
    provider,
    apiKey,
    chatCompletionsUrl: chatCompletionsUrlFromBase(base),
    model,
  };
}

/** Short hint for 503 / setup messages based on current `AI_PROVIDER`. */
export function describeMissingLlmEnv(): string {
  const provider = normalizeProvider(process.env.AI_PROVIDER);
  if (provider === "groq") {
    return "Set `GROQ_API_KEY` (optional: `GROQ_MODEL`, `GROQ_BASE_URL`). See `.env.example`.";
  }
  if (provider === "custom") {
    return "Set `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` for a custom endpoint. See `.env.example`.";
  }
  return "Set `OPENAI_API_KEY` (optional: `OPENAI_MODEL`). Or use `AI_PROVIDER=groq` / `custom`. See `.env.example`.";
}

export async function postChatCompletion(
  llm: ResolvedServerLlm,
  jsonBody: Record<string, unknown>,
): Promise<Response> {
  return fetch(llm.chatCompletionsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${llm.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...jsonBody, model: llm.model }),
  });
}

export function chatCompletionAssistantText(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return undefined;
  const msg = (first as { message?: unknown }).message;
  if (typeof msg !== "object" || msg === null) return undefined;
  const content = (msg as { content?: unknown }).content;
  return typeof content === "string" ? content : undefined;
}
