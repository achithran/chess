"""Higher-level analysis: single-move analysis and full PGN game review."""
from __future__ import annotations

import io
from dataclasses import dataclass, field

import chess
import chess.pgn

from app.core.logging import get_logger
from app.models.game import MoveClassification
from app.services.ai_explanation import (
    ExplanationLevel,
    ExplanationRequest,
    ai_explanation_service,
)
from app.services.coaching import coach_after_move

# ── Piece-type → English name (python-chess piece_type constants) ──
_PIECE_EN: dict[int, str] = {
    chess.PAWN:   "Pawn",
    chess.KNIGHT: "Knight",
    chess.BISHOP: "Bishop",
    chess.ROOK:   "Rook",
    chess.QUEEN:  "Queen",
    chess.KING:   "King",
}

# ── Opponent-context slide templates (2 slides prepended to "Why This Move?") ──

_OPP_MOVE_TMPL: dict[str, dict[str, str]] = {
    "en": {
        "move": "Opponent's {piece} moved from {from_sq} to {to_sq}.",
        "capture": "Opponent's {piece} captured your {cap_piece} on {to_sq}!",
        "check": "Opponent's {piece} moved to {to_sq}, giving check!",
    },
    "ml": {
        "move": "Opponent-ന്റെ {piece} {from_sq}-ൽ നിന്ന് {to_sq}-ലേക്ക് move ചെയ്തു.",
        "capture": "Opponent-ന്റെ {piece} {to_sq}-ൽ നിങ്ങളുടെ {cap_piece}-നെ capture ചെയ്തു!",
        "check": "Opponent-ന്റെ {piece} {to_sq}-ലേക്ക് move ചെയ്ത് check കൊടുത്തു!",
    },
    "hi": {
        "move": "प्रतिद्वंद्वी का {piece} {from_sq} से {to_sq} गया।",
        "capture": "प्रतिद्वंद्वी के {piece} ने {to_sq} पर आपका {cap_piece} capture किया!",
        "check": "प्रतिद्वंद्वी के {piece} ने {to_sq} पर जाकर check दिया!",
    },
    "ta": {
        "move": "எதிரியின் {piece} {from_sq}-லிருந்து {to_sq}-க்கு சென்றது.",
        "capture": "எதிரியின் {piece} {to_sq}-ல் உங்கள் {cap_piece}-ஐ capture செய்தது!",
        "check": "எதிரியின் {piece} {to_sq}-க்கு சென்று check கொடுத்தது!",
    },
}

_OPP_THREAT_TMPL: dict[str, dict[str, str]] = {
    "en": {
        "check": "Your King is now in check — you must respond immediately.",
        "attack": "This now attacks your {targets} — watch out!",
        "center": "This secures center control, giving the opponent a strategic advantage.",
        "general": "This places the opponent's piece in an active position — time to counter.",
    },
    "ml": {
        "check": "ഇപ്പോൾ നിങ്ങളുടെ King check-ൽ ആണ് — ഉടൻ respond ചെയ്യണം.",
        "attack": "ഇത് നിങ്ങളുടെ {targets}-നെ attack ചെയ്യുന്നു — ശ്രദ്ധിക്കൂ!",
        "center": "ഇത് center control ഉറപ്പിക്കുന്നു — opponent-ന് strategic advantage ഉണ്ട്.",
        "general": "Opponent-ന്റെ piece ഒരു active position-ൽ ആണ് — ഇനി counter ചെയ്യണം.",
    },
    "hi": {
        "check": "आपका King अब check में है — तुरंत जवाब दें।",
        "attack": "यह अब आपके {targets} पर हमला कर रहा है — सावधान!",
        "center": "यह center control मजबूत करता है, जिससे प्रतिद्वंद्वी को रणनीतिक लाभ।",
        "general": "यह opponent के piece को एक active position में रखता है — counter करें।",
    },
    "ta": {
        "check": "உங்கள் King இப்போது check-ல் உள்ளது — உடனே பதிலளிக்கவும்.",
        "attack": "இது உங்கள் {targets}-ஐ attack செய்கிறது — கவனமாக இருங்கள்!",
        "center": "இது center control-ஐ உறுதிப்படுத்துகிறது — எதிரிக்கு strategic advantage.",
        "general": "எதிரியின் piece ஒரு active position-ல் உள்ளது — counter செய்யுங்கள்.",
    },
}


