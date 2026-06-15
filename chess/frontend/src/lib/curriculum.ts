/**
 * Chess Guru Mode — complete belt curriculum.
 * Progress is stored in localStorage under "cm_progress" so guests can learn
 * without an account. On login the frontend syncs with the backend.
 */

export type BeltId = "white" | "yellow" | "orange" | "green" | "blue" | "brown" | "black";
export type LessonType = "lesson" | "piece_trainer" | "tactic" | "game";

export interface Lesson {
  id: string;
  title: string;
  titleMl: string;
  description: string;
  descriptionMl: string;
  durationMin: number;
  xp: number;
  type: LessonType;
  href: string;
}

export interface BeltLevel {
  id: BeltId;
  label: string;
  labelMl: string;
  colorHex: string;
  bgClass: string;
  textClass: string;
  emoji: string;
  xpRequired: number;
  tagline: string;
  taglineMl: string;
  lessons: Lesson[];
  puzzleGoal: number;
  gameGoal: number;
}

export const BELTS: BeltLevel[] = [
  {
    id: "white",
    label: "White Belt",
    labelMl: "വൈറ്റ് ബെൽറ്റ്",
    colorHex: "#e5e7eb",
    bgClass: "bg-gray-200",
    textClass: "text-gray-900",
    emoji: "⬜",
    xpRequired: 0,
    tagline: "Learn the pieces and rules",
    taglineMl: "കരുക്കളും നിയമങ്ങളും പഠിക്കാം",
    puzzleGoal: 10,
    gameGoal: 3,
    lessons: [
      {
        id: "wb-board",
        title: "The Chessboard",
        titleMl: "ചെസ്സ് ബോർഡ്",
        description: "64 squares, files a–h, ranks 1–8, and how pieces are set up",
        descriptionMl: "64 കളങ്ങൾ, a–h ഫൈലുകൾ, 1–8 റാങ്കുകൾ, കരുക്കൾ ഇടുന്ന രീതി",
        durationMin: 5,
        xp: 30,
        type: "lesson",
        href: "/learn/board",
      },
      {
        id: "wb-pawn",
        title: "The Pawn",
        titleMl: "കാലാൾ",
        description: "Forward only, diagonal capture, two-square first move, promotion",
        descriptionMl: "മുന്നോട്ട് മാത്രം, കോണോട്ട് പിടിക്കൽ, ആദ്യ നീക്കത്തിൽ രണ്ട് കളം, പ്രമോഷൻ",
        durationMin: 5,
        xp: 30,
        type: "piece_trainer",
        href: "/learn/pieces?piece=pawn",
      },
      {
        id: "wb-knight",
        title: "The Knight",
        titleMl: "കുതിര",
        description: "L-shape move, the only piece that jumps over others",
        descriptionMl: "L ആകൃതിയിൽ നീക്കം, മറ്റ് കരുക്കൾക്ക് മുകളിലൂടെ ചാടാം",
        durationMin: 5,
        xp: 30,
        type: "piece_trainer",
        href: "/learn/pieces?piece=knight",
      },
      {
        id: "wb-bishop",
        title: "The Bishop",
        titleMl: "ആന",
        description: "Diagonals only, stays on its starting colour forever",
        descriptionMl: "കോണോട്ട് മാത്രം, ഒരേ നിറത്തിൽ എന്നും നിൽക്കുന്നു",
        durationMin: 5,
        xp: 30,
        type: "piece_trainer",
        href: "/learn/pieces?piece=bishop",
      },
      {
        id: "wb-rook",
        title: "The Rook",
        titleMl: "തേര്",
        description: "Straight lines — ranks and files, any number of squares",
        descriptionMl: "നേർരേഖ — ഏത് ദിശയിലും, എത്ര കളം വേണമെങ്കിലും",
        durationMin: 5,
        xp: 30,
        type: "piece_trainer",
        href: "/learn/pieces?piece=rook",
      },
      {
        id: "wb-queen",
        title: "The Queen",
        titleMl: "മന്ത്രി",
        description: "Rook + Bishop combined — the most powerful piece on the board",
        descriptionMl: "തേരും ആനയും ഒരുമിച്ച് — ബോർഡിലെ ഏറ്റവും ശക്തമായ കരു",
        durationMin: 5,
        xp: 30,
        type: "piece_trainer",
        href: "/learn/pieces?piece=queen",
      },
      {
        id: "wb-king",
        title: "The King",
        titleMl: "രാജാവ്",
        description: "One square any direction — protect the king or the game ends",
        descriptionMl: "ഏത് ദിശയിലും ഒരു കളം — രാജാവിനെ രക്ഷിക്കൂ, ഇല്ലെങ്കിൽ കളി തീരും",
        durationMin: 5,
        xp: 30,
        type: "piece_trainer",
        href: "/learn/pieces?piece=king",
      },
      {
        id: "wb-rules",
        title: "Check, Checkmate & Draw",
        titleMl: "ചെക്ക്, ചെക്ക്മേറ്റ്, ഡ്രോ",
        description: "How to win, how to draw, castling, and en passant",
        descriptionMl: "എങ്ങനെ ജയിക്കാം, എങ്ങനെ ഡ്രോ ആകും, കാസ്ലിംഗ്, ആൻ പസ്സൻ",
        durationMin: 8,
        xp: 40,
        type: "lesson",
        href: "/learn/rules",
      },
    ],
  },
  {
    id: "yellow",
    label: "Yellow Belt",
    labelMl: "യെല്ലോ ബെൽറ്റ്",
    colorHex: "#facc15",
    bgClass: "bg-yellow-400",
    textClass: "text-yellow-900",
    emoji: "🟡",
    xpRequired: 300,
    tagline: "Tactics — win material, see threats",
    taglineMl: "ടാക്റ്റിക്സ് — കരു നേടൂ, ഭീഷണി കാണൂ",
    puzzleGoal: 15,
    gameGoal: 5,
    lessons: [
      {
        id: "yb-values",
        title: "Piece Values",
        titleMl: "കരുക്കളുടെ മൂല്യം",
        description: "Pawn=1, Knight=3, Bishop=3, Rook=5, Queen=9 — when to trade",
        descriptionMl: "കാലാൾ=1, കുതിര=3, ആന=3, തേര്=5, മന്ത്രി=9 — എപ്പോൾ കൈമാറണം",
        durationMin: 5,
        xp: 30,
        type: "lesson",
        href: "/learn/values",
      },
      {
        id: "yb-fork",
        title: "The Fork",
        titleMl: "ഫോർക്ക്",
        description: "Attack two pieces at once — your opponent can only save one",
        descriptionMl: "ഒരേ സമയം രണ്ട് കരുക്കളെ ആക്രമിക്കൂ — ഒന്ന് മാത്രമേ രക്ഷിക്കാൻ പറ്റൂ",
        durationMin: 8,
        xp: 40,
        type: "tactic",
        href: "/learn/tactics?type=fork",
      },
      {
        id: "yb-pin",
        title: "The Pin",
        titleMl: "പിൻ",
        description: "Lock a piece in place — it can't move without exposing something bigger",
        descriptionMl: "ഒരു കരുവിനെ തടഞ്ഞ് നിർത്തൂ — നീങ്ങിയാൽ വലിയ കരു കൈ പോകും",
        durationMin: 8,
        xp: 40,
        type: "tactic",
        href: "/learn/tactics?type=pin",
      },
      {
        id: "yb-skewer",
        title: "The Skewer",
        titleMl: "സ്ക്യൂവർ",
        description: "Like a reverse pin — attack the big piece, win the smaller one behind it",
        descriptionMl: "പിന്നിലെ ചെറിയ കരു നേടാൻ വലിയ കരുവിനെ ആക്രമിക്കൂ",
        durationMin: 8,
        xp: 40,
        type: "tactic",
        href: "/learn/tactics?type=skewer",
      },
      {
        id: "yb-discovered",
        title: "Discovered Attack",
        titleMl: "ഡിസ്കവേർഡ് അറ്റാക്ക്",
        description: "Move one piece to reveal a hidden attack from the piece behind it",
        descriptionMl: "ഒരു കരു നീക്കി പിന്നിലെ കരുവിന്റെ മറഞ്ഞ ആക്രമണം വെളിപ്പെടുത്തൂ",
        durationMin: 8,
        xp: 40,
        type: "tactic",
        href: "/learn/tactics?type=discovered",
      },
    ],
  },
  {
    id: "orange",
    label: "Orange Belt",
    labelMl: "ഓറഞ്ച് ബെൽറ്റ്",
    colorHex: "#f97316",
    bgClass: "bg-orange-500",
    textClass: "text-white",
    emoji: "🟠",
    xpRequired: 700,
    tagline: "Opening principles — a strong start",
    taglineMl: "ഓപ്പണിംഗ് തത്ത്വങ്ങൾ — ശക്തമായ തുടക്കം",
    puzzleGoal: 20,
    gameGoal: 7,
    lessons: [
      {
        id: "ob-center",
        title: "Control the Center",
        titleMl: "കേന്ദ്രം നിയന്ത്രിക്കൂ",
        description: "Why e4, d4, e5, d5 matter — the battle for the center",
        descriptionMl: "e4, d4, e5, d5 എന്തിന് പ്രധാനം — കേന്ദ്ര യുദ്ധം",
        durationMin: 7,
        xp: 35,
        type: "lesson",
        href: "/learn/center",
      },
      {
        id: "ob-develop",
        title: "Develop Your Pieces",
        titleMl: "കരുക്കളെ ഡെവലപ്പ് ചെയ്യൂ",
        description: "Bring knights and bishops out early, don't move the same piece twice",
        descriptionMl: "ആദ്യം കുതിരയും ആനയും കൊണ്ടുവരൂ, ഒരേ കരു രണ്ടുതവണ നീക്കരുത്",
        durationMin: 7,
        xp: 35,
        type: "lesson",
        href: "/learn/development",
      },
      {
        id: "ob-castle",
        title: "Castle Early",
        titleMl: "നേരത്തേ കാസ്ൽ ചെയ്യൂ",
        description: "King safety — tuck your king behind pawns with castling",
        descriptionMl: "രാജ സുരക്ഷ — കാസ്ലിംഗ് ചെയ്ത് കാലാൾ മതിലിനു പിന്നിൽ ഇരുത്തൂ",
        durationMin: 7,
        xp: 35,
        type: "lesson",
        href: "/learn/castling",
      },
      {
        id: "ob-openings",
        title: "Your First Openings",
        titleMl: "ആദ്യ ഓപ്പണിംഗുകൾ",
        description: "Italian Game, London System, Sicilian — three beginner-friendly openings",
        descriptionMl: "ഇറ്റാലിയൻ ഗെയിം, ലണ്ടൻ സിസ്റ്റം, സിസിലിയൻ — മൂന്ന് ഓപ്പണിംഗുകൾ",
        durationMin: 10,
        xp: 50,
        type: "lesson",
        href: "/openings",
      },
    ],
  },
  {
    id: "green",
    label: "Green Belt",
    labelMl: "ഗ്രീൻ ബെൽറ്റ്",
    colorHex: "#22c55e",
    bgClass: "bg-green-500",
    textClass: "text-white",
    emoji: "🟢",
    xpRequired: 1300,
    tagline: "Middlegame — attack, defend, combine",
    taglineMl: "മിഡിൽ ഗെയിം — ആക്രമണം, പ്രതിരോധം, കോമ്പിനേഷൻ",
    puzzleGoal: 25,
    gameGoal: 10,
    lessons: [
      {
        id: "gb-combinations",
        title: "Tactical Combinations",
        titleMl: "ടാക്റ്റിക്കൽ കോമ്പിനേഷൻ",
        description: "Chain multiple tactics together to win decisively",
        descriptionMl: "ഒന്നിലധികം ടാക്റ്റിക്സ് ചേർത്ത് ഉറച്ച ജയം നേടൂ",
        durationMin: 10,
        xp: 50,
        type: "tactic",
        href: "/learn/combinations",
      },
      {
        id: "gb-sacrifice",
        title: "The Sacrifice",
        titleMl: "ബലിദാനം",
        description: "Give up material to get a winning position or checkmate",
        descriptionMl: "ജയകരമായ ഘടന നേടാൻ ഒരു കരു ബലി നൽകൂ",
        durationMin: 10,
        xp: 50,
        type: "tactic",
        href: "/learn/sacrifice",
      },
      {
        id: "gb-king-attack",
        title: "Attack the King",
        titleMl: "രാജാവിനെ ആക്രമിക്കൂ",
        description: "How to build a kingside attack and deliver checkmate",
        descriptionMl: "കിംഗ്സൈഡ് ആക്രമണം കെട്ടിപ്പടുക്കുന്ന വിധവും ചെക്ക്മേറ്റും",
        durationMin: 10,
        xp: 50,
        type: "lesson",
        href: "/learn/king-attack",
      },
      {
        id: "gb-weak-squares",
        title: "Weak Squares & Outposts",
        titleMl: "ദുർബ്ബല കളങ്ങൾ & ഔട്ട്പോസ്റ്റ്",
        description: "Find and use squares your opponent can't defend with pawns",
        descriptionMl: "എതിരാളിക്ക് കാലാൾ കൊണ്ട് കാക്കാൻ കഴിയാത്ത കളങ്ങൾ കണ്ടെത്തൂ",
        durationMin: 10,
        xp: 50,
        type: "lesson",
        href: "/learn/outposts",
      },
    ],
  },
  {
    id: "blue",
    label: "Blue Belt",
    labelMl: "ബ്ലൂ ബെൽറ്റ്",
    colorHex: "#3b82f6",
    bgClass: "bg-blue-500",
    textClass: "text-white",
    emoji: "🔵",
    xpRequired: 2300,
    tagline: "Endgame mastery — convert advantages",
    taglineMl: "എൻഡ്ഗെയിം — ലീഡ് ജയമാക്കൂ",
    puzzleGoal: 30,
    gameGoal: 15,
    lessons: [
      {
        id: "bb-king-pawn",
        title: "King & Pawn Endgame",
        titleMl: "രാജ-കാലാൾ അന്ത്യഘട്ടം",
        description: "The opposition, key squares, promoting your pawn",
        descriptionMl: "ഒപ്പോസിഷൻ, കീ കളങ്ങൾ, കാലാൾ പ്രമോഷൻ",
        durationMin: 12,
        xp: 60,
        type: "lesson",
        href: "/learn/king-pawn-endgame",
      },
      {
        id: "bb-rook-endgame",
        title: "Rook Endgame Basics",
        titleMl: "തേര് അന്ത്യഘട്ടം",
        description: "Lucena position, Philidor position, rook + king vs king",
        descriptionMl: "ലൂസേന, ഫിലിഡോർ പൊസിഷൻ, തേര്+രാജാവ് vs രാജാവ്",
        durationMin: 12,
        xp: 60,
        type: "lesson",
        href: "/learn/rook-endgame",
      },
      {
        id: "bb-checkmate-patterns",
        title: "Checkmate Patterns",
        titleMl: "ചെക്ക്മേറ്റ് പ്യാറ്റേണുകൾ",
        description: "Back rank mate, smothered mate, two-rook mate, and more",
        descriptionMl: "ബാക്ക് റാങ്ക് മേറ്റ്, സ്മദേർഡ് മേറ്റ്, ഡബ്ൾ രൂക്ക് മേറ്റ്",
        durationMin: 12,
        xp: 60,
        type: "tactic",
        href: "/learn/checkmate-patterns",
      },
    ],
  },
  {
    id: "brown",
    label: "Brown Belt",
    labelMl: "ബ്രൗൺ ബെൽറ്റ്",
    colorHex: "#92400e",
    bgClass: "bg-amber-800",
    textClass: "text-white",
    emoji: "🟤",
    xpRequired: 3800,
    tagline: "Strategy — pawn structure, piece plans",
    taglineMl: "തന്ത്രം — കാലാൾ ഘടന, കരു പ്ലാൻ",
    puzzleGoal: 40,
    gameGoal: 20,
    lessons: [
      {
        id: "brb-pawn-structure",
        title: "Pawn Structure",
        titleMl: "കാലാൾ ഘടന",
        description: "Isolated, doubled, passed pawns and how to exploit them",
        descriptionMl: "ഒറ്റ, ഇരട്ട, പാസ്ഡ് കാലാൾ — ഇവ ഉപയോഗിക്കുന്ന വിധം",
        durationMin: 15,
        xp: 70,
        type: "lesson",
        href: "/learn/pawn-structure",
      },
      {
        id: "brb-piece-activity",
        title: "Piece Activity",
        titleMl: "കരുക്കളുടെ ശക്തി",
        description: "Good bishops vs bad bishops, active rooks, knight vs bishop",
        descriptionMl: "നല്ല ആന vs ചീത്ത ആന, ആക്ടീവ് തേര്, കുതിര vs ആന",
        durationMin: 15,
        xp: 70,
        type: "lesson",
        href: "/learn/piece-activity",
      },
      {
        id: "brb-plans",
        title: "Finding a Plan",
        titleMl: "പ്ലാൻ കണ്ടെത്തൂ",
        description: "How to choose a plan when no tactic is available",
        descriptionMl: "ടാക്റ്റിക്സ് ഇല്ലാത്തപ്പോൾ സ്ട്രാറ്റജിക് പ്ലാൻ തിരഞ്ഞെടുക്കൂ",
        durationMin: 15,
        xp: 70,
        type: "lesson",
        href: "/learn/plans",
      },
    ],
  },
  {
    id: "black",
    label: "Black Belt",
    labelMl: "ബ്ലാക്ക് ബെൽറ്റ്",
    colorHex: "#1f2937",
    bgClass: "bg-gray-900",
    textClass: "text-white",
    emoji: "⬛",
    xpRequired: 6000,
    tagline: "Master level — calculation and intuition",
    taglineMl: "മാസ്റ്റർ ലെവൽ — കാൽക്കുലേഷൻ, ഇൻടൂഷൻ",
    puzzleGoal: 50,
    gameGoal: 30,
    lessons: [
      {
        id: "blb-calculation",
        title: "Deep Calculation",
        titleMl: "ആഴത്തിലുള്ള കണക്കുകൂട്ടൽ",
        description: "Visualise 5+ moves ahead, candidate moves, tree pruning",
        descriptionMl: "5+ നീക്കം മുന്നോട്ട് ചിന്തിക്കൂ, കാൻഡിഡേറ്റ് നീക്കങ്ങൾ",
        durationMin: 20,
        xp: 100,
        type: "lesson",
        href: "/learn/calculation",
      },
      {
        id: "blb-prophylaxis",
        title: "Prophylaxis",
        titleMl: "പ്രൊഫൈലാക്സിസ്",
        description: "Think like your opponent — prevent their plans before they start",
        descriptionMl: "എതിരാളിയുടെ മനസ്സ് വായിക്കൂ — പ്ലാൻ തടഞ്ഞ് നിർത്തൂ",
        durationMin: 20,
        xp: 100,
        type: "lesson",
        href: "/learn/prophylaxis",
      },
      {
        id: "blb-positional",
        title: "Positional Mastery",
        titleMl: "പൊസിഷണൽ ചെസ്സ്",
        description: "Accumulating small advantages, Zugzwang, long-term imbalances",
        descriptionMl: "ചെറിയ ലീഡ് കൂട്ടുക, സുഗ്സ്‌വ്വാങ്, ദീർഘകാല അസന്തുലനം",
        durationMin: 20,
        xp: 100,
        type: "lesson",
        href: "/learn/positional",
      },
    ],
  },
];

