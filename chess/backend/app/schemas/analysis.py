from __future__ import annotations

from pydantic import BaseModel, Field


class EvaluateRequest(BaseModel):
    fen: str = Field(..., description="Position in FEN notation")
    depth: int | None = Field(None, ge=1, le=30)


class EvaluateResponse(BaseModel):
    fen: str
    score_pawns: float
    score_cp: int
    mate: int | None
    best_move_uci: str | None
    best_move_san: str | None
    pv: list[str]


_LANG_PATTERN = "^(en|ml|hi|ta|te|kn|ru|es|fr|zh)$"


class MoveAnalysisRequest(BaseModel):
    fen: str
    move_uci: str = Field(..., min_length=4, max_length=5)
    level: str = Field("beginner", pattern="^(guru|beginner|intermediate|advanced)$")
    language: str = Field("en", pattern=_LANG_PATTERN)
    depth: int | None = Field(None, ge=1, le=30)
    # Opponent's previous move context — used to prepend 2 "why opponent played X" slides
    opponent_move_uci: str | None = Field(None, min_length=4, max_length=5)
    opponent_fen: str | None = None  # FEN *before* opponent's move (enables capture detection)


class ChecklistItem(BaseModel):
    text_ml: str
    ok: bool


class ExplanationStep(BaseModel):
    """One visual slide in the Why This Move? carousel."""
    text_ml: str
    arrows: list[list[str]] = []   # [[from_sq, to_sq, color], ...]
    squares: list[list[str]] = []  # [[sq, color], ...]


class MoveAnalysisResponse(BaseModel):
    move_san: str
    best_move_san: str | None
    eval_before: float
    eval_after: float
    centipawn_loss: int
    classification: str
    explanation_ml: str | None
    explanation_steps: list[ExplanationStep] = []
    best_move_reason_ml: str | None = None
    threats: list[str] = []
    checklist: list[ChecklistItem] = []


class BestMoveRequest(BaseModel):
    fen: str
    skill_level: int = Field(20, ge=0, le=20)
    depth: int | None = Field(None, ge=1, le=30)


class BestMoveResponse(BaseModel):
    best_move_uci: str | None


class PGNReviewRequest(BaseModel):
    pgn: str = Field(..., min_length=4)
    depth: int | None = Field(12, ge=1, le=30)


class MoveReviewOut(BaseModel):
    ply: int
    move_san: str
    best_move_san: str | None
    eval_before: float
    eval_after: float
    centipawn_loss: int
    classification: str
    explanation_ml: str | None


class GameReviewResponse(BaseModel):
    accuracy_white: float
    accuracy_black: float
    blunders: int
    mistakes: int
    inaccuracies: int
    summary_ml: str | None
    moves: list[MoveReviewOut]


class ExplainRequest(BaseModel):
    fen: str
    move_uci: str | None = None
    level: str = Field("beginner", pattern="^(beginner|intermediate|advanced)$")
    language: str = Field("en", pattern=_LANG_PATTERN)
    include_english_terms: bool = True


class ExplainResponse(BaseModel):
    text_ml: str
    text_en: str | None
    cached: bool
