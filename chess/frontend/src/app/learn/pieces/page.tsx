"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { ArrowLeft, CheckCircle2, RotateCcw, Zap } from "lucide-react";
import { completeLesson, loadProgress, saveProgress } from "@/lib/curriculum";

interface PieceLesson {
  id: string;          // curriculum lesson id
  pieceKey: string;    // URL ?piece= param
  name_ml: string;
  name_en: string;
  square: string;
  fen: string;
  lesson_ml: string;
  lesson_en: string;
  xp: number;
}

const LESSONS: PieceLesson[] = [
  {
    id: "wb-pawn",
    pieceKey: "pawn",
    name_ml: "കാലാൾ",
    name_en: "Pawn",
    square: "e2",
    fen: "7k/8/8/8/8/8/4P3/K7 w - - 0 1",
    lesson_ml:
      "കാലാൾ എപ്പോഴും മുന്നോട്ട് മാത്രം നീങ്ങുന്നു — ഒരു കളം. ആദ്യ നീക്കത്തിൽ വേണമെങ്കിൽ രണ്ട് കളം. എതിരാളിയുടെ കരുവിനെ കോണോട്ട് (diagonal) മാത്രമേ പിടിക്കൂ. അവസാന വരിയിൽ എത്തിയാൽ ഏത് കരുവും ആകാം — ഇതാണ് Promotion!",
    lesson_en:
      "The pawn moves forward only — one square at a time. On its first move it can go two squares. It captures diagonally. When it reaches the last rank it promotes to any piece — this is called Promotion!",
    xp: 30,
  },
  {
    id: "wb-knight",
    pieceKey: "knight",
    name_ml: "കുതിര",
    name_en: "Knight",
    square: "d4",
    fen: "7k/8/8/8/3N4/8/8/K7 w - - 0 1",
    lesson_ml:
      "കുതിര 'L' ആകൃതിയിൽ നീങ്ങുന്നു — രണ്ട് കളം ഒരു ദിശയിൽ, പിന്നെ ഒരു കളം വശത്തേക്ക്. മറ്റ് കരുക്കൾക്ക് മുകളിലൂടെ ചാടാൻ കഴിയുന്ന ഒരേയൊരു കരു! ചുറ്റും കരുക്കൾ ഉണ്ടെങ്കിലും കുതിര ചാടി പോകും.",
    lesson_en:
      "The knight moves in an L-shape — two squares in one direction, then one square sideways. It is the only piece that can jump over other pieces! Knights are most powerful in the center of the board.",
    xp: 30,
  },
  {
    id: "wb-bishop",
    pieceKey: "bishop",
    name_ml: "ആന",
    name_en: "Bishop",
    square: "d5",
    fen: "7k/8/8/3B4/8/8/8/K7 w - - 0 1",
    lesson_ml:
      "ആന കോണോട്ട് (diagonal) മാത്രം നീങ്ങുന്നു — എത്ര കളം വേണമെങ്കിലും. ഓരോ ആനയും ഒരേ നിറത്തിലുള്ള കളങ്ങളിൽ മാത്രം നിലനിൽക്കുന്നു. ഒരു ആന വെളുത്ത കളങ്ങളിലും മറ്റൊന്ന് കറുത്ത കളങ്ങളിലും.",
    lesson_en:
      "The bishop moves only diagonally — any number of squares. Each bishop stays on its starting color forever. One bishop stays on light squares, the other on dark squares.",
    xp: 30,
  },
  {
    id: "wb-rook",
    pieceKey: "rook",
    name_ml: "തേര്",
    name_en: "Rook",
    square: "d4",
    fen: "7k/8/8/8/3R4/8/8/K7 w - - 0 1",
    lesson_ml:
      "തേര് നേർരേഖയിൽ നീങ്ങുന്നു — മുകളിലേക്കോ താഴേക്കോ വശങ്ങളിലേക്കോ, എത്ര കളം വേണമെങ്കിലും. കാസ്ലിംഗിൽ രാജാവിനൊപ്പം തേരും ഭാഗമാകുന്നു. തേർ ഒരുമിച്ച് (doubled rooks) ഏഴാം വരിയിൽ വളരെ ശക്തമാണ്!",
    lesson_en:
      "The rook moves in straight lines — up, down, left, right, any number of squares. It participates in castling with the king. Two rooks working together on the 7th rank are devastatingly powerful.",
    xp: 30,
  },
  {
    id: "wb-queen",
    pieceKey: "queen",
    name_ml: "മന്ത്രി",
    name_en: "Queen",
    square: "d5",
    fen: "7k/8/8/3Q4/8/8/8/K7 w - - 0 1",
    lesson_ml:
      "മന്ത്രി ഏറ്റവും ശക്തമായ കരുവാണ് — നേർരേഖയിലും കോണോട്ടും എല്ലാ ദിശയിലും നീങ്ങാം. തേരിന്റെയും ആനയുടെയും ശക്തി ഒരുമിച്ച്! ഓർക്കൂ: ആദ്യ നീക്കങ്ങളിൽ മന്ത്രിയെ ഇറക്കരുത് — ആക്രമണം ഏൽക്കും.",
    lesson_en:
      "The queen is the most powerful piece — it moves like a rook AND a bishop combined. Every direction, any number of squares. But beware: don't bring the queen out too early or it will be chased around by enemy pieces.",
    xp: 30,
  },
  {
    id: "wb-king",
    pieceKey: "king",
    name_ml: "രാജാവ്",
    name_en: "King",
    square: "d4",
    fen: "7k/8/8/8/3K4/8/8/8 w - - 0 1",
    lesson_ml:
      "രാജാവ് ഏത് ദിശയിലും ഒരു കളം മാത്രം നീങ്ങുന്നു. രാജാവിനെ സംരക്ഷിക്കുകയാണ് ഏറ്റവും പ്രധാനം — ചെക്ക്മേറ്റ് ആയാൽ കളി തീരും! ഗെയിമിന്റെ അവസാനം (endgame) രാജാവ് ഒരു ആക്ടീവ് ആക്രമണ ആയുധം ആകുന്നു.",
    lesson_en:
      "The king moves only one square in any direction. Protecting the king is everything — if it is checkmated, the game ends! In the endgame, the king becomes a powerful attacker.",
    xp: 30,
  },
];

