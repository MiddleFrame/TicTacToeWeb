import type { CardKind } from "./cards.ts";
import { isOperationId, type PlayerProgressSnapshot } from "./player-progress.ts";

export const PROGRESS_OPERATIONS_KEY = "tttp-progress-operations-v1";

export type ProgressOperation =
  | { id: string; type: "purchase"; count: number; collectionId: string }
  | { id: string; type: "reward-ad" }
  | { id: string; type: "progression"; input: Record<string, unknown> }
  | { id: string; type: "profile"; input: { nickname?: string; selectedKinds?: CardKind[] } };

type QueueStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function readProgressOperations(storage: Pick<Storage, "getItem">): ProgressOperation[] {
  try {
    const value = JSON.parse(storage.getItem(PROGRESS_OPERATIONS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isProgressOperation) : [];
  } catch {
    return [];
  }
}

export function enqueueProgressOperation(storage: QueueStorage, operation: ProgressOperation): void {
  const queue = readProgressOperations(storage).filter((item) => !supersededBy(item, operation));
  if (!queue.some((item) => item.id === operation.id)) {
    storage.setItem(PROGRESS_OPERATIONS_KEY, JSON.stringify([...queue, operation]));
  }
}

function isProgressOperation(item: unknown): item is ProgressOperation {
  if (!item || typeof item !== "object") return false;
  const value = item as Record<string, unknown>;
  if (!isOperationId(value.id)) return false;
  if (value.type === "purchase") return typeof value.collectionId === "string" && [1, 5].includes(Number(value.count));
  if (value.type === "reward-ad") return true;
  if (value.type === "profile") return Boolean(value.input && typeof value.input === "object");
  return value.type === "progression" && Boolean(value.input && typeof value.input === "object");
}

function supersededBy(current: ProgressOperation, next: ProgressOperation): boolean {
  if (current.type === "profile" && next.type === "profile") return true;
  if (current.type !== "progression" || next.type !== "progression") return false;
  return current.input.type === "save-decks" && next.input.type === "save-decks";
}

export function removeProgressOperation(storage: QueueStorage, id: string): void {
  storage.setItem(PROGRESS_OPERATIONS_KEY, JSON.stringify(readProgressOperations(storage).filter((item) => item.id !== id)));
}

export function migrateLegacyProgressOperations(storage: QueueStorage, progress: PlayerProgressSnapshot): void {
  const legacyRewards = parseArray(storage.getItem("tttp-pending-rewards"));
  const legacyRounds = parseArray(storage.getItem("tttp-pending-rounds"));
  for (const id of legacyRewards.filter((item): item is string => typeof item === "string")) {
    enqueueProgressOperation(storage, { id, type: "reward-ad" });
  }
  for (const round of legacyRounds) {
    if (!round || typeof round !== "object") continue;
    const value = round as Record<string, unknown>;
    if (typeof value.operationId !== "string") continue;
    enqueueProgressOperation(storage, {
      id: value.operationId,
      type: "progression",
      input: { type: "record-round", kinds: value.kinds, outcome: value.outcome, mode: value.mode, ...(progress.accountId === "local" ? {} : { accountId: progress.accountId }) },
    });
  }
  const nickname = storage.getItem("tttp-pending-name");
  const selectedKinds = parseArray(storage.getItem("tttp-pending-deck")).filter((item): item is CardKind => typeof item === "string") as CardKind[];
  if (nickname || selectedKinds.length >= 5) {
    enqueueProgressOperation(storage, {
      id: crypto.randomUUID(),
      type: "profile",
      input: { ...(nickname ? { nickname } : {}), ...(selectedKinds.length >= 5 ? { selectedKinds } : {}) },
    });
  }
  for (const key of ["tttp-pending-rewards", "tttp-pending-rounds", "tttp-pending-name", "tttp-pending-deck"]) storage.removeItem(key);
}

function parseArray(value: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
