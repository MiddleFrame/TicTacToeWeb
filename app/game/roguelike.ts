import { DECK_BUILDING_KINDS, type CardKind } from "./cards.ts";
import { createSingleRoundGame, type GameState } from "./engine.ts";

export type RoguelikeStatus =
  | "playing"
  | "upgrade"
  | "reward"
  | "replacement"
  | "defeat"
  | "draw";

export type RoguelikeStage = {
  boardSize: number;
  scoreToWin: number;
  smartFigures: number;
  randomFigures: number;
};

export type RoguelikeRun = {
  stageIndex: number;
  victories: number;
  maximumMana: number;
  deck: CardKind[];
  cardsPlayed: number;
  playerFiguresPlaced: number;
  enemyFiguresPlaced: number;
  enemyMovesRemaining: number;
  status: RoguelikeStatus;
  rewardChoices: CardKind[];
  pendingReward: CardKind | null;
};

const STAGES: readonly RoguelikeStage[] = [
  { boardSize: 3, scoreToWin: 3, smartFigures: 1, randomFigures: 0 },
  { boardSize: 3, scoreToWin: 10, smartFigures: 2, randomFigures: 0 },
  { boardSize: 4, scoreToWin: 10, smartFigures: 0, randomFigures: 3 },
  { boardSize: 4, scoreToWin: 15, smartFigures: 2, randomFigures: 1 },
  { boardSize: 5, scoreToWin: 20, smartFigures: 0, randomFigures: 4 },
  { boardSize: 5, scoreToWin: 20, smartFigures: 4, randomFigures: 0 },
  { boardSize: 6, scoreToWin: 20, smartFigures: 0, randomFigures: 5 },
];

const SMART_CYCLE = { smartFigures: 4, randomFigures: 0 };
const RANDOM_CYCLE = { smartFigures: 0, randomFigures: 5 };

export function getRoguelikeStage(stageIndex: number): RoguelikeStage {
  if (stageIndex < STAGES.length) return STAGES[Math.max(0, stageIndex)];
  const last = STAGES[STAGES.length - 1];
  const enemy = (stageIndex - STAGES.length) % 2 === 0
    ? SMART_CYCLE
    : RANDOM_CYCLE;
  return { ...last, ...enemy };
}

export function createRoguelikeRun(): RoguelikeRun {
  return {
    stageIndex: 0,
    victories: 0,
    maximumMana: 0,
    deck: Array<CardKind>(10).fill("place"),
    cardsPlayed: 0,
    playerFiguresPlaced: 0,
    enemyFiguresPlaced: 0,
    enemyMovesRemaining: 0,
    status: "playing",
    rewardChoices: [],
    pendingReward: null,
  };
}

export function createRoguelikeGame(run: RoguelikeRun): GameState {
  const stage = getRoguelikeStage(run.stageIndex);
  return createSingleRoundGame({
    size: stage.boardSize,
    maxMana: run.maximumMana,
    scoreToWin: stage.scoreToWin,
    deck: run.deck,
  });
}

function rewardChoices(): CardKind[] {
  const pool = DECK_BUILDING_KINDS.filter((kind) => kind !== "place");
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, 3);
}

export function resolveRoguelikeResult(
  run: RoguelikeRun,
  winner: 1 | 2 | null,
): RoguelikeRun {
  if (run.status !== "playing") return run;
  if (winner === null) return { ...run, status: "draw" };
  if (winner === 2) return { ...run, status: "defeat" };
  const victories = run.victories + 1;
  const maximumMana = victories === 1
    ? Math.max(run.maximumMana, 1)
    : run.maximumMana;
  const mustChooseCard = victories === 1 || maximumMana >= 6;
  return {
    ...run,
    stageIndex: run.stageIndex + 1,
    victories,
    maximumMana,
    status: mustChooseCard ? "reward" : "upgrade",
    rewardChoices: mustChooseCard ? rewardChoices() : [],
    enemyMovesRemaining: 0,
  };
}

export function chooseManaReward(run: RoguelikeRun): RoguelikeRun {
  if (run.status !== "upgrade" || run.maximumMana >= 6) return run;
  return { ...run, maximumMana: run.maximumMana + 1, status: "playing" };
}

export function openCardReward(run: RoguelikeRun): RoguelikeRun {
  if (run.status !== "upgrade") return run;
  return { ...run, status: "reward", rewardChoices: rewardChoices() };
}

export function chooseCardReward(
  run: RoguelikeRun,
  reward: CardKind,
): RoguelikeRun {
  if (run.status !== "reward" || !run.rewardChoices.includes(reward)) return run;
  if (run.victories === 1) {
    const deck = [...run.deck];
    const index = Math.max(0, deck.indexOf("place"));
    deck[index] = reward;
    return { ...run, deck, status: "playing", rewardChoices: [] };
  }
  return { ...run, pendingReward: reward, status: "replacement" };
}

export function replaceRoguelikeCard(
  run: RoguelikeRun,
  index: number,
): RoguelikeRun {
  if (
    run.status !== "replacement" ||
    run.pendingReward === null ||
    index < 0 ||
    index >= run.deck.length
  ) {
    return run;
  }
  const deck = [...run.deck];
  deck[index] = run.pendingReward;
  return {
    ...run,
    deck,
    pendingReward: null,
    rewardChoices: [],
    status: "playing",
  };
}

export function restartDrawnStage(run: RoguelikeRun): RoguelikeRun {
  return { ...run, status: "playing", enemyMovesRemaining: 0 };
}
