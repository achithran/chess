"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Clock, Trophy, Users, Plus, LogIn } from "lucide-react";
import { api, type TournamentOut } from "@/lib/api";

const FORMAT_LABEL: Record<string, string> = {
  swiss: "Swiss",
  round_robin: "Round Robin",
  knockout: "Knockout",
  arena: "Arena",
};

const STATUS_STYLE: Record<string, string> = {
  draft:        "bg-gray-700 text-gray-300",
  registration: "bg-blue-900 text-blue-300",
  active:       "bg-emerald-900 text-emerald-300",
  completed:    "bg-gray-800 text-gray-400",
  cancelled:    "bg-red-900 text-red-300",
};

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinToken, setJoinToken] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    api.listTournaments()
      .then(setTournaments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async () => {
    if (!joinToken.trim()) return;
    setJoining(true);
    setJoinError("");
    try {
      const { tournament_id } = await api.joinByToken(joinToken.trim());
      window.location.href = `/tournaments/${tournament_id}`;
    } catch (e: unknown) {
      setJoinError(e instanceof Error ? e.message : "Invalid link.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="container-px py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tournaments</h1>
          <p className="mt-1 font-ml text-sm text-gray-400">
            Professional chess tournaments — Swiss, Round Robin, Knockout &amp; Arena
          </p>
        </div>
        <Link
          href="/tournaments/create"
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Create Tournament
        </Link>
      </div>

      {/* Join by invite link */}
      <div className="card mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <LogIn className="h-5 w-5 shrink-0 text-brand" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Have an invite link?</p>
          <p className="text-xs text-gray-400">Paste the token from your invite URL to join a private tournament.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={joinToken}
            onChange={(e) => setJoinToken(e.target.value)}
            placeholder="Paste invite token…"
            className="input w-48 text-sm"
          />
          <button
            onClick={handleJoin}
            disabled={joining}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join"}
          </button>
        </div>
        {joinError && <p className="w-full text-xs text-red-400">{joinError}</p>}
      </div>

      {/* Tournament list */}
      {loading ? (
        <div className="text-center text-gray-500">Loading tournaments…</div>
      ) : tournaments.length === 0 ? (
        <div className="card text-center text-gray-500">
          <Trophy className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-ml">No public tournaments yet.</p>
          <p className="mt-1 text-sm">Create one or join via an invite link.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t, i) => (
            <TournamentCard key={t.id} tournament={t} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentCard({ tournament: t, index }: { tournament: TournamentOut; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={`/tournaments/${t.id}`}
        className="card block space-y-4 transition hover:border-brand"
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-white leading-tight">{t.name}</p>
            <p className="mt-0.5 text-xs text-gray-500">by {t.organiser_name ?? "Organiser"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[t.status] ?? STATUS_STYLE.draft}`}>
            {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
          </span>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5" /> {FORMAT_LABEL[t.format] ?? t.format}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {t.time_control}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {t.participant_count} / {t.max_players}
          </span>
          {t.starts_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(t.starts_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Prize / entry */}
        {(t.entry_fee_inr > 0 || t.prize_pool_inr > 0) && (
          <div className="flex gap-3 border-t border-surface-border pt-3 text-xs">
            {t.entry_fee_inr > 0 && (
              <span className="text-gray-400">Entry: <span className="text-white">₹{t.entry_fee_inr}</span></span>
            )}
            {t.prize_pool_inr > 0 && (
              <span className="text-gray-400">Prize pool: <span className="text-yellow-300">₹{t.prize_pool_inr}</span></span>
            )}
          </div>
        )}
      </Link>
    </motion.div>
  );
}
