"""Aggregate all v1 routers under a single APIRouter."""
from fastapi import APIRouter

from app.api.routers import (
    admin,
    analysis,
    auth,
    games,
    health,
    leaderboard,
    openings,
    puzzles,
    subscriptions,
    tournaments,
    tts,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(analysis.router)
api_router.include_router(puzzles.router)
api_router.include_router(openings.router)
api_router.include_router(games.router)
api_router.include_router(leaderboard.router)
api_router.include_router(subscriptions.router)
api_router.include_router(admin.router)
api_router.include_router(tournaments.router)
api_router.include_router(tts.router)
