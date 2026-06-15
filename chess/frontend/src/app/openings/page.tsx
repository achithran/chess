"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { api } from "@/lib/api";

interface Opening {
  id: number;
  name: string;
  slug: string;
  eco: string | null;
  difficulty: number;
}

const DIFFICULTY_ML = ["", "എളുപ്പം", "ഇടത്തരം", "കഠിനം"];

export default function OpeningsPage() {
  const [openings, setOpenings] = useState<Opening[]>([]);

  useEffect(() => {
    api.openings().then(setOpenings).catch(() => setOpenings([]));
  }, []);

  return (
    <div className="container-px py-12">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BookOpen className="h-6 w-6 text-brand" /> ഓപ്പണിംഗ് ട്രെയിനർ
      </h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {openings.length === 0 && (
          <p className="font-ml text-sm text-gray-500">
            ബാക്കെൻഡ് സീഡ് ചെയ്യുമ്പോൾ ഓപ്പണിംഗുകൾ ഇവിടെ ദൃശ്യമാകും.
          </p>
        )}
        {openings.map((o) => (
          <div key={o.id} className="card transition hover:border-brand">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{o.name}</h3>
              {o.eco && (
                <span className="rounded bg-surface-DEFAULT px-2 py-0.5 text-xs text-gray-400">
                  {o.eco}
                </span>
              )}
            </div>
            <p className="mt-2 font-ml text-sm text-gray-400">
              നില: {DIFFICULTY_ML[o.difficulty] ?? o.difficulty}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
