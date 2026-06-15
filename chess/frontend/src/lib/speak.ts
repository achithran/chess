/**
 * TTS module for CheckMate Malayalam AI.
 *
 * Malayalam: calls the backend /api/v1/tts/speak (Google Cloud Wavenet ml-IN)
 *            audio is cached in-memory as blob URLs so repeated sentences are instant
 *
 * Other languages: uses the browser's built-in Web Speech API (works fine for English)
 *
 * speakSequence() fires onStart(i) 250ms before sentence i begins so the board
 * can update its annotation before the voice starts.
 */

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
    : "";

// ── Malayalam backend TTS ──────────────────────────────────────────────────────

const _mlCache = new Map<string, string>(); // text → blob URL

let _currentAudio: HTMLAudioElement | null = null;
let _sequenceId = 0; // incremented on every new sequence; old callbacks check their id

async function _speakMl(text: string, rate = 1.0): Promise<void> {
  if (!text.trim()) return;

  return new Promise((resolve) => {
    const cached = _mlCache.get(text);

    const _play = (url: string) => {
      const audio = new Audio(url);
      audio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
      _currentAudio = audio;
      audio.onended = () => { _currentAudio = null; resolve(); };
      audio.onerror = () => { _currentAudio = null; resolve(); };
      audio.play().catch(() => { _currentAudio = null; resolve(); });
    };

    if (cached) {
      _play(cached);
      return;
    }

    const voiceId = typeof window !== "undefined"
      ? (window.localStorage.getItem("cm_tts_voice_id") ?? "") : "";

    fetch(`${API_URL}/tts/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...(voiceId ? { voice_id: voiceId } : {}) }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        _mlCache.set(text, url);
        _play(url);
      })
      .catch(() => {
        _speakWebSpeech(text, "ml-IN", resolve, rate);
      });
  });
}

// ── Web Speech API (English / fallback) ────────────────────────────────────────

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

/** Speak a single sentence. For Malayalam, calls the backend TTS (async, fire-and-forget). */
export function speak(
  text: string,
  lang = "en-IN",
  onEnd?: () => void,
  rate = 1.0,
): void {
  if (lang.startsWith("ml")) {
    _speakMl(text, rate).then(onEnd);
  } else {
    _speakWebSpeech(text, lang, onEnd, rate);
  }
}

/**
 * Speak sentences one by one with a 250ms pre-sentence delay for board sync.
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
  const isMl = lang.startsWith("ml");
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
      if (isMl) {
        await _speakMl(sentences[i], rate);
        if (_sequenceId === myId) next();
      } else {
        _speakWebSpeech(sentences[i], lang, next, rate);
      }
    }, 250);
  }

  next();
}

export function stopSpeaking(): void {
  _sequenceId++; // invalidates any running sequence
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
