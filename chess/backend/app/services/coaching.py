"""Beginner coaching helpers built on python-chess.

Given the position *after* a move, produce the practical things a beginner
should check: which pieces are hanging, whether the opponent can give check,
and a localised checklist. All strings are produced in the requested language.
"""
from __future__ import annotations

import chess

_PIECE_ML = {
    chess.PAWN: "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK: "rook",
    chess.QUEEN: "queen",
    chess.KING: "king",
}

_PIECE_VALUE = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100,
}

# Per-language string templates.  Keys:
#   hanging       – piece under attack (vars: {piece}, {square})
#   gave_check    – mover just gave check
#   safe_pieces   – checklist item 1
#   opponent_check – checklist item 2
#   free_capture  – checklist item 3
_STRINGS: dict[str, dict[str, str]] = {
    "en": {
        "hanging": "Your {piece} on {square} is under attack.",
        "gave_check": "You gave check to the opponent — nice pressure!",
        "safe_pieces": "Are all your pieces safe?",
        "opponent_check": "Can the opponent give a check?",
        "free_capture": "Any piece that can be captured for free?",
    },
    "ml": {
        "hanging": "നിങ്ങളുടെ {piece} {square}-ൽ ആക്രമണത്തിലാണ്.",
        "gave_check": "നിങ്ങൾ opponent-ന്റെ king-ന് check കൊടുത്തു — നല്ല pressure!",
        "safe_pieces": "നിങ്ങളുടെ എല്ലാ pieces-ഉം safe ആണോ?",
        "opponent_check": "Opponent-ന് check കൊടുക്കാൻ കഴിയുമോ?",
        "free_capture": "Free-ആയി capture ചെയ്യാൻ കഴിയുന്ന piece ഉണ്ടോ?",
    },
    "hi": {
        "hanging": "आपका {piece} {square} पर हमले में है।",
        "gave_check": "आपने प्रतिद्वंद्वी को चेक दिया — अच्छा दबाव!",
        "safe_pieces": "क्या आपके सभी मोहरे सुरक्षित हैं?",
        "opponent_check": "क्या प्रतिद्वंद्वी चेक दे सकता है?",
        "free_capture": "क्या कोई मोहरा मुफ्त में पकड़ा जा सकता है?",
    },
    "ta": {
        "hanging": "உங்கள் {piece} {square}ல் தாக்கப்படுகிறது.",
        "gave_check": "நீங்கள் எதிரிக்கு சோதனை கொடுத்தீர்கள் — நல்ல அழுத்தம்!",
        "safe_pieces": "உங்கள் அனைத்து காய்களும் பாதுகாப்பாக உள்ளதா?",
        "opponent_check": "எதிரி சோதனை கொடுக்க முடியுமா?",
        "free_capture": "இலவசமாக பிடிக்கக்கூடிய காய் உள்ளதா?",
    },
    "te": {
        "hanging": "మీ {piece} {square}పై దాడికి గురవుతోంది.",
        "gave_check": "మీరు ప్రత్యర్థికి చెక్ ఇచ్చారు — మంచి ఒత్తిడి!",
        "safe_pieces": "మీ అన్ని పావులు సురక్షితంగా ఉన్నాయా?",
        "opponent_check": "ప్రత్యర్థి చెక్ ఇవ్వగలరా?",
        "free_capture": "ఉచితంగా తీసుకోగలిగే పావు ఉందా?",
    },
    "kn": {
        "hanging": "ನಿಮ್ಮ {piece} {square}ನಲ್ಲಿ ಆಕ್ರಮಣಕ್ಕೆ ಒಳಗಾಗಿದೆ.",
        "gave_check": "ನೀವು ಎದುರಾಳಿಗೆ ಚೆಕ್ ನೀಡಿದ್ದೀರಿ — ಒಳ್ಳೆಯ ಒತ್ತಡ!",
        "safe_pieces": "ನಿಮ್ಮ ಎಲ್ಲಾ ಕಾಯಿಗಳು ಸುರಕ್ಷಿತವಾಗಿವೆಯೇ?",
        "opponent_check": "ಎದುರಾಳಿ ಚೆಕ್ ನೀಡಬಹುದೇ?",
        "free_capture": "ಉಚಿತವಾಗಿ ಹಿಡಿಯಬಹುದಾದ ಕಾಯಿ ಇದೆಯೇ?",
    },
    "ru": {
        "hanging": "Ваш {piece} на {square} находится под атакой.",
        "gave_check": "Вы поставили шах сопернику — хорошее давление!",
        "safe_pieces": "Все ли ваши фигуры в безопасности?",
        "opponent_check": "Может ли соперник поставить шах?",
        "free_capture": "Есть ли фигура, которую можно взять бесплатно?",
    },
    "es": {
        "hanging": "Tu {piece} en {square} está bajo ataque.",
        "gave_check": "¡Diste jaque al oponente — buen trabajo!",
        "safe_pieces": "¿Están todas tus piezas a salvo?",
        "opponent_check": "¿Puede el oponente dar jaque?",
        "free_capture": "¿Hay alguna pieza que se pueda capturar gratis?",
    },
    "fr": {
        "hanging": "Votre {piece} en {square} est sous attaque.",
        "gave_check": "Vous avez mis le roi adverse en échec — bonne pression !",
        "safe_pieces": "Toutes vos pièces sont-elles en sécurité ?",
        "opponent_check": "L'adversaire peut-il donner échec ?",
        "free_capture": "Y a-t-il une pièce qui peut être capturée gratuitement ?",
    },
    "zh": {
        "hanging": "您的{piece}在{square}正在受到攻击。",
        "gave_check": "您将对手将军了——施加了良好的压力！",
        "safe_pieces": "您所有的棋子都安全吗？",
        "opponent_check": "对手能够将军吗？",
        "free_capture": "有可以免费吃掉的棋子吗？",
    },
}


def _s(lang: str, key: str, **kwargs: str) -> str:
    strings = _STRINGS.get(lang) or _STRINGS["en"]
    template = strings.get(key) or _STRINGS["en"][key]
    return template.format(**kwargs) if kwargs else template


def hanging_pieces(board: chess.Board, color: bool) -> list[tuple[int, chess.Piece]]:
    """Pieces of ``color`` that are attacked and not safely defended."""
    result: list[tuple[int, chess.Piece]] = []
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if not piece or piece.color != color or piece.piece_type == chess.KING:
            continue
        attackers = board.attackers(not color, sq)
        if not attackers:
            continue
        defenders = board.attackers(color, sq)
        cheapest_attacker = min(
            _PIECE_VALUE[board.piece_at(a).piece_type] for a in attackers
        )
        if not defenders or cheapest_attacker < _PIECE_VALUE[piece.piece_type]:
            result.append((sq, piece))
    return result


def coach_after_move(board: chess.Board, language: str = "en") -> dict:
    """Coaching info for the side that just moved (``not board.turn``)."""
    mover = not board.turn

    hanging = hanging_pieces(board, mover)
    threats: list[str] = [
        _s(language, "hanging", piece=_PIECE_ML[p.piece_type], square=chess.square_name(sq))
        for sq, p in hanging
    ]

    opponent_can_check = any(board.gives_check(m) for m in board.legal_moves)

    if board.is_check():
        threats.append(_s(language, "gave_check"))

    checklist = [
        {"text_ml": _s(language, "safe_pieces"), "ok": len(hanging) == 0},
        {"text_ml": _s(language, "opponent_check"), "ok": not opponent_can_check},
        {"text_ml": _s(language, "free_capture"), "ok": len(hanging) == 0},
    ]

    return {"threats": threats, "checklist": checklist}
