"""Celery application + background tasks (game review, leaderboard snapshots)."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "checkmate",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    task_track_started=True,
    beat_schedule={
        "snapshot-leaderboard-daily": {
            "task": "app.workers.tasks.snapshot_leaderboard",
            "schedule": 60 * 60 * 24,
        },
        "rotate-daily-puzzle": {
            "task": "app.workers.tasks.rotate_daily_puzzle",
            "schedule": 60 * 60 * 24,
        },
    },
)
