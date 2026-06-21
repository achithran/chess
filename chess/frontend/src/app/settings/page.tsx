"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, CheckCircle2, ChevronDown, ChevronUp, Globe, KeyRound,
  Palette, Shield, Trash2, User, Volume2,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { LANGUAGES, useLanguageStore } from "@/store/language";
import { BOARD_THEMES, usePreferencesStore, type BoardTheme } from "@/store/preferences";
import { VoicePicker } from "@/components/voice-picker";
import { api } from "@/lib/api";

const DIFFICULTIES = [
  { label: "Guru",         ml: "ഗുരു",        color: "text-purple-400" },
  { label: "Beginner",     ml: "Beginner",    color: "text-emerald-400" },
  { label: "Intermediate", ml: "Intermediate", color: "text-yellow-400" },
  { label: "Advanced",     ml: "Advanced",    color: "text-orange-400" },
  { label: "Master",       ml: "Master",      color: "text-red-400" },
];

const TTS_SPEEDS = [
  { label: "0.7×", rate: 0.7 },
  { label: "1×",   rate: 1.0 },
  { label: "1.3×", rate: 1.3 },
];

// ── Collapsible section wrapper ─────────────────────────────────────────────

function Section({
  icon, title, defaultOpen = true, children,
}: {
  icon: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-surface-border pb-3 text-left"
      >
        <span className="text-brand">{icon}</span>
        <h2 className="flex-1 font-semibold text-white">{title}</h2>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-500" />
          : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {open && <div className="mt-4 space-y-4">{children}</div>}
    </section>
  );
}

// ── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label, sub, value, onChange,
}: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-brand" : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  const { code, setCode } = useLanguageStore();
  const {
    defaultDifficulty, setDefaultDifficulty,
    autoPlayTts,       setAutoPlayTts,
    ttsRate,           setTtsRate,
    boardTheme,        setBoardTheme,
    showLegalHints,    setShowLegalHints,
    alwaysWhiteBottom, setAlwaysWhiteBottom,
    displayName,       setDisplayName,
  } = usePreferencesStore();

  // ── Staged settings — only written to stores when Save is pressed ──────────
  const [stagedLang,        setStagedLang]        = useState(code);
  const [stagedDifficulty,  setStagedDifficulty]  = useState(defaultDifficulty);
  const [stagedAutoTts,     setStagedAutoTts]      = useState(autoPlayTts);
  const [stagedTtsRate,     setStagedTtsRate]      = useState(ttsRate);
  const [stagedTheme,       setStagedTheme]        = useState<BoardTheme>(boardTheme);
  const [stagedLegalHints,  setStagedLegalHints]   = useState(showLegalHints);
  const [stagedWhiteBottom, setStagedWhiteBottom]  = useState(alwaysWhiteBottom);

  const [saved, setSaved] = useState(false);

  // Voice picker
  const [voicePicker, setVoicePicker] = useState(false);
  const [voiceName, setVoiceName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("cm_tts_voice_name") ?? "";
  });

  // Account section state
  const [nameInput,  setNameInput]  = useState(displayName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg,    setNameMsg]    = useState<string | null>(null);

  const [curPw,  setCurPw]  = useState("");
  const [newPw,  setNewPw]  = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg,  setPwMsg]  = useState<string | null>(null);
  const [pwErr,  setPwErr]  = useState<string | null>(null);

  const [resetConfirm, setResetConfirm] = useState(false);

  // Fetch profile name from backend on mount
  useEffect(() => {
    if (!isAuthenticated) return;
    api.me().then((u) => {
      if (u.full_name && !displayName) {
        setDisplayName(u.full_name);
        setNameInput(u.full_name);
      } else {
        setNameInput(displayName || u.full_name || "");
      }
    }).catch(() => {/* ignore */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/login");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const selectedLang = LANGUAGES.find((l) => l.code === stagedLang) ?? LANGUAGES[0];

  const handleVoiceSelect = (_voiceId: string, name: string) => {
    setVoiceName(name);
    if (typeof window !== "undefined") window.localStorage.setItem("cm_tts_voice_name", name);
    setVoicePicker(false);
  };

  // Apply all staged settings to stores, then navigate to /play
  const handleSave = () => {
    setCode(stagedLang);
    setDefaultDifficulty(stagedDifficulty);
    setAutoPlayTts(stagedAutoTts);
    setTtsRate(stagedTtsRate);
    setBoardTheme(stagedTheme);
    setShowLegalHints(stagedLegalHints);
    setAlwaysWhiteBottom(stagedWhiteBottom);
    setSaved(true);
    setTimeout(() => router.push("/play"), 700);
  };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    setNameSaving(true);
    setNameMsg(null);
    try {
      await api.updateProfile(nameInput.trim());
      setDisplayName(nameInput.trim());
      setNameMsg("Name saved!");
    } catch {
      setNameMsg("Failed to save. Try again.");
    } finally {
      setNameSaving(false);
      setTimeout(() => setNameMsg(null), 3000);
    }
  };

  const changePassword = async () => {
    if (!curPw || !newPw) return;
    if (newPw.length < 8) { setPwErr("New password must be at least 8 characters."); return; }
    setPwBusy(true); setPwErr(null); setPwMsg(null);
    try {
      await api.changePassword(curPw, newPw);
      setPwMsg("Password changed successfully!");
      setCurPw(""); setNewPw("");
    } catch (e) {
      setPwErr(e instanceof Error ? e.message : "Failed to change password.");
    } finally {
      setPwBusy(false);
      setTimeout(() => { setPwMsg(null); setPwErr(null); }, 4000);
    }
  };

  const resetProgress = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("cm_progress");
    }
    setResetConfirm(false);
    alert("Progress has been reset.");
  };

  return (
    <div className="container-px py-10 pb-32">
      <div className="mx-auto max-w-lg space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-400">Choose your preferences, then tap Save to apply them.</p>
        </div>

        {/* ── 1. Coaching Preferences ─────────────────────────────────────── */}
        <Section icon={<Brain className="h-4 w-4" />} title="Coaching Preferences">

          <div>
            <p className="mb-2 text-sm font-medium text-gray-300">Default Difficulty</p>
            <p className="mb-3 text-xs text-gray-500">
              The level you start with whenever you open the Play page.
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {DIFFICULTIES.map((d, i) => (
                <button
                  key={d.label}
                  onClick={() => setStagedDifficulty(i)}
                  className={`rounded-lg border px-2 py-2.5 text-xs transition ${
                    stagedDifficulty === i
                      ? "border-brand bg-brand/15 text-white"
                      : "border-surface-border text-gray-400 hover:text-white"
                  }`}
                >
                  <span className={`block font-semibold ${stagedDifficulty === i ? "text-white" : d.color}`}>
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            label="Auto-play voice in Guru Mode"
            sub="Guru automatically reads the explanation aloud after every AI move"
            value={stagedAutoTts}
            onChange={setStagedAutoTts}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-gray-300">Speech Rate</p>
            <div className="flex gap-2">
              {TTS_SPEEDS.map((s) => (
                <button
                  key={s.rate}
                  onClick={() => setStagedTtsRate(s.rate)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    stagedTtsRate === s.rate
                      ? "border-brand bg-brand/15 text-white"
                      : "border-surface-border text-gray-400 hover:border-gray-500 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 2. Board Appearance ─────────────────────────────────────────── */}
        <Section icon={<Palette className="h-4 w-4" />} title="Board Appearance">

          <div>
            <p className="mb-2 text-sm font-medium text-gray-300">Board Theme</p>
            <div className="grid grid-cols-5 gap-2">
              {(Object.entries(BOARD_THEMES) as [BoardTheme, typeof BOARD_THEMES[BoardTheme]][]).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => setStagedTheme(key)}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition ${
                    stagedTheme === key
                      ? "border-brand bg-brand/10"
                      : "border-surface-border hover:border-gray-500"
                  }`}
                >
                  <div className="grid grid-cols-2 overflow-hidden rounded-md" style={{ width: 36, height: 36 }}>
                    <div style={{ background: t.light }} />
                    <div style={{ background: t.dark  }} />
                    <div style={{ background: t.dark  }} />
                    <div style={{ background: t.light }} />
                  </div>
                  <span className={`text-[10px] font-medium ${stagedTheme === key ? "text-white" : "text-gray-500"}`}>
                    {t.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            label="Show legal move hints"
            sub="Highlight valid squares when you pick up a piece"
            value={stagedLegalHints}
            onChange={setStagedLegalHints}
          />

          <ToggleRow
            label="Always play as White"
            sub="Board stays White-at-bottom even in vs-Friend mode"
            value={stagedWhiteBottom}
            onChange={setStagedWhiteBottom}
          />
        </Section>

        {/* ── 3. Language ─────────────────────────────────────────────────── */}
        <Section icon={<Globe className="h-4 w-4" />} title="Explanation Language">
          <p className="text-sm text-gray-400">
            Language your AI Guru uses to explain moves.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setStagedLang(l.code)}
                className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                  stagedLang === l.code
                    ? "border-brand bg-brand/15 text-white"
                    : "border-surface-border text-gray-400 hover:border-gray-500 hover:text-gray-200"
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Selected: <span className="font-semibold text-gray-300">{selectedLang.name}</span>
          </p>
        </Section>

        {/* ── 4. Voice / TTS ──────────────────────────────────────────────── */}
        <Section icon={<Volume2 className="h-4 w-4" />} title="Voice (TTS)" defaultOpen={false}>
          <p className="text-sm text-gray-400">
            Select the voice accent for move explanations.
          </p>
          <button
            onClick={() => setVoicePicker(true)}
            className="rounded-xl border border-surface-border px-4 py-2.5 text-sm text-gray-300 transition hover:border-brand/50 hover:text-white"
          >
            {voiceName ? `Current: ${voiceName}` : "Choose a voice…"}
          </button>
          <VoicePicker
            open={voicePicker}
            onClose={() => setVoicePicker(false)}
            onSelect={handleVoiceSelect}
          />
        </Section>

        {/* ── 5. Account & Profile ────────────────────────────────────────── */}
        <Section icon={<User className="h-4 w-4" />} title="Account & Profile" defaultOpen={false}>

          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-300">Display Name</p>
            <div className="flex gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className="flex-1 rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 text-sm text-white outline-none focus:border-brand"
              />
              <button
                onClick={saveName}
                disabled={nameSaving || !nameInput.trim()}
                className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {nameSaving ? "…" : "Save"}
              </button>
            </div>
            {nameMsg && (
              <p className={`mt-1.5 text-xs ${nameMsg.includes("Failed") ? "text-red-400" : "text-emerald-400"}`}>
                {nameMsg}
              </p>
            )}
          </div>

          <div className="space-y-2 border-t border-surface-border pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <KeyRound className="h-4 w-4 text-gray-500" />
              Change Password
            </div>
            <input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="Current password"
              className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 text-sm text-white outline-none focus:border-brand"
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full rounded-xl border border-surface-border bg-surface-DEFAULT px-4 py-2.5 text-sm text-white outline-none focus:border-brand"
            />
            {pwErr && <p className="text-xs text-red-400">{pwErr}</p>}
            {pwMsg && <p className="text-xs text-emerald-400">{pwMsg}</p>}
            <button
              onClick={changePassword}
              disabled={pwBusy || !curPw || !newPw}
              className="btn-primary w-full disabled:opacity-50"
            >
              {pwBusy ? "Changing…" : "Change Password"}
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-red-900/50 bg-red-950/20 p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-400" />
              <p className="text-sm font-semibold text-red-300">Danger Zone</p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-300">Reset Progress</p>
                <p className="text-xs text-gray-500">
                  Clears all belt, XP, puzzle and game progress from this device.
                </p>
              </div>
              {resetConfirm ? (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setResetConfirm(false)}
                    className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-gray-400 hover:text-white">
                    Cancel
                  </button>
                  <button onClick={resetProgress}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500">
                    Confirm
                  </button>
                </div>
              ) : (
                <button onClick={() => setResetConfirm(true)}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-red-800/60 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-600 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" /> Reset
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-300">Log Out</p>
                <p className="text-xs text-gray-500">Sign out from this device.</p>
              </div>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="shrink-0 rounded-lg border border-red-800/60 px-3 py-1.5 text-xs text-red-400 transition hover:border-red-600 hover:text-red-300"
              >
                Log Out
              </button>
            </div>
          </div>
        </Section>

      </div>

      {/* ── Sticky Save bar ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700 bg-gray-900 px-4 py-4 shadow-2xl">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          {saved ? (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Settings saved! Returning to game…
            </span>
          ) : (
            <span className="text-xs text-gray-400">Changes apply when you tap Save.</span>
          )}
          <button
            onClick={handleSave}
            disabled={saved}
            className="btn-primary px-8 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {saved ? "Saved ✓" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
