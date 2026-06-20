"""Google Cloud Text-to-Speech service.

Uses the REST API (no SDK) so the only requirement is httpx (already in requirements.txt)
and a GOOGLE_TTS_API_KEY env var.

Wavenet voices used — actual native speakers, far more natural than ElevenLabs for
Indian languages:
  Malayalam : ml-IN-Wavenet-B (male) / ml-IN-Wavenet-A (female)
  Tamil     : ta-IN-Wavenet-B (male) / ta-IN-Wavenet-A (female)
  Hindi     : hi-IN-Wavenet-B (male) / hi-IN-Wavenet-A (female)
  Telugu    : te-IN-Wavenet-B (male) / te-IN-Wavenet-A (female)
  Kannada   : kn-IN-Wavenet-B (male) / kn-IN-Wavenet-A (female)
  English   : en-IN-Wavenet-B (Indian-accented male)
"""
from __future__ import annotations

import base64
import hashlib
import logging

import httpx

from app.core.config import settings
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

_GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"
_CACHE_PREFIX   = "tts:gcp:v1:"
_CACHE_TTL      = 60 * 60 * 24 * 30  # 30 days

# BCP-47 language code → (languageCode, Wavenet voice name)
# "B" variants are male; swap to "A" for female.
_VOICES: dict[str, tuple[str, str]] = {
    "ml": ("ml-IN", "ml-IN-Wavenet-B"),
    "ta": ("ta-IN", "ta-IN-Wavenet-B"),
    "hi": ("hi-IN", "hi-IN-Wavenet-B"),
    "te": ("te-IN", "te-IN-Wavenet-B"),
    "kn": ("kn-IN", "kn-IN-Wavenet-B"),
    "en": ("en-IN", "en-IN-Wavenet-B"),
}


def is_available() -> bool:
    return bool(settings.GOOGLE_TTS_API_KEY)


def supports_language(lang_code: str) -> bool:
    """True if Google TTS has a Wavenet voice for this BCP-47 base code."""
    base = lang_code.split("-")[0].lower()
    return base in _VOICES


async def synthesize(text: str, lang_code: str) -> bytes:
    """Return MP3 bytes for the given text using a native Wavenet voice.

    lang_code: BCP-47 string e.g. "ml-IN", "ta-IN", "hi-IN".
    Raises ValueError if GOOGLE_TTS_API_KEY is not set or language unsupported.
    """
    if not settings.GOOGLE_TTS_API_KEY:
        raise ValueError("GOOGLE_TTS_API_KEY not set.")

    base = lang_code.split("-")[0].lower()
    if base not in _VOICES:
        raise ValueError(f"No Wavenet voice configured for language '{lang_code}'")

    language_code, voice_name = _VOICES[base]

    text = text.strip()
    if not text:
        raise ValueError("Empty text")

    cache_key = _cache_key(text, voice_name)
    cached = await _get_cached(cache_key)
    if cached is not None:
        logger.debug("tts.gcp.cache_hit", extra={"voice": voice_name, "chars": len(text)})
        return cached

    audio = await _call_google(text, language_code, voice_name)
    await _set_cached(cache_key, audio)
    logger.info("tts.gcp.synthesized", extra={"voice": voice_name, "chars": len(text), "bytes": len(audio)})
    return audio


async def _call_google(text: str, language_code: str, voice_name: str) -> bytes:
    payload = {
        "input": {"text": text},
        "voice": {
            "languageCode": language_code,
            "name": voice_name,
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": 1.0,
            "pitch": 0.0,
            "effectsProfileId": ["headphone-class-device"],
        },
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            _GOOGLE_TTS_URL,
            params={"key": settings.GOOGLE_TTS_API_KEY},
            json=payload,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Google TTS {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        return base64.b64decode(data["audioContent"])


def _cache_key(text: str, voice_name: str) -> str:
    h = hashlib.sha256(f"{voice_name}:{text}".encode()).hexdigest()
    return f"{_CACHE_PREFIX}{h}"


async def _get_cached(key: str) -> bytes | None:
    try:
        val = await redis_client.get(key)
        if val:
            return base64.b64decode(val)
    except Exception as exc:
        logger.warning("tts.gcp.cache_read_failed", extra={"error": str(exc)})
    return None


async def _set_cached(key: str, audio: bytes) -> None:
    try:
        await redis_client.set(key, base64.b64encode(audio).decode(), ex=_CACHE_TTL)
    except Exception as exc:
        logger.warning("tts.gcp.cache_write_failed", extra={"error": str(exc)})
