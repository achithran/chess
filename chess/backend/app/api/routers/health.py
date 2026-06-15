from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.schemas.common import HealthResponse
from app.services.ai_explanation import ai_explanation_service
from app.services.stockfish_service import stockfish_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health():
    engine = await stockfish_service._get_engine()
    return HealthResponse(
        status="ok",
        version=__version__,
        engine_available=engine is not None,
        ai_enabled=ai_explanation_service.enabled,
    )
