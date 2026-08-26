"use client";

import { useEffect, useRef, useState } from "react";

export type MatchmakingMark = "x" | "o";

export type MatchmakingDrawing = {
  index: number;
  mark: MatchmakingMark;
};

export type MatchmakingResolution = {
  kind: "win" | "draw";
  cells: number[];
  winner: MatchmakingMark | null;
};

export type MatchmakingTokenPoint = {
  x: number;
  y: number;
};

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const EMPTY_BOARD = Array<MatchmakingMark | null>(9).fill(null);

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function hasLine(board: (MatchmakingMark | null)[], mark: MatchmakingMark) {
  return WIN_LINES.some((line) => line.every((index) => board[index] === mark));
}

function createWinningRound() {
  const winner: MatchmakingMark = Math.random() < 0.5 ? "x" : "o";
  const line = shuffle(WIN_LINES)[0];
  const winningCells = shuffle(line);
  const remaining = shuffle(Array.from({ length: 9 }, (_, index) => index).filter((index) => !line.includes(index)));

  if (winner === "x") {
    return {
      moves: winningCells.flatMap((index, turn) => turn < 2
        ? [{ index, mark: "x" as const }, { index: remaining[turn], mark: "o" as const }]
        : [{ index, mark: "x" as const }]),
      resolution: { kind: "win" as const, cells: line, winner },
    };
  }

  let opponentCells = remaining.slice(0, 3);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = shuffle(remaining).slice(0, 3);
    const board = [...EMPTY_BOARD];
    candidate.forEach((index) => { board[index] = "x"; });
    if (!hasLine(board, "x")) {
      opponentCells = candidate;
      break;
    }
  }

  return {
    moves: winningCells.flatMap((index, turn) => [
      { index: opponentCells[turn], mark: "x" as const },
      { index, mark: "o" as const },
    ]),
    resolution: { kind: "win" as const, cells: line, winner },
  };
}

function createDrawRound() {
  let board = [...EMPTY_BOARD];
  do {
    board = shuffle<MatchmakingMark>(["x", "x", "x", "x", "x", "o", "o", "o", "o"]);
  } while (hasLine(board, "x") || hasLine(board, "o"));

  const xCells = shuffle(board.flatMap((mark, index) => mark === "x" ? [index] : []));
  const oCells = shuffle(board.flatMap((mark, index) => mark === "o" ? [index] : []));
  const moves = xCells.flatMap((index, turn) => turn < oCells.length
    ? [{ index, mark: "x" as const }, { index: oCells[turn], mark: "o" as const }]
    : [{ index, mark: "x" as const }]);

  return {
    moves,
    resolution: { kind: "draw" as const, cells: Array.from({ length: 9 }, (_, index) => index), winner: null },
  };
}

function createRound() {
  return Math.random() < 0.78 ? createWinningRound() : createDrawRound();
}

function randomPoint(): MatchmakingTokenPoint {
  return {
    x: 7 + Math.random() * 86,
    y: 7 + Math.random() * 86,
  };
}

function cellPoint(index: number): MatchmakingTokenPoint {
  return {
    x: ((index % 3) + 0.5) * 100 / 3,
    y: (Math.floor(index / 3) + 0.5) * 100 / 3,
  };
}

export function useMatchmakingAnimation(failed: boolean, matched: boolean) {
  const [board, setBoard] = useState<(MatchmakingMark | null)[]>(EMPTY_BOARD);
  const [drawing, setDrawing] = useState<MatchmakingDrawing | null>(null);
  const [resolution, setResolution] = useState<MatchmakingResolution | null>(null);
  const [activeMark, setActiveMark] = useState<MatchmakingMark | null>(null);
  const [tokenPoints, setTokenPoints] = useState<Record<MatchmakingMark, MatchmakingTokenPoint>>({
    x: { x: 15, y: 18 },
    o: { x: 85, y: 82 },
  });
  const activeMarkRef = useRef<MatchmakingMark | null>(null);

  useEffect(() => {
    if (failed || matched) return;
    const interval = window.setInterval(() => {
      setTokenPoints((current) => ({
        x: activeMarkRef.current === "x" ? current.x : randomPoint(),
        o: activeMarkRef.current === "o" ? current.o : randomPoint(),
      }));
    }, 920);
    return () => window.clearInterval(interval);
  }, [failed, matched]);

  useEffect(() => {
    if (failed || matched) return;
    const timers: number[] = [];
    let cancelled = false;
    const wait = (duration: number) => new Promise<void>((resolve) => {
      timers.push(window.setTimeout(resolve, duration));
    });

    const run = async () => {
      await wait(340);
      while (!cancelled) {
        const round = createRound();
        setBoard([...EMPTY_BOARD]);
        setResolution(null);

        for (const move of round.moves) {
          if (cancelled) return;
          activeMarkRef.current = move.mark;
          setActiveMark(move.mark);
          setTokenPoints((current) => ({ ...current, [move.mark]: cellPoint(move.index) }));
          await wait(500);
          if (cancelled) return;
          setDrawing(move);
          await wait(520);
          if (cancelled) return;
          setBoard((current) => current.map((mark, index) => index === move.index ? move.mark : mark));
          setDrawing(null);
          activeMarkRef.current = null;
          setActiveMark(null);
          setTokenPoints((current) => ({ ...current, [move.mark]: randomPoint() }));
          await wait(260);
        }

        if (cancelled) return;
        setResolution(round.resolution);
        setTokenPoints((current) => round.resolution.kind === "win"
          ? { ...current, [round.resolution.winner as MatchmakingMark]: { x: 50, y: 50 } }
          : { x: { x: 5, y: 50 }, o: { x: 95, y: 50 } });
        await wait(920);
        if (cancelled) return;
        setBoard([...EMPTY_BOARD]);
        setResolution(null);
        await wait(300);
      }
    };

    void run();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      activeMarkRef.current = null;
    };
  }, [failed, matched]);

  return { activeMark, board, drawing, resolution, tokenPoints };
}
