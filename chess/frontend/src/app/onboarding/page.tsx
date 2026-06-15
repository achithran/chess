"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  ArrowRight, BookOpen, Brain, Check, ChevronRight,
  GraduationCap, Play, Puzzle, Sword, Trophy, Users, Zap,
} from "lucide-react";
import { saveProgress, loadProgress, updateStreak } from "@/lib/curriculum";

type Step = "language" | "welcome" | "experience" | "pieces-intro" | "first-game-ready";

const LANGUAGES = [
  { code: "ml", label: "മലയാളം", name: "Malayalam" },
  { code: "en", label: "English", name: "English" },
  { code: "hi", label: "हिन्दी", name: "Hindi" },
  { code: "ta", label: "தமிழ்", name: "Tamil" },
  { code: "te", label: "తెలుగు", name: "Telugu" },
  { code: "kn", label: "ಕನ್ನಡ", name: "Kannada" },
];

const EXPERIENCE_LEVELS = [
  {
    id: "zero",
    icon: "🌱",
    label: "ഞാൻ ചെസ്സ് തീരെ അറിയില്ല",
    labelEn: "Complete beginner — I don't know chess",
    desc: "We start from zero. You'll learn every piece step by step.",
  },
  {
    id: "basics",
    icon: "♟️",
    label: "ഞാൻ കരുക്കൾ അറിയാം, പക്ഷേ ടാക്റ്റിക്സ് ഇല്ല",
    labelEn: "I know the pieces but lose quickly",
    desc: "Skip piece intro, go straight to tactics and strategy.",
  },
  {
    id: "intermediate",
    icon: "⚔️",
    label: "ഞാൻ ചെസ്സ് കളിക്കും, rating ഉണ്ടാക്കണം",
    labelEn: "I play chess, I want to improve my rating",
    desc: "Jump to Yellow Belt — openings, tactics, and game analysis.",
  },
  {
    id: "competitive",
    icon: "🏆",
    label: "ഞാൻ rated player — ഞാൻ Master ആകണം",
    labelEn: "I am a rated player aiming for Master/GM",
    desc: "Start from Green Belt with advanced tactics and strategy.",
  },
];

