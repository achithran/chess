"use client";

import { useEffect, useState } from "react";
import { Trophy, Flame } from "lucide-react";
import { api } from "@/lib/api";

interface Row {
  rank: number;
  user_id: number;
  name: string;
  puzzle_rating: number;
  streak: number;
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [scope, setScope] = useState<"kerala" | "global">("kerala");

  useEffect(() => {
    api.leaderboard(scope).then(setRows).catch(() => setRows([]));
  }, [scope]);

  return (
    <div className="container-px py-12">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trophy className="h-6 w-6 text-brand" /> ലീഡർബോർഡ്
        </h1>
        <div className="flex gap-2">
          {(["kerala", "global"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                scope === s
                  ? "border-brand bg-brand/10 text-white"
                  : "border-surface-border text-gray-400"
              }`}
            >
              {s === "kerala" ? "കേരളം" : "ആഗോളം"}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-6 p-0">
        {rows.length === 0 ? (
          <p className="p-6 font-ml text-sm text-gray-500">
            ഇതുവരെ ഡാറ്റ ഇല്ല. പസിലുകൾ പരിഹരിച്ച് ലീഡർബോർഡിൽ കയറൂ!
          </p>
        ) : (
          <ul className="divide-y divide-surface-border">
            {rows.map((r) => (
              <li key={r.user_id} className="flex items-center gap-4 px-6 py-3">
                <span className="w-6 text-center font-semibold text-gray-400">
                  {r.rank}
                </span>
                <span className="flex-1">{r.name}</span>
                <span className="flex items-center gap-1 text-sm text-orange-400">
                  <Flame className="h-3.5 w-3.5" /> {r.streak}
                </span>
                <span className="w-16 text-right font-mono">{r.puzzle_rating}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
