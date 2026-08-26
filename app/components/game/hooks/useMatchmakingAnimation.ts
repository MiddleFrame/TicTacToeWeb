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

function findLine(board: (MatchmakingMark | null)[], mark: MatchmakingMark) {
  return WIN_LINES.find((line) => line.every((index) => board[index] === mark)) ?? null;
}

function chooseCell(board: (MatchmakingMark | null)[], mark: MatchmakingMark) {
  const empty = board.flatMap((value, index) => value === null ? [index] : []);
  const winning = empty.filter((index) => {
    const candidate = [...board];
    candidate[index] = mark;
    return findLine(candidate, mark) !== null;
  });
  const choices = winning.length > 0 && Math.random() < 0.72 ? winning : empty;
  return choices[Math.floor(Math.random() * choices.length)];
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
    x: { x: 12, y: 20 },
    o: { x: 88, y: 80 },
  });
  const activeMarkRef = useRef<MatchmakingMark | null>(null);
  const resolvingRef = useRef(false);

  useEffect(() => {
    if (failed || matched) return;
    const interval = window.setInterval(() => {
      if (resolvingRef.current) return;
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
      const liveBoard = [...EMPTY_BOARD];
      let nextMark: MatchmakingMark = "x";
      while (!cancelled) {
        const index = chooseCell(liveBoard, nextMark);
        const move = { index, mark: nextMark };
        activeMarkRef.current = nextMark;
        setActiveMark(nextMark);
        setTokenPoints((current) => ({ ...current, [nextMark]: cellPoint(index) }));
        await wait(560);
        if (cancelled) return;
        setDrawing(move);
        await wait(560);
        if (cancelled) return;
        liveBoard[index] = nextMark;
        setBoard([...liveBoard]);
        setDrawing(null);
        activeMarkRef.current = null;
        setActiveMark(null);
        setTokenPoints((current) => ({ ...current, [nextMark]: randomPoint() }));
        await wait(280);
        if (cancelled) return;

        const line = findLine(liveBoard, nextMark);
        const boardIsFull = liveBoard.every((mark) => mark !== null);
        if (line) {
          resolvingRef.current = true;
          setResolution({ kind: "win", cells: line, winner: nextMark });
          await wait(920);
          if (cancelled) return;
          line.forEach((cell) => { liveBoard[cell] = null; });
          setBoard([...liveBoard]);
          setResolution(null);
          resolvingRef.current = false;
          await wait(260);
        } else if (boardIsFull) {
          resolvingRef.current = true;
          setResolution({ kind: "draw", cells: Array.from({ length: 9 }, (_, cell) => cell), winner: null });
          await wait(920);
          if (cancelled) return;
          liveBoard.fill(null);
          setBoard([...liveBoard]);
          setResolution(null);
          resolvingRef.current = false;
          await wait(300);
        }

        nextMark = nextMark === "x" ? "o" : "x";
      }
    };

    void run();
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      activeMarkRef.current = null;
      resolvingRef.current = false;
    };
  }, [failed, matched]);

  return { activeMark, board, drawing, resolution, tokenPoints };
}