// Piece intro cards — one per piece
const PIECE_CARDS = [
  {
    emoji: "♚",
    name: "രാജാവ് (King)",
    fact: "ഏറ്റവും പ്രധാനപ്പെട്ട കരു. ഏത് ദിശയിലും ഒരു കളം.",
    factEn: "Most important piece. Moves one square in any direction.",
    color: "#facc15",
  },
  {
    emoji: "♛",
    name: "മന്ത്രി (Queen)",
    fact: "ഏറ്റവും ശക്തം! ഏത് ദിശയിലും, എത്ര ദൂരവും.",
    factEn: "Most powerful! Any direction, any distance.",
    color: "#f97316",
  },
  {
    emoji: "♜",
    name: "തേര് (Rook)",
    fact: "നേർ വരകളിൽ — മുന്നോട്ട്, പിന്നോട്ട്, വശങ്ങളിലേക്ക്.",
    factEn: "Straight lines — forward, backward, sideways.",
    color: "#3b82f6",
  },
  {
    emoji: "♝",
    name: "ആന (Bishop)",
    fact: "കോണോട്ട് — ഒരേ നിറത്തിലുള്ള കളങ്ങളിൽ മാത്രം.",
    factEn: "Diagonals only — stays on one colour forever.",
    color: "#22c55e",
  },
  {
    emoji: "♞",
    name: "കുതിര (Knight)",
    fact: "L ആകൃതിയിൽ — മറ്റ് കരുക്കൾക്ക് മുകളിലൂടെ ചാടാം!",
    factEn: "L-shape — the only piece that jumps over others!",
    color: "#a855f7",
  },
  {
    emoji: "♟",
    name: "കാലാൾ (Pawn)",
    fact: "മുന്നോട്ട് മാത്രം, കോണോട്ട് പിടിക്കൽ. അവസാനം: ഏത് കരുവും ആകാം!",
    factEn: "Forward only, captures diagonally. At the end: becomes any piece!",
    color: "#6b7280",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("language");
  const [lang, setLang] = useState("en");
  const [experience, setExperience] = useState("");
  const [pieceIdx, setPieceIdx] = useState(0);

  const finish = (expId: string) => {
    const p = loadProgress();
    const updated = updateStreak({ ...p, onboardingComplete: true });
    saveProgress(updated);

    // Also save language preference
    if (typeof window !== "undefined") {
      localStorage.setItem("cm_language", lang);
    }

    // Route to appropriate belt based on experience
    if (expId === "zero") {
      router.push("/learn/pieces?piece=pawn");
    } else if (expId === "basics") {
      router.push("/learn");
    } else {
      router.push("/learn");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-DEFAULT px-4 py-12">
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {step === "language" && (
            <SlideIn key="language">
              <LanguageStep selected={lang} onSelect={setLang} onNext={() => setStep("welcome")} />
            </SlideIn>
          )}
          {step === "welcome" && (
            <SlideIn key="welcome">
              <WelcomeStep onNext={() => setStep("experience")} />
            </SlideIn>
          )}
          {step === "experience" && (
            <SlideIn key="experience">
              <ExperienceStep
                selected={experience}
                onSelect={setExperience}
                onNext={() => {
                  if (experience === "zero") {
                    setStep("pieces-intro");
                  } else {
                    finish(experience);
                  }
                }}
              />
            </SlideIn>
          )}
          {step === "pieces-intro" && (
            <SlideIn key="pieces-intro">
              <PiecesIntroStep
                pieceIdx={pieceIdx}
                onNext={() => {
                  if (pieceIdx < PIECE_CARDS.length - 1) {
                    setPieceIdx(pieceIdx + 1);
                  } else {
                    setStep("first-game-ready");
                  }
                }}
              />
            </SlideIn>
          )}
          {step === "first-game-ready" && (
            <SlideIn key="first-game-ready">
              <FirstGameReadyStep onFinish={() => finish("zero")} />
            </SlideIn>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Slide wrapper ────────────────────────────────────────────────────────────

function SlideIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Step 1: Language ─────────────────────────────────────────────────────────

function LanguageStep({
  selected, onSelect, onNext,
}: {
  selected: string; onSelect: (c: string) => void; onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-3 flex justify-center">
          <span className="rounded-2xl bg-brand/20 p-4 text-4xl">♟️</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Chanakya — Chess Guru</h1>
        <p className="mt-2 text-gray-400">Choose your language / നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കൂ</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => onSelect(l.code)}
            className={`rounded-xl border p-4 text-left transition ${
              selected === l.code
                ? "border-brand bg-brand/10"
                : "border-surface-border hover:border-gray-500"
            }`}
          >
            <p className="text-lg font-bold text-white">{l.label}</p>
            <p className="text-xs text-gray-500">{l.name}</p>
          </button>
        ))}
      </div>

      <button onClick={onNext} className="btn-primary w-full text-lg">
        Continue <ArrowRight className="ml-2 inline h-5 w-5" />
      </button>
    </div>
  );
}

// ─── Step 2: Welcome ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const FACTS = [
    { icon: <Brain className="h-5 w-5 text-purple-400" />, text: "Chess improves memory, focus, and problem-solving" },
    { icon: <Trophy className="h-5 w-5 text-yellow-400" />, text: "India has 75+ Grandmasters — the most in Asia" },
    { icon: <Users className="h-5 w-5 text-blue-400" />, text: "800 million people play chess worldwide" },
    { icon: <Zap className="h-5 w-5 text-brand" />, text: "Your AI Guru will explain every move in your language" },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <span className="text-6xl">🏛️</span>
        </div>
        <h1 className="text-2xl font-bold text-white">ചെസ്സ് ഗുരുക്കൾ സ്വാഗതം</h1>
        <p className="mt-1 text-lg text-white">Welcome to Chess Guru Mode</p>
        <p className="mt-3 text-gray-400">
          ഞാൻ നിങ്ങളുടെ ചെസ്സ് ഗുരുവാണ്. തുടക്കം മുതൽ ഗ്രാൻഡ്മാസ്റ്റർ വരെ ഞാൻ കൂടെ ഉണ്ടാകും.
        </p>
        <p className="mt-1 text-sm text-gray-500 italic">
          I am your Chess Guru. I&apos;ll be with you from zero to Grandmaster.
        </p>
      </div>

      <div className="card space-y-3">
        {FACTS.map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            {f.icon}
            <p className="text-sm text-gray-300">{f.text}</p>
          </div>
        ))}
      </div>

      {/* Interactive mini-board teaser */}
      <MiniBoard />

      <button onClick={onNext} className="btn-primary w-full">
        Let&apos;s start! / തുടങ്ങാം! <ArrowRight className="ml-2 inline h-4 w-4" />
      </button>
    </div>
  );
}

function MiniBoard() {
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [hint, setHint] = useState("Touch any piece to move it!");

  const onDrop = (from: string, to: string) => {
    try {
      const move = game.move({ from, to, promotion: "q" });
      if (move) {
        setFen(game.fen());
        setHint(`✓ ${move.san} — great first move!`);
        return true;
      }
    } catch {}
    return false;
  };

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-gray-500">{hint}</p>
      <div className="mx-auto w-48">
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          boardWidth={192}
          customBoardStyle={{ borderRadius: "8px" }}
          customDarkSquareStyle={{ backgroundColor: "#739552" }}
          customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
        />
      </div>
    </div>
  );
}

