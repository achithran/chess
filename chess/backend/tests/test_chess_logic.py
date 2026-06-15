"""Unit tests for engine-independent chess logic.

These run without a Stockfish binary or database, so they're CI-friendly.
"""
from __future__ import annotations

import chess

from app.models.game import MoveClassification
from app.services.ai_explanation import (
    ExplanationLevel,
    ExplanationRequest,
    ai_explanation_service,
)
from app.services.stockfish_service import classify_move


def test_classify_move_thresholds():
    assert classify_move(0) == MoveClassification.BEST
    assert classify_move(40) == MoveClassification.GOOD
    assert classify_move(120) == MoveClassification.MISTAKE
    assert classify_move(500) == MoveClassification.BLUNDER


def test_template_malayalam_language():
    """With language='ml' the fallback returns Manglish (Malayalam) text."""
    req = ExplanationRequest(
        fen=chess.STARTING_FEN,
        move_uci="e2e4",
        level=ExplanationLevel.BEGINNER,
        eval_after=0.3,
        classification="good",
        language="ml",
    )
    result = ai_explanation_service._generate_template(req)
    assert result.text_ml
    # Contains Malayalam unicode (range 0x0D00-0x0D7F).
    assert any("ഀ" <= ch <= "ൿ" for ch in result.text_ml)
    assert result.cached is False


def test_template_english_default():
    """Default language is English and detects center control."""
    req = ExplanationRequest(fen=chess.STARTING_FEN, move_uci="d2d4")
    text = ai_explanation_service._generate_template(req).text_ml
    assert "center" in text.lower()
    # English template should not contain Malayalam script.
    assert not any("ഀ" <= ch <= "ൿ" for ch in text)
