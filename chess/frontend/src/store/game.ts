import { create } from "zustand";
import { usePreferencesStore } from "./preferences";

export type GameMode = "ai" | "friend";

export interface LastMove {
  fenBefore: string;
  uci: string;
  mover: "player" | "ai";
}

interface MoveCtx { uci: string; fenBefore: string; }

interface GameState {
  // Move history as UCI strings — used to reconstruct Chess game on remount
  moves: string[];
  mode: GameMode;
  diffIdx: number;
  lastMove: LastMove | null;
  lastPlayerMoveCtx: MoveCtx | null;
  lastAiMoveCtx: MoveCtx | null;
  scoreCp: number;
  mate: number | null;

  pushMove: (uci: string) => void;
  setMode: (m: GameMode) => void;
  setDiffIdx: (i: number) => void;
  setLastMove: (m: LastMove | null) => void;
  setLastPlayerMoveCtx: (m: MoveCtx | null) => void;
  setLastAiMoveCtx: (m: MoveCtx | null) => void;
  setScore: (cp: number, mate: number | null) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  moves: [],
  mode: "ai",
  diffIdx: usePreferencesStore.getState().defaultDifficulty,
  lastMove: null,
  lastPlayerMoveCtx: null,
  lastAiMoveCtx: null,
  scoreCp: 0,
  mate: null,

  pushMove:             (uci) => set((s) => ({ moves: [...s.moves, uci] })),
  setMode:              (mode) => set({ mode }),
  setDiffIdx:           (diffIdx) => set({ diffIdx }),
  setLastMove:          (lastMove) => set({ lastMove }),
  setLastPlayerMoveCtx: (lastPlayerMoveCtx) => set({ lastPlayerMoveCtx }),
  setLastAiMoveCtx:     (lastAiMoveCtx) => set({ lastAiMoveCtx }),
  setScore:             (scoreCp, mate) => set({ scoreCp, mate }),
  // resetGame clears board state but preserves mode/diffIdx
  resetGame: () => set({ moves: [], lastMove: null, lastPlayerMoveCtx: null, lastAiMoveCtx: null, scoreCp: 0, mate: null }),
}));
