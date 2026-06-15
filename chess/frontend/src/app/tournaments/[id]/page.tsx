"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle, Calendar, CheckCircle2, Clock, Copy, Link2,
  Loader2, Play, Trophy, Users,
} from "lucide-react";
import { api, type TournamentDetail, type ParticipantOut, type RoundOut } from "@/lib/api";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
  .replace(/^http/, "ws")
  .replace("/api/v1", "");

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const load = async () => {
    try {
      const t = await api.getTournament(Number(id));
      setTournament(t);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Subscribe to live tournament updates.
    const ws = new WebSocket(`${WS_BASE}/api/v1/tournaments/ws/tournament/${id}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (["tournament_started", "round_complete", "game_completed"].includes(msg.type)) {
          load(); // Refresh standings / bracket on events.
        }
      } catch {}
    };
    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const copyInvite = () => {
    if (!tournament) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/tournaments/join/${tournament.invite_token}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doAction = async (action: "open-registration" | "start") => {
    if (!tournament) return;
    setActionMsg("");
    try {
      if (action === "open-registration") await api.openRegistration(tournament.id);
      if (action === "start") await api.startTournament(tournament.id);
      await load();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Action failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return <div className="container-px py-10 text-gray-400">Tournament not found.</div>;
  }

  const isAdmin =
    typeof window !== "undefined" &&
    Boolean(localStorage.getItem("cm_access_token"));

  return (
    <div className="container-px py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{tournament.name}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {tournament.format.replace("_", " ")} · {tournament.time_control} ·{" "}
            {tournament.participant_count}/{tournament.max_players} players
          </p>
          {tournament.description && (
            <p className="mt-2 text-sm text-gray-300">{tournament.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Invite link */}
          <button
            onClick={copyInvite}
            className="btn-ghost inline-flex items-center gap-1.5 text-sm"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Invite Link"}
          </button>

          {/* Organiser actions */}
          {isAdmin && tournament.status === "draft" && (
            <button onClick={() => doAction("open-registration")} className="btn-primary text-sm">
              Open Registration
            </button>
          )}
          {isAdmin && tournament.status === "registration" && (
            <button onClick={() => doAction("start")} className="btn-primary text-sm">
              <Play className="h-4 w-4" /> Start Tournament
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {actionMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Trophy className="h-5 w-5 text-yellow-400" />} label="Format" value={tournament.format.replace("_", " ")} />
        <StatCard icon={<Clock className="h-5 w-5 text-brand" />} label="Time Control" value={tournament.time_control} />
        <StatCard icon={<Users className="h-5 w-5 text-emerald-400" />} label="Players" value={`${tournament.participant_count}/${tournament.max_players}`} />
        {tournament.prize_pool_inr > 0 && (
          <StatCard icon={<Trophy className="h-5 w-5 text-yellow-300" />} label="Prize Pool" value={`₹${tournament.prize_pool_inr}`} />
        )}
        {tournament.starts_at && (
          <StatCard icon={<Calendar className="h-5 w-5 text-blue-400" />} label="Starts" value={new Date(tournament.starts_at).toLocaleDateString()} />
        )}
      </div>

      {/* Main content tabs */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Rounds / Bracket */}
        <div className="space-y-4">
          {tournament.rounds.length > 0 ? (
            tournament.rounds.map((rnd) => <RoundCard key={rnd.id} round={rnd} />)
          ) : (
            <div className="card text-center text-gray-500">
              <Calendar className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p className="font-ml text-sm">
                {tournament.status === "registration"
                  ? "Waiting for the organiser to start the tournament."
                  : "Rounds will appear here once the tournament starts."}
              </p>
            </div>
          )}
        </div>

        {/* Right: Standings */}
        <div>
          <StandingsTable participants={tournament.participants} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-semibold text-white capitalize">{value}</p>
      </div>
    </div>
  );
}

function RoundCard({ round }: { round: RoundOut }) {
  const done = !!round.completed_at;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Round {round.number}</h3>
        {done ? (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        ) : (
          <span className="text-xs text-yellow-400">In progress</span>
        )}
      </div>
      <div className="divide-y divide-surface-border">
        {round.pairings.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 text-xs text-gray-500 shrink-0">#{p.board_number}</span>
              <span className="truncate text-white">{p.white_name ?? `Player ${p.white_id}`}</span>
              <span className="text-gray-500 shrink-0">vs</span>
              <span className="truncate text-white">
                {p.black_id ? (p.black_name ?? `Player ${p.black_id}`) : "Bye"}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ResultBadge result={p.result} />
              {p.game_id && p.result === "pending" && (
                <Link
                  href={`/tournaments/${round.id}/game/${p.game_id}`}
                  className="text-xs text-brand hover:underline"
                >
                  Watch →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    pending:   "bg-gray-800 text-gray-400",
    white_win: "bg-gray-200 text-gray-900",
    black_win: "bg-gray-900 text-gray-100 border border-gray-600",
    draw:      "bg-yellow-900 text-yellow-300",
    forfeit:   "bg-red-900 text-red-300",
  };
  const labels: Record<string, string> = {
    pending: "–", white_win: "1-0", black_win: "0-1", draw: "½-½", forfeit: "FF",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-mono font-bold ${styles[result] ?? styles.pending}`}>
      {labels[result] ?? result}
    </span>
  );
}

function StandingsTable({ participants }: { participants: ParticipantOut[] }) {
  if (participants.length === 0) {
    return (
      <div className="card text-center text-sm text-gray-500">
        <Users className="mx-auto mb-2 h-6 w-6 opacity-30" />
        No participants yet.
      </div>
    );
  }

  const sorted = [...participants].sort(
    (a, b) => b.points - a.points || b.buchholz - a.buchholz
  );

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-surface-border px-4 py-3">
        <h3 className="font-semibold text-white">Standings</h3>
      </div>
      <div className="divide-y divide-surface-border">
        {sorted.map((p, i) => (
          <div key={p.user_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-white">{p.user_name ?? `Player ${p.user_id}`}</p>
              <p className="text-xs text-gray-500">{p.rating_at_entry} Elo · {p.wins}W {p.draws}D {p.losses}L</p>
            </div>
            <span className="font-bold text-white tabular-nums">{p.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
