"""Malayalam AI explanation pipeline — structured step output.

Each explanation is now a list of 4-5 visual steps, each containing:
  - text: one or two sentences in the requested language
  - arrows: [[from_sq, to_sq, color], ...]  — board arrows to draw
  - squares: [[sq, color], ...]              — board squares to highlight

Color tokens: green | red | purple | yellow | blue | orange

Fallback chain (first available wins):
  1. OpenAI (gpt-4o-mini)
  2. Groq / Llama
  3. Deterministic python-chess template
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from enum import Enum

import chess

from app.core.config import settings
from app.core.logging import get_logger
from app.db.redis import redis_client

logger = get_logger(__name__)


class ExplanationLevel(str, Enum):
    GURU = "guru"          # super-simple: no jargon, analogies, ends with "your move next"
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


@dataclass
class ExplanationRequest:
    fen: str
    move_uci: str | None = None
    level: ExplanationLevel = ExplanationLevel.BEGINNER
    eval_before: float | None = None
    eval_after: float | None = None
    classification: str | None = None
    include_english_terms: bool = True
    language: str = "en"


@dataclass
class ExplanationResult:
    text_ml: str
    text_en: str | None
    cached: bool
    tokens_used: int = 0
    steps: list[dict] = field(default_factory=list)


LANGUAGE_NAMES = {
    "en": "English",
    "ml": "Malayalam",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ru": "Russian",
    "es": "Spanish",
    "fr": "French",
    "zh": "Simplified Chinese",
}

_PIECE_EN = {
    chess.PAWN:   "pawn",
    chess.KNIGHT: "knight",
    chess.BISHOP: "bishop",
    chess.ROOK:   "rook",
    chess.QUEEN:  "queen",
    chess.KING:   "king",
}

_PIECE_VALUES = {
    chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
    chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0,
}

_VALID_STEP_LABELS = {"move", "tactic", "threat", "strategy", "plan", "warning"}

CLASSIFICATION_EN = {
    "best": "best move", "excellent": "excellent move", "good": "good move",
    "inaccuracy": "inaccuracy", "mistake": "mistake", "blunder": "blunder",
}

# ── Tactical analysis helpers ─────────────────────────────────────────────────

def _game_phase(board: chess.Board) -> str:
    total = sum(
        _PIECE_VALUES.get(p.piece_type, 0)
        for sq in chess.SQUARES
        if (p := board.piece_at(sq)) and p.piece_type != chess.KING
    )
    if board.fullmove_number <= 10 and total >= 60:
        return "opening"
    if total <= 20:
        return "endgame"
    return "middlegame"


def _detect_tactics(board: chess.Board, move: chess.Move) -> list[str]:
    """Return natural-language descriptions of tactical patterns this move creates."""
    piece = board.piece_at(move.from_square)
    if not piece:
        return []
    tactics: list[str] = []
    opp = not piece.color

    b2 = board.copy()
    b2.push(move)
    to_sq = move.to_square

    # Check / discovered check
    if b2.is_check():
        opp_king_sq = b2.king(opp)
        if opp_king_sq is not None and to_sq not in b2.attackers(piece.color, opp_king_sq):
            tactics.append("discovered check — moving reveals a hidden attacking piece that gives check")
        else:
            tactics.append("check — king is now in check")

    # Fork: landing square attacks 2+ opponent pieces simultaneously
    opp_targets = [
        s for s in b2.attacks(to_sq)
        if (p := b2.piece_at(s)) and p.color == opp
    ]
    if len(opp_targets) >= 2:
        target_desc = " and ".join(
            f"{_PIECE_EN.get(b2.piece_at(s).piece_type, 'piece')} on {chess.square_name(s)}"
            for s in opp_targets[:3]
        )
        tactics.append(
            f"fork — {_PIECE_EN.get(piece.piece_type, 'piece')} on {chess.square_name(to_sq)}"
            f" attacks {target_desc} simultaneously"
        )

    # Pin: opponent piece newly pinned to their king after this move
    if b2.king(opp) is not None:
        for sq in chess.SQUARES:
            p2 = b2.piece_at(sq)
            if p2 and p2.color == opp and p2.piece_type != chess.KING:
                if b2.is_pinned(opp, sq) and not board.is_pinned(opp, sq):
                    pname = _PIECE_EN.get(p2.piece_type, "piece")
                    tactics.append(
                        f"pin — opponent's {pname} on {chess.square_name(sq)}"
                        f" is now pinned to their king and cannot move freely"
                    )
                    break

    # Winning capture: take a more valuable piece
    if board.is_capture(move):
        cap = board.piece_at(move.to_square)
        if cap:
            mv = _PIECE_VALUES.get(piece.piece_type, 0)
            cv = _PIECE_VALUES.get(cap.piece_type, 0)
            if cv > mv:
                tactics.append(
                    f"winning capture — {_PIECE_EN.get(piece.piece_type, 'piece')} (worth {mv})"
                    f" takes {_PIECE_EN.get(cap.piece_type, 'piece')} (worth {cv}), gaining {cv - mv} pawns of material"
                )

    return tactics


# ── Prompts ───────────────────────────────────────────────────────────────────

# OUTPUT STYLE for Malayalam:
# • Malayalam Unicode script for all grammar, connectors, emotions.
# • These English words stay AS-IS (Malayalis say them this way in chess):
#     Piece names: King, Queen, Knight, Bishop, Rook, Pawn
#     Actions:     push, capture, attack, threaten, check, checkmate, castle,
#                  move, develop, control, protect, defend, fork, pin, skewer
#     Square names: e4, d5, f3 etc.
# • Result sounds like a real Malayali coach — Malayalam sentence structure,
#   English chess vocabulary, natural and fluent.
#
# GOOD examples:
#   "നിങ്ങളുടെ Knight e4-ൽ നിന്ന് f6-ലേക്ക് move ചെയ്തു."
#   "ഇപ്പോൾ ഇത് opponent-ന്റെ Bishop-നെ directly threaten ചെയ്യുന്നു."
#   "Center control ഉണ്ടാകുന്നു — ഇത് നിങ്ങൾക്ക് വലിയ advantage ആണ്."
#   "c5-ൽ Pawn push ചെയ്യൂ — അത് best move ആണ്."
#   "Opponent-ന്റെ King ഇപ്പോൾ safe അല്ല — check കൊടുക്കാൻ പറ്റും."

_ML_STYLE = """\
LANGUAGE RULES — follow exactly:
  • Write in Malayalam Unicode script (not Roman/English transliteration).
  • These words MUST stay in English as-is (do not translate or transliterate):
      Piece names : King, Queen, Knight, Bishop, Rook, Pawn
      Actions     : push, capture, attack, threaten, check, checkmate, castle,
                    move, develop, control, protect, defend, fork, pin, skewer
      Square names: e4, d5, f3 etc. (always English algebraic notation)
      Other terms : center, opening, endgame, advantage, opponent, safe, best
  • Everything else — grammar, sentence structure, connectors, emotions — in Malayalam script.
  • Write like a friendly Malayali coach speaking naturally to a student.
  • Keep sentences SHORT (1–2 sentences per step).
