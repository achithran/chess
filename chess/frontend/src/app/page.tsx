import Link from "next/link";
import {
  Brain,
  Crown,
  Languages,
  Puzzle,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Analysis",
    desc: "Every move evaluated by Stockfish — best move, centipawn loss, blunders.",
  },
  {
    icon: Languages,
    title: "Malayalam Explanations",
    desc: "Your AI Guru explains why a move is good or bad in simple Malayalam.",
  },
  {
    icon: Puzzle,
    title: "Puzzle Trainer",
    desc: "Daily puzzles, tactical themes, rating system, and streaks.",
  },
  {
    icon: Crown,
    title: "Opening Trainer",
    desc: "Italian, Sicilian, London System — with step-by-step explanations.",
  },
  {
    icon: TrendingUp,
    title: "Game Review",
    desc: "Upload a PGN, get accuracy score, blunder count, and a summary.",
  },
  {
    icon: Sparkles,
    title: "Adaptive AI",
    desc: "AI strength adjusts to your level — from beginner to master.",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="container-px pt-20 pb-16 text-center">
        <div className="mx-auto max-w-3xl animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-card px-4 py-1.5 text-sm text-brand">
            <Sparkles className="h-4 w-4" /> AI Chess Teacher · Kerala
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
              Chanakya
            </span>{" "}
            — Chess in Malayalam
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            Your AI Guru explains every move — why it&apos;s good or bad — in
            simple Malayalam. Designed for students and beginners in Kerala.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login?mode=register" className="btn-primary w-full sm:w-auto text-base">
              🥋 Register Free
            </Link>
            <Link href="/play" className="btn-ghost w-full sm:w-auto">
              Just Play →
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-brand hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="container-px py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <f.icon className="h-8 w-8 text-brand" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-px py-20">
        <div className="card flex flex-col items-center gap-4 bg-gradient-to-br from-surface-card to-brand-dark/20 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Start improving your chess today
          </h2>
          <p className="text-gray-300">
            Free plan includes daily analysis. Pro gives unlimited AI coaching.
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/login?mode=register" className="btn-primary">
              Register Free
            </Link>
            <Link href="/login" className="btn-ghost">
              Login
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-surface-border py-8">
        <div className="container-px flex flex-col items-center justify-between gap-2 text-sm text-gray-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Chanakya</span>
          <span className="font-ml">കേരളത്തിന്റെ സ്വന്തം ചെസ് AI</span>
        </div>
      </footer>
    </div>
  );
}