// ─── Progress helpers (localStorage) ───────────────────────────────────────

export interface Progress {
  xp: number;
  completedLessons: string[];   // lesson ids
  puzzlesSolved: Record<BeltId, number>;
  gamesPlayed: Record<BeltId, number>;
  beltsEarned: BeltId[];
  lastActiveDate: string;       // ISO date string
  streak: number;
  onboardingComplete: boolean;
}

const STORAGE_KEY = "cm_progress";

export function loadProgress(): Progress {
  if (typeof window === "undefined") return defaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch {}
  return defaultProgress();
}

export function saveProgress(p: Progress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function defaultProgress(): Progress {
  return {
    xp: 0,
    completedLessons: [],
    puzzlesSolved: emptyBeltRecord(0),
    gamesPlayed: emptyBeltRecord(0),
    beltsEarned: [],
    lastActiveDate: "",
    streak: 0,
    onboardingComplete: false,
  };
}

function emptyBeltRecord<T>(val: T): Record<BeltId, T> {
  return {
    white: val, yellow: val, orange: val,
    green: val, blue: val, brown: val, black: val,
  } as Record<BeltId, T>;
}

export function addXP(p: Progress, amount: number): Progress {
  const next = { ...p, xp: p.xp + amount };
  // Check belt awards
  for (const belt of BELTS) {
    if (next.xp >= belt.xpRequired && !next.beltsEarned.includes(belt.id)) {
      next.beltsEarned = [...next.beltsEarned, belt.id];
    }
  }
  return next;
}

export function completeLesson(p: Progress, lessonId: string, xp: number): Progress {
  if (p.completedLessons.includes(lessonId)) return p;
  return addXP({ ...p, completedLessons: [...p.completedLessons, lessonId] }, xp);
}

export function currentBelt(p: Progress): BeltLevel {
  // Highest belt the user has earned; default white.
  const earned = BELTS.filter((b) => p.beltsEarned.includes(b.id));
  return earned.length > 0 ? earned[earned.length - 1] : BELTS[0];
}

export function nextBelt(p: Progress): BeltLevel | null {
  const cur = currentBelt(p);
  const idx = BELTS.findIndex((b) => b.id === cur.id);
  return idx < BELTS.length - 1 ? BELTS[idx + 1] : null;
}

export function xpToNextBelt(p: Progress): { needed: number; current: number; pct: number } {
  const next = nextBelt(p);
  if (!next) return { needed: 0, current: 0, pct: 100 };
  const cur = currentBelt(p);
  const range = next.xpRequired - cur.xpRequired;
  const earned = p.xp - cur.xpRequired;
  return {
    needed: next.xpRequired,
    current: p.xp,
    pct: Math.min(100, Math.round((earned / range) * 100)),
  };
}

export function updateStreak(p: Progress): Progress {
  const today = new Date().toISOString().slice(0, 10);
  if (p.lastActiveDate === today) return p;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = p.lastActiveDate === yesterday ? p.streak + 1 : 1;
  return { ...p, streak, lastActiveDate: today };
}

// Daily mission: lesson + 3 puzzles + 1 game → completed when all 3 done today
export interface DailyMission {
  lessonDone: boolean;
  puzzlesDone: boolean;
  gameDone: boolean;
  complete: boolean;
}

export function getDailyMission(p: Progress): DailyMission {
  // Very simple: if streak updated today, assume mission partially done via XP tracking.
  // In Phase 2 this will be server-side.
  const today = new Date().toISOString().slice(0, 10);
  const active = p.lastActiveDate === today;
  const belt = currentBelt(p).id;
  return {
    lessonDone: active && (p.completedLessons.length > 0),
    puzzlesDone: active && (p.puzzlesSolved[belt] > 0),
    gameDone: active && (p.gamesPlayed[belt] > 0),
    complete: active && p.streak > 0,
  };
}
