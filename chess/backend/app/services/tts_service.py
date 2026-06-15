"""ElevenLabs TTS service — Manglish speech for CheckMate Malayalam AI.

Free tier: 10,000 characters/month (model: eleven_multilingual_v2).
Audio is cached in Redis (30 days) keyed by text + voice_id so each voice is cached
independently and switching voices doesn't bust existing cache entries.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import re

import httpx

from app.core.config import settings
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

_EL_BASE   = "https://api.elevenlabs.io/v1"
_MODEL     = "eleven_multilingual_v2"

# Default fallback voice (Daniel — neutral male, good multilingual coverage)
_DEFAULT_VOICE_ID = "onwK4e9ZLuTAKqWW03F9"

_CACHE_PREFIX = "tts:el:v3:"   # v3: Malayalam script + English chess terms
_CACHE_TTL    = 60 * 60 * 24 * 30  # 30 days


def _preprocess(text: str) -> str:
    """Minimal cleanup — collapse extra whitespace only.
    Malayalam Unicode + English chess terms are both intentional and sent as-is to ElevenLabs."""
    return re.sub(r" {2,}", " ", text).strip()


async def synthesize(text: str, voice_id: str | None = None) -> bytes:
    """Return MP3 bytes for the given Manglish text.

    voice_id: ElevenLabs voice ID — uses _DEFAULT_VOICE_ID when not provided.
    Raises ValueError if ELEVENLABS_API_KEY is not set.
    """
    if not settings.ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY not set. Add it to .env.")

    text = _preprocess(text.strip())
    if not text:
        raise ValueError("Empty text after preprocessing")

    vid = voice_id or _DEFAULT_VOICE_ID
    cache_key = _cache_key(text, vid)

    cached = await _get_cached(cache_key)
    if cached is not None:
        logger.debug("tts.cache_hit", extra={"chars": len(text), "voice": vid})
        return cached

    audio = await _call_elevenlabs(text, vid)
    await _set_cached(cache_key, audio)
    logger.info("tts.synthesized", extra={"chars": len(text), "voice": vid, "bytes": len(audio)})
    return audio


async def list_indian_voices() -> list[dict]:
    """Query ElevenLabs shared voice library for Indian-accent male voices."""
    if not settings.ELEVENLABS_API_KEY:
        raise ValueError("ELEVENLABS_API_KEY not set.")

    results: list[dict] = []
    # Search 1: accent=Indian, male
    # Search 2: accent=South Indian, male
    # Merge and deduplicate by voice_id
    seen: set[str] = set()

    async with httpx.AsyncClient(timeout=15.0) as client:
        for accent in ("Indian", "South Indian", "indian", "south indian"):
            resp = await client.get(
                f"{_EL_BASE}/shared-voices",
                headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
                params={
                    "accent": accent,
                    "gender": "male",
                    "page_size": 12,
                    "sort": "trending",
                },
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            for v in data.get("voices", []):
                vid = v.get("voice_id", "")
                if vid and vid not in seen:
                    seen.add(vid)
                    results.append({
                        "voice_id":    vid,
                        "name":        v.get("name", "Unknown"),
                        "accent":      v.get("accent", ""),
                        "description": v.get("description", ""),
                        "preview_url": v.get("preview_url", ""),
                        "language":    v.get("language", "en"),
                    })

    # If library search returns nothing, fall back to known Indian-accent voice IDs
    if not results:
        results = _KNOWN_INDIAN_VOICES

    return results[:12]


# Curated fallback list — known ElevenLabs voices with Indian English accent
_KNOWN_INDIAN_VOICES: list[dict] = [
    {
        "voice_id": "onwK4e9ZLuTAKqWW03F9",
        "name": "Daniel",
        "accent": "British",
        "description": "Warm, authoritative male voice — good multilingual coverage",
        "preview_url": "",
        "language": "en",
    },
    {
        "voice_id": "pNInz6obpgDQGcFmaJgB",
        "name": "Adam",
        "accent": "American",
        "description": "Deep, clear male voice",
        "preview_url": "",
        "language": "en",
    },
    {
        "voice_id": "N2lVS1w4EtoT3dr4eOWO",
        "name": "Callum",
        "accent": "Transatlantic",
        "description": "Natural conversational male voice",
        "preview_url": "",
        "language": "en",
    },
]


def _cache_key(text: str, voice_id: str) -> str:
    h = hashlib.sha256(f"{voice_id}:{text}".encode()).hexdigest()
    return f"{_CACHE_PREFIX}{h}"


async def _get_cached(key: str) -> bytes | None:
    try:
        val = await redis_client.get(key)
        if val:
            return base64.b64decode(val)
    except Exception as exc:
        logger.warning("tts.cache_read_failed", extra={"error": str(exc)})
    return None


async def _set_cached(key: str, audio: bytes) -> None:
    try:
        await redis_client.set(key, base64.b64encode(audio).decode(), ex=_CACHE_TTL)
    except Exception as exc:
        logger.warning("tts.cache_write_failed", extra={"error": str(exc)})


async def _call_elevenlabs(text: str, voice_id: str) -> bytes:
    url = f"{_EL_BASE}/text-to-speech/{voice_id}"
    payload = {
        "text": text,
        "model_id": _MODEL,
        "voice_settings": {
            "stability": 0.65,
            "similarity_boost": 0.80,
            "style": 0.15,
            "use_speaker_boost": True,
        },
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            url,
            headers={
                "xi-api-key": settings.ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json=payload,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"ElevenLabs {resp.status_code}: {resp.text[:300]}")
        return resp.content
