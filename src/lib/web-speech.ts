/**
 * Browser Web Speech API helpers (SpeechRecognition + speechSynthesis).
 * Chrome/Edge: full support. Safari: synthesis ok; recognition varies. Firefox: limited.
 */

export type BrowserSpeechLocale = "en-US" | "vi-VN";

/** Minimal typings — TS lib.dom omits SpeechRecognition on some targets */
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type RecCtor = new () => SpeechRecognitionLike;

/** Remove light markdown and extra whitespace for TTS */
export function textForSpeech(raw: string): string {
  return raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function getRecognitionCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function prefetchSpeechVoices(): void {
  if (!speechSynthesisSupported()) return;
  const run = () => {
    window.speechSynthesis.getVoices();
  };
  run();
  window.speechSynthesis.addEventListener("voiceschanged", run, { once: true });
}

function pickVoice(lang: BrowserSpeechLocale): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const short = lang.split("-")[0]?.toLowerCase() ?? "en";
  return (
    voices.find((v) => v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(short)) ??
    null
  );
}

export type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

/** Cancels any in-flight utterance before speaking */
export function speakText(
  text: string,
  lang: BrowserSpeechLocale,
  handlers?: SpeakHandlers,
): void {
  if (!speechSynthesisSupported()) return;
  const plain = textForSpeech(text);
  if (!plain) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain);
  u.lang = lang;
  u.rate = 0.92;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;

  u.onstart = () => handlers?.onStart?.();
  u.onend = () => handlers?.onEnd?.();
  u.onerror = () => handlers?.onError?.();

  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (!speechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export type RecognitionCallbacks = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (code: string) => void;
  /** Fires when the engine stops (manual stop, abort, timeout, etc.) */
  onEnded?: () => void;
};

export type RecognitionSession = {
  stop: () => void;
};

/**
 * Continuous listening until `stop()` — streams interim transcripts.
 */
export function startContinuousRecognition(
  lang: BrowserSpeechLocale,
  callbacks: RecognitionCallbacks,
): RecognitionSession | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (event: SpeechRecognitionEventLike) => {
    let interim = "";
    let finalChunk = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const row = event.results[i];
      const piece = row[0]?.transcript ?? "";
      if (row.isFinal) finalChunk += piece;
      else interim += piece;
    }
    if (interim) callbacks.onInterim?.(interim);
    if (finalChunk.trim()) callbacks.onFinal?.(finalChunk.trim());
  };

  rec.onerror = (event: SpeechRecognitionErrorEventLike) => {
    callbacks.onError?.(event.error ?? "unknown");
  };

  rec.onend = () => {
    callbacks.onEnded?.();
  };

  try {
    rec.start();
  } catch {
    callbacks.onError?.("start_failed");
    return null;
  }

  return {
    stop: () => {
      try {
        rec.abort();
      } catch {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
      }
    },
  };
}
