"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { BoardArrow, BoardSquares } from "@/components/coach-panel";
import Link from "next/link";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { BookOpen, Cpu, GraduationCap, HelpCircle, RotateCcw, Sparkles, Users, Wifi } from "lucide-react";
import { EvalBar } from "@/components/eval-bar";
import { CoachPanel } from "@/components/coach-panel";
import { api, type MoveAnalysisResponse } from "@/lib/api";
import { stopSpeaking } from "@/lib/speak";
import { useLanguageStore } from "@/store/language";
import { loadProgress, saveProgress } from "@/lib/curriculum";

type Mode = "ai" | "friend";

const DIFFICULTIES = [
  {
    label: "Guru",
    ml: "ഗുരു",
    sublabel: "Baby AI + auto coaching",
    skill: 0,
    guruMode: true,
    color: "text-purple-400",
  },
  {
    label: "Beginner",
    ml: "തുടക്കക്കാരൻ",
    sublabel: "Easy AI",
    skill: 2,
    guruMode: false,
    color: "text-emerald-400",
  },
  {
    label: "Intermediate",
    ml: "ഇടത്തരം",
    sublabel: "Moderate AI",
    skill: 8,
    guruMode: false,
    color: "text-yellow-400",
  },
  {
    label: "Advanced",
    ml: "വിദഗ്ധൻ",
    sublabel: "Strong AI",
    skill: 14,
    guruMode: false,
    color: "text-orange-400",
  },
  {
    label: "Master",
    ml: "മാസ്റ്റർ",
    sublabel: "Very strong",
    skill: 20,
    guruMode: false,
    color: "text-red-400",
  },
];

interface LastMove {
  fenBefore: string;
  uci: string;
  mover: "player" | "ai";
}

