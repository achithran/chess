"use client";

import { useEffect, useState } from "react";

/**
 * Shows a dismissible banner when speak.ts fires "tts-auth-expired"
 * (token expired + refresh failed → no audio).
 * Directs the user to log out and log in again to restore Malayalam voice.
 */
export function TtsAuthBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener("tts-auth-expired", handler);
    return () => window.removeEventListener("tts-auth-expired", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200 shadow-lg backdrop-blur">
      <span>🔇 Voice session expired — please</span>
      <a href="/auth/login" className="underline font-medium hover:text-white">
        log in again
      </a>
      <span>to restore Malayalam audio.</span>
      <button
        onClick={() => setVisible(false)}
        className="ml-2 text-yellow-400 hover:text-white"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