"""

# Few-shot system prompt tuned for Ollama / llama3.1:8b.
# The concrete examples are critical — they show the model exactly what mix we want.
_OLLAMA_SYSTEM_ML = """\
You are a Malayalam chess coach. Output ONLY a JSON array — no other text.

STRICT RULES:
1. Malayalam Unicode script for all grammar and sentence structure.
2. These words MUST appear in English exactly — NEVER translate them:
   Pieces: King, Queen, Knight, Bishop, Rook, Pawn
   Actions: push, capture, move, attack, threaten, check, checkmate, castle, develop, control, protect, fork, pin, skewer
   Squares: e4, d5, f3, c5 etc.
   Words: center, advantage, opponent, safe, best, position, fork, pin, check, discovered check

CORRECT examples (copy this style):
  "നിങ്ങളുടെ Pawn c7-ൽ നിന്ന് c5-ലേക്ക് push ചെയ്തു."
  "ഇത് ഒരു Fork ആണ് — Knight ഒരേ സമയം Queen-നെയും Rook-നെയും attack ചെയ്യുന്നു!"
  "Center control ഉണ്ടാകുന്നു — ഇത് നിങ്ങൾക്ക് വലിയ advantage ആണ്."
  "ഇനി Knight develop ചെയ്യൂ — position strong ആകും."

WRONG (never do this):
  "നിങ്ങളുടെ പ്യാദ..." ← WRONG, use "Pawn"
  "...ആക്രമിക്കുന്നു" ← WRONG, use "attack ചെയ്യുന്നു"
  "...നൈറ്റ്..." ← WRONG, use "Knight"

Generate exactly 5 steps with these LABELS:
  Step 1: label "move"     — which piece moved where. Green arrow.
  Step 2: label "tactic"   — if TACTICS DETECTED are listed: name the tactic (Fork/Pin/Check/Discovered Check) and explain why it works. Red/orange arrows. If no tactic listed, label "threat" and explain the main threat.
  Step 3: label "threat"   — what opponent must respond to. Red arrows.
  Step 4: label "strategy" — positional gain: center control, piece activity, King safety. Purple/blue.
  Step 5: label "plan"     — player's next 2-3 move idea. Yellow squares.