def _opponent_context_steps(
    fen: str,
    opponent_move_uci: str,
    opponent_fen: str | None,
    language: str,
) -> list[dict]:
    """Return 2 board-annotated slides about the opponent's previous move.

    fen           – position AFTER the opponent moved (= before user's move)
    opponent_fen  – position BEFORE the opponent moved (enables capture detection)
    """
    try:
        board_after = chess.Board(fen)
        move = chess.Move.from_uci(opponent_move_uci)
        from_sq = chess.square_name(move.from_square)
        to_sq   = chess.square_name(move.to_square)

        piece = board_after.piece_at(move.to_square)
        if piece is None:
            return []
        pname = _PIECE_EN.get(piece.piece_type, "piece").capitalize()

        # Capture detection — needs the board state before opponent's move
        is_capture = False
        cap_pname  = ""
        if opponent_fen:
            try:
                board_before = chess.Board(opponent_fen)
                cap = board_before.piece_at(move.to_square)
                if cap and cap.color != piece.color:
                    is_capture = True
                    cap_pname  = _PIECE_EN.get(cap.piece_type, "piece").capitalize()
            except Exception:
                pass

        # Check detection (board_after.turn is user's turn; if in_check → opponent gave check)
        is_check = board_after.is_check()

        tmpl1 = _OPP_MOVE_TMPL.get(language) or _OPP_MOVE_TMPL["en"]
        if is_check:
            s1_text = tmpl1["check"].format(piece=pname, from_sq=from_sq, to_sq=to_sq)
        elif is_capture:
            s1_text = tmpl1["capture"].format(piece=pname, from_sq=from_sq, to_sq=to_sq, cap_piece=cap_pname)
        else:
            s1_text = tmpl1["move"].format(piece=pname, from_sq=from_sq, to_sq=to_sq)

        step1 = {
            "text":    s1_text,
            "arrows":  [[from_sq, to_sq, "orange"]],
            "squares": [[to_sq, "orange"]],
        }

        # Step 2 — what the opponent's move threatens / achieves
        tmpl2 = _OPP_THREAT_TMPL.get(language) or _OPP_THREAT_TMPL["en"]
        user_color = board_after.turn
        s2_arrows:  list[list[str]] = []
        s2_squares: list[list[str]] = []

        if is_check:
            king_sq = chess.square_name(board_after.king(user_color))
            s2_text = tmpl2["check"]
            s2_arrows  = [[to_sq, king_sq, "red"]]
            s2_squares = [[king_sq, "red"]]
        else:
            # User pieces attacked from the opponent's landed square
            attacked = [
                s for s in board_after.attacks(move.to_square)
                if board_after.piece_at(s) and board_after.piece_at(s).color == user_color
            ]
            if attacked:
                names = []
                for s in attacked[:3]:
                    p = board_after.piece_at(s)
                    names.append(f"{_PIECE_EN.get(p.piece_type,'piece').capitalize()} on {chess.square_name(s)}")
                s2_text    = tmpl2["attack"].format(targets=", ".join(names))
                s2_arrows  = [[to_sq, chess.square_name(s), "red"] for s in attacked[:2]]
                s2_squares = [[chess.square_name(s), "red"] for s in attacked[:2]]
            else:
                center = {chess.E4, chess.D4, chess.E5, chess.D5}
                ctrl   = [s for s in board_after.attacks(move.to_square) if s in center]
                if ctrl:
                    s2_text    = tmpl2["center"]
                    s2_arrows  = [[to_sq, chess.square_name(s), "purple"] for s in ctrl[:2]]
                    s2_squares = [[chess.square_name(s), "purple"] for s in ctrl]
                else:
                    s2_text    = tmpl2["general"]
                    s2_squares = [[to_sq, "orange"]]

        step2 = {"text": s2_text, "arrows": s2_arrows, "squares": s2_squares}
        return [step1, step2]

    except Exception as exc:
        logger.warning("opponent_context.failed", error=str(exc))
        return []


