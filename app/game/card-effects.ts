import type { CardInstance } from "./cards";
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

export function applyCardEffect(
  state: GameState,
  card: CardInstance,
  targetIndex: number | undefined,
  context: CardEffectContext,
): GameState {
  const target = targetIndex as number;
  switch (card.kind) {
    case "place": return context.place(state, target);
    case "place-draw": return drawAfterPlacement(state, target, context);
    case "random-effect": return addTimedFigure(state);
    case "freeze-3": return context.freezeEmpty(state, 3, "Заморожено клеток");
    case "place-5": return context.placeRandom(state, 5);
    case "destroy-freeze": return destroyIce(state, context);
    case "freeze-effect": return addTimedIce(state);
    case "freeze-6-figures": return freezeOwnFigures(state);
    case "freeze-all-mana": return context.freezeEmpty({ ...state, mana: 0 }, state.mana * 2, "Создано льдин");
    case "freeze-cell": return {
      ...state,
      frozen: { ...state.frozen, [target]: { owner: state.turn, turns: 2 } },
      lastAction: "Клетка заморожена",
    };
    case "full-house": return fillHand(state, context);
    case "ice-encirclement": return freezeAroundFigure(state, target, context);
    case "place-around-freeze": return spreadIce(state, context);
    case "place-more": return context.placeRandom({ ...state, mana: 0 }, state.mana, false);
    case "shortage": return drawTwo(state, context);
    case "surrounded-by-ice": {
      const adjacent = context.neighbours(target, state.size)
        .filter((index) => Boolean(state.frozen[index]));
      return context.thaw(state, adjacent, `Разбито льдин рядом: ${adjacent.length}`);
    }
  }
}
