"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ReviewResult {
  accuracy_white: number;
  accuracy_black: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  summary_ml: string | null;
}

export default function ReviewPage() {
  const [pgn, setPgn] = useState("");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("cm_access_token")
          : null;
      const res = await fetch(`${API_URL}/analysis/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pgn, depth: 12 }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed");
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-px py-12">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Upload className="h-6 w-6 text-brand" /> ഗെയിം റിവ്യൂ
      </h1>
      <p className="mt-2 font-ml text-gray-400">
        നിങ്ങളുടെ PGN ഒട്ടിക്കൂ — AI കൃത്യത, ബ്ലണ്ടറുകൾ, മലയാളം സംഗ്രഹം നൽകും.
      </p>

      <textarea
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
        rows={8}
        placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ..."
        className="mt-6 w-full rounded-xl border border-surface-border bg-surface-DEFAULT p-4 font-mono text-sm outline-none focus:border-brand"
      />
      <button onClick={analyze} disabled={loading || !pgn} className="btn-primary mt-4">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        വിശകലനം ചെയ്യൂ
      </button>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="card mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="വെള്ള കൃത്യത" value={`${result.accuracy_white}%`} />
          <Stat label="കറുപ്പ് കൃത്യത" value={`${result.accuracy_black}%`} />
          <Stat label="ബ്ലണ്ടറുകൾ" value={String(result.blunders)} />
          <div className="sm:col-span-3">
            <p className="font-ml leading-relaxed text-gray-200">{result.summary_ml}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-DEFAULT p-4 text-center">
      <p className="text-2xl font-bold text-brand">{value}</p>
      <p className="mt-1 font-ml text-xs text-gray-400">{label}</p>
    </div>
  );
}