JSON format:
[
  {"label": "move",     "text": "Malayalam sentence.", "arrows": [["from","to","color"]], "squares": [["sq","color"]]},
  {"label": "tactic",   "text": "...", "arrows": [...], "squares": [...]},
  {"label": "threat",   "text": "...", "arrows": [...], "squares": [...]},
  {"label": "strategy", "text": "...", "arrows": [...], "squares": [...]},
  {"label": "plan",     "text": "...", "arrows": [...], "squares": [...]}
]

Valid labels: move | tactic | threat | strategy | plan | warning
Colors: green=good move, red=threat/attack, purple=key square, yellow=watch/plan, blue=protected, orange=opponent trouble
Squares: a1–h8 only. Output ONLY the JSON array."""

_GURU_SYSTEM_ML = f"""\
You are a friendly Malayalam chess coach. Explain the move to a beginner child.

OUTPUT ONLY a valid JSON array — NO markdown, NO text outside the JSON.

{_ML_STYLE}

CORRECT examples:
  "നിങ്ങളുടെ Knight e2-ൽ നിന്ന് f4-ലേക്ക് move ചെയ്തു."
  "ഇത് ഒരു Fork ആണ്! Knight ഒരേ സമയം Queen-നെയും Rook-നെയും attack ചെയ്യുന്നു."
  "ഇനി Rook develop ചെയ്യൂ — safe ആകും."

WRONG: "...നൈറ്റ്...", "...പ്യാദ...", "...ആക്രമിക്കുന്നു...", "...നീക്കി..."

Generate exactly 4 steps with these labels and purposes:
  Step 1 [label "move"]     – ഏത് piece ഏത് square-ൽ നിന്ന് ഏത് square-ലേക്ക് move ചെയ്തു? Green arrow.
  Step 2 [label "tactic" or "threat"] – TACTICS DETECTED ഉണ്ടെങ്കിൽ: tactic-ന്റെ name (Fork/Pin/Check) ഉൾപ്പെടുത്തി ലളിതമായ Malayalam-ൽ explain ചെയ്യൂ. ഇല്ലെങ്കിൽ label "threat": ഇത് എന്ത് threaten ചെയ്യുന്നു? Red arrow.
  Step 3 [label "strategy"] – ഇത് എന്ത് protect ചെയ്യുന്നു / control ചെയ്യുന്നു? Purple/blue.
  Step 4 [label "plan"]     – ഇനി നിങ്ങൾ എന്ത് ചെയ്യണം? Yellow squares.

