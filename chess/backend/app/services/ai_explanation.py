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

CLASSIFICATION_EN = {
    "best": "best move", "excellent": "excellent move", "good": "good move",
    "inaccuracy": "inaccuracy", "mistake": "mistake", "blunder": "blunder",
}

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
   Actions: push, capture, move, attack, threaten, check, checkmate, castle, develop, control, protect, fork, pin
   Squares: e4, d5, f3, c5 etc.
   Words: center, advantage, opponent, safe, best, position

CORRECT examples (copy this style):
  "നിങ്ങളുടെ Pawn c7-ൽ നിന്ന് c5-ലേക്ക് push ചെയ്തു."
  "ഇത് ഇപ്പോൾ opponent-ന്റെ Knight-നെ threaten ചെയ്യുന്നു."
  "Center control ഉണ്ടാകുന്നു — ഇത് നിങ്ങൾക്ക് വലിയ advantage ആണ്."
  "ഇനി Knight develop ചെയ്യൂ — position strong ആകും."

WRONG (never do this):
  "നിങ്ങളുടെ പ്യാദ..." ← WRONG, use "Pawn"
  "...ആക്രമിക്കുന്നു" ← WRONG, use "attack ചെയ്യുന്നു"
  "...നൈറ്റ്..." ← WRONG, use "Knight"

Generate exactly 4 steps. Each step has one short sentence + board arrows/squares.

JSON format:
[
  {"text": "Malayalam sentence with English piece names.", "arrows": [["from","to","color"]], "squares": [["sq","color"]]},
  ...
]

Colors: green=good move, red=threat/attack, purple=key square, yellow=watch, blue=protected, orange=opponent trouble
Squares: a1–h8 only. Output ONLY the JSON array."""

_GURU_SYSTEM_ML = f"""\
You are a friendly Malayalam chess coach. Explain the move to a beginner child.

OUTPUT ONLY a valid JSON array — NO markdown, NO text outside the JSON.

{_ML_STYLE}

CORRECT examples:
  "നിങ്ങളുടെ Knight e2-ൽ നിന്ന് f4-ലേക്ക് move ചെയ്തു."
  "ഇത് opponent-ന്റെ Pawn-നെ attack ചെയ്യുന്നു."
  "ഇനി Rook develop ചെയ്യൂ — safe ആകും."

WRONG: "...നൈറ്റ്...", "...പ്യാദ...", "...ആക്രമിക്കുന്നു...", "...നീക്കി..."

Generate exactly 4 steps. Each step = 1 short sentence + board annotation.

