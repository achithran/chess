from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


class LeaderRow(BaseModel):
    rank: int
    user_id: int
    name: str
    puzzle_rating: int
    streak: int


@router.get("", response_model=list[LeaderRow])
async def leaderboard(
    scope: str = Query("kerala", pattern="^(kerala|global)$"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Live leaderboard ordered by puzzle rating then streak.

    A Celery job snapshots this into ``leaderboard_entries`` daily for the
    'daily rankings' view; this endpoint returns the live standings.
    """
    res = await db.execute(
        select(User)
        .where(User.is_active.is_(True))
        .order_by(User.puzzle_rating.desc(), User.puzzle_streak.desc())
        .limit(limit)
    )
    rows = res.scalars().all()
    return [
        LeaderRow(
            rank=i + 1,
            user_id=u.id,
            name=u.full_name or u.email.split("@")[0],
            puzzle_rating=u.puzzle_rating,
            streak=u.puzzle_streak,
        )
        for i, u in enumerate(rows)
    ]
