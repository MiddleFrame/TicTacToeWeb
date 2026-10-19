import { initialRogueliteProgress, validRogueliteProgress, type RogueliteProgress } from "./roguelite-progress.ts";

const PROGRESS_KEY = "tttr-progress-v1";

export function readRogueliteProgress(storage: Pick<Storage, "getItem">): RogueliteProgress {
  const raw = storage.getItem(PROGRESS_KEY);
  if (raw === null) return initialRogueliteProgress();
  const value: unknown = JSON.parse(raw);
  if (!validRogueliteProgress(value)) throw new Error("invalid-roguelite-save");
  return value;
}

export function writeRogueliteProgress(storage: Pick<Storage, "setItem">, progress: RogueliteProgress): void {
  if (!validRogueliteProgress(progress)) throw new Error("invalid-roguelite-save");
  storage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}
