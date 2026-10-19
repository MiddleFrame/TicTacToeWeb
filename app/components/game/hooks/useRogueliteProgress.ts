import { useCallback, useEffect, useRef, useState } from "react";
import { beginRogueliteRun, recordRogueliteStage, type RogueliteProgress } from "../../../game/roguelite-progress";
import { readRogueliteProgress, writeRogueliteProgress } from "../../../game/roguelite-storage";
import type { RoguelikeRun } from "../../../game/roguelike";

export function useRogueliteProgress() {
  const [progress, setProgress] = useState<RogueliteProgress | null>(null);
  const [failed, setFailed] = useState(false);
  const current = useRef<RogueliteProgress | null>(null);
  const restore = useCallback(() => {
    try {
      const saved = readRogueliteProgress(window.localStorage);
      current.current = saved;
      setProgress(saved);
      setFailed(false);
    } catch { setFailed(true); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(restore, 0);
    return () => window.clearTimeout(timer);
  }, [restore]);

  const commit = (update: (saved: RogueliteProgress) => RogueliteProgress) => {
    try {
      if (!current.current) throw new Error("roguelite-save-unavailable");
      const saved = readRogueliteProgress(window.localStorage);
      const next = update(saved);
      writeRogueliteProgress(window.localStorage, next);
      current.current = next;
      setProgress(next);
      setFailed(false);
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  };

  return {
    progress, failed, restore,
    start: (id: string) => commit((saved) => beginRogueliteRun(saved, id)),
    resolve: (id: string, before: RoguelikeRun, after: RoguelikeRun) => {
      if (before.status !== "playing" || after.status === "draw") return true;
      return commit((saved) => recordRogueliteStage(saved, id, before.stageIndex, after.victories > before.victories));
    },
  };
}