REQUIRED JSON format:
[
  {{
    "label": "move",
    "text": "ഒരു ചെറിയ Malayalam വാക്യം — കുട്ടിക്ക് മനസ്സിലാകുന്ന ഭാഷ.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

Valid labels: move | tactic | threat | strategy | plan | warning
ALLOWED COLORS: green (നിങ്ങളുടെ move / നല്ലത്), red (അപകടം / threaten), purple (പ്രധാന square), yellow (ശ്രദ്ധിക്കൂ / plan), blue (protected), orange (opponent-ന്റെ കഷ്ടം)
VALID SQUARES: a1-h8 only. Never invent squares.

RULES:
  • Every step MUST have ≥1 arrow OR ≥1 square.
  • Each step is MAX 1–2 sentences.
  • Output ONLY the JSON array — nothing else.
"""

_GURU_SYSTEM_EN = """\
You are a friendly chess teacher explaining a move to a complete beginner (like a 6-year-old).

OUTPUT ONLY a valid JSON array — NO markdown, NO text outside the JSON.

Generate exactly 4 steps. Use the SIMPLEST possible words. If a TACTIC is listed in the position info, explain it simply.

REQUIRED JSON format:
[
  {{
    "label": "move",
    "text": "1 sentence in LANG — very simple, like talking to a child.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

Valid labels: move | tactic | threat | strategy | plan | warning
ALLOWED COLORS: green (your piece moving / good), red (danger / threat), purple (important square), yellow (watch this / plan), blue (safe / protected), orange (opponent piece in trouble)
VALID SQUARES: a1-h8 only.

STEP GUIDE:
  Step 1 [label "move"]             – The piece moved from [sq] to [sq]. Green arrow.
  Step 2 [label "tactic" or "threat"] – If TACTICS are listed: explain the tactic simply ("This is a fork!" / "This piece is pinned!"). Use label "tactic". If no tactic, explain the threat. Use label "threat".
  Step 3 [label "strategy"]         – It protects / controls the middle. Purple/blue.
  Step 4 [label "plan"]             – Your best next move idea. Yellow squares.

RULES:
  • Every step MUST have ≥1 arrow OR ≥1 square.
  • Each step is MAX 1 sentence.
  • Output ONLY the JSON array — nothing else.
"""


def _system_prompt(language: str, level: str) -> str:
    name = LANGUAGE_NAMES.get(language, "English")

    if level == "guru":
        if language == "ml":
            return _GURU_SYSTEM_ML
        return _GURU_SYSTEM_EN.replace("LANG", name)

    depth_note = (
        "Keep explanations simple — one concrete fact per step."
        if level == "beginner" else
        "You may include one short tactical variation per step."
        if level == "advanced" else
        "Balance clarity and depth."
    )

    if language == "ml":
        return f"""\
You are a world-class Malayalam chess coach. Explain the move visually to a student.

OUTPUT ONLY a valid JSON array — NO markdown fences, NO text outside the JSON.

{_ML_STYLE}

CORRECT examples — copy this exact style:
  "നിങ്ങളുടെ Pawn c7-ൽ നിന്ന് c5-ലേക്ക് push ചെയ്തു."
  "ഇത് ഒരു Fork ആണ്! Knight ഒരേ സമയം Queen-നെ d7-ൽ, Rook-നെ f5-ൽ attack ചെയ്യുന്നു."
  "ഇത് opponent-ന്റെ Bishop-നെ pin ചെയ്യുന്നു — അത് move ചെയ്താൽ King exposed ആകും."
  "Center control ഉണ്ടാകുന്നു — ഇത് വലിയ advantage ആണ്."
  "ഇനി Knight develop ചെയ്ത് f5-ൽ outpost ഉണ്ടാക്കൂ."

WRONG (never generate):
  "...പ്യാദ..." ← use "Pawn"
  "...നൈറ്റ്..." ← use "Knight"
  "...ആക്രമിക്കുന്നു..." ← use "attack ചെയ്യുന്നു"
  "...നീക്കി..." ← use "move ചെയ്തു"
  "...ഭീഷണിയുണ്ട്..." ← use "threaten ചെയ്യുന്നു"

Generate exactly 5 steps. Each step covers ONE angle of the move with board annotations.

REQUIRED JSON format:
[
  {{
    "label": "move",
    "text": "1-2 Malayalam sentences — natural, like a real coach speaking.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

Valid labels: move | tactic | threat | strategy | plan | warning

ALLOWED COLORS:
  green  = നിങ്ങളുടെ main move, development, നല്ലത്
  red    = threaten / attack line
  purple = strategic square, key control point
  yellow = ശ്രദ്ധ വേണം, plan, next target
  blue   = safely protected piece or square
  orange = opponent-ന്റെ piece കഷ്ടത്തിൽ

VALID SQUARES: a1-h8 only. Never invent squares.

STEP GUIDE (all 5 required):
  Step 1 [label "move"]     – ഏത് piece, എവിടെ നിന്ന്, എവിടേക്ക് move? Green arrow.
  Step 2 [label "tactic" or "threat"] – TACTICS DETECTED section-ൽ listed ആണെങ്കിൽ: tactic-ന്റെ English name (Fork / Pin / Check / Discovered Check) ഉൾപ്പെടുത്തി explain ചെയ്യൂ — label "tactic". ഇല്ലെങ്കിൽ: main threat explain ചെയ്ത് — label "threat". Red/orange arrows.
  Step 3 [label "threat"]   – Opponent-ന് ഇപ്പോൾ respond ചെയ്യേണ്ട immediate danger. Red arrows to the target.
  Step 4 [label "strategy"] – Positional gain: center control, piece activity, King safety. Purple/blue arrows.
  Step 5 [label "plan"]     – Player-ന്റെ next 2-3 move idea — concretely show the plan. Yellow squares.

RULES:
  • Every step MUST have ≥1 arrow OR ≥1 square.
  • Do NOT invent squares that are not on the board.
  • {depth_note}
  • Output ONLY the JSON array — nothing else."""

    return f"""You are a world-class chess coach. Explain the given move visually to a student.

OUTPUT ONLY a valid JSON array — NO markdown fences, NO text outside the JSON.

Generate exactly 5 steps. Each step covers ONE angle of the move and specifies \
what to draw on the chessboard so the student sees it visually.

REQUIRED JSON format:
[
  {{
    "label": "move",
    "text": "1-2 sentences in {name}.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

Valid labels: move | tactic | threat | strategy | plan | warning

ALLOWED COLORS:
  green  = main move, development, good square for you
  red    = threat to opponent, danger, attack line
  purple = strategic control, outpost, key square
  yellow = attention needed, plan, next target square
  blue   = safely defended piece or square
  orange = opponent piece under pressure

VALID SQUARES: a1-h8 only (e.g. e4, d5, g1, f3). Never invent squares.

STEP GUIDE (all 5 required):
  Step 1 [label "move"]     – The move: piece, from→to, capture or not. Green arrow.
  Step 2 [label "tactic" or "threat"] – If TACTICS DETECTED are listed in the position info: name the tactic (Fork / Pin / Check / Discovered Check / Skewer) and explain why it works with concrete arrows showing the pattern. Use label "tactic". If no tactic listed, explain the immediate threat. Use label "threat".
  Step 3 [label "threat"]   – What must the opponent respond to right now? Red arrows to the threatened square(s).
  Step 4 [label "strategy"] – Strategic gain: development tempo, center control, king safety, piece activity. Purple/blue.
  Step 5 [label "plan"]     – Long-term plan: the idea for the next 2-3 moves after this. Yellow squares showing next targets.

RULES:
  • Every step MUST have ≥1 arrow OR ≥1 square.
  • Do NOT invent squares that are not on the board.
  • {depth_note}
  • Output ONLY the JSON array — nothing else."""


def _user_prompt(req: ExplanationRequest) -> str:
    board = chess.Board(req.fen)
    parts = [f"FEN: {req.fen}", f"Game phase: {_game_phase(board)} (move {board.fullmove_number})"]

    if req.move_uci:
        try:
            move = chess.Move.from_uci(req.move_uci)
            san  = board.san(move)
            piece = board.piece_at(move.from_square)
            pname = _PIECE_EN.get(piece.piece_type, "piece") if piece else "piece"
            from_sq = chess.square_name(move.from_square)
            to_sq   = chess.square_name(move.to_square)
            parts.append(f"Move: {san} (UCI: {req.move_uci}) — {pname} from {from_sq} to {to_sq}")

            if board.is_capture(move):
                cap = board.piece_at(move.to_square)
                cap_name = _PIECE_EN.get(cap.piece_type, "piece") if cap else "piece"
                parts.append(f"Captures: {cap_name} on {to_sq}")

            # Detect tactical patterns BEFORE pushing the move
            tactics = _detect_tactics(board, move)
            if tactics:
                parts.append("TACTICS DETECTED (Step 2 MUST name and explain one of these):")
                for t in tactics:
                    parts.append(f"  • {t}")

            board.push(move)

            if board.is_check():
                parts.append(f"Effect: gives CHECK to king on {chess.square_name(board.king(board.turn))}")

            attacks = [chess.square_name(s) for s in board.attacks(move.to_square)
                       if board.piece_at(s) and board.piece_at(s).color != (not board.turn)]
            if attacks:
                parts.append(f"Attacks opponent pieces on: {', '.join(attacks[:4])}")

            center_ctrl = [chess.square_name(s) for s in board.attacks(move.to_square)
                           if s in (chess.E4, chess.D4, chess.E5, chess.D5)]
            if center_ctrl:
                parts.append(f"Controls center squares: {', '.join(center_ctrl)}")

        except Exception:
            parts.append(f"Move UCI: {req.move_uci}")

    if req.classification:
        parts.append(f"Engine assessment: {req.classification}")
    if req.eval_before is not None and req.eval_after is not None:
        parts.append(f"Eval change: {req.eval_before:+.2f} → {req.eval_after:+.2f} (positive = White better)")
    parts.append(f"Level: {req.level.value}")
    return "\n".join(parts)


# ── JSON parsing ──────────────────────────────────────────────────────────────

def _parse_steps(raw: str) -> list[dict]:
    """Extract and validate the JSON step array from an LLM response."""
    # Strip markdown fences if present
    text = re.sub(r"```(?:json)?", "", raw).strip()

    data: list | None = None

    # Try 1: whole string is valid JSON
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            data = parsed
        elif isinstance(parsed, dict):
            # e.g. {"steps": [...]} — find any list value
            for v in parsed.values():
                if isinstance(v, list) and v:
                    data = v
                    break
    except (json.JSONDecodeError, ValueError):
        pass

    # Try 2: extract [...] using non-greedy regex to find the first complete array
    if data is None:
        m = re.search(r"\[[\s\S]*?\](?=\s*[,\]]|\s*$)", text)
        if m is None:
            # Fallback: greedy search
            m = re.search(r"\[.*\]", text, re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group(0))
                if isinstance(parsed, list):
                    data = parsed
            except (json.JSONDecodeError, ValueError):
                pass

    # Try 3: find outermost [...] by bracket counting
    if data is None:
        start = text.find("[")
        if start != -1:
            depth, end = 0, -1
            for i, ch in enumerate(text[start:], start):
                if ch == "[":
                    depth += 1
                elif ch == "]":
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            if end != -1:
                try:
                    parsed = json.loads(text[start : end + 1])
                    if isinstance(parsed, list):
                        data = parsed
                except (json.JSONDecodeError, ValueError):
                    pass

    if not data:
        return []

    validated: list[dict] = []
    valid_sqs = {chess.square_name(s) for s in chess.SQUARES}
    allowed_colors = {"green", "red", "purple", "yellow", "blue", "orange"}

    for item in data:
        if not isinstance(item, dict):
            continue
        text_val = str(item.get("text", "")).strip()
        if not text_val:
            continue
        raw_arrows  = item.get("arrows", [])
        raw_squares = item.get("squares", [])

        arrows: list[list[str]] = []
        for a in raw_arrows:
            if (isinstance(a, list) and len(a) >= 2
                    and str(a[0]).lower() in valid_sqs
                    and str(a[1]).lower() in valid_sqs):
                color = str(a[2]).lower() if len(a) > 2 else "green"
                arrows.append([str(a[0]).lower(), str(a[1]).lower(),
                               color if color in allowed_colors else "green"])

        squares: list[list[str]] = []
        for s in raw_squares:
            if (isinstance(s, list) and len(s) >= 1
                    and str(s[0]).lower() in valid_sqs):
                color = str(s[1]).lower() if len(s) > 1 else "yellow"
                squares.append([str(s[0]).lower(),
                                color if color in allowed_colors else "yellow"])

        # Every step must have ≥1 annotation
        if not arrows and not squares:
            continue

        label_val = str(item.get("label", "")).strip().lower()
        if label_val not in _VALID_STEP_LABELS:
            label_val = None

        validated.append({"text": text_val, "label": label_val, "arrows": arrows, "squares": squares})

    return validated[:5]


# ── Template fallback (no LLM) ────────────────────────────────────────────────

def _template_steps(req: ExplanationRequest) -> list[dict]:
    """Generate structured steps from python-chess analysis, no LLM needed."""
    if not req.move_uci:
        return []
    try:
        board = chess.Board(req.fen)
        move  = chess.Move.from_uci(req.move_uci)
        if move not in board.legal_moves:
            return []
    except Exception:
        return []

    piece    = board.piece_at(move.from_square)
    pname    = _PIECE_EN.get(piece.piece_type, "piece") if piece else "piece"
    from_sq  = chess.square_name(move.from_square)
    to_sq    = chess.square_name(move.to_square)
    is_cap   = board.is_capture(move)
    steps: list[dict] = []

    # Detect tactics before pushing
    tactics_found = _detect_tactics(board, move)

    # Step 1 – The move
    if is_cap:
        cap = board.piece_at(move.to_square)
        cap_name = _PIECE_EN.get(cap.piece_type, "piece") if cap else "piece"
        text1 = f"The {pname} captures the {cap_name} on {to_sq}, winning material."
    else:
        text1 = f"The {pname} moves from {from_sq} to {to_sq}."
    steps.append({
        "label": "move",
        "text": text1,
        "arrows": [[from_sq, to_sq, "green"]],
        "squares": [[to_sq, "green"]],
    })

    board.push(move)

    # Step 2 – Named tactic OR check/attacks
    if tactics_found:
        tactic_text = tactics_found[0].capitalize() + "."
        steps.append({
            "label": "tactic",
            "text": tactic_text,
            "arrows": [[to_sq, chess.square_name(s), "orange"]
                       for s in list(board.attacks(move.to_square))[:2]
                       if board.piece_at(s) and board.piece_at(s).color == board.turn],
            "squares": [[to_sq, "orange"]],
        })
    elif board.is_check():
        king_sq = chess.square_name(board.king(board.turn))
        steps.append({
            "label": "tactic",
            "text": f"Check! The opponent's king on {king_sq} is in check and must move.",
            "arrows": [[to_sq, king_sq, "red"]],
            "squares": [[king_sq, "red"]],
        })
    else:
        attacked = [s for s in chess.SQUARES
                    if board.is_attacked_by(not board.turn, s)
                    and board.piece_at(s) and board.piece_at(s).color == board.turn]
        if attacked:
            targets = attacked[:2]
            steps.append({
                "label": "threat",
                "text": f"This move now attacks opponent pieces on {', '.join(chess.square_name(s) for s in targets)}.",
                "arrows": [[to_sq, chess.square_name(s), "red"] for s in targets],
                "squares": [[chess.square_name(s), "red"] for s in targets],
            })

    # Step 3 – Center / key squares controlled (strategy)
    center = [chess.E4, chess.D4, chess.E5, chess.D5]
    ctrl   = [s for s in board.attacks(move.to_square) if s in center]
    if ctrl:
        cnames = [chess.square_name(s) for s in ctrl]
        steps.append({
            "label": "strategy",
            "text": f"From {to_sq}, the {pname} controls center squares: {', '.join(cnames)}.",
            "arrows": [[to_sq, chess.square_name(s), "purple"] for s in ctrl[:2]],
            "squares": [[chess.square_name(s), "purple"] for s in ctrl],
        })
    elif move.to_square in center:
        steps.append({
            "label": "strategy",
            "text": f"The {pname} now occupies {to_sq}, a central square giving strong control.",
            "arrows": [[from_sq, to_sq, "purple"]],
            "squares": [[to_sq, "purple"]],
        })

    # Step 4 – Long-term plan / evaluation
    if req.eval_after is not None:
        if req.eval_after > 0.5:
            steps.append({
                "label": "plan",
                "text": f"Position is better for White (+{req.eval_after:.1f}). The plan is to develop remaining pieces and advance in the center.",
                "arrows": [[from_sq, to_sq, "green"]],
                "squares": [[to_sq, "green"]],
            })
        elif req.eval_after < -0.5:
            steps.append({
                "label": "plan",
                "text": f"Black is slightly better ({req.eval_after:.1f}). Look for active piece play and counter-attack opportunities.",
                "arrows": [[from_sq, to_sq, "blue"]],
                "squares": [[to_sq, "blue"]],
            })
        else:
            steps.append({
                "label": "plan",
                "text": "The position is roughly equal. Focus on piece development and controlling the center.",
                "arrows": [],
                "squares": [[chess.square_name(s), "yellow"] for s in [chess.E4, chess.D4] if not board.piece_at(s)],
            })

    return steps[:5] or [{"label": "strategy", "text": "Develop your pieces and keep your king safe.",
                           "arrows": [], "squares": []}]


# ── Service class ─────────────────────────────────────────────────────────────

class AIExplanationService:
    def __init__(self) -> None:
        self._client        = None
        self._groq_client   = None
        self._ollama_client = None

        if settings.OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            except Exception as exc:
                logger.warning("openai.init_failed", error=str(exc))

        if settings.GROQ_API_KEY:
            try:
                from openai import AsyncOpenAI
                self._groq_client = AsyncOpenAI(
                    api_key=settings.GROQ_API_KEY,
                    base_url="https://api.groq.com/openai/v1",
                )
            except Exception as exc:
                logger.warning("groq.init_failed", error=str(exc))

        if settings.OLLAMA_URL:
            try:
                import httpx
                from openai import AsyncOpenAI
                self._ollama_client = AsyncOpenAI(
                    api_key="ollama",                      # Ollama ignores the key
                    base_url=f"{settings.OLLAMA_URL}/v1",
                    timeout=httpx.Timeout(120.0, connect=5.0),  # 2-min cap, fall back to Groq
                )
                logger.info("ollama.client_ready", url=settings.OLLAMA_URL, model=settings.OLLAMA_MODEL)
            except Exception as exc:
                logger.warning("ollama.init_failed", error=str(exc))

    @property
    def enabled(self) -> bool:
        return any([self._ollama_client, self._client, self._groq_client])

    async def explain(self, req: ExplanationRequest) -> ExplanationResult:
        key = self._cache_key(req)
        cached = await self._get_cached(key)
        if cached is not None:
            return ExplanationResult(
                text_ml=cached["text_ml"],
                text_en=cached.get("text_en"),
                steps=cached.get("steps", []),
                cached=True,
            )

        # Malayalam → Groq first (no GPU on this host → Ollama CPU is too slow; 70B Groq is faster+better)
        # Other languages → OpenAI → Groq → template
        if req.language == "ml" and self._groq_client is not None:
            result = await self._generate_llama(req)
        elif self._client is not None:
            result = await self._generate_openai(req)
        elif self._groq_client is not None:
            result = await self._generate_llama(req)
        else:
            result = self._generate_template(req)

        await self._set_cached(key, result)
        return result

    # ── cache ─────────────────────────────────────────────────────────────────

    def _cache_key(self, req: ExplanationRequest) -> str:
        raw = json.dumps({
            "fen": req.fen, "move": req.move_uci,
            "level": req.level.value, "cls": req.classification,
            "lang": req.language, "v": 8,   # v8: label field + tactic detection in user prompt
        }, sort_keys=True)
        return "aiexp:" + hashlib.sha256(raw.encode()).hexdigest()[:48]

    async def _get_cached(self, key: str) -> dict | None:
        try:
            raw = await redis_client.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:
            logger.warning("cache.read_failed", error=str(exc))
            return None

    async def _set_cached(self, key: str, result: ExplanationResult) -> None:
        try:
            await redis_client.set(
                key,
                json.dumps({"text_ml": result.text_ml, "text_en": result.text_en,
                            "steps": result.steps}),
                ex=settings.AI_EXPLANATION_CACHE_TTL,
            )
        except Exception as exc:
            logger.warning("cache.write_failed", error=str(exc))

    # ── generators ────────────────────────────────────────────────────────────

    async def _generate_ollama(self, req: ExplanationRequest) -> ExplanationResult:
        """Primary Malayalam generator — uses local Ollama llama3.1:8b."""
        # Use the tighter few-shot prompt tuned for llama3.1
        system = _OLLAMA_SYSTEM_ML if req.language == "ml" else _system_prompt(req.language, req.level.value)
        try:
            resp = await self._ollama_client.chat.completions.create(  # type: ignore[union-attr]
                model=settings.OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user",   "content": _user_prompt(req)},
                ],
                temperature=0.3,
                max_tokens=512,  # 4 steps × ~100 tokens each; keep Ollama fast on CPU
            )
            raw = resp.choices[0].message.content or ""
            result = self._build_result(raw, req, 0)
            if result.steps:
                return result
            # Empty steps — fall through to OpenAI/Groq
            logger.warning("ollama.empty_steps_fallback", raw_preview=raw[:200])
        except Exception as exc:
            logger.warning("ollama.completion_failed", error=str(exc))

        # Fallback: OpenAI → Groq → template
        if self._client is not None:
            return await self._generate_openai(req)
        if self._groq_client is not None:
            return await self._generate_llama(req)
        return self._generate_template(req)

    async def _generate_openai(self, req: ExplanationRequest) -> ExplanationResult:
        try:
            resp = await self._client.chat.completions.create(  # type: ignore[union-attr]
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": _system_prompt(req.language, req.level.value)},
                    {"role": "user",   "content": _user_prompt(req)},
                ],
                temperature=0.4,
                max_tokens=900,
                response_format={"type": "json_object"} if settings.OPENAI_MODEL.startswith("gpt-4") else None,
            )
            raw    = resp.choices[0].message.content or ""
            tokens = resp.usage.total_tokens if resp.usage else 0
            return self._build_result(raw, req, tokens)
        except Exception as exc:
            logger.warning("openai.completion_failed", error=str(exc))
            if self._groq_client is not None:
                return await self._generate_llama(req)
            return self._generate_template(req)

    async def _generate_llama(self, req: ExplanationRequest) -> ExplanationResult:
        try:
            resp = await self._groq_client.chat.completions.create(  # type: ignore[union-attr]
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": _system_prompt(req.language, req.level.value)},
                    {"role": "user",   "content": _user_prompt(req)},
                ],
                temperature=0.4,
                max_tokens=900,
            )
            raw    = resp.choices[0].message.content or ""
            tokens = resp.usage.total_tokens if resp.usage else 0
            return self._build_result(raw, req, tokens)
        except Exception as exc:
            logger.warning("groq.completion_failed", error=str(exc))
            return self._generate_template(req)

    def _build_result(self, raw: str, req: ExplanationRequest, tokens: int) -> ExplanationResult:
        steps = _parse_steps(raw)
        if steps:
            text_ml = " ".join(s["text"] for s in steps)
        else:
            # JSON failed — treat entire response as plain text, no structured steps
            text_ml = raw.strip()
            logger.warning("ai_explanation.json_parse_failed", raw_preview=raw[:200])
        return ExplanationResult(
            text_ml=text_ml, text_en=None, cached=False,
            tokens_used=tokens, steps=steps,
        )

    def _generate_template(self, req: ExplanationRequest) -> ExplanationResult:
        steps   = _template_steps(req)
        text_ml = " ".join(s["text"] for s in steps) if steps else "Play chess well."
        return ExplanationResult(
            text_ml=text_ml, text_en=None, cached=False,
            tokens_used=0, steps=steps,
        )


ai_explanation_service = AIExplanationService()
