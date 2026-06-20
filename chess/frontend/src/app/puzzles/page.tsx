"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, Square } from "chess.js";
import {
  CheckCircle2,
  Flame,
  Lightbulb,
  Puzzle as PuzzleIcon,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import { api, ApiError, HintOut, PuzzleOut } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { BOARD_THEMES, usePreferencesStore } from "@/store/preferences";

type Feedback = { kind: "correct" | "wrong" | "solved" | "error"; text: string } | null;

const PIECE_LABEL: Record<string, string> = {
  p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King",
};

export default function PuzzlesPage() {
  const { isAuthenticated } = useAuthStore();
  const { boardTheme } = usePreferencesStore();
  const gameRef = useRef(new Chess());
  const genRef = useRef(0); // incremented on reset to cancel stale timeouts
  const [puzzle, setPuzzle] = useState<PuzzleOut | null>(null);
  const [fen, setFen] = useState("");
  const [solverStep, setSolverStep] = useState(0); // which solver move we're on (0-indexed)
  const [solved, setSolved] = useState(false);
  const [locked, setLocked] = useState(false); // true while opponent's auto-reply is animating
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loading, setLoading] = useState(true);
  const [hints, setHints] = useState<HintOut[]>([]);
  const [hintArrow, setHintArrow] = useState<[string, string, string][]>([]);
  const [hintError, setHintError] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);

  const load = useCallback(async (mode: "daily" | "next" = "daily") => {
    setLoading(true);
    setFeedback(null);
    setSolved(false);
    setLocked(false);
    setHints([]);
    setHintArrow([]);
    setHintError(null);
    try {
      const p =
        mode === "next" && isAuthenticated
          ? await api.nextPuzzle()
          : await api.dailyPuzzle();
      const g = new Chess(p.fen);
      gameRef.current = g;
      setPuzzle(p);
      setFen(g.fen());
      setSolverStep(0);
    } catch {
      setFeedback({ kind: "error", text: "Couldn't load a puzzle. Try again in a moment." });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load("daily");
  }, [load]);

  const finishSolved = useCallback(async (puzzleId: number) => {
    setSolved(true);
    setFeedback({ kind: "solved", text: "Puzzle solved! Well done." });
    if (isAuthenticated) {
      try {
        const solverMoves = gameRef.current
          .history({ verbose: true })
          .filter((_, i) => i % 2 === 0)
          .map((m) => m.from + m.to + (m.promotion || ""));
        const res = await api.solvePuzzle(puzzleId, solverMoves);
        setRating(res.new_rating);
        setStreak(res.streak);
      } catch {
        /* rating sync is best-effort */
      }
    }
  }, [isAuthenticated]);

  const onDrop = (from: string, to: string) => {
    if (!puzzle || solved || locked) return false;
    const game = gameRef.current;
    const piece = game.get(from as Square);
    const pieceLabel = piece ? PIECE_LABEL[piece.type] : "Piece";

    let move;
    try {
      move = game.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;

    const uci = move.from + move.to + (move.promotion || "");
    setHintArrow([]);

    const gen = genRef.current;
    setLocked(true);
    api
      .checkPuzzleMove(puzzle.id, solverStep, uci)
      .then((res) => {
        if (genRef.current !== gen) return; // puzzle was reset mid-flight
        if (!res.correct) {
          game.undo();
          setFen(game.fen());
          setFeedback({ kind: "wrong", text: `${pieceLabel} ${from}→${to} isn't the best move here. Try again.` });
          setLocked(false);
          return;
        }

        setFen(game.fen());
        setFeedback({ kind: "correct", text: `${pieceLabel} ${from}→${to} — correct!` });

        if (res.is_last) {
          finishSolved(puzzle.id);
          setLocked(false);
          return;
        }

        // Auto-play the opponent's scripted reply, then unlock for the next solver move.
        if (res.opponent_reply) {
          setTimeout(() => {
            if (genRef.current !== gen) return; // puzzle was reset during the delay
            game.move({
              from: res.opponent_reply!.slice(0, 2),
              to: res.opponent_reply!.slice(2, 4),
              promotion: res.opponent_reply!.slice(4) || undefined,
            });
            setFen(game.fen());
            setSolverStep((s) => s + 1);
            setLocked(false);
          }, 500);
        } else {
          setSolverStep((s) => s + 1);
          setLocked(false);
        }
      })
      .catch(() => {
        game.undo();
        setFen(game.fen());
        setFeedback({ kind: "error", text: "Couldn't check that move. Try again." });
        setLocked(false);
      });

    return true;
  };

  const requestHint = async () => {
    if (!puzzle) return;
    setHintError(null);
    setHintLoading(true);
    try {
      const hint = await api.puzzleHint(puzzle.id, solverStep);
      setHints((h) => [...h, hint]);
      setHintArrow([[hint.move.slice(0, 2), hint.move.slice(2, 4), "rgb(234,179,8)"]]);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setHintError("Daily hint limit reached. Upgrade to Pro for unlimited hints.");
      } else if (e instanceof ApiError && e.status === 401) {
        setHintError("Login to use hints.");
      } else if (e instanceof ApiError && e.status === 404) {
        setHintError("No more hints for this puzzle.");
      } else {
        setHintError("Couldn't load a hint right now.");
      }
    } finally {
      setHintLoading(false);
    }
  };

  const reset = () => {
    if (!puzzle) return;
    genRef.current += 1; // cancel any pending timeouts from the previous attempt
    const g = new Chess(puzzle.fen);
    gameRef.current = g;
    setFen(g.fen());
    setSolverStep(0);
    setSolved(false);
    setLocked(false);
    setFeedback(null);
    setHintArrow([]);
  };

  const currentHint = hints[solverStep] ?? hints[hints.length - 1];

  return (
    <div className="container-px py-12">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <PuzzleIcon className="h-6 w-6 text-brand" /> Daily Puzzle
      </h1>
      <p className="mt-1 text-sm text-gray-400">
        Find the best move. Use hints any time — they show the move with pros and cons.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="w-[min(80vw,480px)]">
          {fen && (
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              customArrows={hintArrow as never}
              customDarkSquareStyle={{ backgroundColor: BOARD_THEMES[boardTheme].dark }}
              customLightSquareStyle={{ backgroundColor: BOARD_THEMES[boardTheme].light }}
              customBoardStyle={{ borderRadius: "12px" }}
            />
          )}
          <div className="mt-3 flex items-center justify-between">
            <button onClick={reset} className="btn-ghost px-3 py-1.5 text-sm">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            <button
              onClick={() => load(isAuthenticated ? "next" : "daily")}
              className="btn-primary px-4 py-1.5 text-sm"
            >
              Next Puzzle →
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {puzzle && (
            <div className="card">
              <p className="text-sm text-gray-400">Rating</p>
              <p className="text-2xl font-bold">{puzzle.rating}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {puzzle.themes.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface-DEFAULT px-3 py-1 text-xs text-gray-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {(rating !== null || streak !== null) && (
                <div className="mt-4 flex gap-4 border-t border-surface-border pt-3 text-sm">
                  {rating !== null && (
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <Trophy className="h-4 w-4 text-brand" /> {rating}
                    </span>
                  )}
                  {streak !== null && (
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <Flame className="h-4 w-4 text-orange-400" /> {streak} streak
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {feedback && (
            <div
              className={`card flex items-start gap-2 ${
                feedback.kind === "wrong" || feedback.kind === "error"
                  ? "border-red-500/40"
                  : feedback.kind === "solved"
                  ? "border-brand/40"
                  : ""
              }`}
            >
              {feedback.kind === "solved" && <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" />}
              {(feedback.kind === "wrong" || feedback.kind === "error") && (
                <XCircle className="h-5 w-5 shrink-0 text-red-400" />
              )}
              <p className="text-sm text-gray-200">{feedback.text}</p>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold">
                <Lightbulb className="h-4 w-4 text-yellow-400" /> Hints
              </h3>
              <button
                onClick={requestHint}
                disabled={hintLoading || solved || locked}
                className="btn-ghost px-3 py-1 text-xs disabled:opacity-50"
              >
                {hintLoading ? "Loading…" : "Get a hint"}
              </button>
            </div>

            {hintError && <p className="mt-3 text-sm text-amber-400">{hintError}</p>}

            {currentHint && (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-mono text-brand">{currentHint.move}</p>
                <p className="text-gray-300">
                  <span className="font-semibold text-green-400">Pros: </span>
                  {currentHint.pros}
                </p>
                <p className="text-gray-300">
                  <span className="font-semibold text-red-400">Cons: </span>
                  {currentHint.cons}
                </p>
                {currentHint.hints_remaining_today !== null && (
                  <p className="text-xs text-gray-500">
                    {currentHint.hints_remaining_today} free hint
                    {currentHint.hints_remaining_today === 1 ? "" : "s"} left today.{" "}
                    <span className="text-brand">Upgrade for unlimited.</span>
                  </p>
                )}
              </div>
            )}

            {!currentHint && !hintError && (
              <p className="mt-3 text-sm text-gray-500">
                Stuck? Click &quot;Get a hint&quot; to reveal the next move with pros and cons.
              </p>
            )}
          </div>

          {loading && <div className="card text-sm text-gray-400">Loading puzzle…</div>}
        </div>
      </div>
    </div>
  );
}
