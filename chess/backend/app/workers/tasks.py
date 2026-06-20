"""Background tasks. Heavy game reviews and scheduled jobs run here so the
API stays responsive."""
from __future__ import annotations

import asyncio

from app.core.logging import get_logger
from app.services.analysis_service import analysis_service
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


@celery_app.task(name="app.workers.tasks.review_pgn_task")
def review_pgn_task(pgn: str, depth: int = 12) -> dict:
    """Run a full PGN review off the request path."""
    review = asyncio.run(analysis_service.review_pgn(pgn, depth=depth))
    return {
        "accuracy_white": review.accuracy_white,
        "accuracy_black": review.accuracy_black,
        "blunders": review.blunders,
        "summary_ml": review.summary_ml,
    }


@celery_app.task(name="app.workers.tasks.snapshot_leaderboard")
def snapshot_leaderboard() -> str:
    # Real implementation writes the current standings into leaderboard_entries.
    logger.info("task.snapshot_leaderboard")
    return "ok"


@celery_app.task(name="app.workers.tasks.rotate_daily_puzzle")
def rotate_daily_puzzle() -> str:
    """Pick a new random daily puzzle. Scheduled to run once per day via Celery Beat."""
    from sqlalchemy import update as sa_update
    from app.db.session import AsyncSessionLocal
    from app.models.puzzle import Puzzle
    from sqlalchemy import func, select
    from datetime import datetime, timezone

    async def _rotate():
        async with AsyncSessionLocal() as db:
            await db.execute(sa_update(Puzzle).where(Puzzle.is_daily.is_(True)).values(is_daily=False))
            new_daily = (await db.execute(select(Puzzle).order_by(func.random()).limit(1))).scalars().first()
            if new_daily:
                new_daily.is_daily = True
                new_daily.updated_at = datetime.now(timezone.utc)
                await db.commit()
                logger.info("task.rotate_daily_puzzle", puzzle_id=new_daily.id)

    asyncio.run(_rotate())
    return "ok"
