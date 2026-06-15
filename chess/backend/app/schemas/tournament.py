"""Pydantic schemas for tournament REST API."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


# ── Tournament ────────────────────────────────────────────────────────────────

class TournamentCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    description: str | None = None
    format: str = Field("swiss", pattern="^(swiss|round_robin|knockout|arena)$")
    time_control: str = Field("3+2", pattern=r"^\d+\+\d+$")
    max_players: int = Field(32, ge=4, le=128)
    rounds_total: int | None = Field(None, ge=1, le=11)
    entry_fee_inr: int = Field(0, ge=0)
    is_public: bool = False
    arena_duration_minutes: int | None = Field(None, ge=10, le=180)
    starts_at: datetime | None = None

    @model_validator(mode="after")
    def parse_time_control(self) -> "TournamentCreate":
        base, inc = self.time_control.split("+")
        self.time_seconds = int(base) * 60
        self.increment_seconds = int(inc)
        return self

    time_seconds: int = 0
    increment_seconds: int = 0


class TournamentOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None
    format: str
    status: str
    organiser_id: int
    organiser_name: str | None = None
    time_control: str
    max_players: int
    rounds_total: int | None
    current_round: int
    entry_fee_inr: int
    prize_pool_inr: int
    invite_token: str
    is_public: bool
    starts_at: datetime | None
    participant_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class TournamentDetail(TournamentOut):
    participants: list["ParticipantOut"] = []
    rounds: list["RoundOut"] = []


# ── Participants ──────────────────────────────────────────────────────────────

class ParticipantOut(BaseModel):
    user_id: int
    user_name: str | None = None
    rating_at_entry: int
    points: float
    buchholz: float
    games_played: int
    wins: int
    draws: int
    losses: int
    final_rank: int | None
    status: str

    model_config = {"from_attributes": True}


# ── Rounds & Pairings ─────────────────────────────────────────────────────────

class PairingOut(BaseModel):
    id: int
    board_number: int
    white_id: int
    white_name: str | None = None
    black_id: int | None
    black_name: str | None = None
    result: str
    game_id: int | None

    model_config = {"from_attributes": True}


class RoundOut(BaseModel):
    id: int
    number: int
    started_at: datetime | None
    completed_at: datetime | None
    pairings: list[PairingOut] = []

    model_config = {"from_attributes": True}


# ── Live Games ────────────────────────────────────────────────────────────────

class LiveGameOut(BaseModel):
    id: int
    tournament_id: int | None
    white_id: int
    white_name: str | None = None
    white_rating: int | None = None
    black_id: int
    black_name: str | None = None
    black_rating: int | None = None
    time_control: str
    status: str
    result: str | None
    termination: str | None
    current_fen: str
    white_time_ms: int
    black_time_ms: int
    started_at: datetime | None
    ended_at: datetime | None
    move_count: int = 0

    model_config = {"from_attributes": True}


class GameMoveOut(BaseModel):
    ply: int
    uci: str
    san: str
    fen_after: str
    white_time_ms: int
    black_time_ms: int

    model_config = {"from_attributes": True}


class LiveGameDetail(LiveGameOut):
    moves: list[GameMoveOut] = []
    pgn: str | None = None


# ── WebSocket message shapes (validated client-side only) ─────────────────────

class WsMoveMsg(BaseModel):
    type: str = "move"
    uci: str = Field(..., min_length=4, max_length=5)


class WsResignMsg(BaseModel):
    type: str = "resign"


class WsDrawOfferMsg(BaseModel):
    type: str = "draw_offer"


class WsDrawResponseMsg(BaseModel):
    type: str = "draw_response"
    accept: bool


# ── Player Rating ─────────────────────────────────────────────────────────────

class PlayerRatingOut(BaseModel):
    user_id: int
    rating: int
    games_played: int
    wins: int
    losses: int
    draws: int
    peak_rating: int

    model_config = {"from_attributes": True}
