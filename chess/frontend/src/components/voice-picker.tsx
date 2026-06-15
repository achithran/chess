"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Square, Check, Mic } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const VOICE_KEY = "cm_tts_voice_id";

export function getStoredVoiceId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(VOICE_KEY) ?? "";
}

export function setStoredVoiceId(id: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(VOICE_KEY, id);
}

interface Voice {
  voice_id: string;
  name: string;
  accent: string;
  description: string;
  preview_url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (voiceId: string, name: string) => void;
}

export function VoicePicker({ open, onClose, onSelect }: Props) {
  const [voices, setVoices]         = useState<Voice[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<string>(() => getStoredVoiceId());
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/tts/voices`)
      .then((r) => r.json())
      .then((data) => setVoices(Array.isArray(data) ? data : []))
      .catch(() => setError("Could not load voices. Check your ElevenLabs key."))
      .finally(() => setLoading(false));
  }, [open]);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewing(null);
  }, []);

  const preview = useCallback((voice: Voice) => {
    stopPreview();
    if (!voice.preview_url) return;
    const audio = new Audio(voice.preview_url);
    audioRef.current = audio;
    setPreviewing(voice.voice_id);
    audio.onended = () => setPreviewing(null);
    audio.onerror = () => setPreviewing(null);
    audio.play().catch(() => setPreviewing(null));
  }, [stopPreview]);

  const pick = useCallback((voice: Voice) => {
    stopPreview();
    setSelected(voice.voice_id);
    setStoredVoiceId(voice.voice_id);
    onSelect(voice.voice_id, voice.name);
    onClose();
  }, [stopPreview, onSelect, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { stopPreview(); onClose(); }}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 bottom-4 top-20 z-50 mx-auto max-w-md overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-2xl"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-brand" />
                <span className="font-semibold text-white">Choose Voice</span>
                <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] text-brand">
                  Indian accent
                </span>
              </div>
              <button onClick={() => { stopPreview(); onClose(); }}
                className="rounded-lg p-1 text-gray-400 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-3" style={{ maxHeight: "calc(100% - 56px)" }}>
              {loading && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <p className="text-sm text-gray-400">Searching ElevenLabs library…</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-yellow-800/50 bg-yellow-950/30 p-3 text-sm text-yellow-300">
                  {error}
                </div>
              )}

              {!loading && !error && voices.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">No Indian voices found.</p>
              )}

              <div className="flex flex-col gap-2">
                {voices.map((v) => (
                  <div key={v.voice_id}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                      selected === v.voice_id
                        ? "border-brand/60 bg-brand/10"
                        : "border-surface-border bg-surface-hover/30 hover:border-gray-600"
                    }`}>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{v.name}</span>
                        {v.accent && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
                            {v.accent}
                          </span>
                        )}
                        {selected === v.voice_id && (
                          <Check className="h-3.5 w-3.5 text-brand" />
                        )}
                      </div>
                      {v.description && (
                        <p className="mt-0.5 text-[11px] text-gray-400 line-clamp-2">{v.description}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {v.preview_url && (
                        <button
                          onClick={() => previewing === v.voice_id ? stopPreview() : preview(v)}
                          title={previewing === v.voice_id ? "Stop preview" : "Preview voice"}
                          className="flex items-center gap-1 rounded-lg border border-surface-border px-2 py-1 text-[11px] text-gray-300 transition hover:border-gray-400 hover:text-white">
                          {previewing === v.voice_id
                            ? <><Square className="h-3 w-3" /> Stop</>
                            : <><Play  className="h-3 w-3" /> Try</>}
                        </button>
                      )}
                      <button
                        onClick={() => pick(v)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                          selected === v.voice_id
                            ? "bg-brand text-white"
                            : "border border-brand/50 text-brand hover:bg-brand/20"
                        }`}>
                        {selected === v.voice_id ? "Selected" : "Use"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