export default function PlayPage() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());

  // Track the last move by each side (refs = immediately available, no async lag)
  type MoveCtx = { uci: string; fenBefore: string };
  const lastPlayerMoveRef = useRef<MoveCtx | null>(null);
  const lastAiMoveRef     = useRef<MoveCtx | null>(null);
  const [mode, setMode] = useState<Mode>("ai");
  const [diffIdx, setDiffIdx] = useState(1); // default: Beginner
  const langCode = useLanguageStore((s) => s.code);

  const diff = DIFFICULTIES[diffIdx];

  const [scoreCp, setScoreCp] = useState(0);
  const [mate, setMate] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);

  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [coach, setCoach] = useState<MoveAnalysisResponse | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachLabel, setCoachLabel] = useState<"your_move" | "ai_move">("your_move");

  // Board visual annotations driven by CoachPanel step interactions
  const [boardArrows, setBoardArrows] = useState<BoardArrow[]>([]);
  const [boardSquares, setBoardSquares] = useState<BoardSquares>({});

  const handleAnnotate = useCallback((arrows: BoardArrow[], squareStyles: BoardSquares) => {
    setBoardArrows(arrows);
    setBoardSquares(squareStyles);
  }, []);

  const status = useMemo(() => {
    const g = gameRef.current;
    if (g.isCheckmate()) return "Checkmate! 🏁";
    if (g.isDraw()) return "Draw";
    if (g.isCheck()) return "Check!";
    return g.turn() === "w" ? "White's turn" : "Black's turn";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  const orientation: "white" | "black" =
    mode === "friend" ? (gameRef.current.turn() === "w" ? "white" : "black") : "white";

  const refreshEval = useCallback(async (currentFen: string) => {
    try {
      const res = await api.evaluate(currentFen, 12);
      setScoreCp(res.score_cp);
      setMate(res.mate);
    } catch {
      /* engine optional */
    }
  }, []);

  // Fetch coaching analysis — used both for manual "Why?" and auto-coaching
  const fetchCoaching = useCallback(
    async (
      fenBefore: string,
      uci: string,
      mover: "player" | "ai",
      oppUci?: string | null,
      oppFen?: string | null,
    ) => {
      setCoachLoading(true);
      setCoachError(null);
      setCoach(null);
      setCoachLabel(mover === "ai" ? "ai_move" : "your_move");
      try {
        const level = diff.guruMode ? "guru" : diff.skill <= 2 ? "beginner" : diff.skill <= 14 ? "intermediate" : "advanced";
        const res = await api.analyzeMove(fenBefore, uci, level, langCode, oppUci, oppFen);
        setCoach(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        setCoachError(
          msg.toLowerCase().includes("auth") || msg.includes("401")
            ? "Coach explanations need login. Please log in and try again."
            : "Couldn't explain that move right now. Please try again."
        );
      } finally {
        setCoachLoading(false);
      }
    },
    [diff.skill, langCode]
  );

  const aiMove = useCallback(async () => {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    setThinking(true);
    try {
      const fenBefore = g.fen();
      const { best_move_uci } = await api.bestMove(fenBefore, diff.skill);
      if (best_move_uci) {
        g.move({
          from: best_move_uci.slice(0, 2),
          to: best_move_uci.slice(2, 4),
          promotion: best_move_uci.slice(4) || undefined,
        });
        const newFen = g.fen();
        setFen(newFen);
        const lm: LastMove = { fenBefore, uci: best_move_uci, mover: "ai" };
        setLastMove(lm);
        // Record AI's move so it can later serve as opponent context for the player's next move
        const prevPlayerCtx = lastPlayerMoveRef.current;
        lastAiMoveRef.current = { uci: best_move_uci, fenBefore };
        refreshEval(newFen);

        // Auto-coaching in Guru mode: always explain the AI's move
        // Opponent context = the player's last move (what triggered this AI response)
        if (diff.guruMode && !g.isGameOver()) {
          fetchCoaching(fenBefore, best_move_uci, "ai", prevPlayerCtx?.uci, prevPlayerCtx?.fenBefore);
        }

        // Record game played for belt XP
        const p = loadProgress();
        const beltId = p.beltsEarned.length > 0 ? p.beltsEarned[p.beltsEarned.length - 1] : "white";
        const updated = {
          ...p,
          gamesPlayed: {
            ...p.gamesPlayed,
            [beltId]: (p.gamesPlayed[beltId] ?? 0) + (g.isGameOver() ? 1 : 0),
          },
        };
        if (g.isGameOver()) saveProgress(updated);
      }
    } catch {
      /* ignore */
    } finally {
      setThinking(false);
    }
  }, [diff, refreshEval, fetchCoaching]);

  const onDrop = useCallback(
    (from: string, to: string): boolean => {
      const g = gameRef.current;
      const fenBefore = g.fen();
      let move;
      try {
        move = g.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;

      const uci = move.from + move.to + (move.promotion ?? "");
      // Record player's move before AI responds, so aiMove can use it as opponent context
      lastPlayerMoveRef.current = { uci, fenBefore };
      setFen(g.fen());
      setLastMove({ fenBefore, uci, mover: "player" });
      setCoach(null);
      setCoachError(null);
      setBoardArrows([]);
      setBoardSquares({});
      stopSpeaking();
      refreshEval(g.fen());

      if (mode === "ai" && !g.isGameOver()) {
        setTimeout(aiMove, 400);
      }
      return true;
    },
    [aiMove, refreshEval, mode]
  );

  const explainLast = useCallback(async () => {
    if (!lastMove) return;
    // Opponent context: if explaining the player's move → AI was the opponent; and vice-versa
    const oppCtx = lastMove.mover === "player"
      ? lastAiMoveRef.current
      : lastPlayerMoveRef.current;
    fetchCoaching(lastMove.fenBefore, lastMove.uci, lastMove.mover, oppCtx?.uci, oppCtx?.fenBefore);
  }, [lastMove, fetchCoaching]);

  const reset = () => {
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setLastMove(null);
    setCoach(null);
    setCoachError(null);
    setScoreCp(0);
    setMate(null);
    setBoardArrows([]);
    setBoardSquares({});
    stopSpeaking();
    lastPlayerMoveRef.current = null;
    lastAiMoveRef.current     = null;
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  return (
    <div className="container-px py-8">
      {/* Mode selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        <ModeButton
          active={mode === "ai"}
          onClick={() => switchMode("ai")}
          icon={<Cpu className="h-4 w-4" />}
          label="vs Computer"
        />
        <ModeButton
          active={mode === "friend"}
          onClick={() => switchMode("friend")}
          icon={<Users className="h-4 w-4" />}
          label="vs Friend"
        />
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-surface-border px-4 py-2 text-sm text-gray-600"
        >
          <Wifi className="h-4 w-4" /> Online
          <span className="rounded bg-surface-border px-1.5 py-0.5 text-[10px] text-gray-400">
            Soon
          </span>
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Board column */}
        <div className="flex gap-3">
          <div className="h-[min(80vw,520px)]">
            <EvalBar scoreCp={scoreCp} mate={mate} />
          </div>
          <div className="w-[min(80vw,520px)]">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={orientation}
              customBoardStyle={{ borderRadius: "12px" }}
              customDarkSquareStyle={{ backgroundColor: "#739552" }}
              customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
              customArrows={boardArrows as any}
              customSquareStyles={boardSquares}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="font-ml text-sm text-gray-300">{status}</span>
              <button onClick={reset} className="btn-ghost px-3 py-1.5 text-sm">
                <RotateCcw className="h-4 w-4" /> പുതിയ ഗെയിം
              </button>
            </div>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-5">
          {mode === "ai" && (
            <div className="card space-y-4">
              {/* Difficulty header */}
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Cpu className="h-4 w-4 text-brand" /> AI Strength
                {thinking && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                    Thinking…
                  </span>
                )}
              </div>

              {/* Difficulty buttons */}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-5">
                {DIFFICULTIES.map((d, i) => (
                  <button
                    key={d.label}
                    onClick={() => { setDiffIdx(i); reset(); }}
                    className={`relative rounded-lg border px-2 py-2.5 text-xs transition ${
                      diffIdx === i
                        ? "border-brand bg-brand/10 text-white"
                        : "border-surface-border text-gray-400 hover:text-white"
                    }`}
                  >
                    {d.guruMode && (
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-purple-600 px-1 py-0.5 text-[8px] font-bold text-white">
                        GURU
                      </span>
                    )}
                    <span className={`block font-medium ${diffIdx === i ? "text-white" : d.color}`}>
                      {d.ml}
                    </span>
                    <span className="block text-[10px] text-gray-500">{d.sublabel}</span>
                  </button>
                ))}
              </div>

              {/* Guru mode banner */}
              {diff.guruMode && (
                <div className="flex items-start gap-2 rounded-lg border border-purple-800/50 bg-purple-950/30 p-3 text-xs text-purple-300">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Guru Mode Active</p>
                    <p className="mt-0.5 text-purple-400/80">
                      After every AI move, your Guru automatically explains why the AI played that move and suggests your best responses — all in your language.
                    </p>
                  </div>
                </div>
              )}

              {/* Manual explain button (non-guru modes) */}
              {!diff.guruMode && (
                <button
                  onClick={explainLast}
                  disabled={!lastMove || coachLoading}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  <HelpCircle className="h-4 w-4" /> Why? — explain last move
                </button>
              )}

              {/* Guru mode: show label above coaching */}
              {diff.guruMode && lastMove && (
                <button
                  onClick={explainLast}
                  disabled={coachLoading}
                  className="btn-ghost w-full text-xs disabled:opacity-50"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  {coachLabel === "ai_move" ? "Re-explain AI's move" : "Explain my last move"}
                </button>
              )}
            </div>
          )}

          {mode === "friend" ? (
            <div className="card font-ml text-sm text-gray-300">
              <p className="mb-1 font-semibold text-white">Pass &amp; play 👥</p>
              രണ്ടുപേർ ഒരേ device-ൽ മാറിമാറി കളിക്കൂ. ഓരോ move-നും ശേഷം board
              തിരിയും. (AI coach ഈ mode-ൽ ഇല്ല.)
            </div>
          ) : (
            <>
              {/* Coaching panel */}
              <CoachPanel
                analysis={coach}
                loading={coachLoading}
                error={coachError}
                headerLabel={
                  coachLabel === "ai_move"
                    ? "Guru: AI played this because…"
                    : undefined
                }
                moveUci={lastMove?.uci}
                onAnnotate={handleAnnotate}
                autoPlay={diff.guruMode}
              />

              {/* Onboarding hint for total beginners */}
              {!lastMove && !coachLoading && (
                <div className="card flex items-start gap-3 border-dashed text-sm text-gray-500">
                  <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                  <div>
                    <p className="font-medium text-gray-300">New to chess?</p>
                    <p className="mt-0.5">
                      Start with{" "}
                      <Link href="/learn/pieces" className="text-brand hover:underline">
                        Piece Trainer
                      </Link>{" "}
                      or{" "}
                      <Link href="/onboarding" className="text-brand hover:underline">
                        take the full tour
                      </Link>
                      . Then come back and try{" "}
                      <strong className="text-purple-300">Guru Mode</strong> above.
                    </p>
                  </div>
                </div>
              )}

              {/* Learning path link */}
              <Link
                href="/learn"
                className="flex items-center gap-2 rounded-xl border border-surface-border px-4 py-3 text-sm text-gray-400 transition hover:border-brand hover:text-white"
              >
                <BookOpen className="h-4 w-4 text-brand" />
                <div>
                  <p className="font-medium text-white">Learning Hub</p>
                  <p className="text-xs text-gray-500">Track your belt progress & daily mission</p>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-ml transition ${
        active
          ? "border-brand bg-brand/10 text-white"
          : "border-surface-border text-gray-400 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
