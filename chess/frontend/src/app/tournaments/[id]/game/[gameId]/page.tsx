"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { Flag, Handshake, Loader2, Volume2 } from "lucide-react";
import type { LiveGameOut } from "@/lib/api";
import { api } from "@/lib/api";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
  .replace(/^http/, "ws")
  .replace("/api/v1", "");

function msToDisplay(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ClockDisplay({ ms, active }: { ms: number; active: boolean }) {
  return (
    <div
      className={`rounded-lg px-4 py-2 text-xl font-mono font-bold tabular-nums transition-colors ${
        active ? "bg-brand text-white" : "bg-surface-DEFAULT text-gray-300"
      }`}
    >
      {msToDisplay(ms)}
    </div>
  );
}

export default function LiveGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const gid = Number(gameId);

  const [gameInfo, setGameInfo] = useState<LiveGameOut | null>(null);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [whiteClock, setWhiteClock] = useState(0);
  const [blackClock, setBlackClock] = useState(0);
  const [moves, setMoves] = useState<{ san: string; uci: string }[]>([]);
  const [status, setStatus] = useState<"waiting" | "active" | "completed" | "aborted">("waiting");
  const [result, setResult] = useState<string | null>(null);
  const [termination, setTermination] = useState<string | null>(null);
  const [drawOffered, setDrawOffered] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chessRef = useRef(new Chess());
  const myId = useRef<number | null>(null);

  // Determine player color from localStorage user id (simple approach).
  const [myColor, setMyColor] = useState<"white" | "black" | "spectator">("spectator");

  useEffect(() => {
    api.getGame(gid).then((g) => {
      setGameInfo(g);
      setFen(g.current_fen);
      setWhiteClock(g.white_time_ms);
      setBlackClock(g.black_time_ms);
      if (g.result) { setResult(g.result); setStatus("completed"); }
      chessRef.current = new Chess(g.current_fen);
    }).catch(() => {});

    const token = localStorage.getItem("cm_access_token");
    const url = `${WS_BASE}/api/v1/tournaments/ws/game/${gid}${token ? `?token=${token}` : ""}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        handleServerMsg(msg);
      } catch {}
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid]);

  const handleServerMsg = useCallback((msg: Record<string, unknown>) => {
    switch (msg.type) {
      case "game_state": {
        const s = msg as Record<string, unknown>;
        setFen(s.fen as string);
        setWhiteClock(s.white_time_ms as number);
        setBlackClock(s.black_time_ms as number);
        setStatus(s.status as typeof status);
        if (s.result) setResult(s.result as string);
        setMoves((s.moves as { san: string; uci: string }[]) ?? []);
        chessRef.current = new Chess(s.fen as string);

        // Determine my color.
        const token = localStorage.getItem("cm_access_token");
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            myId.current = Number(payload.sub);
            const white = (s.white as Record<string, unknown>).id as number;
            const black = (s.black as Record<string, unknown>).id as number;
            if (myId.current === white) setMyColor("white");
            else if (myId.current === black) setMyColor("black");
            else setMyColor("spectator");
          } catch {}
        }
        break;
      }
      case "game_started":
        setStatus("active");
        break;
      case "move": {
        const m = msg as Record<string, unknown>;
        setFen(m.fen as string);
        setWhiteClock(m.white_time_ms as number);
        setBlackClock(m.black_time_ms as number);
        setMoves((prev) => [...prev, { san: m.san as string, uci: m.uci as string }]);
        chessRef.current = new Chess(m.fen as string);
        if (m.game_over) {
          const go = m.game_over as Record<string, unknown>;
          setResult(go.result as string);
          setTermination(go.termination as string);
          setStatus("completed");
        }
        break;
      }
      case "game_over":
        setResult(msg.result as string);
        setTermination(msg.termination as string);
        setStatus("completed");
        break;
      case "draw_offered":
        setDrawOffered(msg.by as string);
        break;
    }
  }, []);

  const send = (data: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify(data));
  };

  const onDrop = useCallback(
    (from: string, to: string): boolean => {
      if (myColor === "spectator" || status !== "active") return false;
      const turn = chessRef.current.turn();
      if ((turn === "w" && myColor !== "white") || (turn === "b" && myColor !== "black")) return false;

      try {
        const move = chessRef.current.move({ from, to, promotion: "q" });
        if (!move) return false;
        send({ type: "move", uci: move.from + move.to + (move.promotion ?? "") });
        return true;
      } catch {
        return false;
      }
    },
    [myColor, status]
  );

  const boardOrientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  return (
    <div className="container-px py-8">
      {/* Connection indicator */}
      {!connected && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-900/40 p-3 text-sm text-yellow-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Connecting to game server…
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Board column */}
        <div className="space-y-3">
          {/* Opponent clock */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">
              {boardOrientation === "white" ? (gameInfo?.black_name ?? "Black") : (gameInfo?.white_name ?? "White")}
            </p>
            <ClockDisplay
              ms={boardOrientation === "white" ? blackClock : whiteClock}
              active={status === "active" && chessRef.current.turn() !== (boardOrientation === "white" ? "w" : "b")}
            />
          </div>

          <div className="w-[min(80vw,520px)]">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={boardOrientation}
              arePiecesDraggable={myColor !== "spectator" && status === "active"}
              customBoardStyle={{ borderRadius: "12px" }}
              customDarkSquareStyle={{ backgroundColor: "#739552" }}
              customLightSquareStyle={{ backgroundColor: "#ebecd0" }}
            />
          </div>

          {/* My clock */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-300">
              {boardOrientation === "white" ? (gameInfo?.white_name ?? "White") : (gameInfo?.black_name ?? "Black")}
              {myColor !== "spectator" && " (You)"}
            </p>
            <ClockDisplay
              ms={boardOrientation === "white" ? whiteClock : blackClock}
              active={status === "active" && chessRef.current.turn() === (boardOrientation === "white" ? "w" : "b")}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Game status */}
          {status === "completed" && result && (
            <div className="card text-center">
              <p className="text-lg font-bold text-white">
                {result === "1/2-1/2" ? "Draw" : result === "1-0" ? "White wins" : "Black wins"}
              </p>
              {termination && (
                <p className="mt-1 text-sm capitalize text-gray-400">
                  by {termination.replace(/_/g, " ")}
                </p>
              )}
            </div>
          )}

          {status === "waiting" && (
            <div className="card flex items-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for both players to connect…
            </div>
          )}

          {/* Draw offer */}
          {drawOffered && myColor !== "spectator" && drawOffered !== myColor && (
            <div className="card space-y-2 text-sm">
              <p className="font-medium text-yellow-300">Draw offered by {drawOffered}!</p>
              <div className="flex gap-2">
                <button onClick={() => { send({ type: "draw_response", accept: true }); setDrawOffered(null); }} className="btn-primary text-xs">Accept</button>
                <button onClick={() => { send({ type: "draw_response", accept: false }); setDrawOffered(null); }} className="btn-ghost text-xs">Decline</button>
              </div>
            </div>
          )}

          {/* Player controls */}
          {myColor !== "spectator" && status === "active" && (
            <div className="card flex gap-2">
              <button
                onClick={() => send({ type: "draw_offer" })}
                className="btn-ghost flex flex-1 items-center justify-center gap-1.5 text-sm"
              >
                <Handshake className="h-4 w-4" /> Offer Draw
              </button>
              <button
                onClick={() => { if (confirm("Resign this game?")) send({ type: "resign" }); }}
                className="btn-ghost flex flex-1 items-center justify-center gap-1.5 text-sm text-red-400 hover:text-red-300"
              >
                <Flag className="h-4 w-4" /> Resign
              </button>
            </div>
          )}

          {/* Move list */}
          <div className="card max-h-80 overflow-y-auto p-0">
            <div className="sticky top-0 border-b border-surface-border bg-surface-DEFAULT px-4 py-2">
              <h3 className="text-sm font-medium text-gray-300">Moves</h3>
            </div>
            {moves.length === 0 ? (
              <p className="p-4 text-xs text-gray-500">No moves yet.</p>
            ) : (
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 p-3 text-sm font-mono">
                {moves.reduce<React.ReactNode[]>((acc, m, i) => {
                  if (i % 2 === 0) {
                    acc.push(
                      <span key={`n${i}`} className="text-gray-500">{Math.floor(i / 2) + 1}.</span>,
                      <span key={`w${i}`} className="text-white">{m.san}</span>,
                      <span key={`b${i}`} className="text-white">{moves[i + 1]?.san ?? ""}</span>
                    );
                  }
                  return acc;
                }, [])}
              </div>
            )}
          </div>

          {/* Spectator note */}
          {myColor === "spectator" && (
            <div className="flex items-center gap-2 rounded-lg bg-surface-DEFAULT px-3 py-2 text-xs text-gray-500">
              <Volume2 className="h-3.5 w-3.5" /> Watching as spectator — moves are broadcast live.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
