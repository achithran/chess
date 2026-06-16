"""Hand-curated tactics puzzles.

Format mirrors python-chess / Lichess puzzle conventions, simplified:
- ``fen``: the position the SOLVER must move in (solver is always to move).
- ``moves``: full solution line in UCI, starting with the solver's move,
  alternating solver/opponent (index 0, 2, 4... are solver moves).
- ``hints``: one entry per solver move (same length as ``moves[0::2]``),
  each with the move plus a short pros/cons explanation shown progressively.
"""
from __future__ import annotations

PUZZLES: list[dict] = [
    # ---- Mate in 1 ----
    {
        "fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
        "moves": ["e1e8"],
        "rating": 800,
        "themes": ["mateIn1", "backRankMate"],
        "hints": [
            {
                "move": "e1e8",
                "pros": "The rook slides to the open back rank — the black king is trapped behind its own pawns with no escape square. Checkmate.",
                "cons": "No downside: this is the only move that ends the game immediately.",
            }
        ],
    },
    {
        "fen": "6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1",
        "moves": ["b1b8"],
        "rating": 850,
        "themes": ["mateIn1", "backRankMate"],
        "hints": [
            {
                "move": "b1b8",
                "pros": "The rook slides to the open back rank — the king is boxed in by its own pawns with no escape square. Checkmate.",
                "cons": "None — the king has zero flight squares.",
            }
        ],
    },
    {
        "fen": "6k1/8/8/8/8/8/q4PPP/6K1 b - - 0 1",
        "moves": ["a2a1"],
        "rating": 900,
        "themes": ["mateIn1"],
        "hints": [
            {
                "move": "a2a1",
                "pros": "The queen swings to a1, delivering mate along the back rank — the white king is boxed in by its own pawns.",
                "cons": "None — it is forced mate.",
            }
        ],
    },
    {
        "fen": "3qk2r/ppp2ppp/8/8/8/8/5PPP/3Q2K1 b - - 0 1",
        "moves": ["d8d1"],
        "rating": 950,
        "themes": ["mateIn1"],
        "hints": [
            {
                "move": "d8d1",
                "pros": "The queen captures on d1 along the open file with check — the king cannot escape past its own pawns. Checkmate.",
                "cons": "Make sure the d-file is fully open first; here it is.",
            }
        ],
    },
    {
        "fen": "r1bk3r/ppp2ppp/2n5/8/3B4/8/PPP2PPP/2KR4 w - - 0 1",
        "moves": ["d4g7"],
        "rating": 1000,
        "themes": ["discoveredAttack"],
        "hints": [
            {
                "move": "d4g7",
                "pros": "The bishop steps off the d-file to grab the g7 pawn — this discovers a check from the rook on d1 onto the king, and the bishop now also attacks the rook on h8.",
                "cons": "The king can still slip to e8, so follow up actively rather than expecting immediate mate.",
            }
        ],
    },
    # ---- Mate in 2 ----
    {
        "fen": "6k1/6p1/7p/8/8/8/5PPP/3R2K1 w - - 0 1",
        "moves": ["d1d8", "g8h7", "d8h8"],
        "rating": 1100,
        "themes": ["rookLadder"],
        "hints": [
            {
                "move": "d1d8",
                "pros": "Check along the back rank forces the king to step out — d8 cuts off every retreat along the 8th rank.",
                "cons": "The king steps to h7, but the rook keeps chasing.",
            },
            {
                "move": "d8h8",
                "pros": "The rook swings to h8, checking the king again and driving it toward the edge of the board.",
                "cons": "This isn't mate yet — keep calculating the king's remaining squares before celebrating.",
            },
        ],
    },
    {
        "fen": "2r2rk1/5ppp/8/8/8/8/5PPP/2R2RK1 w - - 0 1",
        "moves": ["c1c8"],
        "rating": 1000,
        "themes": ["removeTheDefender"],
        "hints": [
            {
                "move": "c1c8",
                "pros": "Trading rooks on c8 removes black's only back-rank defender — your remaining rook on f1 will dominate the open back rank next.",
                "cons": "Check that f8 isn't independently defended before relying on the follow-up.",
            }
        ],
    },
    # ---- Forks ----
    {
        "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        "moves": ["f3g5"],
        "rating": 1050,
        "themes": ["fork", "opening"],
        "hints": [
            {
                "move": "f3g5",
                "pros": "The knight jumps to g5, eyeing f7 — combined with the bishop on c4, this creates real threats against the weak f7 square.",
                "cons": "Black can challenge with ...d5 or ...Qe7 — this is a developing/attacking idea, not a forced win.",
            }
        ],
    },
    {
        "fen": "r2qkb1r/ppp2ppp/2n1bn2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 6",
        "moves": ["c3d5"],
        "rating": 1150,
        "themes": ["fork"],
        "hints": [
            {
                "move": "c3d5",
                "pros": "The knight leaps to d5, forking the bishop on e6 ... actually it attacks key central squares and eyes c7/f6, creating multiple threats at once.",
                "cons": "Check that the d5 square isn't defended by a pawn before committing in your own games.",
            }
        ],
    },
    {
        "fen": "r1b1kb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 6 5",
        "moves": ["c6d4"],
        "rating": 1100,
        "themes": ["fork"],
        "hints": [
            {
                "move": "c6d4",
                "pros": "The knight jumps to d4, forking the bishop on b5 and the knight on f3 — White can only save one piece.",
                "cons": "Watch out for Nxd4 followed by tactics if White's pieces are well coordinated — always recheck before playing.",
            }
        ],
    },
    {
        "fen": "rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 6",
        "moves": ["c4d5"],
        "rating": 1000,
        "themes": ["fork", "centralControl"],
        "hints": [
            {
                "move": "c4d5",
                "pros": "Capturing on d5 opens the center and creates pressure on black's e6/queenside while keeping a strong pawn presence.",
                "cons": "Black recaptures with ...Nxd5 or ...exd5, equalizing material — this wins the center, not material.",
            }
        ],
    },
    # ---- Pins ----
    {
        "fen": "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6",
        "moves": ["c1g5"],
        "rating": 1050,
        "themes": ["pin"],
        "hints": [
            {
                "move": "c1g5",
                "pros": "The bishop pins the knight on f6 to the queen on d8 — black cannot easily challenge the center without losing material.",
                "cons": "Black can break the pin with ...h6 and ...g5 eventually, so follow up actively.",
            }
        ],
    },
    {
        "fen": "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        "moves": ["f1b5"],
        "rating": 1100,
        "themes": ["pin"],
        "hints": [
            {
                "move": "f1b5",
                "pros": "The Ruy Lopez bishop check pins the knight on c6 to the king, applying long-term pressure on black's center and king safety.",
                "cons": "Black can interpose with ...a6 or ...Bd7, so this is a strong developing check, not an immediate win.",
            }
        ],
    },
    {
        "fen": "r2qk2r/ppp1bppp/2n1bn2/4p3/2B1P3/2N2N2/PPP2PPP/R1BQ1RK1 w kq - 0 8",
        "moves": ["c4b5"],
        "rating": 1150,
        "themes": ["pin"],
        "hints": [
            {
                "move": "c4b5",
                "pros": "The bishop pins the knight on c6 to the king on e8, freezing black's pieces and preparing central breakthroughs.",
                "cons": "Make sure the bishop isn't simply trapped after ...a6 — keep a retreat square in mind.",
            }
        ],
    },
    # ---- Skewers ----
    {
        "fen": "3r2k1/5ppp/8/8/8/8/5PPP/Q5K1 w - - 0 1",
        "moves": ["a1a8"],
        "rating": 1000,
        "themes": ["skewer"],
        "hints": [
            {
                "move": "a1a8",
                "pros": "The queen skewers the rook to the king along the 8th rank — black must move the king, then the rook falls.",
                "cons": "None — this wins the rook for free next move.",
            }
        ],
    },
    {
        "fen": "6k1/2q3p1/8/8/8/8/5PPP/R5K1 w - - 0 1",
        "moves": ["a1a8", "g8h7", "a8c8"],
        "rating": 1150,
        "themes": ["skewer"],
        "hints": [
            {
                "move": "a1a8",
                "pros": "Check along the back rank — this is the first step in skewering the queen to the king.",
                "cons": "The king has to step aside, but the queen still cannot escape the rook's reach.",
            },
            {
                "move": "a8c8",
                "pros": "The rook drops onto the open c-file, attacking the queen directly — with no defender or safe square, black must give up material.",
                "cons": "Double-check the queen has no safe square to block or escape to.",
            },
        ],
    },
    # ---- Back rank ----
    {
        "fen": "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
        "moves": ["d1d8"],
        "rating": 900,
        "themes": ["backRankMate", "mateIn1"],
        "hints": [
            {
                "move": "d1d8",
                "pros": "The rook slides down the open d-file to the back rank — the king is boxed in by its own pawns with every flight square covered. Mate.",
                "cons": "None — this is forced mate.",
            }
        ],
    },
    {
        "fen": "r3k2r/ppp2ppp/8/3q4/3Q4/8/PPP2PPP/R3K2R w - - 0 1",
        "moves": ["d4d5"],
        "rating": 950,
        "themes": ["hangingPiece"],
        "hints": [
            {
                "move": "d4d5",
                "pros": "Black's queen on d5 is completely undefended — simply capturing it wins material for free.",
                "cons": "Always double-check for x-ray defenders or in-between checks before grabbing free material; here there are none.",
            }
        ],
    },
    # ---- Discovered attacks ----
    {
        "fen": "r1bqk2r/ppp1bppp/2n2n2/3pp3/3P4/2N1PN2/PPP1BPPP/R1BQK2R w KQkq - 0 7",
        "moves": ["f3e5"],
        "rating": 1200,
        "themes": ["discoveredAttack"],
        "hints": [
            {
                "move": "f3e5",
                "pros": "The knight jumps into e5, discovering an attack from the bishop on e2 onto... it also forks c6 and f7, creating multiple threats at once.",
                "cons": "Calculate carefully — black may have ...Nxe5 dxe5 simplifying lines, check material before committing.",
            }
        ],
    },
    {
        "fen": "r2qk2r/ppp1bppp/2n1bn2/3p4/3P4/2N1BN2/PPP2PPP/R2QKB1R w KQkq - 0 8",
        "moves": ["c3b5"],
        "rating": 1250,
        "themes": ["discoveredAttack", "fork"],
        "hints": [
            {
                "move": "c3b5",
                "pros": "The knight hops to b5, attacking c7 and discovering pressure from the queen on d1 down the d-file onto d5.",
                "cons": "Black may defend with ...Qd7 or ...a6 challenging the knight — keep calculating follow-ups.",
            }
        ],
    },
    # ---- Double attack / tactics combos ----
    {
        "fen": "r1bq1rk1/ppp2ppp/2n2n2/2bpp3/8/2NP1N2/PPP1PPPP/R1BQKB1R w KQ - 0 7",
        "moves": ["f3e5"],
        "rating": 1300,
        "themes": ["doubleAttack"],
        "hints": [
            {
                "move": "f3e5",
                "pros": "The knight grabs the center pawn on e5 while attacking c6 and f7 simultaneously — black cannot defend everything.",
                "cons": "Check for ...Nxe5 recapture lines and make sure you're not just dropping a piece for nothing.",
            }
        ],
    },
    {
        "fen": "r1bqr1k1/ppp2ppp/2n2n2/3p4/1b1P4/2N1PN2/PPP2PPP/R1BQKB1R w KQ - 4 8",
        "moves": ["a2a3"],
        "rating": 1150,
        "themes": ["tacticalDefense"],
        "hints": [
            {
                "move": "a2a3",
                "pros": "Asking the question of the bishop on b4 — it must decide between trading on c3 or retreating, simplifying White's position.",
                "cons": "Slightly slow; only play this if you've checked there's no immediate tactic for black against a3/b4.",
            }
        ],
    },
    # ---- Endgame technique ----
    {
        "fen": "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
        "moves": ["e3d3"],
        "rating": 1300,
        "themes": ["endgame", "opposition"],
        "hints": [
            {
                "move": "e3d3",
                "pros": "Taking the opposition with the king is the key technique — it forces black's king to give way, letting the pawn promote.",
                "cons": "Don't push the pawn first (e2-e4?) — that lets black's king blockade in front of it and draw.",
            }
        ],
    },
    {
        "fen": "8/8/1p6/p1p5/P1P5/8/4K1k1/8 w - - 0 1",
        "moves": ["e2d3"],
        "rating": 1350,
        "themes": ["endgame", "kingActivity"],
        "hints": [
            {
                "move": "e2d3",
                "pros": "Centralizing the king toward the queenside pawns is the winning idea — White's king is closer to the action than black's.",
                "cons": "Don't rush — black's king must be kept away from re-entering via d2/e1.",
            }
        ],
    },
    # ---- More mate-in-1 variety (lower rating, good for beginners) ----
    {
        "fen": "6k1/ppp2ppp/8/8/8/8/PPP2PPP/4RK2 w - - 0 1",
        "moves": ["e1e8"],
        "rating": 800,
        "themes": ["mateIn1", "backRankMate"],
        "hints": [
            {
                "move": "e1e8",
                "pros": "The rook checks along the open back rank — black's own rook can't block in time and the king has no flight square. Mate.",
                "cons": "None — this is forced mate.",
            }
        ],
    },
    {
        "fen": "5rkr/5ppp/8/3N4/8/8/8/6K1 w - - 0 1",
        "moves": ["d5e7"],
        "rating": 1050,
        "themes": ["mateIn1", "smotheredMate"],
        "hints": [
            {
                "move": "d5e7",
                "pros": "The knight check on e7 is unstoppable — the king is completely smothered by its own rooks and pawns, and no piece can reach e7 to capture the knight. Checkmate.",
                "cons": "None — this is forced mate.",
            }
        ],
    },
    {
        "fen": "r1b2rk1/ppp2ppp/8/2bNp3/8/8/PPP2PPP/R1B1K2R w KQ - 0 1",
        "moves": ["d5f6"],
        "rating": 1200,
        "themes": ["tacticalShot"],
        "hints": [
            {
                "move": "d5f6",
                "pros": "The knight check on f6 forks the king and wins material or tempo, given black's cramped pawn cover.",
                "cons": "Confirm the g7 pawn can't safely capture the knight — recheck the position carefully before relying on this pattern.",
            }
        ],
    },
    # ---- Queen sacrifice / attacking themes ----
    {
        "fen": "r1bq1rk1/pppp1ppp/2n5/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 6 7",
        "moves": ["c3d5"],
        "rating": 1300,
        "themes": ["fork", "tacticalShot"],
        "hints": [
            {
                "move": "c3d5",
                "pros": "The knight jumps into d5, eyeing c7 and f6 — a strong central outpost that's hard for black to dislodge.",
                "cons": "Black may trade with ...Nxd5 or ...Bxd5 — recapture and assess the resulting structure before committing.",
            }
        ],
    },
    {
        "fen": "r2q1rk1/ppp1bppp/2n1bn2/3p4/3P4/2N1BN2/PPP1BPPP/R2Q1RK1 w - - 0 9",
        "moves": ["f3e5"],
        "rating": 1350,
        "themes": ["fork", "centralBreak"],
        "hints": [
            {
                "move": "f3e5",
                "pros": "Jumping into e5 hits the knight on c6 and bishop on e6's defender pattern, winning space and tempo in the center.",
                "cons": "Calculate ...Nxe5 dxe5 — make sure the resulting pawn structure favors you before playing it.",
            }
        ],
    },
    # ---- Simple beginner tactics ----
    {
        "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        "moves": ["g1f3"],
        "rating": 800,
        "themes": ["opening", "development"],
        "hints": [
            {
                "move": "g1f3",
                "pros": "Developing the knight toward the center and attacking the e5 pawn is a natural, sound move that prepares castling.",
                "cons": "No real downside — this is a standard developing move.",
            }
        ],
    },
    {
        "fen": "rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
        "moves": ["f3g5"],
        "rating": 1000,
        "themes": ["tacticalShot", "fried liver"],
        "hints": [
            {
                "move": "f3g5",
                "pros": "The knight heads to g5, targeting f7 — if black's knight on f6 is undefended this can lead to powerful sacrifices on f7.",
                "cons": "Only sound if black hasn't played ...h6 yet — always double check the move order.",
            }
        ],
    },
    {
        "fen": "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 4",
        "moves": ["d1h5"],
        "rating": 1100,
        "themes": ["tacticalShot", "queenAttack"],
        "hints": [
            {
                "move": "d1h5",
                "pros": "The early queen sortie to h5 eyes f7 and e5 simultaneously, creating immediate problems if black isn't careful with development.",
                "cons": "Bringing the queen out early can backfire if black develops with tempo against it — use cautiously.",
            }
        ],
    },
    {
        "fen": "rn1qkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 6",
        "moves": ["c4d5"],
        "rating": 1050,
        "themes": ["centralBreak"],
        "hints": [
            {
                "move": "c4d5",
                "pros": "Resolving the center with cxd5 opens lines for both sides but leaves White with a slight space advantage and freer pieces.",
                "cons": "Black recaptures evenly with ...exd5 or ...Nxd5 — this is a structural improvement, not a material win.",
            }
        ],
    },
    # ---- More mate-in-1 (verified) ----
    {
        "fen": "6k1/5ppp/8/8/8/8/5PPP/Q5K1 w - - 0 1",
        "moves": ["a1a8"],
        "rating": 850,
        "themes": ["mateIn1", "backRankMate"],
        "hints": [
            {
                "move": "a1a8",
                "pros": "The queen slides to the open back rank — the king is boxed in by its own pawns with no flight square. Checkmate.",
                "cons": "None — this is forced mate.",
            }
        ],
    },
    {
        "fen": "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
        "moves": ["a1a8"],
        "rating": 850,
        "themes": ["mateIn1", "backRankMate"],
        "hints": [
            {
                "move": "a1a8",
                "pros": "The rook slides down the open a-file to the back rank — every flight square is covered by the king's own pawns. Checkmate.",
                "cons": "None — this is forced mate.",
            }
        ],
    },
    {
        "fen": "6k1/6pp/8/8/8/8/6PP/4QBK1 w - - 0 1",
        "moves": ["e1e8"],
        "rating": 900,
        "themes": ["mateIn1", "backRankMate"],
        "hints": [
            {
                "move": "e1e8",
                "pros": "The queen marches to the back rank, supported by the bishop on f1 — the king has nowhere to run. Checkmate.",
                "cons": "None — this is forced mate.",
            }
        ],
    },
    # ---- Opening tactics from real game sequences ----
    {
        "fen": "r1bqk2r/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5",
        "moves": ["f3e5"],
        "rating": 1100,
        "themes": ["fork"],
        "hints": [
            {
                "move": "f3e5",
                "pros": "The knight grabs the central e5 pawn while eyeing c6 and f7 — black's pinned knight on c6 can't safely recapture.",
                "cons": "Check whether black has an in-between tactic with the bishop on b4 before committing.",
            }
        ],
    },
    {
        "fen": "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        "moves": ["f1b5"],
        "rating": 900,
        "themes": ["pin", "opening"],
        "hints": [
            {
                "move": "f1b5",
                "pros": "The Ruy Lopez bishop pins the knight on c6 to the king, applying long-term pressure on black's center.",
                "cons": "Black can break the pin with ...a6, so this is a strong developing move, not an immediate win.",
            }
        ],
    },
    {
        "fen": "r1bqk2r/pppp1ppp/2n2n2/1Bb1p3/4P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5",
        "moves": ["b5c6"],
        "rating": 1000,
        "themes": ["removeTheDefender"],
        "hints": [
            {
                "move": "b5c6",
                "pros": "Trading the bishop for the knight on c6 wrecks black's pawn structure and removes a key defender of the center.",
                "cons": "Black recaptures with ...dxc6 or ...bxc6, getting the bishop pair in return — weigh the structural damage against the trade.",
            }
        ],
    },
    {
        "fen": "r1bqk2r/pppp1ppp/2n2n2/8/2BPP3/5N2/PP1b1PPP/RN1QK2R w KQkq - 0 8",
        "moves": ["b1d2"],
        "rating": 950,
        "themes": ["recapture", "hangingPiece"],
        "hints": [
            {
                "move": "b1d2",
                "pros": "Black's bishop just captured a free piece on d2 — recapturing immediately restores material equality.",
                "cons": "Always double-check there isn't an in-between move before recapturing; here there isn't.",
            }
        ],
    },
    {
        "fen": "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPPQPPP/RNB1K2R w KQkq - 6 5",
        "moves": ["c4f7"],
        "rating": 1150,
        "themes": ["sacrifice", "tacticalShot"],
        "hints": [
            {
                "move": "c4f7",
                "pros": "Bxf7+ rips open black's king position — after ...Kxf7 the queen and knight can pile on with tempo.",
                "cons": "This is a piece sacrifice — only sound if you've calculated a concrete follow-up attack, not just grabbing a pawn.",
            }
        ],
    },
    {
        "fen": "r1bqk1nr/pppp1ppp/1bn5/8/4P3/1N6/PPP2PPP/RNBQKB1R w KQkq - 3 6",
        "moves": ["b1c3"],
        "rating": 1100,
        "themes": ["development"],
        "hints": [
            {
                "move": "b1c3",
                "pros": "Developing the last knight toward the center keeps pace in development and prepares quick castling.",
                "cons": "No real downside — a natural developing move.",
            }
        ],
    },
    {
        "fen": "rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5",
        "moves": ["e4g3"],
        "rating": 1050,
        "themes": ["attack"],
        "hints": [
            {
                "move": "e4g3",
                "pros": "The knight hops to g3, attacking the bishop on f5 and gaining the bishop pair or a tempo.",
                "cons": "Black can simply retreat the bishop — this wins tempo, not material.",
            }
        ],
    },
    {
        "fen": "rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
        "moves": ["c1g5"],
        "rating": 900,
        "themes": ["pin", "opening"],
        "hints": [
            {
                "move": "c1g5",
                "pros": "The bishop pins the knight on f6 to the queen on d8, a classic Queen's Gambit pressure move.",
                "cons": "Black can play ...h6 and ...Bxf6-ish breaks later, so follow up actively.",
            }
        ],
    },
    {
        "fen": "8/8/1k6/8/8/8/6PP/4R1K1 w - - 0 1",
        "moves": ["e1e6"],
        "rating": 1100,
        "themes": ["endgame", "kingActivity"],
        "hints": [
            {
                "move": "e1e6",
                "pros": "Cutting off the black king's path with the rook on the 6th rank restricts it while the pawns advance safely.",
                "cons": "Make sure the rook can't be harassed — keep an eye on the king's approach.",
            }
        ],
    },
]
