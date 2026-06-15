"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageSquare } from "lucide-react";
import type { MoveAnalysisResponse } from "@/lib/api";

const CLASSIFICATION_STYLE: Record<string, { ml: string; color: string }> = {
  best: { ml: "മികച്ച നീക്കം", color: "text-emerald-400" },
  excellent: { ml: "ഉത്തമം", color: "text-emerald-400" },
  good: { ml: "നല്ല നീക്കം", color: "text-green-400" },
  inaccuracy: { ml: "ചെറിയ പിഴവ്", color: "text-yellow-400" },
  mistake: { ml: "തെറ്റ്", color: "text-orange-400" },
  blunder: { ml: "വലിയ പിഴവ്", color: "text-red-400" },
};

export function MoveExplanation({
  analysis,
  loading,
}: {
  analysis: MoveAnalysisResponse | null;
  loading: boolean;
}) {
  return (
    <div className="card min-h-[180px]">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <MessageSquare className="h-4 w-4 text-brand" /> AI വിശദീകരണം
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-center gap-2 text-gray-400"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> വിശകലനം ചെയ്യുന്നു...
          </motion.div>
        ) : analysis ? (
          <motion.div
            key={analysis.move_san}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold">{analysis.move_san}</span>
              <span className={CLASSIFICATION_STYLE[analysis.classification]?.color}>
                {CLASSIFICATION_STYLE[analysis.classification]?.ml ??
                  analysis.classification}
              </span>
              {analysis.best_move_san && (
                <span className="text-gray-400">
                  മികച്ചത്: <b className="text-gray-200">{analysis.best_move_san}</b>
                </span>
              )}
              <span className="text-gray-500">
                നഷ്ടം: {analysis.centipawn_loss}cp
              </span>
            </div>
            <p className="font-ml leading-relaxed text-gray-200">
              {analysis.explanation_ml}
            </p>
          </motion.div>
        ) : (
          <p className="mt-6 font-ml text-sm text-gray-500">
            ഒരു നീക്കം കളിക്കൂ — AI അത് മലയാളത്തിൽ വിശദീകരിക്കും.
          </p>
        )}
      </AnimatePresence>
    </div>
  );
}
