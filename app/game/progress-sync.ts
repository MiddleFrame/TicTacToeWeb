import type { PlayerProgressSnapshot } from "./player-progress.ts";
import { readProgressOperations, removeProgressOperation, type ProgressOperation } from "./progress-operation-queue.ts";

type SyncStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type SendProgressOperation = (operation: ProgressOperation) => Promise<{ progress: PlayerProgressSnapshot }>;

export async function flushProgressOperations(
  storage: SyncStorage,
  initial: PlayerProgressSnapshot,
  send: SendProgressOperation,
): Promise<PlayerProgressSnapshot> {
  let progress = initial;
  while (true) {
    const operation = readProgressOperations(storage)[0];
    if (!operation) return progress;
    progress = (await send(operation)).progress;
    removeProgressOperation(storage, operation.id);
  }
}
