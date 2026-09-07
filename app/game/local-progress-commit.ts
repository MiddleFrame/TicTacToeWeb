import { cacheLocalPlayerProgress } from "./local-player-progress.ts";
import { enqueueProgressOperation, PROGRESS_OPERATIONS_KEY, type ProgressOperation } from "./progress-operation-queue.ts";
import type { PlayerProgressSnapshot } from "./player-progress.ts";

export function commitLocalProgressOperation(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  operation: ProgressOperation,
  progress: PlayerProgressSnapshot,
): void {
  const previousQueue = storage.getItem(PROGRESS_OPERATIONS_KEY);
  enqueueProgressOperation(storage, operation);
  try {
    cacheLocalPlayerProgress(storage, progress);
  } catch (error) {
    if (previousQueue === null) storage.removeItem(PROGRESS_OPERATIONS_KEY);
    else storage.setItem(PROGRESS_OPERATIONS_KEY, previousQueue);
    throw error;
  }
}
