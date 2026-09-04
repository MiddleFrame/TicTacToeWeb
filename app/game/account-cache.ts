const ACCOUNT_KEYS = [
  "tttp-deck", "tttp-unlocked", "tttp-coins", "tttp-player-name",
  "tttp-pending-deck", "tttp-pending-name", "tttp-pending-rewards", "tttp-pending-rounds", "tttp-cloud-account",
  "tttp-local-progress-v2", "tttp-progress-operations-v1",
];

export function clearAccountCache(storage: Pick<Storage, "removeItem" | "setItem">): void {
  for (const key of ACCOUNT_KEYS) storage.removeItem(key);
  storage.setItem("tttp-coins", "0");
}

export function adoptCloudAccount(storage: Pick<Storage, "getItem" | "removeItem" | "setItem">, accountId: string): void {
  const previous = storage.getItem("tttp-cloud-account");
  if (previous && previous !== accountId) {
    for (const key of ["tttp-pending-deck", "tttp-pending-name", "tttp-pending-rewards", "tttp-pending-rounds", "tttp-progress-operations-v1"]) storage.removeItem(key);
  }
  storage.setItem("tttp-cloud-account", accountId);
}
