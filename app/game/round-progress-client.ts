import type { CardKind } from "./cards";
import type { GameMode } from "./game-mode";
import type { RoundOutcome } from "./element-progression";
import type { PlayerProgressSnapshot } from "./player-progress";
import { cloudProgressionAction } from "./player-progress-client";

const QUEUE_KEY = "tttp-pending-rounds";
type QueuedRound = { operationId: string; kinds: CardKind[]; outcome: RoundOutcome; mode: GameMode };

function queuedRounds(): QueuedRound[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export async function saveRoundProgress(round: QueuedRound) {
  if (!window.localStorage.getItem("tttp-cloud-account")) throw new Error("account-unavailable");
  const queue = queuedRounds();
  if (!queue.some((item) => item.operationId === round.operationId)) {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, round]));
  }
  const accountId = window.localStorage.getItem("tttp-cloud-account");
  const result = await cloudProgressionAction({ type: "record-round", accountId, kinds: round.kinds, outcome: round.outcome, mode: round.mode }, round.operationId);
  if (accountId !== window.localStorage.getItem("tttp-cloud-account")) throw new Error("account-changed");
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queuedRounds().filter((item) => item.operationId !== round.operationId)));
  return result;
}

export async function flushRoundProgress(): Promise<PlayerProgressSnapshot | null> {
  let progress: PlayerProgressSnapshot | null = null;
  for (const round of queuedRounds()) {
    try {
      progress = (await saveRoundProgress(round)).progress;
    } catch (error) {
      const rejected = ["invalid-round-deck", "invalid-round-mode", "invalid-round-outcome"];
      if (!(error instanceof Error) || !rejected.includes(error.message)) throw error;
    }
  }
  return progress;
}