_BEST_MOVE_MSGS: dict[str, dict[str, str]] = {
    "en": {"better": "The engine's best move was {move} — it's a bit stronger here.", "best": "You played the best move! 👏"},
    "ml": {"better": "Engine-ന്റെ best move {move} ആയിരുന്നു — ആ move ഇവിടെ അൽപ്പം ശക്തമായിരുന്നു.", "best": "നിങ്ങൾ best move കളിച്ചു! 👏"},
    "hi": {"better": "इंजन की सर्वश्रेष्ठ चाल {move} थी — यह यहाँ थोड़ी मजबूत है।", "best": "आपने सर्वश्रेष्ठ चाल चली! 👏"},
    "ta": {"better": "இயந்திரத்தின் சிறந்த நகர்வு {move} — இது இங்கே சற்று வலிமையானது.", "best": "நீங்கள் சிறந்த நகர்வை விளையாடினீர்கள்! 👏"},
    "te": {"better": "ఇంజిన్ యొక్క ఉత్తమ నడక {move} — ఇది ఇక్కడ కొంచెం బలంగా ఉంది.", "best": "మీరు ఉత్తమ నడకను ఆడారు! 👏"},
    "kn": {"better": "ಎಂಜಿನ್‌ನ ಉತ್ತಮ ನಡೆ {move} ಆಗಿತ್ತು — ಇದು ಇಲ್ಲಿ ಸ್ವಲ್ಪ ಬಲವಾಗಿತ್ತು.", "best": "ನೀವು ಅತ್ಯುತ್ತಮ ನಡೆ ಆಡಿದ್ದೀರಿ! 👏"},
    "ru": {"better": "Лучший ход движка был {move} — он немного сильнее здесь.", "best": "Вы сделали лучший ход! 👏"},
    "es": {"better": "El mejor movimiento del motor era {move} — es un poco más fuerte aquí.", "best": "¡Jugaste el mejor movimiento! 👏"},
    "fr": {"better": "Le meilleur coup du moteur était {move} — c'est un peu plus fort ici.", "best": "Vous avez joué le meilleur coup ! 👏"},
    "zh": {"better": "引擎的最佳走法是{move}——这里稍微更强一些。", "best": "您走了最佳走法！👏"},
}
from app.services.stockfish_service import classify_move, stockfish_service

logger = get_logger(__name__)


@dataclass
class MoveReview:
    ply: int
    fen_before: str
    move_san: str
    best_move_san: str | None
    eval_before: float
    eval_after: float
    centipawn_loss: int
    classification: MoveClassification
    explanation_ml: str | None = None
    explanation_steps: list[dict] = field(default_factory=list)
    best_move_reason_ml: str | None = None
    threats: list[str] = field(default_factory=list)
    checklist: list[dict] = field(default_factory=list)


@dataclass
class GameReview:
    accuracy_white: float
    accuracy_black: float
    blunders: int = 0
    mistakes: int = 0
    inaccuracies: int = 0
    moves: list[MoveReview] = field(default_factory=list)
    summary_ml: str | None = None


def _accuracy_from_losses(losses: list[int]) -> float:
    """Map average centipawn loss to a 0-100 accuracy score (chess.com-like)."""
    if not losses:
        return 100.0
    avg = sum(losses) / len(losses)
    # Exponential decay: 0 cpl -> 100, ~100 cpl -> ~50.
    import math

    return round(max(0.0, min(100.0, 103.0 * math.exp(-0.0061 * avg) - 3.0)), 1)


