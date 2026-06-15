"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Brain, CheckCircle2, ChevronLeft,
  ChevronRight, Lightbulb, Mic, Pause, Play, Shield, Sparkles,
  TrendingDown, TrendingUp, Volume2, VolumeX, XCircle, Zap,
} from "lucide-react";
import type { MoveAnalysisResponse } from "@/lib/api";
import { isSpeechSupported, speak, speakSequence, stopSpeaking } from "@/lib/speak";
import { ttsLangFor, useLanguageStore } from "@/store/language";
import { VoicePicker, getStoredVoiceId } from "@/components/voice-picker";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BoardArrow   = [string, string, string];
export type BoardSquares = Record<string, React.CSSProperties>;

interface SlideRenderProps {
  analysis:   MoveAnalysisResponse;
  from:       string;
  to:         string;
  onAnnotate: (a: BoardArrow[], s: BoardSquares) => void;
  langCode:   string;
  playTrigger?: number;     // increments to trigger sentence-by-sentence TTS
  onPlayEnd?:   () => void; // called when TTS sequence finishes
}

// ── Classification config ─────────────────────────────────────────────────────

const CLASS_CFG: Record<string, {
  label: string; emoji: string;
  gradient: string; border: string; text: string; badge: string;
  arrowRgb: string; dot: string;
}> = {
  best:       { label:"Best Move!",  emoji:"✨", gradient:"from-emerald-900/60 to-emerald-950/80", border:"border-emerald-500",  text:"text-emerald-300", badge:"bg-emerald-900/60 text-emerald-200", arrowRgb:"34,197,94",  dot:"bg-emerald-400" },
  excellent:  { label:"Excellent",   emoji:"⭐", gradient:"from-emerald-900/50 to-emerald-950/70", border:"border-emerald-500",  text:"text-emerald-300", badge:"bg-emerald-900/50 text-emerald-200", arrowRgb:"34,197,94",  dot:"bg-emerald-400" },
  good:       { label:"Good Move",   emoji:"👍", gradient:"from-teal-900/50 to-teal-950/70",      border:"border-teal-500",     text:"text-teal-300",    badge:"bg-teal-900/50 text-teal-200",       arrowRgb:"20,184,166", dot:"bg-teal-400"    },
  inaccuracy: { label:"Inaccuracy",  emoji:"⚠️", gradient:"from-yellow-900/50 to-yellow-950/70",  border:"border-yellow-500",   text:"text-yellow-300",  badge:"bg-yellow-900/50 text-yellow-200",   arrowRgb:"234,179,8",  dot:"bg-yellow-400"  },
  mistake:    { label:"Mistake",     emoji:"❌", gradient:"from-orange-900/50 to-orange-950/70",  border:"border-orange-500",   text:"text-orange-300",  badge:"bg-orange-900/50 text-orange-200",   arrowRgb:"249,115,22", dot:"bg-orange-400"  },
  blunder:    { label:"Blunder!",    emoji:"💀", gradient:"from-red-900/60 to-red-950/80",        border:"border-red-500",      text:"text-red-300",     badge:"bg-red-900/60 text-red-200",         arrowRgb:"239,68,68",  dot:"bg-red-400"     },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pieceFromSan(san: string) {
  const ch = san[0];
  if (ch === "K") return { symbol:"♚", name:"King" };
  if (ch === "Q") return { symbol:"♛", name:"Queen" };
  if (ch === "R") return { symbol:"♜", name:"Rook" };
  if (ch === "B") return { symbol:"♝", name:"Bishop" };
  if (ch === "N") return { symbol:"♞", name:"Knight" };
  return { symbol:"♟", name:"Pawn" };
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
function evalToPercent(e: number) { return 50 + clamp(e, -5, 5) * 10; }

function extractSquares(text: string): string[] {
  const m = text.match(/\b([a-h][1-8])\b/g);
  return m ? [...new Set(m)] : [];
}

function inferContext(text: string): "attack" | "defend" | "control" | "neutral" {
  const t = text.toLowerCase();
  if (/attack|threaten|capture|take|hanging|win|fork|pin|skewer|sacrifice|check/.test(t)) return "attack";
  if (/defend|protect|safe|guard|block|shield|cover/.test(t)) return "defend";
  if (/control|occupy|center|centre|outpost|dominate|command/.test(t)) return "control";
  return "neutral";
}


function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[।.!?])\s+|(?<=[।.!?])$/)
    .map((s) => s.trim().replace(/[.!?।]+$/, ""))
    .filter(Boolean);
}

