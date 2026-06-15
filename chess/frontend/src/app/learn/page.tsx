"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen, CheckCircle2, ChevronRight, Flame,
  GraduationCap, Lock, Play, Puzzle, Sword, Zap,
} from "lucide-react";
import {
  BELTS,
  type BeltId,
  type BeltLevel,
  type Lesson,
  type Progress,
  currentBelt,
  getDailyMission,
  loadProgress,
  nextBelt,
  xpToNextBelt,
} from "@/lib/curriculum";

export default function LearnPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [activeBeltId, setActiveBeltId] = useState<BeltId>("white");

  useEffect(() => {
    const p = loadProgress();
    setProgress(p);
    setActiveBeltId(currentBelt(p).id);
  }, []);

  if (!progress) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-gray-400">
        Loading your journey…
      </div>
    );
  }

  const belt = currentBelt(progress);
  const next = nextBelt(progress);
  const xpInfo = xpToNextBelt(progress);
  const mission = getDailyMission(progress);
  const activeBelt = BELTS.find((b) => b.id === activeBeltId) ?? BELTS[0];

  return (
    <div className="container-px py-10 space-y-8">
      {/* Hero — belt + XP + streak */}
      <GuroBanner belt={belt} xpInfo={xpInfo} next={next} streak={progress.streak} xp={progress.xp} />

      {/* Daily mission */}
      <DailyMissionCard mission={mission} />

      {/* Belt selector */}
      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
          Your Learning Path
        </h2>
        <div className="flex flex-wrap gap-2">
          {BELTS.map((b) => {
            const earned = progress.beltsEarned.includes(b.id) || b.id === "white";
            const locked = !earned && b.xpRequired > progress.xp + 1;
            return (
              <button
                key={b.id}
                onClick={() => !locked && setActiveBeltId(b.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition
                  ${activeBeltId === b.id
                    ? "border-brand bg-brand/10 text-white"
                    : locked
                    ? "cursor-not-allowed border-surface-border text-gray-600"
                    : "border-surface-border text-gray-400 hover:text-white"
                  }`}
              >
                {b.emoji} {b.label}
                {locked && <Lock className="h-3 w-3 ml-0.5" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Belt curriculum */}
      <BeltCurriculum belt={activeBelt} progress={progress} />
    </div>
  );
}

// ─── Banner ─────────────────────────────────────────────────────────────────

function GuroBanner({
  belt, xpInfo, next, streak, xp,
}: {
  belt: BeltLevel;
  xpInfo: { pct: number };
  next: BeltLevel | null;
  streak: number;
  xp: number;
}) {
  return (
    <div className="card relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-10"
        style={{ background: `radial-gradient(ellipse at top left, ${belt.colorHex}, transparent 70%)` }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg"
            style={{ background: belt.colorHex + "33", border: `2px solid ${belt.colorHex}` }}
          >
            {belt.emoji}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Chess Guru Mode</p>
            <h1 className="text-xl font-bold text-white">{belt.labelMl}</h1>
            <p className="text-sm text-gray-400">{belt.taglineMl}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {streak > 0 && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-orange-400">
                <Flame className="h-5 w-5" />
                <span className="text-xl font-bold">{streak}</span>
              </div>
              <p className="text-[10px] text-gray-500">day streak</p>
            </div>
          )}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-brand">
              <Zap className="h-5 w-5" />
              <span className="text-xl font-bold">{xp}</span>
            </div>
            <p className="text-[10px] text-gray-500">total XP</p>
          </div>
        </div>
      </div>

      {/* XP Progress bar */}
      {next && (
        <div className="relative mt-5">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>{belt.label}</span>
            <span>{xpInfo.pct}% → {next.label}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-border">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpInfo.pct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: next.colorHex }}
            />
          </div>
        </div>
      )}

      {/* First-time CTA */}
      {xp === 0 && (
        <Link href="/onboarding" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
          <GraduationCap className="h-4 w-4" /> Start your journey →
        </Link>
      )}
    </div>
  );
}

// ─── Daily Mission ───────────────────────────────────────────────────────────

function DailyMissionCard({ mission }: { mission: ReturnType<typeof getDailyMission> }) {
  const items = [
    { label: "Complete a lesson", labelMl: "ഒരു ലെസ്സൺ പൂർത്തിയാക്കൂ", done: mission.lessonDone, icon: <BookOpen className="h-4 w-4" />, href: "/learn", xp: 30 },
    { label: "Solve 3 puzzles", labelMl: "3 പസിൽ പരിഹരിക്കൂ", done: mission.puzzlesDone, icon: <Puzzle className="h-4 w-4" />, href: "/puzzles", xp: 30 },
    { label: "Play a practice game", labelMl: "ഒരു ഗെയിം കളിക്കൂ", done: mission.gameDone, icon: <Sword className="h-4 w-4" />, href: "/play", xp: 20 },
  ];

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Today&apos;s Mission
        </h2>
        {mission.complete && (
          <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Complete +50 XP bonus!
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`card flex items-center gap-3 transition hover:border-brand ${item.done ? "border-emerald-700/50" : ""}`}
          >
            <div className={`rounded-lg p-2 ${item.done ? "bg-emerald-900/40 text-emerald-400" : "bg-surface-border text-gray-400"}`}>
              {item.done ? <CheckCircle2 className="h-4 w-4" /> : item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.done ? "line-through text-gray-500" : "text-white"}`}>
                {item.labelMl}
              </p>
              <p className="text-xs text-gray-500">+{item.xp} XP</p>
            </div>
            {!item.done && <ChevronRight className="h-4 w-4 shrink-0 text-gray-600" />}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Belt curriculum ─────────────────────────────────────────────────────────

function BeltCurriculum({ belt, progress }: { belt: BeltLevel; progress: Progress }) {
  const unlockedXP = progress.xp >= belt.xpRequired;
  const totalLessonXP = belt.lessons.reduce((s, l) => s + l.xp, 0);
  const earnedLessonXP = belt.lessons
    .filter((l) => progress.completedLessons.includes(l.id))
    .reduce((s, l) => s + l.xp, 0);
  const lessonPct = totalLessonXP > 0 ? Math.round((earnedLessonXP / totalLessonXP) * 100) : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{belt.emoji}</span>
        <div>
          <h2 className="font-bold text-white">{belt.labelMl} — {belt.label}</h2>
          <p className="text-xs text-gray-500">{belt.taglineMl}</p>
        </div>
        {!unlockedXP && (
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
            <Lock className="h-3.5 w-3.5" /> {belt.xpRequired} XP needed
          </span>
        )}
      </div>

      {!unlockedXP ? (
        <div className="card border-dashed text-center text-sm text-gray-500 py-8">
          <Lock className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p>Earn {belt.xpRequired} XP to unlock {belt.label} curriculum.</p>
        </div>
      ) : (
        <>
          {/* Lesson progress bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Lessons: {progress.completedLessons.filter(id => belt.lessons.some(l => l.id === id)).length}/{belt.lessons.length}</span>
              <span>{lessonPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-border">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${lessonPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: belt.colorHex }}
              />
            </div>
          </div>

          {/* Lessons */}
          <div className="grid gap-2">
            {belt.lessons.map((lesson, i) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={i}
                done={progress.completedLessons.includes(lesson.id)}
                beltColor={belt.colorHex}
              />
            ))}
          </div>

          {/* Practice section */}
          <div className="grid gap-3 sm:grid-cols-2">
            <PracticeCard
              icon={<Puzzle className="h-5 w-5 text-brand" />}
              title="Practice Puzzles"
              titleMl="ടാക്റ്റിക്സ് പസിലുകൾ"
              progress={progress.puzzlesSolved[belt.id]}
              goal={belt.puzzleGoal}
              href="/puzzles"
              label="Solve puzzles →"
            />
            <PracticeCard
              icon={<Sword className="h-5 w-5 text-emerald-400" />}
              title="Practice Games"
              titleMl="പ്രാക്ടീസ് ഗെയിമുകൾ"
              progress={progress.gamesPlayed[belt.id]}
              goal={belt.gameGoal}
              href="/play"
              label="Play vs AI →"
            />
          </div>

          {/* Belt test */}
          <BeltTestCard belt={belt} progress={progress} lessonPct={lessonPct} />
        </>
      )}
    </section>
  );
}

// ─── Lesson row ──────────────────────────────────────────────────────────────

function LessonRow({
  lesson, index, done, beltColor,
}: {
  lesson: Lesson; index: number; done: boolean; beltColor: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    lesson: <BookOpen className="h-4 w-4" />,
    piece_trainer: <Play className="h-4 w-4" />,
    tactic: <Puzzle className="h-4 w-4" />,
    game: <Sword className="h-4 w-4" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        href={lesson.href}
        className={`flex items-center gap-4 rounded-xl border p-4 transition hover:border-brand
          ${done ? "border-emerald-800/50 bg-emerald-950/20" : "border-surface-border"}`}
      >
        {/* Step number / check */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={done
            ? { background: "#16a34a33", color: "#4ade80" }
            : { background: beltColor + "22", color: beltColor }
          }
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{icons[lesson.type]}</span>
            <p className={`font-medium ${done ? "text-gray-400 line-through" : "text-white"}`}>
              {lesson.titleMl}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{lesson.descriptionMl}</p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xs font-medium text-gray-400">+{lesson.xp} XP</p>
          <p className="text-xs text-gray-600">{lesson.durationMin} min</p>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Practice card ───────────────────────────────────────────────────────────

function PracticeCard({
  icon, title, titleMl, progress, goal, href, label,
}: {
  icon: React.ReactNode;
  title: string;
  titleMl: string;
  progress: number;
  goal: number;
  href: string;
  label: string;
}) {
  const pct = Math.min(100, Math.round((progress / goal) * 100));
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="font-medium text-white text-sm">{titleMl}</p>
          <p className="text-xs text-gray-500">{title}</p>
        </div>
        <span className="ml-auto text-sm font-bold text-white tabular-nums">
          {progress}/{goal}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-border">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <Link href={href} className="btn-ghost w-full text-center text-xs">
        {label}
      </Link>
    </div>
  );
}

// ─── Belt test card ──────────────────────────────────────────────────────────

function BeltTestCard({
  belt, progress, lessonPct,
}: {
  belt: BeltLevel; progress: Progress; lessonPct: number;
}) {
  const puzzlesReady = progress.puzzlesSolved[belt.id] >= Math.floor(belt.puzzleGoal * 0.8);
  const gamesReady = progress.gamesPlayed[belt.id] >= Math.floor(belt.gameGoal * 0.8);
  const lessonsReady = lessonPct >= 80;
  const ready = puzzlesReady && gamesReady && lessonsReady;
  const alreadyEarned = progress.beltsEarned.includes(belt.id);

  if (alreadyEarned) return null;

  return (
    <div className={`card border-2 ${ready ? "border-brand" : "border-surface-border"}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{belt.emoji}</span>
        <div>
          <p className="font-semibold text-white">Belt Test — {belt.labelMl}</p>
          <p className="text-xs text-gray-500">
            Complete 80% of lessons, puzzles, and games to unlock
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Requirement done={lessonsReady} label="80% lessons" />
        <Requirement done={puzzlesReady} label={`${Math.floor(belt.puzzleGoal * 0.8)} puzzles`} />
        <Requirement done={gamesReady} label={`${Math.floor(belt.gameGoal * 0.8)} games`} />
      </div>
      {ready && (
        <Link href={`/learn/belt-test/${belt.id}`} className="btn-primary mt-4 w-full text-center text-sm">
          Take the Belt Test → +100 XP
        </Link>
      )}
    </div>
  );
}

function Requirement({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${done ? "bg-emerald-900/40 text-emerald-300" : "bg-surface-border text-gray-500"}`}>
      {done ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <div className="h-3 w-3 shrink-0 rounded-full border border-gray-600" />}
      {label}
    </div>
  );
}
