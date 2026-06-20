"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronRight, Lightbulb, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  move_san: string;
  move_uci: string;
  name: string;
  short_reason: string;
  pros: string[];
  cons: string[];
  style: "aggressive" | "solid" | "creative";
}

interface CandidateData {
  opening_name: string | null;
  opening_tip: string | null;
  candidates: Candidate[];
}

// ── Style config ─────────────────────────────────────────────────────────────

const STYLE_CFG = {
  aggressive: {
    icon: "⚔️",
    label: "Aggressive",
    border: "border-orange-700/50",
    bg: "bg-orange-950/40",
    badge: "bg-orange-900/60 text-orange-200",
    dot: "bg-orange-500",
  },
  solid: {
    icon: "🛡",
    label: "Solid",
    border: "border-blue-700/50",
    bg: "bg-blue-950/40",
    badge: "bg-blue-900/60 text-blue-200",
    dot: "bg-blue-500",
  },
  creative: {
    icon: "✨",
    label: "Creative",
    border: "border-purple-700/50",
    bg: "bg-purple-950/40",
    badge: "bg-purple-900/60 text-purple-200",
    dot: "bg-purple-500",
  },
};

// ── Pros / Cons detail sheet ──────────────────────────────────────────────────

function DetailSheet({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}) {
  const cfg = STYLE_CFG[candidate.style] ?? STYLE_CFG.solid;
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-surface-border bg-surface-DEFAULT shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className={`mx-4 mb-4 rounded-xl border p-4 ${cfg.border} ${cfg.bg}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{cfg.icon}</span>
                <span className="font-mono text-2xl font-bold text-white">{candidate.move_san}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-300">{candidate.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">{candidate.short_reason}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Pros */}
        <div className="mx-4 mb-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            ✅ Why this works
          </p>
          <div className="space-y-1.5">
            {candidate.pros.map((pro, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-emerald-950/30 px-3 py-2">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <p className="text-sm text-gray-200">{pro}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cons */}
        <div className="mx-4 mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-400">
            ⚠️ Watch out for
          </p>
          <div className="space-y-1.5">
            {candidate.cons.map((con, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-red-950/30 px-3 py-2">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <p className="text-sm text-gray-200">{con}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom safe area */}
        <div className="h-4" />
      </motion.div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CandidateMoves({
  fen,
  langCode,
  level = "guru",
}: {
  fen: string;
  langCode: string;
  level?: string;
}) {
  const [data, setData] = useState<CandidateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const fetchedFen = useRef<string | null>(null);

  // Fetch candidates when FEN changes (debounced by ref to avoid double-fetch)
  useEffect(() => {
    if (!fen || fen === fetchedFen.current) return;
    fetchedFen.current = fen;
    setData(null);
    setError(false);
    setLoading(true);
    setSelected(null);

    api.candidateMoves(fen, langCode, level)
      .then((res) => { setData(res); })
      .catch(() => { setError(true); })
      .finally(() => { setLoading(false); });
  }, [fen, langCode, level]);

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-3 py-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>{langCode === "ml" ? "നിങ്ങളുടെ options ആലോചിക്കുന്നു…" : "Thinking of your options…"}</span>
        </div>
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <>
      <div className="card space-y-3">

        {/* Opening header */}
        {data.opening_name && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-800/40 bg-amber-950/30 px-3 py-2.5">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300">{data.opening_name}</p>
              {data.opening_tip && (
                <p className="mt-0.5 text-xs leading-relaxed text-amber-200/80">{data.opening_tip}</p>
              )}
            </div>
          </div>
        )}

        {/* Section title */}
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-brand" />
          <p className="text-sm font-semibold text-white">
            {langCode === "ml" ? "ഇനി നിങ്ങൾ എന്ത് കളിക്കണം?" : "What should you play?"}
          </p>
        </div>

        {/* Candidate cards */}
        <div className="grid grid-cols-3 gap-2">
          {data.candidates.map((c, i) => {
            const cfg = STYLE_CFG[c.style] ?? STYLE_CFG.solid;
            return (
              <motion.button
                key={i}
                onClick={() => setSelected(c)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`group relative flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition hover:brightness-110 active:scale-95 ${cfg.border} ${cfg.bg}`}
              >
                {/* Style icon + move */}
                <div className="flex w-full items-center justify-between">
                  <span className="text-lg">{cfg.icon}</span>
                  <ChevronRight className="h-3 w-3 text-gray-600 transition group-hover:text-gray-400" />
                </div>
                <p className="font-mono text-lg font-bold text-white">{c.move_san}</p>
                <p className="line-clamp-2 text-[11px] leading-tight text-gray-400">{c.name}</p>
                {/* Style badge */}
                <span className={`mt-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        <p className="text-center text-[10px] text-gray-600">
          {langCode === "ml" ? "Tap ചെയ്ത് pros & cons കാണൂ" : "Tap a move to see pros & cons"}
        </p>
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {selected && (
          <DetailSheet candidate={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
