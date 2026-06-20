/**
 * Typed API client for the CheckMate backend.
 * Token is read from the auth store (localStorage-backed) on each request.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("cm_access_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ---- Tournament types ---------------------------------------------------

export interface TournamentOut {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  format: string;
  status: string;
  organiser_id: number;
  organiser_name: string | null;
  time_control: string;
  max_players: number;
  rounds_total: number | null;
  current_round: number;
  entry_fee_inr: number;
  prize_pool_inr: number;
  invite_token: string;
  is_public: boolean;
  starts_at: string | null;
  participant_count: number;
  created_at: string;
}

export interface ParticipantOut {
  user_id: number;
  user_name: string | null;
  rating_at_entry: number;
  points: number;
  buchholz: number;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  final_rank: number | null;
  status: string;
}

export interface PairingOut {
  id: number;
  board_number: number;
  white_id: number;
  white_name: string | null;
  black_id: number | null;
  black_name: string | null;
  result: string;
  game_id: number | null;
}

export interface RoundOut {
  id: number;
  number: number;
  started_at: string | null;
  completed_at: string | null;
  pairings: PairingOut[];
}

export interface TournamentDetail extends TournamentOut {
  participants: ParticipantOut[];
  rounds: RoundOut[];
}

export interface LiveGameOut {
  id: number;
  tournament_id: number | null;
  white_id: number;
  white_name: string | null;
  white_rating: number | null;
  black_id: number;
  black_name: string | null;
  black_rating: number | null;
  time_control: string;
  status: string;
  result: string | null;
  termination: string | null;
  current_fen: string;
  white_time_ms: number;
  black_time_ms: number;
  started_at: string | null;
  ended_at: string | null;
  move_count: number;
  moves?: { uci: string; san: string; fen_after: string; white_time_ms: number; black_time_ms: number }[];
}

export interface PlayerRatingOut {
  user_id: number;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  peak_rating: number;
}

export interface TournamentCreateBody {
  name: string;
  description?: string;
  format: string;
  time_control: string;
  max_players: number;
  rounds_total?: number;
  entry_fee_inr: number;
  is_public: boolean;
  starts_at?: string;
}

// ---- Types --------------------------------------------------------------

export interface EvaluateResponse {
  fen: string;
  score_pawns: number;
  score_cp: number;
  mate: number | null;
  best_move_uci: string | null;
  best_move_san: string | null;
  pv: string[];
}

export interface ChecklistItem {
  text_ml: string;
  ok: boolean;
}

export interface ExplanationStep {
  text_ml: string;
  arrows:  string[][];   // [[from_sq, to_sq, color], ...]
  squares: string[][];   // [[sq, color], ...]
  label?:  string;       // move | tactic | threat | strategy | plan | warning
}

export interface MoveAnalysisResponse {
  move_san: string;
  best_move_san: string | null;
  eval_before: number;
  eval_after: number;
  centipawn_loss: number;
  classification: string;
  explanation_ml: string | null;
  explanation_steps: ExplanationStep[];
  best_move_reason_ml: string | null;
  threats: string[];
  checklist: ChecklistItem[];
}

export interface ExplainResponse {
  text_ml: string;
  text_en: string | null;
  cached: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PuzzleOut {
  id: number;
  fen: string;
  rating: number;
  themes: string[];
  is_daily: boolean;
  solver_move_count: number;
}

export interface PuzzleSolveResponse {
  correct: boolean;
  new_rating: number;
  streak: number;
}

export interface HintOut {
  step: number;
  move: string;
  pros: string;
  cons: string;
  hints_used_today: number;
  hints_remaining_today: number | null;
}

export interface CheckMoveResponse {
  correct: boolean;
  opponent_reply: string | null;
  is_last: boolean;
}

// ---- Endpoints ----------------------------------------------------------

export const api = {
  health: () =>
    request<{ status: string; engine_available: boolean; ai_enabled: boolean }>(
      "/health"
    ),

  register: (email: string, password: string, full_name?: string) =>
    request<TokenPair>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    request<TokenPair>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  evaluate: (fen: string, depth?: number) =>
    request<EvaluateResponse>("/analysis/evaluate", {
      method: "POST",
      body: JSON.stringify({ fen, depth }),
    }),

  bestMove: (fen: string, skill_level = 20) =>
    request<{ best_move_uci: string | null }>("/analysis/best-move", {
      method: "POST",
      body: JSON.stringify({ fen, skill_level }),
    }),

  analyzeMove: (
    fen: string,
    move_uci: string,
    level = "beginner",
    language = "en",
    opponent_move_uci?: string | null,
    opponent_fen?: string | null,
    context_move_by: "ai" | "player" = "ai",
  ) =>
    request<MoveAnalysisResponse>("/analysis/move", {
      method: "POST",
      body: JSON.stringify({
        fen, move_uci, level, language, context_move_by,
        ...(opponent_move_uci ? { opponent_move_uci } : {}),
        ...(opponent_fen      ? { opponent_fen }      : {}),
      }),
    }),

  explain: (fen: string, move_uci?: string, level = "beginner", language = "en") =>
    request<ExplainResponse>("/analysis/explain", {
      method: "POST",
      body: JSON.stringify({ fen, move_uci, level, language }),
    }),

  pricing: () =>
    request<{
      currency: string;
      monthly_inr: number;
      yearly_inr: number;
      features: { name_ml: string; free: boolean; pro: boolean }[];
    }>("/subscriptions/pricing"),

  leaderboard: (scope = "kerala") =>
    request<
      { rank: number; user_id: number; name: string; puzzle_rating: number; streak: number }[]
    >(`/leaderboard?scope=${scope}`),

  openings: () =>
    request<
      { id: number; name: string; slug: string; eco: string | null; difficulty: number }[]
    >("/openings"),

  // ---- Tournaments -------------------------------------------------------

  listTournaments: () =>
    request<TournamentOut[]>("/tournaments"),

  createTournament: (body: TournamentCreateBody) =>
    request<TournamentOut>("/tournaments", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getTournament: (id: number) =>
    request<TournamentDetail>(`/tournaments/${id}`),

  joinByToken: (token: string) =>
    request<{ tournament_id: number; slug: string }>(`/tournaments/join/${token}`),

  previewByToken: (token: string) =>
    request<TournamentOut>(`/tournaments/join/${token}/preview`),

  openRegistration: (id: number) =>
    request<{ status: string }>(`/tournaments/${id}/open-registration`, { method: "POST" }),

  startTournament: (id: number) =>
    request<{ status: string; current_round: number }>(`/tournaments/${id}/start`, { method: "POST" }),

  tournamentStandings: (id: number) =>
    request<ParticipantOut[]>(`/tournaments/${id}/standings`),

  tournamentGames: (id: number) =>
    request<LiveGameOut[]>(`/tournaments/${id}/games`),

  getGame: (gameId: number) =>
    request<LiveGameOut>(`/tournaments/games/${gameId}`),

  myRating: () =>
    request<PlayerRatingOut>("/tournaments/ratings/me"),

  // ---- Puzzles -------------------------------------------------------------

  dailyPuzzle: () => request<PuzzleOut>("/puzzles/daily"),

  randomPuzzle: (theme?: string) =>
    request<PuzzleOut>(`/puzzles/random${theme ? `?theme=${theme}` : ""}`),

  nextPuzzle: (theme?: string) =>
    request<PuzzleOut>(`/puzzles/next${theme ? `?theme=${theme}` : ""}`),

  puzzleHint: (puzzleId: number, step: number) =>
    request<HintOut>(`/puzzles/${puzzleId}/hint?step=${step}`),

  checkPuzzleMove: (puzzleId: number, step: number, move: string) =>
    request<CheckMoveResponse>(`/puzzles/${puzzleId}/check`, {
      method: "POST",
      body: JSON.stringify({ step, move }),
    }),

  solvePuzzle: (puzzleId: number, moves: string[]) =>
    request<PuzzleSolveResponse>("/puzzles/solve", {
      method: "POST",
      body: JSON.stringify({ puzzle_id: puzzleId, moves }),
    }),

  // ---- Candidate moves -------------------------------------------------------

  candidateMoves: (fen: string, language = "en", level = "guru") =>
    request<{
      opening_name: string | null;
      opening_tip: string | null;
      candidates: {
        move_san: string;
        move_uci: string;
        name: string;
        short_reason: string;
        pros: string[];
        cons: string[];
        style: "aggressive" | "solid" | "creative";
      }[];
    }>("/analysis/candidates", {
      method: "POST",
      body: JSON.stringify({ fen, language, level }),
    }),

  // ---- Auth / profile -------------------------------------------------------

  me: () =>
    request<{ id: number; email: string; full_name: string | null; plan: string; rating: number }>("/auth/me"),

  updateProfile: (full_name: string) =>
    request<{ id: number; email: string; full_name: string | null }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ full_name }),
    }),

  changePassword: (current_password: string, new_password: string) =>
    request<void>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
};
