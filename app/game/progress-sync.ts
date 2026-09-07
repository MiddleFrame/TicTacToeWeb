import type { PlayerProgressSnapshot } from "./player-progress.ts";
import { readProgressOperations, removeProgressOperation, type ProgressOperation } from "./progress-operation-queue.ts";
import { ProgressRequestError } from "./progress-request-error.ts";

type SyncStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type SendProgressOperation = (operation: ProgressOperation) => Promise<{ progress: PlayerProgressSnapshot }>;

export async function flushProgressOperations(
  storage: SyncStorage,
  initial: PlayerProgressSnapshot,
  send: SendProgressOperation,
  isCurrent: () => boolean = () => true,
): Promise<PlayerProgressSnapshot> {
  let progress = initial;
  while (true) {
    if (!isCurrent()) throw new ProgressRequestError("session-changed", 401);
    const operation = readProgressOperations(storage)[0];
    if (!operation) return progress;
    const response = await send(operation);
    if (!isCurrent()) throw new ProgressRequestError("session-changed", 401);
    if (response.progress.accountId !== initial.accountId) throw new ProgressRequestError("account-progress-conflict", 409);
    progress = response.progress;
    removeProgressOperation(storage, operation.id);
  }
}
