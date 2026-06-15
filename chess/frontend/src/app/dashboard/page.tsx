"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Brain, Sword, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { api, type PlayerRatingOut, type TournamentOut } from "@/lib/api";

export default function DashboardPage() {
  const [rating, setRating] = useState<PlayerRatingOut | null>(null);
  const [tournaments, setTournaments] = useState<TournamentOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([api.myRating(), api.listTournaments()]).then(([r, t]) => {
      if (r.status === "fulfilled") setRating(r.value);
      if (t.status === "fulfilled") setTournaments(t.value.slice(0, 4));
      setLoading(false);
    });
  }, []);

  const winRate =
    rating && rating.games_played > 0
      ? Math.round((rating.wins / rating.games_played) * 100)
      : null;

  return (
    <div className="container-px py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">Your chess stats and upcoming events.</p>
      </div>

      {/* Rating stats */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">Live Game Rating</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-brand" />}
            label="Live ELO"
            value={loading ? "…" : String(rating?.rating ?? 1200)}
            sub={rating ? `Peak ${rating.peak_rating}` : undefined}
          />
          <StatCard
            icon={<Trophy className="h-5 w-5 text-yellow-400" />}
            label="Games Played"
            value={loading ? "…" : String(rating?.games_played ?? 0)}
          />
          <StatCard
            icon={<Sword className="h-5 w-5 text-emerald-400" />}
            label="Win Rate"
            value={loading ? "…" : winRate !== null ? `${winRate}%` : "–"}
            sub={rating ? `${rating.wins}W ${rating.draws}D ${rating.losses}L` : undefined}
          />
          <StatCard
            icon={<Target className="h-5 w-5 text-blue-400" />}
            label="Puzzle Rating"
            value="–"
            sub="From puzzle trainer"
          />
        </div>
      </section>

      {/* Tournament section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">Tournaments</h2>
          <Link href="/tournaments" className="text-xs text-brand hover:underline">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="card text-sm text-gray-500">Loading…</div>
        ) : tournaments.length === 0 ? (
          <div className="card text-center text-sm text-gray-500">
            <Users className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>No active tournaments.</p>
            <Link href="/tournaments/create" className="mt-2 inline-block text-brand hover:underline">
              Create one →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="card flex items-start justify-between gap-3 transition hover:border-brand"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{t.name}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {t.format.replace("_", " ")} · {t.time_control} · {t.participant_count}/{t.max_players}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-500">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink href="/play" icon={<Sword className="h-5 w-5" />} label="Play vs AI" />
          <QuickLink href="/puzzles" icon={<Brain className="h-5 w-5" />} label="Puzzles" />
          <QuickLink href="/tournaments" icon={<Trophy className="h-5 w-5" />} label="Tournaments" />
          <QuickLink href="/leaderboard" icon={<Award className="h-5 w-5" />} label="Leaderboard" />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="card space-y-2">
      {icon}
      <p className="text-2xl font-bold text-white">{value}</p>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        {sub && <p className="text-xs text-gray-600">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    registration: "bg-blue-900/60 text-blue-300",
    active:       "bg-emerald-900/60 text-emerald-300",
    completed:    "bg-gray-800 text-gray-500",
    draft:        "bg-gray-800 text-gray-400",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="card flex flex-col items-center gap-2 py-4 text-center text-sm text-gray-300 transition hover:border-brand hover:text-white"
    >
      <span className="text-brand">{icon}</span>
      {label}
    </Link>
  );
}
