import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BoardTheme = "classic" | "wooden" | "ocean" | "night" | "ice";

export const BOARD_THEMES: Record<BoardTheme, { name: string; dark: string; light: string }> = {
  classic: { name: "Classic",  dark: "#739552", light: "#ebecd0" },
  wooden:  { name: "Wooden",   dark: "#b58863", light: "#f0d9b5" },
  ocean:   { name: "Ocean",    dark: "#4b7db5", light: "#d5e8f5" },
  night:   { name: "Night",    dark: "#2d2d44", light: "#5a5a7a" },
  ice:     { name: "Ice",      dark: "#6ba3be", light: "#dce8f0" },
};

interface PreferencesState {
  // Coaching
  defaultDifficulty: number;      // 0=Guru 1=Beginner 2=Intermediate 3=Advanced 4=Master
  autoPlayTts: boolean;            // auto-start TTS in Guru mode
  ttsRate: number;                 // 0.7 | 1.0 | 1.3
  // Board
  boardTheme: BoardTheme;
  showLegalHints: boolean;
  alwaysWhiteBottom: boolean;      // false = auto-flip in friend vs-friend mode
  // Profile (local copy, synced to backend on save)
  displayName: string;
  // Setters
  setDefaultDifficulty: (v: number) => void;
  setAutoPlayTts: (v: boolean) => void;
  setTtsRate: (v: number) => void;
  setBoardTheme: (v: BoardTheme) => void;
  setShowLegalHints: (v: boolean) => void;
  setAlwaysWhiteBottom: (v: boolean) => void;
  setDisplayName: (v: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      defaultDifficulty: 1,
      autoPlayTts: true,
      ttsRate: 1.0,
      boardTheme: "classic",
      showLegalHints: true,
      alwaysWhiteBottom: false,
      displayName: "",
      setDefaultDifficulty: (v) => set({ defaultDifficulty: v }),
      setAutoPlayTts:       (v) => set({ autoPlayTts: v }),
      setTtsRate:           (v) => set({ ttsRate: v }),
      setBoardTheme:        (v) => set({ boardTheme: v }),
      setShowLegalHints:    (v) => set({ showLegalHints: v }),
      setAlwaysWhiteBottom: (v) => set({ alwaysWhiteBottom: v }),
      setDisplayName:       (v) => set({ displayName: v }),
    }),
    { name: "cm-preferences" }
  )
);
