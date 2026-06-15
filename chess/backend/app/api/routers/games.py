from __future__ import annotations

import io

import chess.pgn
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.game import Game, GameSource
from app.models.user import User

router = APIRouter(prefix="/games", tags=["games"])


class GameOut(BaseModel):
    id: int
    white: str | None
    black: str | None
    result: str
    opening_name: str | None
    source: str
    model_config = {"from_attributes": True}


@router.get("", response_model=list[GameOut])
async def list_games(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Game).where(Game.user_id == user.id).order_by(Game.created_at.desc())
    )
    return list(res.scalars().all())


@router.post("/upload", response_model=GameOut, status_code=201)
async def upload_pgn(
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw = (await file.read()).decode("utf-8", errors="ignore")
    parsed = chess.pgn.read_game(io.StringIO(raw))
    if parsed is None:
        raise HTTPException(status_code=422, detail="Invalid PGN file")

    headers = parsed.headers
    game = Game(
        user_id=user.id,
        source=GameSource.UPLOADED,
        pgn=raw,
        white=headers.get("White"),
        black=headers.get("Black"),
        opening_name=headers.get("Opening"),
        eco=headers.get("ECO"),
    )
    db.add(game)
    await db.flush()
    return game
