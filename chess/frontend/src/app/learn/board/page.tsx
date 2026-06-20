"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chessboard } from "react-chessboard";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { completeLesson, loadProgress, saveProgress } from "@/lib/curriculum";

// ── Lesson steps ──────────────────────────────────────────────────────────────

interface Step {
  titleMl: string;
  titleEn: string;
  bodyMl: string;
  bodyEn: string;
  fen: string;
  squares: Record<string, React.CSSProperties>;
  arrows: [string, string, string][];
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

function fileSquares(file: string): Record<string, React.CSSProperties> {
  const s: Record<string, React.CSSProperties> = {};
  for (const r of RANKS) s[file + r] = { background: "rgba(99,102,241,0.50)" };
  return s;
}

function rankSquares(rank: string): Record<string, React.CSSProperties> {
  const s: Record<string, React.CSSProperties> = {};
  for (const f of FILES) s[f + rank] = { background: "rgba(234,179,8,0.50)" };
  return s;
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const EMPTY_FEN    = "8/8/8/8/8/8/8/8 w - - 0 1";

const STEPS: Step[] = [
  {
    titleMl: "ചെസ്സ് ബോർഡ്",
    titleEn: "The Chessboard",
    bodyMl:
      "ചെസ്സ് ബോർഡിൽ 64 കളങ്ങൾ ഉണ്ട് — 8 × 8. ഓരോ കളവും ഒന്നുകിൽ വെളുത്തതോ കറുത്തതോ ആണ്. ഇവ ഇടമാറി (alternating) വരുന്നു.",
    bodyEn:
      "The chessboard has 64 squares — 8 rows × 8 columns. Each square is either light or dark, alternating throughout the board.",
    fen: EMPTY_FEN,
    squares: {},
    arrows: [],
  },
  {
    titleMl: "ഫൈലുകൾ (Files) — a മുതൽ h വരെ",
    titleEn: "Files — columns a through h",
    bodyMl:
      "ബോർഡിലെ നിരകളെ (columns) 'ഫൈൽ' എന്ന് പറയുന്നു. ഇടത്തു നിന്ന് വലത്തേക്ക് a, b, c, d, e, f, g, h. e-ഫൈൽ ഒരു കേന്ദ്ര ഫൈൽ ആണ് — highlighted in purple!",
    bodyEn:
      "Columns on the board are called 'files'. They run from a (left) to h (right). The e-file is a central file — highlighted in purple!",
    fen: EMPTY_FEN,
    squares: fileSquares("e"),
    arrows: [],
  },
  {
    titleMl: "റാങ്കുകൾ (Ranks) — 1 മുതൽ 8 വരെ",
    titleEn: "Ranks — rows 1 through 8",
    bodyMl:
      "ബോർഡിലെ വരികളെ (rows) 'റാങ്ക്' എന്ന് പറയുന്നു. വെള്ള ടീമിന്റെ അടിയിൽ നിന്ന് 1, 2, 3…8. ഒന്നാം റാങ്ക് (rank 1) — yellow-ൽ highlighted — വെള്ള കരുക്കൾ തുടങ്ങുന്ന വരിയാണ്.",
    bodyEn:
      "Rows on the board are called 'ranks'. They are numbered 1 (white's side) to 8 (black's side). Rank 1 — highlighted in yellow — is where white's pieces start.",
    fen: EMPTY_FEN,
    squares: rankSquares("1"),
    arrows: [],
  },
  {
    titleMl: "കളത്തിന്റെ പേര് — File + Rank",
    titleEn: "Square names — File + Rank",
    bodyMl:
      "ഓരോ കളത്തിനും ഒരു unique പേരുണ്ട്: ആദ്യം ഫൈൽ (a–h), പിന്നെ റാങ്ക് (1–8). ഉദാ: 'e4' = e-ഫൈൽ, 4-ആം റാങ്ക്. 'd5' = d-ഫൈൽ, 5-ആം റാങ്ക്. ഇവ board-ൽ highlighted ആണ്!",
    bodyEn:
      "Each square has a unique name: file letter first, then rank number. Example: 'e4' = file e, rank 4. This naming is called algebraic notation — used in every chess game worldwide!",
    fen: EMPTY_FEN,
    squares: {
      e4: { background: "rgba(34,197,94,0.60)", boxShadow: "inset 0 0 0 3px rgba(34,197,94,0.9)" },
      d5: { background: "rgba(239,68,68,0.55)", boxShadow: "inset 0 0 0 3px rgba(239,68,68,0.9)" },
      c3: { background: "rgba(99,102,241,0.55)", boxShadow: "inset 0 0 0 3px rgba(99,102,241,0.9)" },
      f6: { background: "rgba(234,179,8,0.55)", boxShadow: "inset 0 0 0 3px rgba(234,179,8,0.9)" },
    },
    arrows: [],
  },
  {
    titleMl: "ആരംഭ സ്ഥാനം (Starting Position)",
    titleEn: "The Starting Position",
    bodyMl:
      "ഗെയിം ആരംഭത്തിൽ ഇങ്ങനെ കരുക്കൾ ഇടുന്നു. വെള്ള ടീം: 1-ആം, 2-ആം റാങ്കുകൾ. കറുത്ത ടീം: 7-ആം, 8-ആം റാങ്കുകൾ. Queen അവൾക്ക് ചേർന്ന നിറത്തിലുള്ള കളത്തിൽ — White Queen → d1 (light square), Black Queen → d8 (dark square).",
    bodyEn:
      "At the start of a game, pieces are placed like this. White occupies ranks 1 and 2; black occupies ranks 7 and 8. The queen always goes on her own color: white queen on d1 (light), black queen on d8 (dark).",
    fen: STARTING_FEN,
    squares: {},
    arrows: [
      ["d1", "d1", "#facc15"],
      ["d8", "d8", "#facc15"],
    ],
  },
];

const LESSON_ID = "wb-board";
const LESSON_XP  = 30;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BoardLessonPage() {
  const [step, setStep]           = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const p = loadProgress();
    if (p.completedLessons.includes(LESSON_ID)) setCompleted(true);
  }, []);

