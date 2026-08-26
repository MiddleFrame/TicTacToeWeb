import type { FrozenCell, GameState } from "./engine";

export type TurnEffectContext = {
  freezeEmpty: (state: GameState, count: number, action: string) => GameState;
  prepareScoring: (state: GameState, action: string) => GameState;
  randomAvailableIndex: (state: GameState) => number | null;
};

function applyRandomFigureEffect(
  state: GameState,
  context: TurnEffectContext,
): { state: GameState; triggered: boolean } {
  const player = state.turn;
  if (state.randomFigureTurns[player] <= 0) return { state, triggered: false };

  const index = context.randomAvailableIndex(state);
  const board = [...state.board];
  if (index !== null) board[index] = player;
  return {
    state: {
      ...state,
      board,
      randomFigureTurns: {
        ...state.randomFigureTurns,
        [player]: state.randomFigureTurns[player] - 1,
      },
    },
    triggered: index !== null,
  };
}

function thawPlayerIce(state: GameState): {
  state: GameState;
  thawingCells: number[];
} {
  const player = state.turn;
  const board = [...state.board];
  const frozen: Record<number, FrozenCell> = {};
  const thawingCells: number[] = [];

  Object.entries(state.frozen).forEach(([rawIndex, effect]) => {
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
  });
  return { state: { ...state, board, frozen }, thawingCells };
}

function applyRandomFreezeEffect(
  state: GameState,
  context: TurnEffectContext,
): { state: GameState; triggered: boolean } {
  const player = state.turn;
  if (state.randomFreezeTurns[player] <= 0) return { state, triggered: false };

  const next = context.freezeEmpty(state, 1, "Сработал эффект льда");
  return {
    state: {
      ...next,
      randomFreezeTurns: {
        ...next.randomFreezeTurns,
        [player]: next.randomFreezeTurns[player] - 1,
      },
    },
    triggered: true,
  };
}

function startOfTurnAction(effectCount: number): string {
  return effectCount > 0
    ? "Сработали эффекты начала хода"
    : "Новый ход: мана восстановлена, добраны 2 карты";
}

export function applyStartOfTurnEffects(
  state: GameState,
  context: TurnEffectContext,
): GameState {
  const figureEffect = applyRandomFigureEffect(state, context);
  const thawResult = thawPlayerIce(figureEffect.state);
  const freezeEffect = applyRandomFreezeEffect(thawResult.state, context);
  const effectCount = Number(figureEffect.triggered) +
    thawResult.thawingCells.length +
    Number(freezeEffect.triggered);
  const action = startOfTurnAction(effectCount);

  if (thawResult.thawingCells.length > 0) {
    return {
      ...freezeEffect.state,
      phase: "thawing",
      thawingCells: thawResult.thawingCells,
      lastAction: action,
    };
  }
  return context.prepareScoring(freezeEffect.state, action);
}
