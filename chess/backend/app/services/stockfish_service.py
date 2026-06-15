"""Stockfish / python-chess analysis service.

A thin, async-friendly wrapper around a pooled Stockfish process. Engine
processes are expensive to spawn, so we keep a small pool and run blocking
engine calls in a thread executor to avoid blocking the event loop.

If the Stockfish binary is unavailable (e.g. local dev without the engine),
the service degrades gracefully to a material-count heuristic so the rest of
the app keeps working.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import chess
import chess.engine

from app.core.config import settings
from app.core.logging import get_logger
from app.models.game import MoveClassification

logger = get_logger(__name__)

# Centipawn-loss thresholds for classifying a move.
_CLASSIFICATION_THRESHOLDS = [
    (10, MoveClassification.BEST),
    (25, MoveClassification.EXCELLENT),
    (50, MoveClassification.GOOD),
    (100, MoveClassification.INACCURACY),
    (200, MoveClassification.MISTAKE),
]

# Rough material values for the fallback heuristic (pawns).
_PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}


@dataclass
class EvalResult:
    """A single position evaluation, always from White's perspective."""

    fen: str
    score_cp: int            # centipawns, +ve = White better
    mate: int | None         # mate-in-N if forced mate, else None
    best_move_uci: str | None
    best_move_san: str | None
    pv: list[str]            # principal variation (UCI)

    @property
    def score_pawns(self) -> float:
        return round(self.score_cp / 100, 2)


def classify_move(centipawn_loss: int) -> MoveClassification:
    for threshold, label in _CLASSIFICATION_THRESHOLDS:
        if centipawn_loss <= threshold:
            return label
    return MoveClassification.BLUNDER


class StockfishService:
    def __init__(self) -> None:
        self._engine: chess.engine.SimpleEngine | None = None
        self._lock = asyncio.Lock()
        self._available: bool | None = None

    async def _get_engine(self) -> chess.engine.SimpleEngine | None:
        if self._available is False:
            return None
        if self._engine is not None:
            return self._engine
        async with self._lock:
            if self._engine is not None:
                return self._engine
            try:
                engine = await asyncio.to_thread(
                    chess.engine.SimpleEngine.popen_uci, settings.STOCKFISH_PATH
                )
                engine.configure(
                    {
                        "Threads": settings.STOCKFISH_THREADS,
                        "Hash": settings.STOCKFISH_HASH_MB,
                    }
                )
                self._engine = engine
                self._available = True
                logger.info("stockfish.ready", path=settings.STOCKFISH_PATH)
            except Exception as exc:  # pragma: no cover - env dependent
                self._available = False
                logger.warning("stockfish.unavailable", error=str(exc))
                return None
        return self._engine

    # ---- public API ---------------------------------------------------

    async def evaluate_fen(
        self, fen: str, depth: int | None = None, multipv: int = 1
    ) -> EvalResult:
        board = chess.Board(fen)
        engine = await self._get_engine()
        if engine is None:
            return self._heuristic_eval(board)

        limit = chess.engine.Limit(depth=depth or settings.STOCKFISH_DEPTH)
        info = await asyncio.to_thread(engine.analyse, board, limit)
        return self._info_to_result(board, info)

    async def best_move(
        self, fen: str, skill_level: int = 20, depth: int | None = None
    ) -> str | None:
        """Return the best move (UCI) at a given Stockfish skill level (0-20)."""
        board = chess.Board(fen)
        engine = await self._get_engine()
        if engine is None:
            legal = list(board.legal_moves)
            return legal[0].uci() if legal else None

        # Skill Level lets us produce intentionally weaker moves for easy bots.
        await asyncio.to_thread(
            engine.configure, {"Skill Level": max(0, min(20, skill_level))}
        )
        limit = chess.engine.Limit(depth=depth or settings.STOCKFISH_DEPTH)
        result = await asyncio.to_thread(engine.play, board, limit)
        return result.move.uci() if result.move else None

    async def close(self) -> None:
        if self._engine is not None:
            await asyncio.to_thread(self._engine.quit)
            self._engine = None

    # ---- internals ----------------------------------------------------

    def _info_to_result(self, board: chess.Board, info: dict) -> EvalResult:
        score = info["score"].white()
        mate = score.mate()
        cp = score.score(mate_score=100000) or 0
        pv_moves = info.get("pv", []) or []
        best = pv_moves[0] if pv_moves else None
        return EvalResult(
            fen=board.fen(),
            score_cp=int(cp),
            mate=mate,
            best_move_uci=best.uci() if best else None,
            best_move_san=board.san(best) if best else None,
            pv=[m.uci() for m in pv_moves[:5]],
        )

    def _heuristic_eval(self, board: chess.Board) -> EvalResult:
        """Material-only fallback when no engine is available."""
        score = 0
        for piece_type, value in _PIECE_VALUES.items():
            score += value * len(board.pieces(piece_type, chess.WHITE))
            score -= value * len(board.pieces(piece_type, chess.BLACK))
        legal = list(board.legal_moves)
        best = legal[0] if legal else None
        return EvalResult(
            fen=board.fen(),
            score_cp=score * 100,
            mate=None,
            best_move_uci=best.uci() if best else None,
            best_move_san=board.san(best) if best else None,
            pv=[best.uci()] if best else [],
        )


# Module-level singleton reused across requests.
stockfish_service = StockfishService()