// ─── Step 3: Experience ───────────────────────────────────────────────────────

function ExperienceStep({
  selected, onSelect, onNext,
}: {
  selected: string; onSelect: (id: string) => void; onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">നിങ്ങൾ ആര്?</h2>
        <p className="mt-1 text-gray-400">Tell us about your chess experience</p>
      </div>

      <div className="space-y-3">
        {EXPERIENCE_LEVELS.map((lvl) => (
          <button
            key={lvl.id}
            onClick={() => onSelect(lvl.id)}
            className={`w-full rounded-xl border p-4 text-left transition ${
              selected === lvl.id
                ? "border-brand bg-brand/10"
                : "border-surface-border hover:border-gray-500"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{lvl.icon}</span>
              <div>
                <p className="font-medium text-white">{lvl.label}</p>
                <p className="text-xs text-gray-500">{lvl.labelEn}</p>
                {selected === lvl.id && (
                  <p className="mt-1 text-xs text-brand">{lvl.desc}</p>
                )}
              </div>
              {selected === lvl.id && (
                <Check className="ml-auto mt-0.5 h-5 w-5 shrink-0 text-brand" />
              )}
            </div>
          </button>
        ))}
      </div>

      <button onClick={onNext} disabled={!selected} className="btn-primary w-full disabled:opacity-50">
        Continue <ChevronRight className="ml-1 inline h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Step 4: Pieces intro ─────────────────────────────────────────────────────

function PiecesIntroStep({
  pieceIdx, onNext,
}: {
  pieceIdx: number; onNext: () => void;
}) {
  const piece = PIECE_CARDS[pieceIdx];
  const isLast = pieceIdx === PIECE_CARDS.length - 1;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Meet the pieces — {pieceIdx + 1} of {PIECE_CARDS.length}
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">കരുക്കളെ പരിചയപ്പെടൂ</h2>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {PIECE_CARDS.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === pieceIdx ? "w-6 bg-brand" : i < pieceIdx ? "w-2 bg-brand/40" : "w-2 bg-surface-border"
            }`}
          />
        ))}
      </div>

      <motion.div
        key={pieceIdx}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card text-center space-y-4"
      >
        <div
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl text-6xl"
          style={{ background: piece.color + "22", border: `2px solid ${piece.color}` }}
        >
          {piece.emoji}
        </div>
        <h3 className="text-xl font-bold text-white">{piece.name}</h3>
        <p className="text-gray-200 leading-relaxed">{piece.fact}</p>
        <p className="text-sm text-gray-500 italic">{piece.factEn}</p>
      </motion.div>

      <div className="flex gap-3">
        <Link href={`/learn/pieces?piece=${["pawn","knight","bishop","rook","queen","king"][pieceIdx]}`}
          className="btn-ghost flex-1 text-center text-sm"
        >
          <Play className="mr-1 inline h-4 w-4" /> Practice this piece
        </Link>
        <button onClick={onNext} className="btn-primary flex-1 text-sm">
          {isLast ? "I'm ready to play! 🎉" : `Next: ${PIECE_CARDS[pieceIdx + 1].name.split(" ")[0]} →`}
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Ready for first game ─────────────────────────────────────────────

function FirstGameReadyStep({ onFinish }: { onFinish: () => void }) {
  const STEPS = [
    { icon: <BookOpen className="h-4 w-4 text-brand" />, text: "Your Guru explains every move" },
    { icon: <Puzzle className="h-4 w-4 text-yellow-400" />, text: "Daily puzzles to sharpen tactics" },
    { icon: <Sword className="h-4 w-4 text-emerald-400" />, text: "Practice games vs AI at your level" },
    { icon: <GraduationCap className="h-4 w-4 text-purple-400" />, text: "Earn belts as you improve: ⬜🟡🟠🟢🔵🟤⬛" },
    { icon: <Trophy className="h-4 w-4 text-orange-400" />, text: "Join tournaments with real players" },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-3 text-5xl">🎓</div>
        <h2 className="text-2xl font-bold text-white">നിങ്ങൾ തയ്യാർ!</h2>
        <p className="mt-1 text-gray-400">You&apos;re ready to begin your chess journey</p>
      </div>

      <div className="card space-y-4">
        <p className="font-medium text-white">Your journey includes:</p>
        {STEPS.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3"
          >
            {s.icon}
            <p className="text-sm text-gray-300">{s.text}</p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-3">
        <button onClick={onFinish} className="btn-primary w-full text-lg">
          Start Learning Now! / ഇപ്പോൾ തുടങ്ങൂ! <ArrowRight className="ml-2 inline h-5 w-5" />
        </button>
        <p className="text-center text-xs text-gray-600">
          No account needed to start. Your progress is saved automatically.
        </p>
      </div>
    </div>
  );
}
