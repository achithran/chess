"use client";

/**
 * Vertical evaluation bar (white share on bottom). Clamps the centipawn score
 * to a sigmoid so large advantages don't blow out the bar.
 */
export function EvalBar({ scoreCp, mate }: { scoreCp: number; mate?: number | null }) {
  // White win-probability style mapping.
  const whitePct =
    mate != null
      ? mate > 0
        ? 100
        : 0
      : 50 + 50 * (2 / (1 + Math.exp(-0.004 * scoreCp)) - 1);

  const label =
    mate != null ? `M${Math.abs(mate)}` : (scoreCp / 100).toFixed(1);

  return (
    <div className="flex h-full w-7 flex-col overflow-hidden rounded-md border border-surface-border bg-black">
      <div
        className="flex items-start justify-center bg-neutral-800 text-[10px] text-gray-300"
        style={{ height: `${100 - whitePct}%` }}
      >
        {scoreCp < 0 && <span className="mt-1">{label}</span>}
      </div>
      <div
        className="flex items-end justify-center bg-gray-100 text-[10px] text-black transition-all duration-500"
        style={{ height: `${whitePct}%` }}
      >
        {scoreCp >= 0 && <span className="mb-1">{label}</span>}
      </div>
    </div>
  );
}
