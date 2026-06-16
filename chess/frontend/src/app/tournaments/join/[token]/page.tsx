"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trophy, Users } from "lucide-react";
import { api, ApiError, type TournamentOut } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function JoinTournamentPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { isAuthenticated, login, register } = useAuthStore();

  const [tournament, setTournament] = useState<TournamentOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .previewByToken(token)
      .then(setTournament)
      .catch((e) =>
        setPreviewError(
          e instanceof ApiError ? e.message : "Couldn't load this invite link."
        )
      )
      .finally(() => setLoading(false));
  }, [token]);

  const doJoin = async () => {
    setJoinError(null);
    setBusy(true);
    try {
      const res = await api.joinByToken(token);
      router.push(`/tournaments/${res.tournament_id}`);
    } catch (e) {
      setJoinError(e instanceof ApiError ? e.message : "Couldn't join the tournament.");
    } finally {
      setBusy(false);
    }
  };

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      await doJoin();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (previewError || !tournament) {
    return (
      <div className="container-px flex justify-center py-20">
        <div className="card flex max-w-md items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <p className="text-sm text-gray-200">{previewError ?? "Invite link not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-px flex justify-center py-16">
      <div className="card w-full max-w-md">
        <div className="flex items-center gap-2 text-brand">
          <Trophy className="h-5 w-5" />
          <span className="text-sm font-medium">You&apos;re invited to a tournament</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">{tournament.name}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {tournament.format.replace("_", " ")} · {tournament.time_control}
        </p>
        <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-300">
          <Users className="h-4 w-4" />
          {tournament.participant_count}/{tournament.max_players} players joined
        </div>
        {tournament.description && (
          <p className="mt-3 text-sm text-gray-300">{tournament.description}</p>
        )}

        {joinError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {joinError}
          </div>
        )}

        {isAuthenticated ? (
          <button onClick={doJoin} disabled={busy} className="btn-primary mt-6 w-full">
            {busy ? "Joining…" : "Join Tournament"}
          </button>
        ) : (
          <>
            <p className="mt-6 text-sm text-gray-400">
              Login or create an account to join.
            </p>
            <form onSubmit={submitAuth} className="mt-3 space-y-3">
              {mode === "register" && (
                <input
                  className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 outline-none focus:border-brand"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}
              <input
                type="email"
                required
                className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 outline-none focus:border-brand"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                required
                minLength={8}
                className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 outline-none focus:border-brand"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {authError && <p className="text-sm text-red-400">{authError}</p>}
              <button disabled={busy} className="btn-primary w-full">
                {busy ? "Please wait…" : mode === "login" ? "Login & Join" : "Register & Join"}
              </button>
            </form>
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="mt-3 w-full text-center text-sm text-gray-400 hover:text-white"
            >
              {mode === "login"
                ? "Don't have an account? Register here"
                : "Already have an account? Login"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
