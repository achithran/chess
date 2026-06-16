from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_optional_user
from app.core.config import settings
from app.db.redis import redis_client
from app.db.session import get_db
from app.models.puzzle import Puzzle, PuzzleAttempt
from app.models.user import SubscriptionPlan, User
from app.repositories.user_repository import UserRepository

router = APIRouter(prefix="/puzzles", tags=["puzzles"])


class PuzzleOut(BaseModel):
    id: int
    fen: str
    rating: int
    themes: list[str]
    is_daily: bool
    solver_move_count: int
    model_config = {"from_attributes": True}


class PuzzleSolveRequest(BaseModel):
    puzzle_id: int
    moves: list[str]  # UCI moves the user played (solver moves only)


class PuzzleSolveResponse(BaseModel):
    correct: bool
    solution: list[str]
    new_rating: int
    streak: int


class HintOut(BaseModel):
    step: int
    move: str
    pros: str
    cons: str
    hints_used_today: int
    hints_remaining_today: int | None  # null = unlimited (pro plan)


class CheckMoveRequest(BaseModel):
    step: int
    move: str  # UCI


class CheckMoveResponse(BaseModel):
    correct: bool
    opponent_reply: str | None  # auto-played UCI move, if any
    is_last: bool


def _to_out(p: Puzzle) -> PuzzleOut:
    return PuzzleOut(
        id=p.id,
        fen=p.fen,
        rating=p.rating,
        themes=p.themes,
        is_daily=p.is_daily,
        solver_move_count=len(p.moves[0::2]),
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


@router.get("/random", response_model=PuzzleOut)
async def random_puzzle(
    theme: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Browse a random puzzle — no auth required."""
    stmt = select(Puzzle)
    if theme:
        stmt = stmt.where(Puzzle.themes.any(theme))
    stmt = stmt.order_by(func.random()).limit(1)
    puzzle = (await db.execute(stmt)).scalars().first()
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


def _hint_quota_key(user_id: int) -> str:
    return f"quota:hints:{user_id}:{date.today().isoformat()}"


@router.post("/{puzzle_id}/check", response_model=CheckMoveResponse)
async def check_move(
    puzzle_id: int,
    body: CheckMoveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Validate a single solver move without revealing the rest of the solution."""
    puzzle = await db.get(Puzzle, puzzle_id)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    solver_moves = puzzle.moves[0::2]
    if body.step < 0 or body.step >= len(solver_moves):
        raise HTTPException(status_code=400, detail="Invalid step")

    correct = body.move == solver_moves[body.step]
    is_last = body.step == len(solver_moves) - 1
    opponent_reply = None
    if correct and not is_last:
        opponent_index = body.step * 2 + 1
        if opponent_index < len(puzzle.moves):
            opponent_reply = puzzle.moves[opponent_index]

    return CheckMoveResponse(correct=correct, opponent_reply=opponent_reply, is_last=is_last)


@router.get("/{puzzle_id}/hint", response_model=HintOut)
async def get_hint(
    puzzle_id: int,
    step: int = Query(0, ge=0),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    puzzle = await db.get(Puzzle, puzzle_id)
    if puzzle is None or not puzzle.hints:
        raise HTTPException(status_code=404, detail="No hints available for this puzzle")
    if step >= len(puzzle.hints):
        raise HTTPException(status_code=404, detail="No more hints for this puzzle")

    is_pro = user is not None and user.plan == SubscriptionPlan.PRO
    used = 0
    remaining: int | None = None
    if not is_pro:
        if user is None:
            raise HTTPException(status_code=401, detail="Login to use hints")
        key = _hint_quota_key(user.id)
        used = await redis_client.incr(key)
        if used == 1:
            await redis_client.expire(key, 60 * 60 * 24)
        if used > settings.FREE_PLAN_DAILY_HINTS:
            raise HTTPException(
                status_code=402,
                detail="Daily hint limit reached. Upgrade to Pro for unlimited hints.",
            )
        remaining = max(0, settings.FREE_PLAN_DAILY_HINTS - used)

    hint = puzzle.hints[step]
    return HintOut(
        step=step,
        move=hint["move"],
        pros=hint["pros"],
        cons=hint["cons"],
        hints_used_today=used,
        hints_remaining_today=remaining,
    )


@router.post("/solve", response_model=PuzzleSolveResponse)
async def solve_puzzle(
    body: PuzzleSolveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    puzzle = await db.get(Puzzle, body.puzzle_id)
    if puzzle is None:
        raise HTTPException(status_code=404, detail="Puzzle not found")

    # Solver moves are the even-indexed moves (0, 2, 4...); opponent replies fill the gaps.
    expected = puzzle.moves[0::2]
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
        new_rating=user.puzzle_rating,
        streak=user.puzzle_streak,
    )
