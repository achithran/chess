/**
 * TTS module for CheckMate — multilingual speech.
 *
 * Priority:
 *   1. Backend /api/v1/tts/speak  — Piper (local) → Google Wavenet → ElevenLabs
 *   2. Browser Web Speech API     — fallback ONLY for languages that have a native voice
 *      (Indian languages have no browser voice; Web Speech is not used for them)
 *
 * Token refresh: on 401 we attempt one silent refresh via /auth/refresh, then retry.
 * If refresh also fails the TTS call is silently skipped rather than playing English
 * phonemes for Malayalam text.
 */

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
    : "";

// Languages routed through the backend TTS service
const BACKEND_LANGS = new Set(["ml", "ta", "hi", "te", "kn", "en", "ru", "es", "fr", "zh"]);

// Languages that have NO usable browser Web Speech voice on most platforms.
// For these we never fall back to Web Speech — silence is better than English
// phonemes attempting to read a Malayalam sentence.
const NO_BROWSER_VOICE = new Set(["ml", "ta", "hi", "te", "kn"]);

// in-memory cache: `${bcp47}:${text}` → blob URL
const _backendCache = new Map<string, string>();

let _currentAudio: HTMLAudioElement | null = null;
let _sequenceId = 0;

// ── Token helpers ─────────────────────────────────────────────────────────────

function _getAccessToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("cm_access_token") ?? "";
}

function _getRefreshToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("cm_refresh_token") ?? "";
}

async function _tryRefresh(): Promise<boolean> {
  const rt = _getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.access_token) {
      window.localStorage.setItem("cm_access_token", data.access_token);
      if (data.refresh_token) window.localStorage.setItem("cm_refresh_token", data.refresh_token);
      return true;
    }
  } catch {
    // network error — can't refresh
  }
  return false;
}

// ── Backend TTS ───────────────────────────────────────────────────────────────

async function _fetchTTS(text: string, bcp47: string, token: string): Promise<Response> {
  const voiceId =
    typeof window !== "undefined"
      ? (window.localStorage.getItem("cm_tts_voice_id") ?? "")
      : "";
  return fetch(`${API_URL}/tts/speak`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      text,
      language: bcp47,
      ...(voiceId ? { voice_id: voiceId } : {}),
    }),
  });
}

async function _speakBackend(text: string, bcp47: string, rate = 1.0): Promise<void> {
  if (!text.trim()) return;

  return new Promise((resolve) => {
    const cacheKey = `${bcp47}:${text}`;
    const cached = _backendCache.get(cacheKey);

    const _play = (url: string) => {
      const audio = new Audio(url);
      audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
      _currentAudio = audio;
      audio.onended = () => { _currentAudio = null; resolve(); };
      audio.onerror  = () => { _currentAudio = null; resolve(); };
      audio.play().catch(() => { _currentAudio = null; resolve(); });
    };

    if (cached) { _play(cached); return; }

    const base = bcp47.split("-")[0].toLowerCase();

    const doFetch = async (isRetry = false): Promise<void> => {
      const token = _getAccessToken();
      try {
        const res = await _fetchTTS(text, bcp47, token);

        if (res.status === 401 && !isRetry) {
          // Token expired — try a silent refresh once, then retry
          const refreshed = await _tryRefresh();
          if (refreshed) {
            return doFetch(true);
          }
          // Refresh also failed — notify the UI so user knows to log in again
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("tts-auth-expired"));
          }
          if (NO_BROWSER_VOICE.has(base)) {
            resolve();
            return;
          }
          _speakWebSpeech(text, bcp47, resolve, rate);
          return;
        }

        if (!res.ok) throw new Error(`TTS ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        _backendCache.set(cacheKey, url);
        _play(url);
      } catch {
        if (NO_BROWSER_VOICE.has(base)) {
          // Network/server error and no browser voice — silent skip
          resolve();
        } else {
          _speakWebSpeech(text, bcp47, resolve, rate);
        }
      }
    };

    doFetch();
  });
}

// ── Browser Web Speech (fallback for languages with native browser voices) ────

function _pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const target = lang.toLowerCase();
  const base = target.split("-")[0];
  return (
    voices.find((v) => v.lang?.toLowerCase() === target) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(base)) ||
    voices.find((v) => v.lang?.toLowerCase() === "en-in") ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("en"))
  );
}

function _speakWebSpeech(
  text: string,
  lang: string,
  onEnd?: () => void,
  rate = 1.0,
): void {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = Math.max(0.5, Math.min(2.0, rate));
  utt.pitch = 1;
  if (onEnd) utt.onend = onEnd;

  const doSpeak = () => {
    const voice = _pickVoice(lang);
    if (voice) { utt.voice = voice; utt.lang = voice.lang; } else { utt.lang = lang; }
    window.speechSynthesis.speak(utt);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    doSpeak();
  } else {
    window.speechSynthesis.addEventListener("voiceschanged", doSpeak, { once: true });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Speak a single sentence.
 * Indian languages → backend only (Piper/Google/ElevenLabs), never Web Speech.
 * European/CJK languages → backend, falls back to Web Speech on error.
 */
export function speak(
  text: string,
  lang = "en-IN",
  onEnd?: () => void,
  rate = 1.0,
): void {
  const base = lang.split("-")[0].toLowerCase();
  if (BACKEND_LANGS.has(base) && API_URL) {
    _speakBackend(text, lang, rate).then(onEnd);
  } else {
    _speakWebSpeech(text, lang, onEnd, rate);
  }
}

/**
 * Speak sentences one-by-one with a 250ms pre-sentence delay for board sync.
 * onStart(i) fires before sentence i so React can update board annotations first.
 * onDone fires after all sentences complete or are cancelled.
 */
export function speakSequence(
  sentences: string[],
  lang: string,
  onStart: (index: number) => void,
  onDone: () => void,
  rate = 1.0,
): void {
  if (typeof window === "undefined" || !sentences.length) { onDone(); return; }
  stopSpeaking();

  const myId = ++_sequenceId;
  const base = lang.split("-")[0].toLowerCase();
  const useBackend = BACKEND_LANGS.has(base) && !!API_URL;
  let idx = 0;

  function next(): void {
    if (_sequenceId !== myId || idx >= sentences.length) {
      if (_sequenceId === myId) onDone();
      return;
    }
    const i = idx++;
    onStart(i);
    setTimeout(async () => {
      if (_sequenceId !== myId) return;
      if (useBackend) {
        await _speakBackend(sentences[i], lang, rate);
        if (_sequenceId === myId) next();
      } else {
        _speakWebSpeech(sentences[i], lang, next, rate);
      }
    }, 250);
  }

  next();
}

export function stopSpeaking(): void {
  _sequenceId++;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && ("speechSynthesis" in window || !!API_URL);
}
