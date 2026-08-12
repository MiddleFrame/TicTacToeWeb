import {
  CARD_DEFINITIONS,
  createConfiguredDeck,
  createExactDeck,
  type CardInstance,
  type CardKind,
  STARTER_SELECTED_KINDS,
} from "./cards.ts";
import { applyCardEffect } from "./card-effects.ts";
import { findScoringCells, orthogonalNeighbours } from "./board-rules.ts";
export { findScoringCells } from "./board-rules.ts";

export type Player = 1 | 2;
export type Cell = Player | null;
export type Phase = "playing" | "thawing" | "clearing" | "round-over" | "game-over";

export const SCORE_TO_WIN = 20;
export const ROUNDS_TO_WIN = 2;
export const MAX_ROUNDS = 3;
export const MAX_HAND_SIZE = 5;
export const CARDS_PER_TURN = 2;

export interface FrozenCell {
  owner: Player;
  turns: number;
}

export interface GameState {
  size: number;
  board: Cell[];
  turn: Player;
  scores: Record<Player, number>;
  scoreToWin: number;
  roundWins: Record<Player, number>;
  completedRounds: number;
  singleRound: boolean;
  phase: Phase;
  thawingCells: number[];
  clearingCells: number[];
  lastGain: number;
  roundWinner: Player | null;
  gameWinner: Player | null;
  mana: number;
  maxMana: number;
  deckKinds: CardKind[];
  hands: Record<Player, CardInstance[]>;
  decks: Record<Player, CardInstance[]>;
  bonusCosts: Record<string, number>;
  basePlacementCosts: Record<Player, number>;
  frozen: Record<number, FrozenCell>;
  randomFigureTurns: Record<Player, number>;
  randomFreezeTurns: Record<Player, number>;
  rechangerAvailable: Record<Player, boolean>;
  cardsPlayedThisTurn: number;
  lastAction: string;
}

const emptyBoard = (size: number): Cell[] => Array<Cell>(size * size).fill(null);
const otherPlayer = (player: Player): Player => (player === 1 ? 2 : 1);

function drawCardsMutable(state: GameState, player: Player, count: number): void {
  for (let index = 0; index < count; index += 1) {
    if (
      state.hands[player].length >= MAX_HAND_SIZE ||
      state.decks[player].length === 0
    ) {
      return;
    }
    const [card, ...deck] = state.decks[player];
    state.decks[player] = deck;
    state.hands[player] = [...state.hands[player], card];
  }
}

function cloneCardPools(state: GameState): GameState {
  return {
    ...state,
    hands: {
      1: [...state.hands[1]],
      2: [...state.hands[2]],
    },
    decks: {
      1: [...state.decks[1]],
      2: [...state.decks[2]],
    },
  };
}

type RoundStateSetup = Pick<GameState, "roundWins" | "completedRounds" | "deckKinds"> & {
  size?: number;
  maxMana?: number;
  scoreToWin?: number;
  singleRound?: boolean;
  exactDeck?: readonly CardKind[];
};

function createRoundState(
  base: RoundStateSetup,
): GameState {
  const size = base.size ?? 3 + base.completedRounds;
  const maxMana = base.maxMana ?? 3 + base.completedRounds;
  const state: GameState = {
    size,
    board: emptyBoard(size),
    turn: 1,
    scores: { 1: 0, 2: 0 },
    scoreToWin: base.scoreToWin ?? SCORE_TO_WIN,
    roundWins: { ...base.roundWins },
    completedRounds: base.completedRounds,
    singleRound: base.singleRound ?? false,
    phase: "playing",
    thawingCells: [],
    clearingCells: [],
    lastGain: 0,
    roundWinner: null,
    gameWinner: null,
    mana: maxMana,
    maxMana,
    deckKinds: [...base.deckKinds],
    hands: { 1: [], 2: [] },
    decks: {
      1: base.exactDeck
        ? createExactDeck(1, base.exactDeck)
        : createConfiguredDeck(1, base.deckKinds),
      2: createConfiguredDeck(2, base.deckKinds),
    },
    bonusCosts: {},
    basePlacementCosts: { 1: 0, 2: 0 },
    frozen: {},
    randomFigureTurns: { 1: 0, 2: 0 },
    randomFreezeTurns: { 1: 0, 2: 0 },
    rechangerAvailable: { 1: true, 2: true },
    cardsPlayedThisTurn: 0,
    lastAction: "Выберите карту и разыграйте её",
  };
  drawCardsMutable(state, 1, CARDS_PER_TURN);
  return state;
}

export function createGame(
  deckKinds: readonly CardKind[] = STARTER_SELECTED_KINDS,
): GameState {
  return createRoundState({
    roundWins: { 1: 0, 2: 0 },
    completedRounds: 0,
    deckKinds: [...deckKinds],
  });
}

