"""Piper TTS service — local open-source neural TTS for Indian languages.

Uses the piper binary (downloaded at Docker build time to /app/piper_bin/piper)
rather than the piper-tts Python package, which has no pre-built wheel for
Python 3.12 on linux/amd64.

Voice models (~50 MB each ONNX) live in /app/piper_models/.
Synthesis runs in a thread-pool executor (blocking subprocess + ONNX inference).
Returns WAV bytes (16-bit PCM).  The router sets Content-Type: audio/wav.

Language priority stack used by tts.py router:
  1. Piper        — local, zero latency, zero cost, native accent
  2. Google Cloud — Wavenet, billed per character
  3. ElevenLabs   — multilingual fallback, billed per character
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import logging
import subprocess
import wave
from pathlib import Path

logger = logging.getLogger(__name__)

_BINARY  = Path("/app/piper_bin/piper")
_MODELS  = Path("/app/piper_models")

# BCP-47 base code → model filename stem (without .onnx suffix)
# Voices verified from rhasspy/piper-voices voices.json (June 2026).
# Tamil excluded — no ta_IN voice in piper-voices; falls to Google/ElevenLabs.
# Malayalam uses meera (female) — clearer pronunciation for mixed ML+English text.
_MODEL_MAP: dict[str, str] = {
    "ml": "ml_IN-meera-medium",      # female Malayalam — clearer for code-switched text
    "hi": "hi_IN-pratham-medium",    # male Hindi
    "te": "te_IN-venkatesh-medium",  # male Telugu
}

_CACHE_PREFIX = "tts:piper:v1:"
_CACHE_TTL    = 60 * 60 * 24 * 30  # 30 days


# ── Public helpers ──────────────────────────────────────────────────────────

def is_available() -> bool:
    """True if the piper binary exists and at least one voice model is present."""
    if not _BINARY.exists():
        return False
    return any(_model_onnx(lang) is not None for lang in _MODEL_MAP)


def supports_language(lang_code: str) -> bool:
    """True if a local Piper model file exists for this BCP-47 language."""
    base = lang_code.split("-")[0].lower()
    return _BINARY.exists() and _model_onnx(base) is not None


# ── Synthesis ───────────────────────────────────────────────────────────────

async def synthesize(text: str, lang_code: str) -> bytes:
    """Return WAV bytes using the local Piper binary + ONNX model.

    Raises ValueError if the binary or model is not available.
    ONNX inference runs in a thread-pool executor to not block the event loop.
    """
    base = lang_code.split("-")[0].lower()
    onnx = _model_onnx(base)
    if onnx is None:
        raise ValueError(f"No local Piper model for language '{lang_code}'.")

    text = text.strip()
    if not text:
        raise ValueError("Empty text.")

    from app.db.redis import redis_client

    cache_key = _cache_key(text, str(onnx))
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            logger.debug("piper.cache_hit", extra={"lang": base, "chars": len(text)})
            return base64.b64decode(cached)
    except Exception as exc:
        logger.warning("piper.cache_read_failed", extra={"error": str(exc)})

    sample_rate = _read_sample_rate(onnx)
    loop = asyncio.get_running_loop()
    audio = await loop.run_in_executor(None, _run_piper, text, onnx, sample_rate)

    try:
        await redis_client.set(cache_key, base64.b64encode(audio).decode(), ex=_CACHE_TTL)
    except Exception as exc:
        logger.warning("piper.cache_write_failed", extra={"error": str(exc)})

    logger.info("piper.synthesized", extra={"lang": base, "chars": len(text), "bytes": len(audio)})
    return audio


# ── Internal ────────────────────────────────────────────────────────────────

def _model_onnx(lang_base: str) -> Path | None:
    stem = _MODEL_MAP.get(lang_base)
    if not stem:
        return None
    onnx = _MODELS / f"{stem}.onnx"
    cfg  = _MODELS / f"{stem}.onnx.json"
    return onnx if (onnx.exists() and cfg.exists()) else None


def _read_sample_rate(onnx: Path) -> int:
    cfg = onnx.with_suffix(".onnx.json")
    try:
        data = json.loads(cfg.read_text())
        return int(data["audio"]["sample_rate"])
    except Exception:
        return 22050  # safe default for medium-quality models


def _run_piper(text: str, onnx: Path, sample_rate: int) -> bytes:
    """Blocking: call piper binary and return WAV bytes."""
    result = subprocess.run(
        [
            str(_BINARY), "--model", str(onnx),
            "--output_raw", "--quiet",
            "--length_scale", "1.1",   # 10% slower — clearer for mixed-language text
            "--sentence_silence", "0.1",
        ],
        input=text.encode("utf-8"),
        capture_output=True,
        timeout=30,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace")[:300]
        raise RuntimeError(f"piper exited {result.returncode}: {stderr}")

    raw_pcm = result.stdout
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)       # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(raw_pcm)
    return buf.getvalue()


def _cache_key(text: str, model_path: str) -> str:
    h = hashlib.sha256(f"{model_path}:{text}".encode()).hexdigest()
    return f"{_CACHE_PREFIX}{h}"
