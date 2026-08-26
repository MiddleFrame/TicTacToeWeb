import type { CardInstance, CardKind } from "./cards";
import type { GameState } from "./engine";

export type CardEffectContext = {
  clonePools: (state: GameState) => GameState;
  draw: (state: GameState, count: number) => void;
  freezeEmpty: (state: GameState, count: number, action: string) => GameState;
  neighbours: (index: number, size: number) => number[];
  place: (state: GameState, index: number) => GameState;
  placeRandom: (state: GameState, count: number, resolveAfterEach?: boolean) => GameState;
  random: (indices: number[]) => number | null;
  thaw: (state: GameState, indices: number[], action: string) => GameState;
};

type CardEffect = (
  state: GameState,
  target: number,
  context: CardEffectContext,
) => GameState;

function drawAfterPlacement(state: GameState, target: number, context: CardEffectContext) {
  let next = context.place(state, target);
  next = context.clonePools(next);
  context.draw(next, 1);
  return { ...next, lastAction: "Фигура поставлена, добрана карта" };
}

function addTimedFigure(state: GameState) {
  return {
    ...state,
    randomFigureTurns: {
      ...state.randomFigureTurns,
      [state.turn]: state.randomFigureTurns[state.turn] + 3,
    },
    lastAction: "Фигура будет появляться в начале следующих 3 ходов",
  };
}

function addTimedIce(state: GameState) {
  return {
    ...state,
    randomFreezeTurns: {
      ...state.randomFreezeTurns,
      [state.turn]: state.randomFreezeTurns[state.turn] + 3,
    },
    lastAction: "Лёд будет появляться в начале следующих 3 ходов",
  };
}

function destroyIce(state: GameState, context: CardEffectContext) {
  const candidates = Object.keys(state.frozen).map(Number);
  const selected: number[] = [];
  while (candidates.length > 0 && selected.length < 6) {
    selected.push(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]);
  }
  return context.thaw(state, selected, `Разбито льдин: ${selected.length}`);
}

function freezeOwnFigures(state: GameState) {
  const candidates = state.board
    .map((cell, index) => cell === state.turn ? index : -1)
    .filter((index) => index >= 0);
  const board = [...state.board];
  const frozen = { ...state.frozen };
  let count = 0;
  while (candidates.length > 0 && count < 6) {
    const [index] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
    board[index] = null;
    frozen[index] = { owner: state.turn, turns: 2 };
    count += 1;
  }
  return { ...state, board, frozen, lastAction: `Заморожено ваших фигур: ${count}` };
}

function freezeAroundFigure(state: GameState, target: number, context: CardEffectContext) {
  const indices = context.neighbours(target, state.size)
    .filter((index) => state.board[index] === null && !state.frozen[index]);
  const frozen = { ...state.frozen };
  indices.forEach((index) => {
    frozen[index] = { owner: state.turn, turns: 2 };
  });
  return { ...state, frozen, lastAction: `Заморожено соседних клеток: ${indices.length}` };
}

function spreadIce(state: GameState, context: CardEffectContext) {
  const sourceIce = Object.keys(state.frozen).map(Number);
  const frozen = { ...state.frozen };
  let count = 0;
  sourceIce.forEach((source) => {
    const candidates = context.neighbours(source, state.size)
      .filter((index) => state.board[index] === null && !frozen[index]);
    const index = context.random(candidates);
    if (index === null) return;
    frozen[index] = { owner: state.turn, turns: 2 };
    count += 1;
  });
  return { ...state, frozen, lastAction: `Добавлено льдин: ${count}` };
}

function fillHand(state: GameState, context: CardEffectContext) {
  const next = context.clonePools(state);
  context.draw(next, 5);
  return { ...next, lastAction: "Рука заполнена картами" };
}

function drawTwo(state: GameState, context: CardEffectContext) {
  const next = context.clonePools(state);
  context.draw(next, 2);
  return { ...next, lastAction: "Добраны две карты" };
}

function spendRemainingMana(state: GameState) {
  return {
    ...state,
    mana: 0,
    manaByPlayer: {
      ...state.manaByPlayer,
      [state.turn]: 0,
    },
  };
}

const CARD_EFFECTS: Record<CardKind, CardEffect> = {
  place: (state, target, context) => context.place(state, target),
  "place-draw": (state, target, context) => drawAfterPlacement(state, target, context),
  "random-effect": (state) => addTimedFigure(state),
  "freeze-3": (state, _target, context) => context.freezeEmpty(state, 3, "Заморожено клеток"),
  "place-5": (state, _target, context) => context.placeRandom(state, 5),
  "destroy-freeze": (state, _target, context) => destroyIce(state, context),
  "freeze-effect": (state) => addTimedIce(state),
  "freeze-6-figures": (state) => freezeOwnFigures(state),
  "freeze-all-mana": (state, _target, context) => context.freezeEmpty(
    spendRemainingMana(state),
    state.mana * 2,
    "Создано льдин",
  ),
  "freeze-cell": (state, target) => ({
    ...state,
    frozen: { ...state.frozen, [target]: { owner: state.turn, turns: 2 } },
    lastAction: "Клетка заморожена",
  }),
  "full-house": (state, _target, context) => fillHand(state, context),
  "ice-encirclement": (state, target, context) => freezeAroundFigure(state, target, context),
  "place-around-freeze": (state, _target, context) => spreadIce(state, context),
  "place-more": (state, _target, context) => context.placeRandom(
    spendRemainingMana(state),
    state.mana,
    false,
  ),
  shortage: (state, _target, context) => drawTwo(state, context),
  "surrounded-by-ice": (state, target, context) => {
    const adjacent = context.neighbours(target, state.size)
      .filter((index) => Boolean(state.frozen[index]));
    return context.thaw(state, adjacent, `Разбито льдин рядом: ${adjacent.length}`);
  },
};

export function applyCardEffect(
  state: GameState,
  card: CardInstance,
  targetIndex: number | undefined,
  context: CardEffectContext,
): GameState {
  return CARD_EFFECTS[card.kind](state, targetIndex ?? -1, context);
}