export function createSingleRoundGame(setup: {
  size: number;
  maxMana: number;
  scoreToWin: number;
  deck: readonly CardKind[];
}): GameState {
  return createRoundState({
    roundWins: { 1: 0, 2: 0 },
    completedRounds: 0,
    deckKinds: [...setup.deck],
    size: setup.size,
    maxMana: setup.maxMana,
    scoreToWin: setup.scoreToWin,
    singleRound: true,
    exactDeck: setup.deck,
  });
}

function finishRound(state: GameState, winner: Player | null): GameState {
  const completedRounds = state.completedRounds + 1;
  const roundWins = { ...state.roundWins };
  if (winner !== null) roundWins[winner] += 1;

  if (state.singleRound) {
    return {
      ...state,
      completedRounds,
      roundWins,
      roundWinner: winner,
      gameWinner: winner,
      phase: "game-over",
    };
  }

  const gameWinner =
    roundWins[1] >= ROUNDS_TO_WIN
      ? 1
      : roundWins[2] >= ROUNDS_TO_WIN
        ? 2
        : completedRounds >= MAX_ROUNDS
          ? roundWins[1] > roundWins[2]
            ? 1
            : roundWins[2] > roundWins[1]
              ? 2
              : null
          : null;

  return {
    ...state,
    completedRounds,
    roundWins,
    roundWinner: winner,
    gameWinner,
    phase:
      gameWinner !== null || completedRounds >= MAX_ROUNDS
        ? "game-over"
        : "round-over",
  };
}

function enabledCellCount(state: GameState): number {
  return state.board.reduce(
    (count, cell, index) =>
      count + (cell === null && !state.frozen[index] ? 1 : 0),
    0,
  );
}

function winnerByScore(state: GameState): Player | null {
  if (state.scores[1] === state.scores[2]) return null;
  return state.scores[1] > state.scores[2] ? 1 : 2;
}

function prepareScoring(state: GameState, action: string): GameState {
  const clearingCells = findScoringCells(
    state.board,
    state.size,
    state.turn,
    state.frozen,
  );
  if (clearingCells.length > 0) {
    return {
      ...state,
      thawingCells: [],
      clearingCells,
      lastGain: clearingCells.length,
      phase: "clearing",
      lastAction: action,
    };
  }

  const next = { ...state, lastGain: 0, lastAction: action };
  return enabledCellCount(next) === 0
    ? finishRound(next, winnerByScore(next))
    : next;
}

function placeOnBoard(state: GameState, index: number): GameState {
  if (
    state.phase !== "playing" ||
    index < 0 ||
    index >= state.board.length ||
    state.board[index] !== null ||
    state.frozen[index]
  ) {
    return state;
  }

  const board = [...state.board];
  board[index] = state.turn;
  return prepareScoring(
    { ...state, board },
    "Фигура поставлена",
  );
}

export function placeFigure(state: GameState, index: number): GameState {
  return placeOnBoard(state, index);
}

export function settleClear(state: GameState): GameState {
  if (state.phase !== "clearing") return state;

  const board = [...state.board];
  state.clearingCells.forEach((index) => {
    board[index] = null;
  });
  const gain = state.clearingCells.length;
  const scores = {
    ...state.scores,
    [state.turn]: state.scores[state.turn] + gain,
  };
  const nextState: GameState = {
    ...state,
    board,
    scores,
    clearingCells: [],
    phase: "playing",
    lastGain: gain,
    lastAction: `Линия принесла ${gain} очк.`,
  };

  if (scores[state.turn] >= state.scoreToWin) {
    return finishRound(nextState, state.turn);
  }
  if (enabledCellCount(nextState) === 0) {
    return finishRound(nextState, winnerByScore(nextState));
  }
  return nextState;
}

export function settleThaw(state: GameState): GameState {
  if (state.phase !== "thawing") return state;
  return prepareScoring(
    { ...state, phase: "playing", thawingCells: [] },
    state.lastAction,
  );
}

function randomFrom(indices: number[]): number | null {
  if (indices.length === 0) return null;
  return indices[Math.floor(Math.random() * indices.length)];
}

function emptyIndices(state: GameState): number[] {
  return state.board
    .map((cell, index) =>
      cell === null && !state.frozen[index] ? index : -1,
    )
    .filter((index) => index >= 0);
}

function randomAvailableIndex(state: GameState): number | null {
  return randomFrom(emptyIndices(state));
}

