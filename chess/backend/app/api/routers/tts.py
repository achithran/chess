"""TTS router — Piper (local) → Google Cloud Wavenet → ElevenLabs fallback."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from app.api.deps import get_optional_user
from app.models.user import User
from app.services import google_tts_service, piper_tts_service, tts_service

router = APIRouter(prefix="/tts", tags=["tts"])

# BCP-47 → ElevenLabs language_code (last-resort fallback only)
_EL_LANG_MAP: dict[str, str] = {
    "ml-IN": "ml", "ml": "ml",
    "ta-IN": "ta", "ta": "ta",
    "hi-IN": "hi", "hi": "hi",
    "te-IN": "te", "te": "te",
    "kn-IN": "kn", "kn": "kn",
    "en-IN": "en", "en-US": "en", "en-GB": "en", "en": "en",
    "ru-RU": "ru", "ru": "ru",
    "es-ES": "es", "es": "es",
    "fr-FR": "fr", "fr": "fr",
    "zh-CN": "zh", "zh": "zh",
}


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1500)
    voice_id: str | None = None
    language: str | None = None  # BCP-47 tag e.g. "ml-IN", "ta-IN", "hi-IN"


@router.post(
    "/speak",
    response_class=Response,
    responses={
        200: {"content": {"audio/wav": {}, "audio/mpeg": {}}},
    },
    summary="Synthesize speech — Piper (local) → Google Wavenet → ElevenLabs",
)
async def speak(
    req: TTSRequest,
    user: User | None = Depends(get_optional_user),
) -> Response:
    if user is None:
        raise HTTPException(status_code=401, detail="Login to use voice features.")

    bcp47 = req.language or "en-IN"
    audio: bytes | None = None
    media_type = "audio/mpeg"

    # ── 1. Piper (local ONNX model, zero cost, best for Indian languages) ──
    if piper_tts_service.supports_language(bcp47):
        try:
            audio = await piper_tts_service.synthesize(req.text, bcp47)
            media_type = "audio/wav"
        except Exception as exc:
            logger.warning("tts.piper_failed", extra={"lang": bcp47, "error": str(exc)})

    # ── 2. Google Cloud Wavenet (excellent Indian-language voices) ──
    if audio is None and google_tts_service.is_available() and google_tts_service.supports_language(bcp47):
        try:
            audio = await google_tts_service.synthesize(req.text, bcp47)
            media_type = "audio/mpeg"
        except Exception as exc:
            logger.warning("tts.gcp_failed", extra={"lang": bcp47, "error": str(exc)})

    # ── 3. ElevenLabs (multilingual fallback, billed per character) ──
    if audio is None:
        el_lang = _EL_LANG_MAP.get(bcp47)
        try:
            audio = await tts_service.synthesize(req.text, voice_id=req.voice_id, language=el_lang)
            media_type = "audio/mpeg"
        except ValueError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {exc}")

    return Response(
        content=audio,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/voices", summary="List Indian voices from ElevenLabs shared library")
async def list_voices() -> list[dict]:
    try:
        return await tts_service.list_indian_voices()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch voices: {exc}")
