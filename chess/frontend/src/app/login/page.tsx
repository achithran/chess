"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">(
    searchParams.get("mode") === "register" ? "register" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      router.push("/play");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-px flex justify-center py-20">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Login" : "Create Account"}
        </h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Please wait…" : mode === "login" ? "Login" : "Register"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 w-full text-center text-sm text-gray-400 hover:text-white"
        >
          {mode === "login"
            ? "Don't have an account? Register here"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