function destFromSan(san: string): string | null {
  const cleaned = san.replace(/[+#=QRBN]/g, "");
  const m = cleaned.match(/([a-h][1-8])$/);
  return m ? m[1] : null;
}

// ── Slide: Verdict ────────────────────────────────────────────────────────────

function VerdictSlide({ analysis, from, to, onAnnotate }: SlideRenderProps) {
  const cfg = CLASS_CFG[analysis.classification] ?? CLASS_CFG.good;
  const piece = pieceFromSan(analysis.move_san);
  const delta = analysis.eval_after - analysis.eval_before;
  const gained = delta >= 0;

  useEffect(() => {
    onAnnotate(
      [[from, to, `rgba(${cfg.arrowRgb},0.85)`]],
      { [to]: { background: `rgba(${cfg.arrowRgb},0.30)` } },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, cfg.arrowRgb]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 ${cfg.border} bg-black/30 text-4xl`}>
          {piece.symbol}
        </div>
        <div>
          <p className="font-mono text-3xl font-bold text-white">{analysis.move_san}</p>
          <p className="text-sm text-gray-400">{piece.name} · {from} → {to}</p>
        </div>
        <div className={`ml-auto rounded-xl px-3 py-2 text-center ${cfg.badge}`}>
          <p className="text-2xl">{cfg.emoji}</p>
          <p className="mt-0.5 text-xs font-semibold">{cfg.label}</p>
        </div>
      </div>

      <div className={`rounded-xl border ${cfg.border}/40 bg-black/20 p-3 space-y-2`}>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Before</span>
          <span className={`flex items-center gap-1 font-semibold ${gained ? "text-emerald-400" : "text-red-400"}`}>
            {gained ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {gained ? "+" : ""}{delta.toFixed(2)} pawns
          </span>
          <span>After</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-gray-300">
          <span className="w-12 text-right">{analysis.eval_before >= 0 ? "+" : ""}{analysis.eval_before.toFixed(2)}</span>
          <div className="relative flex-1">
            <div className="h-3 overflow-hidden rounded-full bg-gray-700">
              <div className="absolute inset-y-0 right-0 rounded-r-full bg-gray-200 transition-all"
                style={{ width: `${100 - evalToPercent(analysis.eval_after)}%` }} />
              <div className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />
            </div>
            <motion.div
              className={`absolute top-0 h-3 w-2 rounded-full ${gained ? "bg-emerald-400" : "bg-red-400"}`}
              style={{ left: `${evalToPercent(analysis.eval_before)}%`, translateX: "-50%" }}
              animate={{ left: `${evalToPercent(analysis.eval_after)}%` }}
              transition={{ duration: 0.9, delay: 0.2 }}
            />
          </div>
          <span className="w-12">{analysis.eval_after >= 0 ? "+" : ""}{analysis.eval_after.toFixed(2)}</span>
        </div>
        {analysis.centipawn_loss > 0 && (
          <p className="text-center text-xs text-orange-400">−{analysis.centipawn_loss} centipawns lost</p>
        )}
      </div>
    </div>
  );
}

// ── Color maps for structured step annotations ────────────────────────────────
// Using full-opacity hex for arrows so they're clearly visible on the board.
// Squares use semi-transparent rgba so pieces remain visible through the highlight.

const ARROW_COLOR: Record<string, string> = {
  green:  "#16a34a",   // solid green
  red:    "#dc2626",   // solid red
  purple: "#7c3aed",   // solid purple
  yellow: "#ca8a04",   // solid amber
  blue:   "#2563eb",   // solid blue
  orange: "#ea580c",   // solid orange
};
const SQ_RGBA: Record<string, string> = {
  green:  "rgba(34,197,94,0.55)",
  red:    "rgba(239,68,68,0.55)",
  purple: "rgba(139,92,246,0.55)",
  yellow: "rgba(234,179,8,0.48)",
  blue:   "rgba(59,130,246,0.48)",
  orange: "rgba(249,115,22,0.48)",
};
const SQ_RING: Record<string, string> = {
  green:  "#16a34a",
  red:    "#dc2626",
  purple: "#7c3aed",
  yellow: "#ca8a04",
  blue:   "#2563eb",
  orange: "#ea580c",
};
const COLOR_LABEL: Record<string, string> = {
  green: "✅ Good move", red: "⚔️ Threat", purple: "🎯 Control",
  yellow: "📍 Watch this", blue: "🛡️ Protected", orange: "⚡ Pressure",
};
const COLOR_TEXT: Record<string, string> = {
  green: "text-emerald-300", red: "text-red-300", purple: "text-purple-300",
  yellow: "text-yellow-300", blue: "text-blue-300", orange: "text-orange-300",
};

// TTS speed options
const SPEEDS = [
  { label: "0.7×", rate: 0.7 },
  { label: "1×",   rate: 1.0 },
  { label: "1.3×", rate: 1.3 },
];
const SPEED_KEY = "cm_tts_speed";

// ── Slide: Why This Move (ONE AT A TIME, STRUCTURED STEPS) ────────────────────

function WhySlide({ analysis, from, to, onAnnotate, langCode, playTrigger, onPlayEnd }: SlideRenderProps) {
  const cfg   = CLASS_CFG[analysis.classification] ?? CLASS_CFG.good;
  const piece = pieceFromSan(analysis.move_san);

  const steps = analysis.explanation_steps?.length
    ? analysis.explanation_steps
    : splitSentences(analysis.explanation_ml ?? "").map((text) => ({
        text_ml: text, arrows: [] as string[][], squares: [] as string[][],
      }));
  const total = steps.length;

  const [active,      setActive]      = useState(0);
  const [playing,     setPlaying]     = useState(false);
  const [dir,         setDir]         = useState(1);
  const [voicePicker, setVoicePicker] = useState(false);
  const [voiceName,   setVoiceName]   = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("cm_tts_voice_name") ?? "";
  });
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1.0;
    return parseFloat(localStorage.getItem(SPEED_KEY) ?? "1.0") || 1.0;
  });
  const stopRef = useRef(false);

  const saveSpeed = (r: number) => {
    setSpeed(r);
    if (typeof window !== "undefined") localStorage.setItem(SPEED_KEY, String(r));
  };
  const handleVoiceSelect = (voiceId: string, name: string) => {
    setVoiceName(name);
    if (typeof window !== "undefined") window.localStorage.setItem("cm_tts_voice_name", name);
  };

  // Build and fire board annotations for a given step index
  const fireAnnotation = useCallback((idx: number) => {
    const step = steps[idx];
    if (!step) return;
    const arrows: BoardArrow[] = (step.arrows ?? []).map(
      ([f, t, c]) => [f, t, ARROW_COLOR[c] ?? ARROW_COLOR.green] as BoardArrow,
    );
    const styles: BoardSquares = {};
    for (const [sq, c] of (step.squares ?? [])) {
      styles[sq] = {
        background: SQ_RGBA[c] ?? SQ_RGBA.yellow,
        boxShadow:  `inset 0 0 0 3px ${SQ_RING[c] ?? SQ_RING.yellow}`,
        borderRadius: "3px",
      };
    }
    if (arrows.length === 0) {
      arrows.push([from, to, ARROW_COLOR.green]);
    }
    onAnnotate(arrows, styles);
  }, [steps, from, to, onAnnotate]);

  useEffect(() => { fireAnnotation(active); }, [active, fireAnnotation]);

  // External playTrigger from CoachPanel "Listen" / auto-play
  useEffect(() => {
    if (!playTrigger) return;
    stopRef.current = false;
    setPlaying(true);
    setDir(1);
    setActive(0);
    speakSequence(
      steps.map((s) => s.text_ml),
      ttsLangFor(langCode),
      (i) => { if (!stopRef.current) { setDir(1); setActive(i); } },
      () => { setPlaying(false); onPlayEnd?.(); },
      speed,
    );
    return () => { stopRef.current = true; stopSpeaking(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playTrigger]);

  const stopPlay = () => {
    stopRef.current = true; stopSpeaking(); setPlaying(false); onPlayEnd?.();
  };

  const goTo = (idx: number) => {
    if (playing) stopPlay();
    setDir(idx > active ? 1 : -1);
    setActive(Math.max(0, Math.min(total - 1, idx)));
  };

  const togglePlay = () => {
    if (playing) { stopPlay(); return; }
    stopRef.current = false;
    setPlaying(true);
    const start = active;
    speakSequence(
      steps.slice(start).map((s) => s.text_ml),
      ttsLangFor(langCode),
      (i) => { if (!stopRef.current) { setDir(1); setActive(start + i); } },
      () => { setPlaying(false); onPlayEnd?.(); },
      speed,
    );
  };

  const repeatStep = () => {
    if (playing) stopPlay();
    const text = steps[active]?.text_ml;
    if (text) speak(text, ttsLangFor(langCode), undefined, speed);
  };

  if (total === 0) return (
    <p className="py-4 text-center text-sm text-gray-500">No explanation available.</p>
  );

  const step = steps[active]!;
  const dominantColor = step.arrows?.[0]?.[2] ?? step.squares?.[0]?.[1] ?? "green";
  const isLastStep    = active === total - 1;

  const stepSquares = [...new Set([
    ...(step.arrows  ?? []).map((a) => a[1]),
    ...(step.squares ?? []).map((s) => s[0]),
  ])].slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Piece strip — always visible */}
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <span className="text-2xl">{piece.symbol}</span>
        <div>
          <p className="text-xs font-semibold text-white">{piece.name}</p>
          <p className="font-mono text-xs text-gray-400">{from} → {to}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {/* Step dots */}
          {steps.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-200 ${
                i === active ? `h-2.5 w-6 ${cfg.dot}` : "h-2.5 w-2.5 bg-gray-600 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Single step card */}
      <div className="relative overflow-hidden" style={{ minHeight: 148 }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={active}
            custom={dir}
            initial={{ opacity: 0, x: dir * 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -32 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`rounded-2xl border-2 p-4 ${cfg.border}/60 bg-black/30`}
          >
            {/* Step header */}
            <div className="mb-3 flex items-center gap-2">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${cfg.dot}`}>
                {active + 1}
              </div>
              <span className="text-xs text-gray-500">of {total}</span>
              {/* "Your turn" badge on last step */}
              {isLastStep
                ? <span className="ml-auto rounded-full bg-yellow-900/60 px-2 py-0.5 text-xs font-semibold text-yellow-300">
                    🎯 {langCode === "ml" ? "നിങ്ങളുടെ turn" : "Your turn!"}
                  </span>
                : <span className={`ml-auto rounded-full bg-black/30 px-2 py-0.5 text-xs font-medium ${COLOR_TEXT[dominantColor] ?? "text-gray-300"}`}>
                    {COLOR_LABEL[dominantColor] ?? "📍"}
                  </span>
              }
            </div>

            {/* Explanation text — larger for readability */}
            <p className={`leading-relaxed text-white ${isLastStep ? "text-base font-medium" : "text-base"}`}>
              {step.text_ml}
            </p>

            {/* Square badges */}
            {stepSquares.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-500">
                  {langCode === "ml" ? "Board-ൽ:" : "See on board:"}
                </span>
                {stepSquares.map((sq) => {
                  const sqColor = step.squares?.find((s) => s[0] === sq)?.[1]
                    ?? step.arrows?.find((a) => a[1] === sq)?.[2]
                    ?? dominantColor;
                  return (
                    <span key={sq}
                      className="rounded-md px-2 py-0.5 font-mono text-xs font-bold text-white"
                      style={{ background: SQ_RGBA[sqColor] ?? SQ_RGBA.yellow }}>
                      {sq}
                    </span>
                  );
                })}
              </div>
            )}

            {/* TTS playing pulse */}
            {playing && (
              <motion.div className="mt-2 flex items-center gap-1"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {[0,1,2,3].map((i) => (
                  <motion.div key={i} className={`h-1 w-1 rounded-full ${cfg.dot}`}
                    animate={{ scaleY: [1, 2.8, 1] }}
                    transition={{ repeat: Infinity, duration: 0.55, delay: i * 0.1 }} />
                ))}
                <span className="ml-1.5 text-xs text-gray-400">
                  {langCode === "ml" ? "വായിക്കുന്നു…" : "reading aloud…"}
                </span>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls row: Prev | voice buttons | speed | Next */}
      <div className="flex items-center gap-1.5">
        {/* Prev */}
        <button onClick={() => goTo(active - 1)} disabled={active === 0}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
          <ChevronLeft className="h-4 w-4" />
          {langCode === "ml" ? "മുമ്പ്" : "Prev"}
        </button>

        {isSpeechSupported() && (
          <>
            {/* Play / Stop */}
            <button onClick={togglePlay}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                playing
                  ? "border-brand bg-brand/20 text-white"
                  : "border-surface-border text-gray-300 hover:border-gray-400 hover:text-white"
              }`}>
              {playing ? <><Pause className="h-3.5 w-3.5" /> Stop</> : <><Play className="h-3.5 w-3.5" /> Play</>}
            </button>

            {/* Repeat current step */}
            <button onClick={repeatStep}
              title="Repeat this step"
              className="flex items-center justify-center rounded-lg border border-surface-border p-1.5 text-gray-400 transition hover:border-gray-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            {/* Speed pills */}
            <div className="flex gap-0.5">
              {SPEEDS.map((s) => (
                <button key={s.rate} onClick={() => saveSpeed(s.rate)}
                  className={`rounded px-1.5 py-1 text-[10px] font-medium transition ${
                    speed === s.rate
                      ? "bg-brand/30 text-white"
                      : "text-gray-500 hover:text-gray-300"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Voice picker button */}
            <button
              onClick={() => setVoicePicker(true)}
              title="Choose voice accent"
              className="flex items-center gap-1 rounded-lg border border-surface-border px-1.5 py-1 text-[10px] text-gray-400 transition hover:border-brand/50 hover:text-brand">
              <Mic className="h-3 w-3" />
              {voiceName || "Voice"}
            </button>
            <VoicePicker
              open={voicePicker}
              onClose={() => setVoicePicker(false)}
              onSelect={handleVoiceSelect}
            />

          </>
        )}

        {/* Next (pushed to end) */}
        <button onClick={() => goTo(active + 1)} disabled={active === total - 1}
          className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
          {langCode === "ml" ? "അടുത്തത്" : "Next"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Slide: Threats ────────────────────────────────────────────────────────────

function ThreatsSlide({ analysis, from, to, onAnnotate, langCode }: SlideRenderProps) {
  const cfg = CLASS_CFG[analysis.classification] ?? CLASS_CFG.good;
  const [active, setActive] = useState(0);

  const fireAnnotation = useCallback((idx: number) => {
    const threat  = analysis.threats[idx] ?? "";
    const squares = extractSquares(threat);
    const arrows: BoardArrow[]  = [[from, to, `rgba(${cfg.arrowRgb},0.40)`]];
    const styles: BoardSquares  = {};
    for (const sq of squares) {
      styles[sq] = {
        background: "rgba(239,68,68,0.50)",
        boxShadow: "inset 0 0 0 2px rgba(239,68,68,0.85)",
        borderRadius: "3px",
      };
    }
    onAnnotate(arrows, styles);
  }, [analysis.threats, cfg.arrowRgb, from, to, onAnnotate]);

  useEffect(() => { fireAnnotation(active); }, [active, fireAnnotation]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {langCode === "ml" ? "Tap → board-ൽ danger squares കാണൂ" : "Tap a threat — board highlights the danger"}
      </p>
      {analysis.threats.map((threat, i) => {
        const squares  = extractSquares(threat);
        const isActive = active === i;
        return (
          <motion.button
            key={i}
            onClick={() => setActive(i)}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className={`w-full text-left flex items-start gap-3 rounded-xl border p-3 transition-all ${
              isActive
                ? "border-red-500/70 bg-red-950/50 shadow-lg shadow-red-900/20"
                : "border-red-900/40 bg-red-950/20 hover:border-red-700/50"
            }`}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg transition-all ${
              isActive ? "bg-red-800" : "bg-red-950"
            }`}>
              🚨
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-relaxed ${isActive ? "text-red-100" : "text-red-300"}`}>{threat}</p>
              {isActive && squares.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 flex flex-wrap gap-1">
                  <span className="text-xs text-red-500 mr-1">Highlighted:</span>
                  {squares.map((sq) => (
                    <span key={sq} className="rounded px-1.5 py-0.5 font-mono text-xs font-bold text-white"
                      style={{ background: "rgba(239,68,68,0.6)" }}>{sq}</span>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Slide: Position Health ────────────────────────────────────────────────────

function PositionSlide({ analysis, from, to, onAnnotate, langCode }: SlideRenderProps) {
  const cfg  = CLASS_CFG[analysis.classification] ?? CLASS_CFG.good;
  const [active, setActive] = useState<number | null>(null);
  const good  = analysis.checklist.filter((c) => c.ok).length;
  const total = analysis.checklist.length;
  const pct   = total > 0 ? Math.round((good / total) * 100) : 0;
  const healthColor = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
  const healthBar   = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500"  : "bg-red-500";

  const fireAnnotation = useCallback((idx: number | null) => {
    const arrows: BoardArrow[]  = [[from, to, `rgba(${cfg.arrowRgb},0.40)`]];
    const styles: BoardSquares  = {};
    if (idx !== null) {
      const item = analysis.checklist[idx];
      for (const sq of extractSquares(item.text_ml)) {
        styles[sq] = {
          background: item.ok ? "rgba(34,197,94,0.45)" : "rgba(249,115,22,0.45)",
          borderRadius: "3px",
        };
      }
    }
    onAnnotate(arrows, styles);
  }, [analysis.checklist, cfg.arrowRgb, from, to, onAnnotate]);

  useEffect(() => { fireAnnotation(active); }, [active, fireAnnotation]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border border-surface-border bg-black/20 p-3">
        <div className={`text-3xl font-bold tabular-nums ${healthColor}`}>{pct}%</div>
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">{good}/{total} {langCode === "ml" ? "items ഭദ്രം" : "items healthy"}</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-border">
            <motion.div className={`h-full rounded-full ${healthBar}`}
              initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: 0.2 }} />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        {langCode === "ml" ? "Tap → board-ൽ related squares കാണൂ" : "Tap an item — see related squares on board"}
      </p>
      <div className="space-y-2">
        {analysis.checklist.map((item, i) => {
          const isActive = active === i;
          const squares  = extractSquares(item.text_ml);
          return (
            <motion.button key={i} onClick={() => setActive(isActive ? null : i)}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`w-full text-left flex items-center gap-3 rounded-lg border p-2.5 transition-all ${
                isActive
                  ? item.ok ? "border-emerald-500/60 bg-emerald-950/50" : "border-orange-500/60 bg-orange-950/40"
                  : item.ok ? "border-emerald-800/40 bg-emerald-950/20 hover:border-emerald-600/50"
                             : "border-orange-800/40 bg-orange-950/20 hover:border-orange-600/50"
              }`}
            >
              {item.ok
                ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                : <XCircle      className="h-5 w-5 shrink-0 text-orange-400" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{item.text_ml}</p>
                {isActive && squares.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {squares.map((sq) => (
                      <span key={sq} className="rounded px-1.5 py-0.5 font-mono text-xs text-white"
                        style={{ background: item.ok ? "rgba(34,197,94,0.5)" : "rgba(249,115,22,0.5)" }}>{sq}</span>
                    ))}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Slide: Better Move ────────────────────────────────────────────────────────

function BetterMoveSlide({ analysis, from, to, onAnnotate, langCode }: SlideRenderProps) {
  const cfg     = CLASS_CFG[analysis.classification] ?? CLASS_CFG.good;
  const bestDest = analysis.best_move_san ? destFromSan(analysis.best_move_san) : null;

  useEffect(() => {
    const arrows: BoardArrow[]  = [[from, to, `rgba(${cfg.arrowRgb},0.30)`]];
    const styles: BoardSquares  = {};
    if (bestDest) {
      styles[bestDest] = {
        background: "rgba(250,204,21,0.45)",
        boxShadow: "inset 0 0 0 2px rgba(250,204,21,0.85)",
        borderRadius: "3px",
      };
    }
    onAnnotate(arrows, styles);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, bestDest, cfg.arrowRgb]);

  const sentences = splitSentences(analysis.best_move_reason_ml ?? "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-yellow-700/50 bg-yellow-950/40 p-4">
        <div className="text-4xl">💡</div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{langCode === "ml" ? "Engine top move" : "Engine's top choice"}</p>
          <p className="font-mono text-2xl font-bold text-yellow-300">{analysis.best_move_san}</p>
          {bestDest && (
            <p className="text-xs text-yellow-600 mt-0.5">→ <span className="font-mono font-bold">{bestDest}</span> highlighted on board</p>
          )}
        </div>
        <Zap className="ml-auto h-8 w-8 text-yellow-500/30" />
      </div>
      <div className="space-y-2">
        {sentences.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
            className="flex items-start gap-3">
            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
            <p className="text-sm leading-relaxed text-gray-200">{s}.</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Slide: Perfect ────────────────────────────────────────────────────────────

function PerfectSlide({ from, to, onAnnotate, langCode }: SlideRenderProps) {
  useEffect(() => {
    onAnnotate(
      [[from, to, "rgba(34,197,94,0.9)"]],
      { [to]: { background: "rgba(34,197,94,0.30)", borderRadius: "3px" } },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type:"spring", stiffness:220, damping:12, delay:0.1 }}>
        <span className="text-6xl">🏆</span>
      </motion.div>
      <div>
        <p className="text-lg font-bold text-white">
          {langCode === "ml" ? "ഇതാണ് ഏറ്റവും മികച്ച നീക്കം!" : "This was the best move!"}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          {langCode === "ml" ? "Engine-ഉം ഇതുതന്നെ കളിക്കുമായിരുന്നു. Brilliant!" : "The engine would play the same. Brilliant!"}
        </p>
      </div>
      <div className="flex gap-2">
        {["🎯","⭐","✨","💪"].map((e, i) => (
          <motion.span key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            transition={{ delay: 0.3 + i * 0.1 }} className="text-2xl">{e}</motion.span>
        ))}
      </div>
    </div>
  );
}

// ── Slide definitions ─────────────────────────────────────────────────────────

interface SlideDef {
  id:          string;
  title:       string;
  icon:        React.ReactNode;
  accentColor: string;
  render:      (props: SlideRenderProps) => React.ReactNode;
}

function buildSlideDefs(analysis: MoveAnalysisResponse): SlideDef[] {
  const cfg     = CLASS_CFG[analysis.classification] ?? CLASS_CFG.good;
  const showBetter = !!analysis.best_move_san && analysis.best_move_san !== analysis.move_san && !!analysis.best_move_reason_ml;
  const isBest  = analysis.classification === "best" || analysis.classification === "excellent";
  const defs: SlideDef[] = [];

  defs.push({
    id: "verdict", title: "The Move", icon: <span className="text-base">{cfg.emoji}</span>, accentColor: cfg.text,
    render: (p) => <VerdictSlide {...p} />,
  });

  if (analysis.explanation_ml) {
    defs.push({
      id: "why", title: "Why This Move?", icon: <Brain className="h-4 w-4" />, accentColor: "text-purple-300",
      render: (p) => <WhySlide {...p} />,
    });
  }

  if (analysis.threats.length > 0) {
    defs.push({
      id: "threats", title: "⚠️ Watch Out", icon: <AlertTriangle className="h-4 w-4" />, accentColor: "text-red-300",
      render: (p) => <ThreatsSlide {...p} />,
    });
  }

  if (analysis.checklist.length > 0) {
    defs.push({
      id: "position", title: "Position Health", icon: <Shield className="h-4 w-4" />, accentColor: "text-blue-300",
      render: (p) => <PositionSlide {...p} />,
    });
  }

  if (showBetter) {
    defs.push({
      id: "better", title: "💡 Stronger Move", icon: <Lightbulb className="h-4 w-4" />, accentColor: "text-yellow-300",
      render: (p) => <BetterMoveSlide {...p} />,
    });
  } else if (isBest) {
    defs.push({
      id: "perfect", title: "🎯 Perfect!", icon: <Sparkles className="h-4 w-4" />, accentColor: "text-emerald-300",
      render: (p) => <PerfectSlide {...p} />,
    });
  }

  return defs;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CoachPanel({
  analysis, loading, error, headerLabel, moveUci, onAnnotate, autoPlay,
}: {
  analysis:    MoveAnalysisResponse | null;
  loading:     boolean;
  error:       string | null;
  headerLabel?: string;
  moveUci?:    string;
  onAnnotate?: (arrows: BoardArrow[], squareStyles: BoardSquares) => void;
  autoPlay?:   boolean;
}) {
  const [slideIdx,  setSlideIdx]  = useState(0);
  const [direction, setDirection] = useState(1);
  const [speaking,  setSpeaking]  = useState(false);
  const [whyTrigger, setWhyTrigger] = useState(0);
  const langCode = useLanguageStore((s) => s.code);

  const annotateRef = useRef(onAnnotate);
  useEffect(() => { annotateRef.current = onAnnotate; }, [onAnnotate]);
  const stableAnnotate = useCallback((a: BoardArrow[], s: BoardSquares) => {
    annotateRef.current?.(a, s);
  }, []);

  const prevAnalysisRef = useRef<MoveAnalysisResponse | null>(null);
  useEffect(() => {
    const wasNull = !prevAnalysisRef.current;
    prevAnalysisRef.current = analysis;
    setDirection(1);
    if (autoPlay && analysis && wasNull && analysis.explanation_ml) {
      // New analysis in guru mode: jump straight to "why" slide (always index 1) and auto-play
      setSlideIdx(1);
      setWhyTrigger((t) => t + 1);
      setSpeaking(true);
    } else {
      setSlideIdx(0);
      setSpeaking(false);
    }
  }, [analysis, autoPlay]);

  if (loading) {
    return (
      <div className="card">
        <div className="flex flex-col items-center gap-3 py-6">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
            <Sparkles className="h-8 w-8 text-brand" />
          </motion.div>
          <p className="text-sm text-gray-400">{langCode === "ml" ? "ഗുരു ആലോചിക്കുന്നു…" : "Guru is thinking…"}</p>
          <div className="flex gap-1.5">
            {[0,1,2].map((i) => (
              <motion.div key={i} className="h-2 w-2 rounded-full bg-brand"
                animate={{ opacity:[0.3,1,0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-yellow-800/50 bg-yellow-950/20">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-400" />
          <p className="text-sm text-yellow-200">{error}</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="card border-dashed">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="rounded-xl bg-surface-border p-3 text-3xl">🤔</div>
          <div>
            <p className="font-medium text-gray-300">
              {langCode === "ml" ? "ഒരു നീക്കം ഉണ്ടാക്കൂ, പിന്നെ Why? ചോദിക്കൂ" : "Make a move, then tap Why?"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {langCode === "ml" ? "ഓരോ point-ഉം board-ൽ visual ആയി കാണാം" : "Each point shown visually on the board"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const from   = moveUci?.slice(0, 2) ?? "a1";
  const to     = moveUci?.slice(2, 4) ?? "a1";
  const cfg    = CLASS_CFG[analysis.classification] ?? CLASS_CFG.good;
  const slides = buildSlideDefs(analysis);
  const slide  = slides[slideIdx];
  if (!slide) return null;

  const goTo = (idx: number) => {
    setDirection(idx > slideIdx ? 1 : -1);
    setSlideIdx(idx);
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (slide.id === "why") {
      // WhySlide handles its own sentence-by-sentence TTS
      setSpeaking(true);
      setWhyTrigger((t) => t + 1);
    } else {
      const parts = [
        analysis.explanation_ml,
        analysis.best_move_reason_ml,
        ...analysis.threats,
        ...analysis.checklist.map((c) => c.text_ml),
      ].filter(Boolean) as string[];
      setSpeaking(true);
      speak(parts.join(". "), ttsLangFor(langCode), () => setSpeaking(false));
    }
  };

  const renderProps: SlideRenderProps = {
    analysis,
    from,
    to,
    onAnnotate: stableAnnotate,
    langCode,
    playTrigger: slide.id === "why" ? whyTrigger : undefined,
    onPlayEnd:   slide.id === "why" ? () => setSpeaking(false) : undefined,
  };

  return (
    <div className={`overflow-hidden rounded-2xl border-2 bg-gradient-to-b ${cfg.gradient} ${cfg.border}/60`}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        {headerLabel
          ? <p className="text-xs font-medium text-purple-300">{headerLabel}</p>
          : <p className="text-xs font-medium text-gray-400">{langCode === "ml" ? "ഗുരു — Visual Explanation" : "Guru — Visual Explanation"}</p>
        }
        {isSpeechSupported() && (
          <button onClick={toggleSpeak}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-gray-300 transition hover:border-white/30 hover:text-white">
            {speaking
              ? <><VolumeX className="h-3.5 w-3.5" /> Stop</>
              : <><Volume2 className="h-3.5 w-3.5" /> Listen</>
            }
          </button>
        )}
      </div>

      {/* Slide title */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <span className={cfg.text}>{slide.icon}</span>
        <h3 className="font-semibold text-white">{slide.title}</h3>
        <span className="ml-auto text-xs text-gray-500 tabular-nums">{slideIdx + 1}/{slides.length}</span>
      </div>

      {/* Slide body */}
      <div className="relative px-4 pb-4 pt-2" style={{ minHeight: 200 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={slide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {slide.render(renderProps)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide nav */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
        <button onClick={() => goTo(slideIdx - 1)} disabled={slideIdx === 0}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft className="h-4 w-4" />
          {langCode === "ml" ? "പിന്നോട്ട്" : "Prev slide"}
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button key={s.id} onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === slideIdx ? `h-2 w-5 ${cfg.dot}` : "h-2 w-2 bg-gray-600 hover:bg-gray-400"
              }`} />
          ))}
        </div>

        <button onClick={() => goTo(slideIdx + 1)} disabled={slideIdx === slides.length - 1}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">
          {langCode === "ml" ? "അടുത്ത slide" : "Next slide"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
