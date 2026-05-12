import type { BrowserSpeechLocale } from "@/lib/web-speech";

const KEY = "idle_speech_voice_prefs_v1";

export const IDLE_SPEECH_VOICE_PREFS_CHANGED =
  "idle-speech-voice-prefs-changed";

export type SpeechVoicePrefsState = {
  /** Empty string = browser default for locale */
  enVoiceUri: string;
  viVoiceUri: string;
};

const DEFAULT_STATE: SpeechVoicePrefsState = {
  enVoiceUri: "",
  viVoiceUri: "",
};

function normalizeUri(raw: unknown): string {
  if (raw !== null && typeof raw === "string") return raw.trim();
  return "";
}

export function readSpeechVoicePreferences(): SpeechVoicePrefsState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KEY) ?? "",
    ) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_STATE };
    const o = parsed as Record<string, unknown>;
    return {
      enVoiceUri: normalizeUri(o.enVoiceUri),
      viVoiceUri: normalizeUri(o.viVoiceUri),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeSpeechVoicePreferences(next: SpeechVoicePrefsState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        enVoiceUri: normalizeUri(next.enVoiceUri),
        viVoiceUri: normalizeUri(next.viVoiceUri),
      }),
    );
    window.dispatchEvent(new Event(IDLE_SPEECH_VOICE_PREFS_CHANGED));
  } catch {
    /* noop */
  }
}

/** Voice URI to pass into `speakText` options, or null to use automatic pairing */
export function voiceUriForSpeakLang(
  lang: BrowserSpeechLocale,
): string | null {
  const p = readSpeechVoicePreferences();
  const uri = lang === "vi-VN" ? p.viVoiceUri : p.enVoiceUri;
  return uri || null;
}