function resolvePlacedFigureImmediately(
  state: GameState,
  index: number,
): GameState {
  const board = [...state.board];
  board[index] = state.turn;
  const scoringCells = findScoringCells(
    board,
    state.size,
    state.turn,
    state.frozen,
  );

  if (scoringCells.length === 0) return { ...state, board };

  scoringCells.forEach((cellIndex) => {
    board[cellIndex] = null;
  });
  const scores = {
    ...state.scores,
    [state.turn]: state.scores[state.turn] + scoringCells.length,
  };
  const next = {
    ...state,
    board,
    scores,
    lastGain: state.lastGain + scoringCells.length,
  };
  return scores[state.turn] >= state.scoreToWin
    ? finishRound(next, state.turn)
    : next;
}

function placeRandomFigures(
  state: GameState,
  count: number,
  resolveAfterEach = true,
): GameState {
  let next = { ...state, lastGain: 0 };
  let placed = 0;

  for (; placed < count; placed += 1) {
    if (next.phase !== "playing") break;
    const index = randomAvailableIndex(next);
    if (index === null) break;

    if (resolveAfterEach) {
      next = resolvePlacedFigureImmediately(next, index);
    } else {
      const board = [...next.board];
      board[index] = next.turn;
      next = { ...next, board };
    }
  }

  if (next.phase !== "playing") return next;
  if (!resolveAfterEach) {
    return prepareScoring(
      next,
      placed > 0 ? `Размещено фигур: ${placed}` : "Нет свободных клеток",
    );
  }

  const action =
    next.lastGain > 0
      ? `Случайные фигуры: +${next.lastGain}`
      : placed > 0
        ? `Размещено фигур: ${placed}`
        : "Нет свободных клеток";
  next = { ...next, lastAction: action };
  return enabledCellCount(next) === 0
    ? finishRound(next, winnerByScore(next))
    : next;
}

function freezeEmptyCells(
  state: GameState,
  count: number,
  action: string,
): GameState {
  const frozen = { ...state.frozen };
  const candidates = emptyIndices(state);
  let frozenCount = 0;

  while (candidates.length > 0 && frozenCount < count) {
    const candidatePosition = Math.floor(Math.random() * candidates.length);
    const [index] = candidates.splice(candidatePosition, 1);
    frozen[index] = { owner: state.turn, turns: 2 };
    frozenCount += 1;
  }

  return {
    ...state,
    frozen,
    lastAction: `${action}: ${frozenCount}`,
  };
}

function thawToCurrentFigures(
  state: GameState,
  indices: number[],
  action: string,
): GameState {
  if (indices.length === 0) return { ...state, lastAction: action };
  const board = [...state.board];
  const frozen = { ...state.frozen };
  indices.forEach((index) => {
    delete frozen[index];
    board[index] = state.turn;
  });
  return {
    ...state,
    board,
    frozen,
    phase: "thawing",
    thawingCells: indices,
    lastAction: action,
  };
}

export function cardCost(state: GameState, card: CardInstance): number {
  const bonus = card.kind === "place"
    ? state.basePlacementCosts[state.turn]
    : state.bonusCosts[`${state.turn}:${card.kind}`] ?? 0;
  return CARD_DEFINITIONS[card.kind].cost + bonus;
}

function consumeCard(
  state: GameState,
  card: CardInstance,
  cost: number,
): GameState {
  return {
    ...state,
    mana: state.mana - cost,
    hands: {
      ...state.hands,
      [state.turn]: state.hands[state.turn].filter(
        (current) => current.id !== card.id,
      ),
    },
    decks: {
      ...state.decks,
      [state.turn]: [...state.decks[state.turn], card],
    },
    bonusCosts: card.kind === "place"
      ? state.bonusCosts
      : {
          ...state.bonusCosts,
          [`${state.turn}:${card.kind}`]:
            (state.bonusCosts[`${state.turn}:${card.kind}`] ?? 0) + 1,
        },
    basePlacementCosts: card.kind === "place"
      ? {
          ...state.basePlacementCosts,
          [state.turn]: state.basePlacementCosts[state.turn] + 1,
        }
      : state.basePlacementCosts,
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
  };
}

function isValidTarget(
  state: GameState,
  target: "none" | "empty" | "ally",
  targetIndex: number | undefined,
): boolean {
  if (target === "none") return true;
  if (
    targetIndex === undefined ||
    targetIndex < 0 ||
    targetIndex >= state.board.length ||
    state.frozen[targetIndex]
  ) {
    return false;
  }
  return target === "empty"
    ? state.board[targetIndex] === null
    : state.board[targetIndex] === state.turn;
}

