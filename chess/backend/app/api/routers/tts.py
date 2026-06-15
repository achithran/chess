"""TTS router — ElevenLabs Malayalam/Manglish speech synthesis."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services import tts_service

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1500)
    voice_id: str | None = None  # overrides default voice when provided


@router.post(
    "/speak",
    response_class=Response,
    responses={200: {"content": {"audio/mpeg": {}}}},
    summary="Synthesize Manglish text to MP3 via ElevenLabs",
)
async def speak(req: TTSRequest) -> Response:
    try:
        audio = await tts_service.synthesize(req.text, voice_id=req.voice_id)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {exc}")

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get(
    "/voices",
    summary="List Indian male voices from ElevenLabs shared library",
)
async def list_voices() -> list[dict]:
    try:
        return await tts_service.list_indian_voices()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch voices: {exc}")
