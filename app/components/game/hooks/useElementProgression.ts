import { saveRoundProgress } from "../../../game/round-progress-client";
import type { GameMode } from "../../../game/game-mode";
import { useCallback, useRef, useState } from "react";
import { cloudProgressionAction } from "../../../game/player-progress-client";
import { initialPasses, type RewardTrack, type XpAward, type RoundOutcome } from "../../../game/element-progression";
import { initialDeckLibrary, type DeckLibrary } from "../../../game/saved-decks";
import type { PlayerProgressSnapshot } from "../../../game/player-progress";
import type { CardKind } from "../../../game/cards";

export function useElementProgression(applyProgress: (progress: PlayerProgressSnapshot) => void) {
  const [passes, setPasses] = useState(initialPasses);
  const [deckLibrary, setDeckLibrary] = useState(initialDeckLibrary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const roundQueue = useRef(Promise.resolve());
  const sync = useCallback((progress: PlayerProgressSnapshot) => {
    setPasses(progress.passes);
    setDeckLibrary(progress.deckLibrary);
  }, []);

  const execute = useCallback(async (input: Record<string, unknown>) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await cloudProgressionAction(input);
      applyProgress(result.progress);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [applyProgress]);

  const recordRound = useCallback((operationId: string, kinds: CardKind[], outcome: RoundOutcome, mode: GameMode): Promise<XpAward[]> => {
    const run = roundQueue.current.then(async () => {
      const result = await saveRoundProgress({ operationId, kinds, outcome, mode });
      applyProgress(result.progress);
      return result.awards ?? [];
    });
    roundQueue.current = run.then(() => undefined, () => undefined);
    return run;
  }, [applyProgress]);

  return {
    passes, deckLibrary, busy, error, sync, recordRound,
    saveLibrary: (library: DeckLibrary) => execute({ type: "save-decks", library }),
    claim: (collectionId: string, level: number, track: RewardTrack) => execute({ type: "claim", collectionId, level, track }),
    activatePremium: (collectionId: string) => execute({ type: "activate-test-premium", collectionId }),
  };
}