  const current = STEPS[step]!;
  const isLast  = step === STEPS.length - 1;

  const handleComplete = () => {
    if (completed) return;
    const p = loadProgress();
    const updated = completeLesson(p, LESSON_ID, LESSON_XP);
    saveProgress(updated);
    setCompleted(true);
  };

  const goNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="container-px py-10">
      {/* Back */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/learn" className="btn-ghost px-3 py-1.5 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Learning Hub
        </Link>
      </div>

      <h1 className="mb-1 text-2xl font-bold text-white">ചെസ്സ് ബോർഡ് — The Chessboard</h1>
      <p className="mb-6 text-sm text-gray-400">
        64 കളങ്ങൾ, ഫൈലുകൾ, റാങ്കുകൾ, ആരംഭ സ്ഥാനം — ചെസ്സിന്റെ അടിത്തറ.
      </p>

      {/* Step progress dots */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`rounded-full transition-all ${
              i === step
                ? "h-2.5 w-8 bg-brand"
                : i < step
                ? "h-2.5 w-2.5 bg-emerald-500"
                : "h-2.5 w-2.5 bg-surface-border hover:bg-gray-500"
            }`}
            aria-label={s.titleEn}
          />
        ))}
        <span className="ml-2 text-xs text-gray-500">{step + 1} / {STEPS.length}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Board */}
        <div className="w-[min(85vw,460px)]">
          <Chessboard
            position={current.fen}
            arePiecesDraggable={false}
            customSquareStyles={current.squares}
            customArrows={current.arrows as any}
            customBoardStyle={{ borderRadius: "12px" }}
            customDarkSquareStyle={{ backgroundColor: "#739552" }}
            customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
          />

          {/* File labels */}
          <div className="mt-1 flex justify-between px-1 text-[10px] font-mono text-gray-600 select-none">
            {FILES.map((f) => <span key={f} className="w-[12.5%] text-center">{f}</span>)}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Step card */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/20 text-sm font-bold text-brand">
                {step + 1}
              </div>
              <div>
                <h2 className="font-semibold text-white">{current.titleMl}</h2>
                <p className="text-xs text-gray-500">{current.titleEn}</p>
              </div>
            </div>

            <p className="leading-relaxed text-gray-200">{current.bodyMl}</p>
            <p className="text-sm italic text-gray-500">{current.bodyEn}</p>
          </div>

          {/* Quick reference — always visible */}
          <div className="card grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Files (നിരകൾ)</p>
              <div className="flex flex-wrap gap-1">
                {FILES.map((f) => (
                  <span key={f} className="rounded bg-indigo-950/60 px-1.5 py-0.5 font-mono text-indigo-300">{f}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 font-semibold text-gray-400 uppercase tracking-wide">Ranks (വരികൾ)</p>
              <div className="flex flex-wrap gap-1">
                {RANKS.map((r) => (
                  <span key={r} className="rounded bg-yellow-950/60 px-1.5 py-0.5 font-mono text-yellow-300">{r}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Completion banner */}
          {completed && (
            <div className="card flex items-center gap-3 border-brand">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-brand" />
              <div>
                <p className="font-medium text-white">ബോർഡ് lesson പൂർത്തിയായി! 🎉</p>
                <p className="flex items-center gap-1 text-xs text-brand">
                  <Zap className="h-3 w-3" /> +{LESSON_XP} XP earned
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="btn-ghost text-sm disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>

            {isLast ? (
              completed ? (
                <Link href="/learn" className="btn-primary ml-auto text-sm">
                  Back to Learning Hub →
                </Link>
              ) : (
                <button onClick={handleComplete} className="btn-primary ml-auto text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Complete (+{LESSON_XP} XP)
                </button>
              )
            ) : (
              <button onClick={goNext} className="btn-primary ml-auto text-sm">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Next lesson shortcut */}
          {completed && (
            <Link
              href="/learn/pieces?piece=pawn"
              className="flex items-center justify-between rounded-xl border border-surface-border px-4 py-3 text-sm text-gray-400 transition hover:border-brand hover:text-white"
            >
              <span>Next lesson: കാലാൾ (Pawn)</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
