"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Clock, Users, Info } from "lucide-react";
import { api } from "@/lib/api";

const FORMATS = [
  { value: "swiss",       label: "Swiss",        desc: "Everyone plays every round, ranked by points." },
  { value: "round_robin", label: "Round Robin",   desc: "Everyone plays everyone. Best for small groups." },
  { value: "knockout",    label: "Knockout",      desc: "Single elimination bracket." },
  { value: "arena",       label: "Arena",         desc: "Play as many games as possible in a time window." },
];

const TIME_CONTROLS = [
  "1+0", "2+1", "3+2", "5+0", "5+3", "10+0", "15+10", "30+0", "60+0",
];

export default function CreateTournamentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    format: "swiss",
    time_control: "3+2",
    max_players: 16,
    rounds_total: "" as string | number,
    entry_fee_inr: 0,
    prize_pool_inr: 0,
    is_public: true,
    starts_at: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (field: string, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        format: form.format,
        time_control: form.time_control,
        max_players: Number(form.max_players),
        rounds_total: form.rounds_total ? Number(form.rounds_total) : undefined,
        entry_fee_inr: Number(form.entry_fee_inr),
        is_public: form.is_public,
        starts_at: form.starts_at || undefined,
      };
      const t = await api.createTournament(body);
      router.push(`/tournaments/${t.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create tournament.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-px py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Create Tournament</h1>
          <p className="mt-1 text-sm text-gray-400">
            Set up a professional chess tournament. Players join via your invite link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic info */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-white">Basic Info</h2>
            <div>
              <label className="label">Tournament Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Kerala District Championship 2025"
                className="input w-full"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Open to all rated players…"
                rows={2}
                className="input w-full resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="public"
                checked={form.is_public}
                onChange={(e) => set("is_public", e.target.checked)}
                className="h-4 w-4 rounded border-surface-border bg-surface-DEFAULT accent-brand"
              />
              <label htmlFor="public" className="text-sm text-gray-300">
                List publicly on the tournament lobby
              </label>
            </div>
          </div>

          {/* Format */}
          <div className="card space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Trophy className="h-4 w-4 text-brand" /> Format
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => set("format", f.value)}
                  className={`rounded-lg border p-3 text-left text-sm transition ${
                    form.format === f.value
                      ? "border-brand bg-brand/10 text-white"
                      : "border-surface-border text-gray-400 hover:text-white"
                  }`}
                >
                  <span className="font-medium">{f.label}</span>
                  <span className="mt-0.5 block text-xs opacity-70">{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time control & players */}
          <div className="card space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Clock className="h-4 w-4 text-brand" /> Time Control &amp; Size
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Time Control</label>
                <select
                  value={form.time_control}
                  onChange={(e) => set("time_control", e.target.value)}
                  className="input w-full"
                >
                  {TIME_CONTROLS.map((tc) => (
                    <option key={tc} value={tc}>{tc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Max Players</label>
                <select
                  value={form.max_players}
                  onChange={(e) => set("max_players", Number(e.target.value))}
                  className="input w-full"
                >
                  {[4, 8, 16, 32, 64, 128].map((n) => (
                    <option key={n} value={n}>{n} players</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">
                  Rounds {form.format === "arena" ? "(N/A for Arena)" : "(leave blank for auto)"}
                </label>
                <input
                  type="number"
                  min={1} max={11}
                  value={form.rounds_total}
                  onChange={(e) => set("rounds_total", e.target.value)}
                  disabled={form.format === "arena"}
                  placeholder="Auto"
                  className="input w-full disabled:opacity-40"
                />
              </div>
              <div>
                <label className="label">Start Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => set("starts_at", e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          {/* Monetisation */}
          <div className="card space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-white">
              <Users className="h-4 w-4 text-brand" /> Entry &amp; Prizes
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Entry Fee (₹)</label>
                <input
                  type="number" min={0}
                  value={form.entry_fee_inr}
                  onChange={(e) => set("entry_fee_inr", e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="label">Prize Pool (₹)</label>
                <input
                  type="number" min={0}
                  value={form.prize_pool_inr}
                  onChange={(e) => set("prize_pool_inr", e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-surface-DEFAULT p-3 text-xs text-gray-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              Platform keeps 15% of entry fees. Prize split: 60% winner, 30% runner-up, 10% third.
              Razorpay payouts configured in Admin → Payments.
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Tournament"}
          </button>
        </form>
      </div>
    </div>
  );
}
