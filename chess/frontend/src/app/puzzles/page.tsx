"use client";

import { useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Puzzle as PuzzleIcon } from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Puzzle {
  id: number;
  fen: string;
  rating: number;
  themes: string[];
  setup_move: string | null;
}

export default function PuzzlesPage() {
  const gameRef = useRef(new Chess());
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [fen, setFen] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = async () => {
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/puzzles/daily`);
      const p: Puzzle = await res.json();
      const g = new Chess(p.fen);
      if (p.setup_move) {
        // Play the setup move so the solver sees the puzzle position.
        g.move({
          from: p.setup_move.slice(0, 2),
          to: p.setup_move.slice(2, 4),
          promotion: p.setup_move.slice(4) || undefined,
        });
      }
      gameRef.current = g;
      setPuzzle(p);
      setFen(g.fen());
    } catch {
      setFeedback("പസിലുകൾ ലോഡ് ചെയ്യാനായില്ല. ബാക്കെൻഡ് സീഡ് ചെയ്യൂ.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDrop = (from: string, to: string) => {
    try {
      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;
      setFen(gameRef.current.fen());
      setFeedback("ശരി! അടുത്ത നീക്കം തുടരൂ. ✅");
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="container-px py-12">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <PuzzleIcon className="h-6 w-6 text-brand" /> ദിവസേനയുള്ള പസിൽ
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="w-[min(80vw,480px)]">
          {fen && (
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              customDarkSquareStyle={{ backgroundColor: "#739552" }}
              customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
              customBoardStyle={{ borderRadius: "12px" }}
            />
          )}
        </div>
        <div className="space-y-4">
          {puzzle && (
            <div className="card">
              <p className="text-sm text-gray-400">റേറ്റിംഗ്</p>
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
            </div>
          )}
          {feedback && (
            <div className="card font-ml text-gray-200">{feedback}</div>
          )}
          <button onClick={load} className="btn-ghost">
            അടുത്ത പസിൽ
          </button>
        </div>
      </div>
    </div>
  );
}
