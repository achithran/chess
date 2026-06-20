"""Candidate move generation — 'What should I play?' feature for Guru Mode."""
from __future__ import annotations

import hashlib
import json

import chess

from app.core.config import settings
from app.core.logging import get_logger
from app.db.redis import redis_client
from app.services.ai_explanation import LANGUAGE_NAMES

logger = get_logger(__name__)

_CACHE_TTL = 86_400 * 3   # 3 days — position-based cache, very stable
_STYLES = {"aggressive", "solid", "creative"}
_PIECE_VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def _game_phase(board: chess.Board) -> str:
    total = sum(
        _PIECE_VALUES.get(p.piece_type, 0)
        for sq in chess.SQUARES
        if (p := board.piece_at(sq)) and p.piece_type != chess.KING
    )
    if board.fullmove_number <= 10 and total >= 60:
        return "opening"
    return "endgame" if total <= 20 else "middlegame"


class CandidateService:
    def __init__(self) -> None:
        self._groq: object | None = None
        self._openai: object | None = None

        if settings.GROQ_API_KEY:
            try:
                from openai import AsyncOpenAI
                self._groq = AsyncOpenAI(
                    api_key=settings.GROQ_API_KEY,
                    base_url="https://api.groq.com/openai/v1",
                )
            except Exception as exc:
                logger.warning("cand.groq_init_failed", error=str(exc))

        if settings.OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI
                self._openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as exc:
                logger.warning("cand.openai_init_failed", error=str(exc))

    # ── cache ────────────────────────────────────────────────────────────────

    def _cache_key(self, fen: str, language: str, level: str) -> str:
        raw = json.dumps({"fen": fen, "lang": language, "level": level, "v": 1}, sort_keys=True)
        return "cand:" + hashlib.sha256(raw.encode()).hexdigest()[:48]

    async def _get_cached(self, key: str) -> dict | None:
        try:
            raw = await redis_client.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:
            logger.warning("cand.cache_read_failed", error=str(exc))
            return None

    async def _set_cached(self, key: str, data: dict) -> None:
        try:
            await redis_client.set(key, json.dumps(data), ex=_CACHE_TTL)
        except Exception as exc:
            logger.warning("cand.cache_write_failed", error=str(exc))

    # ── public ───────────────────────────────────────────────────────────────

    async def get_candidates(self, fen: str, language: str, level: str) -> dict:
        key = self._cache_key(fen, language, level)
        cached = await self._get_cached(key)
        if cached is not None:
            return cached

        result = await self._generate(fen, language, level)
        await self._set_cached(key, result)
        return result

    # ── generation ───────────────────────────────────────────────────────────

    async def _generate(self, fen: str, language: str, level: str) -> dict:
        board = chess.Board(fen)
        lang_name = LANGUAGE_NAMES.get(language, "English")
        turn = "White" if board.turn == chess.WHITE else "Black"
        phase = _game_phase(board)

        prompt = f"""You are an expert chess coach helping a {level}-level student.

Position (FEN): {fen}
It is {turn}'s turn. Game phase: {phase}.

TASK: Suggest exactly 3 candidate moves the player should seriously consider.
- All explanatory text MUST be in {lang_name}.
- Move notation (move_san, move_uci) stays in standard chess format.
- Opening name stays in English (or null).
- Only suggest LEGAL moves for this position.
- Each candidate must represent a DIFFERENT strategic idea.
- Pros: 2-3 items. Cons: 1-2 items. Each item under 15 words.

Respond with ONLY valid JSON — no extra text:
{{
  "opening_name": "Sicilian Defense, Najdorf Variation",
  "opening_tip": "One motivating sentence in {lang_name} about this opening position",
  "candidates": [
    {{
      "move_san": "Nf6",
      "move_uci": "g8f6",
      "name": "Knight Development",
      "short_reason": "One clear sentence in {lang_name} about the main idea",
      "pros": ["Benefit 1 in {lang_name}", "Benefit 2 in {lang_name}"],
      "cons": ["Drawback 1 in {lang_name}"],
      "style": "solid"
    }}
  ]
}}

style must be exactly one of: aggressive, solid, creative
opening_name and opening_tip may be null if not a known opening."""

        client = self._groq or self._openai
        if client is None:
            return self._fallback(board)

        try:
            from openai import AsyncOpenAI
            c: AsyncOpenAI = client  # type: ignore[assignment]
            model = "llama-3.3-70b-versatile" if client is self._groq else "gpt-4o-mini"
            resp = await c.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                max_tokens=1400,
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content or "{}"
            data = json.loads(raw)
        except Exception as exc:
            logger.warning("cand.ai_failed", error=str(exc))
            return self._fallback(board)

        # Validate legality
        legal_ucis = {m.uci() for m in board.legal_moves}
        validated: list[dict] = []
        for c_move in data.get("candidates", []):
            if c_move.get("move_uci") in legal_ucis:
                c_move["style"] = c_move.get("style", "solid") if c_move.get("style") in _STYLES else "solid"
                validated.append(c_move)

        if not validated:
            logger.warning("cand.all_illegal", fen=fen)
            return self._fallback(board)

        return {
            "opening_name": data.get("opening_name") or None,
            "opening_tip": data.get("opening_tip") or None,
            "candidates": validated[:3],
        }

    def _fallback(self, board: chess.Board) -> dict:
        candidates = []
        for move in list(board.legal_moves)[:3]:
            candidates.append({
                "move_san": board.san(move),
                "move_uci": move.uci(),
                "name": "Candidate Move",
                "short_reason": f"Consider {board.san(move)} — a playable option.",
                "pros": ["Keeps options open"],
                "cons": ["Needs further analysis"],
                "style": "solid",
            })
        return {"opening_name": None, "opening_tip": None, "candidates": candidates}


candidate_service = CandidateService()
