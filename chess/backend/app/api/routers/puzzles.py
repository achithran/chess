from __future__ import annotations

import chess
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.puzzle import Puzzle, PuzzleAttempt
from app.models.user import User
from app.repositories.user_repository import UserRepository
from pydantic import BaseModel

router = APIRouter(prefix="/puzzles", tags=["puzzles"])


class PuzzleOut(BaseModel):
    id: int
    fen: str
    rating: int
    themes: list[str]
    is_daily: bool
    # First move sets up the puzzle; the solver plays from move index 1.
    setup_move: str | None
    model_config = {"from_attributes": True}


class PuzzleSolveRequest(BaseModel):
    puzzle_id: int
    moves: list[str]  # UCI moves the user played


class PuzzleSolveResponse(BaseModel):
    correct: bool
    solution: list[str]
    explanation_ml: str | None
    new_rating: int
    streak: int


def _to_out(p: Puzzle) -> PuzzleOut:
    return PuzzleOut(
        id=p.id,
        fen=p.fen,
        rating=p.rating,
        themes=p.themes,
        is_daily=p.is_daily,
        setup_move=p.moves[0] if p.moves else None,
    )


@router.get("/daily", response_model=PuzzleOut)
async def daily_puzzle(db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Puzzle).where(Puzzle.is_daily.is_(True)).order_by(Puzzle.updated_at.desc())
    )
    puzzle = res.scalars().first()
    if puzzle is None:
        res = await db.execute(select(Puzzle).order_by(func.random()).limit(1))
        puzzle = res.scalars().first()
    if puzzle is None:
        raise HTTPException(status_code=404, detail="No puzzles available")
    return _to_out(puzzle)


@router.get("/next", response_model=PuzzleOut)
async def next_puzzle(
    theme: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve a puzzle close to the user's puzzle rating (+/- 150)."""
    low, high = user.puzzle_rating - 150, user.puzzle_rating + 150
    stmt = select(Puzzle).where(Puzzle.rating.between(low, high))
    if theme:
        stmt = stmt.where(Puzzle.themes.any(theme))
    stmt = stmt.order_by(func.random()).limit(1)
    puzzle = (await db.execute(stmt)).scalars().first()
    if puzzle is None:
        puzzle = (await db.execute(select(Puzzle).order_by(func.random()).limit(1))).scalars().first()
    if puzzle is None:
        raise HTTPException(status_code=404, detail="No puzzles available")
    return _to_out(puzzle)


@router.post("/solve", response_model=PuzzleSolveResponse)
async def solve_puzzle(
    body: PuzzleSolveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    puzzle = await db.get(Puzzle, body.puzzle_id)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    # Expected solver moves are every other move after the setup move.
    expected = puzzle.moves[1::2]
    correct = body.moves[: len(expected)] == expected

    # Simple Elo-style rating update (K=24).
    expected_score = 1 / (1 + 10 ** ((puzzle.rating - user.puzzle_rating) / 400))
    actual = 1.0 if correct else 0.0
    delta = round(24 * (actual - expected_score))
    user.puzzle_rating = max(400, user.puzzle_rating + delta)
    await UserRepository(db).increment_puzzle_streak(user, correct)

    db.add(
        PuzzleAttempt(
            user_id=user.id,
            puzzle_id=puzzle.id,
            solved=correct,
            attempts=1,
            rating_delta=delta,
        )
    )
    await db.flush()

    return PuzzleSolveResponse(
        correct=correct,
        solution=puzzle.moves,
        explanation_ml=puzzle.explanation_ml,
        new_rating=user.puzzle_rating,
        streak=user.puzzle_streak,
    )
