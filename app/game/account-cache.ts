const ACCOUNT_KEYS = [
  "tttp-deck", "tttp-unlocked", "tttp-coins", "tttp-player-name",
  "tttp-pending-deck", "tttp-pending-name", "tttp-pending-rewards", "tttp-cloud-account",
];

export function clearAccountCache(storage: Pick<Storage, "removeItem" | "setItem">): void {
  for (const key of ACCOUNT_KEYS) storage.removeItem(key);
  storage.setItem("tttp-coins", "0");
}

export function adoptCloudAccount(storage: Pick<Storage, "getItem" | "removeItem" | "setItem">, accountId: string): void {
  if (storage.getItem("tttp-cloud-account") !== accountId) {
    for (const key of ["tttp-pending-deck", "tttp-pending-name", "tttp-pending-rewards"]) storage.removeItem(key);
  }
  storage.setItem("tttp-cloud-account", accountId);
}
