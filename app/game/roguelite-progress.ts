export type RogueliteProgress = {
  version: 1;
  runsStarted: number;
  victories: number;
  bestVictories: number;
  activeRun: { id: string; resolvedStages: number; finished: boolean } | null;
};

export function initialRogueliteProgress(): RogueliteProgress {
  return { version: 1, runsStarted: 0, victories: 0, bestVictories: 0, activeRun: null };
}

function counter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validRogueliteProgress(value: unknown): value is RogueliteProgress {
  if (!value || typeof value !== "object") return false;
  const progress = value as RogueliteProgress;
  const run = progress.activeRun;
  return progress.version === 1 && counter(progress.runsStarted) && counter(progress.victories)
    && counter(progress.bestVictories) && progress.bestVictories <= progress.victories
    && (run === null || Boolean(run && typeof run === "object" && typeof run.id === "string"
      && run.id.length > 0 && run.id.length <= 100 && counter(run.resolvedStages) && typeof run.finished === "boolean"));
}

export function beginRogueliteRun(progress: RogueliteProgress, id: string): RogueliteProgress {
  if (!id || id.length > 100) throw new Error("invalid-run-id");
  if (progress.activeRun?.id === id) return progress;
  return { ...progress, runsStarted: progress.runsStarted + 1, activeRun: { id, resolvedStages: 0, finished: false } };
}

export function recordRogueliteStage(progress: RogueliteProgress, id: string, stage: number, won: boolean): RogueliteProgress {
  const run = progress.activeRun;
  if (!run || run.id !== id || !counter(stage)) throw new Error("roguelite-run-changed");
  if (stage < run.resolvedStages) return progress;
  if (run.finished || stage !== run.resolvedStages) throw new Error("invalid-run-stage");
  return {
    ...progress,
    victories: progress.victories + Number(won),
    bestVictories: Math.max(progress.bestVictories, stage + Number(won)),
    activeRun: { ...run, resolvedStages: stage + 1, finished: !won },
  };
}
