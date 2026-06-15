import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Language {
  code: string;
  name: string; // shown in the switcher (native script)
  tts: string; // BCP-47 tag used for browser text-to-speech
}

/** English default, then Indian languages, then chess-world languages. */
export const LANGUAGES: Language[] = [
  { code: "en", name: "English", tts: "en-IN" },
  { code: "ml", name: "മലയാളം", tts: "ml-IN" },
  { code: "hi", name: "हिन्दी", tts: "hi-IN" },
  { code: "ta", name: "தமிழ்", tts: "ta-IN" },
  { code: "te", name: "తెలుగు", tts: "te-IN" },
  { code: "kn", name: "ಕನ್ನಡ", tts: "kn-IN" },
  { code: "ru", name: "Русский", tts: "ru-RU" },
  { code: "es", name: "Español", tts: "es-ES" },
  { code: "fr", name: "Français", tts: "fr-FR" },
  { code: "zh", name: "中文", tts: "zh-CN" },
];

export function ttsLangFor(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.tts ?? "en-IN";
}

interface LanguageState {
  code: string;
  setCode: (code: string) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      code: "en",
      setCode: (code) => set({ code }),
    }),
    { name: "cm-language" }
  )
);