function PieceTrainerContent() {
  const params = useSearchParams();
  const pieceParam = params.get("piece");

  const initialIdx = Math.max(
    0,
    LESSONS.findIndex((l) => l.pieceKey === pieceParam)
  );
  const [idx, setIdx] = useState(initialIdx);
  const lesson = LESSONS[idx];

  const game = useMemo(() => new Chess(lesson.fen), [lesson]);
  const legalTargets = useMemo(
    () =>
      game
        .moves({ square: lesson.square as never, verbose: true })
        .map((m) => (m as { to: string }).to),
    [game, lesson]
  );

  const [found, setFound] = useState<string[]>([]);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    setFound([]);
    setJustCompleted(false);
  }, [idx]);

  const complete = found.length > 0 && found.length === legalTargets.length;

  // Award XP when lesson completes
  useEffect(() => {
    if (complete && !justCompleted) {
      setJustCompleted(true);
      const p = loadProgress();
      const updated = completeLesson(p, lesson.id, lesson.xp);
      saveProgress(updated);
    }
  }, [complete, justCompleted, lesson]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    styles[lesson.square] = { background: "rgba(34,197,94,0.30)" };
    for (const t of legalTargets) {
      styles[t] = found.includes(t)
        ? { background: "rgba(34,197,94,0.55)" }
        : { background: "radial-gradient(circle, rgba(34,197,94,0.55) 24%, transparent 26%)" };
    }
    return styles;
  }, [lesson, legalTargets, found]);

  const onDrop = (from: string, to: string) => {
    if (from === lesson.square && legalTargets.includes(to)) {
      setFound((prev) => (prev.includes(to) ? prev : [...prev, to]));
    }
    return false;
  };

  return (
    <div className="container-px py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/learn" className="btn-ghost px-3 py-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Learning Hub
        </Link>
      </div>

      <h1 className="mb-1 text-2xl font-bold text-white">Piece Movement Trainer</h1>
      <p className="mb-6 text-sm text-gray-400">
        ഓരോ കരുവും എങ്ങനെ നീങ്ങുന്നുവെന്ന് കണ്ടെത്തൂ — പച്ച ഡോട്ടുകൾ ഉള്ള ഓരോ കളത്തിലേക്കും നീക്കൂ.
      </p>

      {/* Piece tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {LESSONS.map((l, i) => (
          <button
            key={l.pieceKey}
            onClick={() => setIdx(i)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              i === idx
                ? "border-brand bg-brand/10 text-white"
                : "border-surface-border text-gray-400 hover:text-white"
            }`}
          >
            {l.name_ml}
            <span className="ml-1 text-gray-500">({l.name_en})</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="w-[min(85vw,460px)]">
          <Chessboard
            position={lesson.fen}
            onPieceDrop={onDrop}
            customSquareStyles={squareStyles}
            customBoardStyle={{ borderRadius: "12px" }}
            customDarkSquareStyle={{ backgroundColor: "#739552" }}
            customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
            arePiecesDraggable
          />
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {lesson.name_ml}{" "}
                <span className="text-sm font-normal text-gray-500">({lesson.name_en})</span>
              </h2>
              <span className="text-sm font-medium text-gray-400 tabular-nums">
                {found.length}/{legalTargets.length} found
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-border">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${legalTargets.length > 0 ? (found.length / legalTargets.length) * 100 : 0}%` }}
              />
            </div>

            <p className="mt-4 leading-relaxed text-gray-200">{lesson.lesson_ml}</p>
            <p className="mt-2 text-sm text-gray-500 italic">{lesson.lesson_en}</p>
          </div>

          {complete ? (
            <div className="card flex items-center gap-3 border-brand">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-brand" />
              <div>
                <p className="font-medium text-white">
                  മിടുക്കൻ! {lesson.name_ml} പൂർത്തിയായി! 🎉
                </p>
                <p className="flex items-center gap-1 text-xs text-brand">
                  <Zap className="h-3 w-3" /> +{lesson.xp} XP earned
                </p>
              </div>
            </div>
          ) : (
            <div className="card text-sm text-gray-400">
              കരുവിനെ പച്ച ഡോട്ടുള്ള ഓരോ കളത്തിലേക്കും drag ചെയ്ത് നോക്കൂ.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setFound([])} className="btn-ghost text-sm">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            {idx < LESSONS.length - 1 && (
              <button onClick={() => setIdx(idx + 1)} className="btn-primary text-sm">
                Next: {LESSONS[idx + 1].name_ml} →
              </button>
            )}
            {idx === LESSONS.length - 1 && (
              <Link href="/learn" className="btn-primary text-sm">
                Back to Learning Hub →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PiecesPage() {
  return (
    <Suspense fallback={<div className="container-px py-10 text-gray-400">Loading…</div>}>
      <PieceTrainerContent />
    </Suspense>
  );
}
