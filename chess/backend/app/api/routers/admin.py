from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.explanation import AIExplanation
from app.models.game import Game
from app.models.puzzle import Puzzle
from app.models.user import SubscriptionPlan, User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


class AdminStats(BaseModel):
    total_users: int
    pro_users: int
    total_games: int
    total_puzzles: int
    ai_explanations_cached: int
    ai_tokens_used: int


@router.get("/stats", response_model=AdminStats)
async def stats(db: AsyncSession = Depends(get_db)):
    async def scalar(stmt) -> int:
        return (await db.execute(stmt)).scalar_one() or 0

    return AdminStats(
        total_users=await scalar(select(func.count(User.id))),
        pro_users=await scalar(
            select(func.count(User.id)).where(User.plan == SubscriptionPlan.PRO)
        ),
        total_games=await scalar(select(func.count(Game.id))),
        total_puzzles=await scalar(select(func.count(Puzzle.id))),
        ai_explanations_cached=await scalar(select(func.count(AIExplanation.id))),
        ai_tokens_used=await scalar(select(func.coalesce(func.sum(AIExplanation.tokens_used), 0))),
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(
    limit: int = 100, offset: int = 0, db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    )
    return list(res.scalars().all())


@router.post("/users/{user_id}/deactivate", response_model=UserOut)
async def deactivate_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if user:
        user.is_active = False
        await db.flush()
    return user