export function playCard(
  state: GameState,
  cardId: string,
  targetIndex?: number,
): GameState {
  if (state.phase !== "playing") return state;
  const card = state.hands[state.turn].find((current) => current.id === cardId);
  if (!card) return state;
  const definition = CARD_DEFINITIONS[card.kind];
  const cost = cardCost(state, card);
  if (cost > state.mana || !isValidTarget(state, definition.target, targetIndex)) {
    return state;
  }

  let next = consumeCard(state, card, cost);
  next = applyCardEffect(next, card, targetIndex, {
    clonePools: cloneCardPools,
    draw: (current, count) => drawCardsMutable(current, current.turn, count),
    freezeEmpty: freezeEmptyCells,
    neighbours: orthogonalNeighbours,
    place: placeOnBoard,
    placeRandom: placeRandomFigures,
    random: randomFrom,
    thaw: thawToCurrentFigures,
  });

  if (next.phase === "playing" && enabledCellCount(next) === 0) {
    return finishRound(next, winnerByScore(next));
  }
  return next;
}

function resetPlayerBonusCosts(
  bonusCosts: Record<string, number>,
  player: Player,
): Record<string, number> {
  const result = { ...bonusCosts };
  Object.keys(result).forEach((key) => {
    if (key.startsWith(`${player}:`)) result[key] = 0;
  });
  return result;
}

function applyStartOfTurnEffects(state: GameState): GameState {
  const player = state.turn;
  let next = { ...state };
  let effectCount = 0;
  const thawingCells: number[] = [];

  if (next.randomFigureTurns[player] > 0) {
    const index = randomAvailableIndex(next);
    if (index !== null) {
      const board = [...next.board];
      board[index] = player;
      next = { ...next, board };
      effectCount += 1;
    }
    next = {
      ...next,
      randomFigureTurns: {
        ...next.randomFigureTurns,
        [player]: next.randomFigureTurns[player] - 1,
      },
    };
  }

  const board = [...next.board];
  const frozen: Record<number, FrozenCell> = {};
  Object.entries(next.frozen).forEach(([rawIndex, effect]) => {
    const index = Number(rawIndex);
    if (effect.owner !== player) {
      frozen[index] = effect;
      return;
    }
    const turns = effect.turns - 1;
    if (turns > 0) {
      frozen[index] = { ...effect, turns };
      return;
    }
    board[index] = player;
    thawingCells.push(index);
    effectCount += 1;
  });
  next = { ...next, board, frozen };

  if (next.randomFreezeTurns[player] > 0) {
    next = freezeEmptyCells(next, 1, "Сработал эффект льда");
    next = {
      ...next,
      randomFreezeTurns: {
        ...next.randomFreezeTurns,
        [player]: next.randomFreezeTurns[player] - 1,
      },
    };
    effectCount += 1;
  }

  const action =
    effectCount > 0
      ? "Сработали эффекты начала хода"
      : "Новый ход: мана восстановлена, добраны 2 карты";
  if (thawingCells.length > 0) {
    return {
      ...next,
      phase: "thawing",
      thawingCells,
      lastAction: action,
    };
  }
  return prepareScoring(
    next,
    action,
  );
}

export function endTurn(state: GameState): GameState {
  if (state.phase !== "playing") return state;
  const nextPlayer = otherPlayer(state.turn);

  let next: GameState = {
    ...cloneCardPools(state),
    turn: nextPlayer,
    mana: state.maxMana,
    bonusCosts: resetPlayerBonusCosts(state.bonusCosts, state.turn),
    basePlacementCosts: {
      ...state.basePlacementCosts,
      [state.turn]: 0,
    },
    rechangerAvailable: {
      ...state.rechangerAvailable,
      [nextPlayer]: true,
    },
    cardsPlayedThisTurn: 0,
    lastGain: 0,
    lastAction: "Новый ход: мана восстановлена, добраны 2 карты",
  };
  drawCardsMutable(next, nextPlayer, CARDS_PER_TURN);
  next = applyStartOfTurnEffects(next);
  return next;
}

export function rechangeRandomCard(state: GameState): GameState {
  if (
    state.phase !== "playing" ||
    !state.rechangerAvailable[state.turn] ||
    state.hands[state.turn].length === 0 ||
    state.decks[state.turn].length === 0
  ) {
    return state;
  }

  const next = cloneCardPools(state);
  const handIndex = Math.floor(Math.random() * next.hands[next.turn].length);
  const [removed] = next.hands[next.turn].splice(handIndex, 1);
  next.decks[next.turn].push(removed);
  drawCardsMutable(next, next.turn, 1);
  return {
    ...next,
    rechangerAvailable: {
      ...next.rechangerAvailable,
      [next.turn]: false,
    },
    lastAction: "Одна случайная карта заменена",
  };
}

export function startNextRound(state: GameState): GameState {
  if (state.phase !== "round-over") return state;
  return createRoundState({
    roundWins: state.roundWins,
    completedRounds: state.completedRounds,
    deckKinds: state.deckKinds,
  });
}
