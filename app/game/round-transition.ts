import type { Player } from "./engine.ts";

const ONLINE_ROUND_PAUSE_MS = 2000;
const WIN_RESULT_ANIMATION_MS = 3400;
const DRAW_RESULT_ANIMATION_MS = 4300;

export function onlineRoundAdvanceDelay(roundWinner: Player | null) {
  return (roundWinner ? WIN_RESULT_ANIMATION_MS : DRAW_RESULT_ANIMATION_MS) + ONLINE_ROUND_PAUSE_MS;
}