class AnalysisService:
    async def analyze_move(
        self,
        fen: str,
        move_uci: str,
        level: ExplanationLevel = ExplanationLevel.BEGINNER,
        depth: int | None = None,
        language: str = "en",
        opponent_move_uci: str | None = None,
        opponent_fen: str | None = None,
    ) -> MoveReview:
        board = chess.Board(fen)
        before = await stockfish_service.evaluate_fen(fen, depth=depth)

        move = chess.Move.from_uci(move_uci)
        if move not in board.legal_moves:
            raise ValueError(f"Illegal move {move_uci} in position {fen}")
        san = board.san(move)
        board.push(move)
        after = await stockfish_service.evaluate_fen(board.fen(), depth=depth)

        # Centipawn loss from the mover's perspective.
        mover_is_white = chess.Board(fen).turn == chess.WHITE
        sign = 1 if mover_is_white else -1
        loss = max(0, sign * (before.score_cp - after.score_cp))
        classification = classify_move(loss)

        explanation = await ai_explanation_service.explain(
            ExplanationRequest(
                fen=fen,
                move_uci=move_uci,
                level=level,
                eval_before=before.score_pawns,
                eval_after=after.score_pawns,
                classification=classification.value,
                language=language,
            )
        )

        # Practical beginner coaching from the resulting position.
        coaching = coach_after_move(board, language=language)

        msgs = _BEST_MOVE_MSGS.get(language) or _BEST_MOVE_MSGS["en"]
        if before.best_move_san and before.best_move_san != san:
            best_reason = msgs["better"].format(move=before.best_move_san)
        else:
            best_reason = msgs["best"]

        # Prepend 2 opponent-context slides if the caller supplied the previous move
        opp_steps = []
        if opponent_move_uci:
            opp_steps = _opponent_context_steps(fen, opponent_move_uci, opponent_fen, language)

        return MoveReview(
            ply=0,
            fen_before=fen,
            move_san=san,
            best_move_san=before.best_move_san,
            eval_before=before.score_pawns,
            eval_after=after.score_pawns,
            centipawn_loss=loss,
            classification=classification,
            explanation_ml=explanation.text_ml,
            explanation_steps=opp_steps + explanation.steps,
            best_move_reason_ml=best_reason,
            threats=coaching["threats"],
            checklist=coaching["checklist"],
        )

    async def review_pgn(
        self, pgn: str, depth: int | None = None, explain_threshold: int = 100
    ) -> GameReview:
        """Analyze every move of a PGN. Explanations are generated only for
        notable moves (loss >= ``explain_threshold``) to control AI cost."""
        game = chess.pgn.read_game(io.StringIO(pgn))
        if game is None:
            raise ValueError("Could not parse PGN")

        board = game.board()
        white_losses: list[int] = []
        black_losses: list[int] = []
        reviews: list[MoveReview] = []
        counts = {
            MoveClassification.BLUNDER: 0,
            MoveClassification.MISTAKE: 0,
            MoveClassification.INACCURACY: 0,
        }

        for ply, move in enumerate(game.mainline_moves()):
            fen_before = board.fen()
            before = await stockfish_service.evaluate_fen(fen_before, depth=depth)
            san = board.san(move)
            mover_is_white = board.turn == chess.WHITE
            board.push(move)
            after = await stockfish_service.evaluate_fen(board.fen(), depth=depth)

            sign = 1 if mover_is_white else -1
            loss = max(0, sign * (before.score_cp - after.score_cp))
            classification = classify_move(loss)
            (white_losses if mover_is_white else black_losses).append(loss)
            if classification in counts:
                counts[classification] += 1

            explanation_ml = None
            if loss >= explain_threshold:
                exp = await ai_explanation_service.explain(
                    ExplanationRequest(
                        fen=fen_before,
                        move_uci=move.uci(),
                        eval_before=before.score_pawns,
                        eval_after=after.score_pawns,
                        classification=classification.value,
                    )
                )
                explanation_ml = exp.text_ml

            reviews.append(
                MoveReview(
                    ply=ply,
                    fen_before=fen_before,
                    move_san=san,
                    best_move_san=before.best_move_san,
                    eval_before=before.score_pawns,
                    eval_after=after.score_pawns,
                    centipawn_loss=loss,
                    classification=classification,
                    explanation_ml=explanation_ml,
                )
            )

        acc_w = _accuracy_from_losses(white_losses)
        acc_b = _accuracy_from_losses(black_losses)
        summary = (
            f"വെള്ളയുടെ കൃത്യത {acc_w}%, കറുപ്പിന്റേത് {acc_b}%. "
            f"ആകെ {counts[MoveClassification.BLUNDER]} വലിയ പിഴവുകൾ, "
            f"{counts[MoveClassification.MISTAKE]} തെറ്റുകൾ കണ്ടെത്തി."
        )

        return GameReview(
            accuracy_white=acc_w,
            accuracy_black=acc_b,
            blunders=counts[MoveClassification.BLUNDER],
            mistakes=counts[MoveClassification.MISTAKE],
            inaccuracies=counts[MoveClassification.INACCURACY],
            moves=reviews,
            summary_ml=summary,
        )


analysis_service = AnalysisService()