REQUIRED JSON format:
[
  {{
    "text": "ഒരു ചെറിയ Malayalam വാക്യം — കുട്ടിക്ക് മനസ്സിലാകുന്ന ഭാഷ.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

ALLOWED COLORS: green (നിങ്ങളുടെ move / നല്ലത്), red (അപകടം / threaten), purple (പ്രധാന square), yellow (ശ്രദ്ധിക്കൂ), blue (protected), orange (opponent-ന്റെ കഷ്ടം)
VALID SQUARES: a1-h8 only. Never invent squares.

STEP GUIDE:
  Step 1 – ഏത് piece ഏത് square-ൽ നിന്ന് ഏത് square-ലേക്ക് move ചെയ്തു? Green arrow.
  Step 2 – ഇപ്പോൾ ഇത് എന്ത് threaten ചെയ്യുന്നു? Red arrow.
  Step 3 – ഇത് എന്ത് protect ചെയ്യുന്നു / control ചെയ്യുന്നു? Purple/blue.
  Step 4 – ഇനി നിങ്ങൾ എന്ത് ചെയ്യണം? Yellow squares.

RULES:
  • Every step MUST have ≥1 arrow OR ≥1 square.
  • Each step is MAX 1–2 sentences.
  • Output ONLY the JSON array — nothing else.
"""

_GURU_SYSTEM_EN = """\
You are a friendly chess teacher explaining a move to a complete beginner (like a 6-year-old).

OUTPUT ONLY a valid JSON array — NO markdown, NO text outside the JSON.

Generate exactly 4 steps. Use the SIMPLEST possible words. Avoid ALL chess jargon.

REQUIRED JSON format:
[
  {{
    "text": "1 sentence in LANG — very simple, like talking to a child.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

ALLOWED COLORS: green (your piece moving / good), red (danger / threat), purple (important square), yellow (watch this), blue (safe / protected), orange (opponent piece in trouble)
VALID SQUARES: a1-h8 only.

STEP GUIDE:
  Step 1 – The piece moved from [sq] to [sq]. Green arrow.
  Step 2 – Now it threatens [something]. Red arrow.
  Step 3 – It protects / controls [the middle]. Purple/blue.
  Step 4 – Your best move now is [simple suggestion]. Yellow squares.

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
  "ഇത് opponent-ന്റെ Knight-നെ threaten ചെയ്യുന്നു."
  "Center control ഉണ്ടാകുന്നു — ഇത് വലിയ advantage ആണ്."
  "ഇനി Knight develop ചെയ്യൂ — position strong ആകും."
  "Queen e5-ൽ move ചെയ്ത് check കൊടുക്കാൻ പറ്റും."

WRONG (never generate):
  "...പ്യാദ..." ← use "Pawn"
  "...നൈറ്റ്..." ← use "Knight"
  "...ആക്രമിക്കുന്നു..." ← use "attack ചെയ്യുന്നു"
  "...നീക്കി..." ← use "move ചെയ്തു"
  "...ഭീഷണിയുണ്ട്..." ← use "threaten ചെയ്യുന്നു"

Generate exactly 4-5 steps. Each step covers ONE angle of the move with board annotations.

REQUIRED JSON format:
[
  {{
    "text": "1-2 Malayalam sentences — natural, like a real coach speaking.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

ALLOWED COLORS:
  green  = നിങ്ങളുടെ main move, development, നല്ലത്
  red    = threaten / attack line
  purple = strategic square, key control point
  yellow = ശ്രദ്ധ വേണം, mixed
  blue   = safely protected piece or square
  orange = opponent-ന്റെ piece കഷ്ടത്തിൽ

VALID SQUARES: a1-h8 only. Never invent squares.

STEP GUIDE:
  Step 1 – ഏത് piece, എവിടെ നിന്ന്, എവിടേക്ക് move? Green arrow.
  Step 2 – ഇപ്പോൾ എന്ത് threaten ചെയ്യുന്നു? Red arrows.
  Step 3 – എന്ത് control / protect ചെയ്യുന്നു? Purple/blue.
  Step 4 – Strategy: develop, center control, King safety — show it.
  Step 5 (optional) – Opponent-ന് ഇനി best move എന്താണ്?

RULES:
  • Every step MUST have ≥1 arrow OR ≥1 square.
  • Do NOT invent squares that are not on the board.
  • {depth_note}
  • Output ONLY the JSON array — nothing else."""

    return f"""You are a world-class chess coach. Explain the given move visually to a student.

OUTPUT ONLY a valid JSON array — NO markdown fences, NO text outside the JSON.

Generate exactly 4-5 steps. Each step covers ONE angle of the move and specifies \
what to draw on the chessboard so the student sees it visually.

REQUIRED JSON format:
[
  {{
    "text": "1-2 sentences in {name}.",
    "arrows": [["from_sq", "to_sq", "color"]],
    "squares": [["sq", "color"]]
  }}
]

ALLOWED COLORS:
  green  = main move, development, good square for you
  red    = threat to opponent, danger, attack line
  purple = strategic control, outpost, key square
  yellow = attention needed, mixed implication
  blue   = safely defended piece or square
  orange = opponent piece under pressure, alternative

VALID SQUARES: a1-h8 only (e.g. e4, d5, g1, f3). Never invent squares.

STEP GUIDE:
  Step 1 – The move: piece name, from→to, capture or not. Arrow in green for the move.
  Step 2 – Threat / attack: what does this move NOW threaten? Red arrows to the target.
  Step 3 – Control / defense: squares now controlled or piece now defended. Purple/blue.
  Step 4 – Strategic idea: development, center, king safety, tempo, pin, fork — show it.
  Step 5 (optional) – What the opponent must watch out for or their best reply.

RULES:
  • Every step MUST have ≥1 arrow OR ≥1 square.
  • Do NOT invent squares that are not on the board.
  • {depth_note}
  • Output ONLY the JSON array — nothing else."""


def _user_prompt(req: ExplanationRequest) -> str:
    board = chess.Board(req.fen)
    parts = [f"FEN: {req.fen}"]
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
            # push and inspect
            board.push(move)
            if board.is_check():
                parts.append(f"Effect: gives CHECK to king on {chess.square_name(board.king(board.turn))}")
            # pieces attacked from new square
            attacks = [chess.square_name(s) for s in board.attacks(move.to_square)
                       if board.piece_at(s) and board.piece_at(s).color != (not board.turn)]
            if attacks:
                parts.append(f"Attacks opponent pieces on: {', '.join(attacks[:4])}")
            # squares controlled in center
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

        validated.append({"text": text_val, "arrows": arrows, "squares": squares})

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

    # Step 1 – The move
    if is_cap:
        cap = board.piece_at(move.to_square)
        cap_name = _PIECE_EN.get(cap.piece_type, "piece") if cap else "piece"
        text1 = f"The {pname} captures the {cap_name} on {to_sq}, winning material."
    else:
        text1 = f"The {pname} moves from {from_sq} to {to_sq}."
    steps.append({
        "text": text1,
        "arrows": [[from_sq, to_sq, "green"]],
        "squares": [[to_sq, "green"]],
    })

    board.push(move)

    # Step 2 – Check or attacks
    if board.is_check():
        king_sq = chess.square_name(board.king(board.turn))
        steps.append({
            "text": f"This move gives check! The opponent's king on {king_sq} must move.",
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
                "text": f"This move now attacks opponent pieces on {', '.join(chess.square_name(s) for s in targets)}.",
                "arrows": [[to_sq, chess.square_name(s), "red"] for s in targets],
                "squares": [[chess.square_name(s), "red"] for s in targets],
            })

    # Step 3 – Center / key squares controlled
    center = [chess.E4, chess.D4, chess.E5, chess.D5]
    ctrl   = [s for s in board.attacks(move.to_square) if s in center]
    if ctrl:
        cnames = [chess.square_name(s) for s in ctrl]
        steps.append({
            "text": f"From {to_sq}, the {pname} controls center squares: {', '.join(cnames)}.",
            "arrows": [[to_sq, chess.square_name(s), "purple"] for s in ctrl[:2]],
            "squares": [[chess.square_name(s), "purple"] for s in ctrl],
        })
    elif move.to_square in center:
        steps.append({
            "text": f"The {pname} now occupies {to_sq}, a central square giving strong control.",
            "arrows": [[from_sq, to_sq, "purple"]],
            "squares": [[to_sq, "purple"]],
        })

    # Step 4 – Evaluation summary
    if req.eval_after is not None:
        if req.eval_after > 0.5:
            steps.append({
                "text": f"After this move White has a better position (+{req.eval_after:.1f}). Keep developing!",
                "arrows": [[from_sq, to_sq, "green"]],
                "squares": [[to_sq, "green"]],
            })
        elif req.eval_after < -0.5:
            steps.append({
                "text": f"After this move Black is slightly better ({req.eval_after:.1f}). Look for active play.",
                "arrows": [[from_sq, to_sq, "blue"]],
                "squares": [[to_sq, "blue"]],
            })

    return steps[:5] or [{"text": "Develop your pieces and keep your king safe.",
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
            "lang": req.language, "v": 7,   # v7: Groq primary for Malayalam (no GPU, Ollama CPU too slow)
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
