from __future__ import annotations

import chess
from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import enforce_daily_analysis_quota
from app.schemas.analysis import (
    BestMoveRequest,
    BestMoveResponse,
    CandidateMovesRequest,
    CandidateMovesResponse,
    EvaluateRequest,
    EvaluateResponse,
    ExplainRequest,
    ExplainResponse,
    ExplanationStep,
    MoveAnalysisRequest,
    MoveAnalysisResponse,
    PGNReviewRequest,
    GameReviewResponse,
    MoveReviewOut,
)
from app.services.ai_explanation import (
    ExplanationLevel,
    ExplanationRequest,
    ai_explanation_service,
)
from app.services.analysis_service import analysis_service
from app.services.candidate_service import candidate_service
from app.services.stockfish_service import stockfish_service

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _validate_fen(fen: str) -> None:
    try:
        chess.Board(fen)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid FEN")


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(body: EvaluateRequest):
    _validate_fen(body.fen)
    result = await stockfish_service.evaluate_fen(body.fen, depth=body.depth)
    return EvaluateResponse(
        fen=result.fen,
        score_pawns=result.score_pawns,
        score_cp=result.score_cp,
        mate=result.mate,
        best_move_uci=result.best_move_uci,
        best_move_san=result.best_move_san,
        pv=result.pv,
    )


@router.post("/best-move", response_model=BestMoveResponse)
async def best_move(body: BestMoveRequest):
    _validate_fen(body.fen)
    uci = await stockfish_service.best_move(
        body.fen, skill_level=body.skill_level, depth=body.depth
    )
    return BestMoveResponse(best_move_uci=uci)


@router.post("/move", response_model=MoveAnalysisResponse)
async def analyze_move(
    body: MoveAnalysisRequest,
    _user: object = Depends(enforce_daily_analysis_quota),
):
    _validate_fen(body.fen)
    try:
        review = await analysis_service.analyze_move(
            body.fen,
            body.move_uci,
            level=ExplanationLevel(body.level),
            depth=body.depth,
            language=body.language,
            opponent_move_uci=body.opponent_move_uci,
            opponent_fen=body.opponent_fen,
            context_move_by=body.context_move_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return MoveAnalysisResponse(
        move_san=review.move_san,
        best_move_san=review.best_move_san,
        eval_before=review.eval_before,
        eval_after=review.eval_after,
        centipawn_loss=review.centipawn_loss,
        classification=review.classification.value,
        explanation_ml=review.explanation_ml,
        explanation_steps=[
            ExplanationStep(
                text_ml=s["text"],
                arrows=s.get("arrows", []),
                squares=s.get("squares", []),
                label=s.get("label"),
            )
            for s in review.explanation_steps
        ],
        best_move_reason_ml=review.best_move_reason_ml,
        threats=review.threats,
        checklist=review.checklist,
    )


@router.post("/candidates", response_model=CandidateMovesResponse)
async def get_candidates(
    body: CandidateMovesRequest,
    _user: object = Depends(enforce_daily_analysis_quota),
):
    """Return 3 candidate moves for the current position (Guru Mode 'What should I play?')."""
    _validate_fen(body.fen)
    result = await candidate_service.get_candidates(body.fen, body.language, body.level)
    return CandidateMovesResponse(**result)


@router.post("/explain", response_model=ExplainResponse)
async def explain(
    body: ExplainRequest, _user: object = Depends(enforce_daily_analysis_quota)
):
    _validate_fen(body.fen)
    result = await ai_explanation_service.explain(
        ExplanationRequest(
            fen=body.fen,
            move_uci=body.move_uci,
            level=ExplanationLevel(body.level),
            include_english_terms=body.include_english_terms,
            language=body.language,
        )
    )
    return ExplainResponse(
        text_ml=result.text_ml, text_en=result.text_en, cached=result.cached
    )


@router.post("/review", response_model=GameReviewResponse)
async def review_game(
    body: PGNReviewRequest, user: User = Depends(enforce_daily_analysis_quota)
):
    try:
        review = await analysis_service.review_pgn(body.pgn, depth=body.depth)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return GameReviewResponse(
        accuracy_white=review.accuracy_white,
        accuracy_black=review.accuracy_black,
        blunders=review.blunders,
        mistakes=review.mistakes,
        inaccuracies=review.inaccuracies,
        summary_ml=review.summary_ml,
        moves=[
            MoveReviewOut(
                ply=m.ply,
                move_san=m.move_san,
                best_move_san=m.best_move_san,
                eval_before=m.eval_before,
                eval_after=m.eval_after,
                centipawn_loss=m.centipawn_loss,
                classification=m.classification.value,
                explanation_ml=m.explanation_ml,
            )
            for m in review.moves
        ],
    )
