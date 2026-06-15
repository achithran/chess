from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.opening import OpeningLesson

router = APIRouter(prefix="/openings", tags=["openings"])


class OpeningOut(BaseModel):
    id: int
    name: str
    slug: str
    eco: str | None
    moves: list[str]
    difficulty: int
    description_ml: str | None
    ideas_ml: str | None
    model_config = {"from_attributes": True}


class OpeningSummary(BaseModel):
    id: int
    name: str
    slug: str
    eco: str | None
    difficulty: int
    model_config = {"from_attributes": True}


@router.get("", response_model=list[OpeningSummary])
async def list_openings(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(OpeningLesson).order_by(OpeningLesson.difficulty))
    return list(res.scalars().all())


@router.get("/{slug}", response_model=OpeningOut)
async def get_opening(slug: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(OpeningLesson).where(OpeningLesson.slug == slug))
    opening = res.scalar_one_or_none()
    if opening is None:
        raise HTTPException(status_code=404, detail="Opening not found")
    return opening
