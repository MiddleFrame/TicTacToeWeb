import { useCallback, useEffect, useRef, useState } from "react";
import type { CardKind } from "../../../game/cards";
import type { GameState, Player } from "../../../game/engine";
import type { GameMode } from "../../../game/game-mode";
import type { RoundOutcome, XpAward } from "../../../game/element-progression";

type RecordRound = (id: string, kinds: CardKind[], outcome: RoundOutcome, mode: GameMode) => Promise<XpAward[]>;
type PendingRound = { id: string; kinds: CardKind[]; outcome: RoundOutcome; mode: GameMode };
export type RoundProgressResult = { awards: XpAward[]; pending: boolean; failed: boolean; retry: () => void };

export function useRoundProgression(game: GameState, mode: GameMode, active: boolean, viewer: Player, forfeit: boolean, record: RecordRound): RoundProgressResult {
  const [result, setResult] = useState({ awards: [] as XpAward[], pending: false, failed: false });
  const pending = useRef<PendingRound | null>(null);
  const lifecycle = useRef({ ended: false, active: false });
  const sending = useRef(new Set<string>());
  const submit = useCallback(async (round: PendingRound) => {
    if (sending.current.has(round.id)) return;
    sending.current.add(round.id);
    setResult({ awards: [], pending: true, failed: false });
    try {
      const awards = await record(round.id, round.kinds, round.outcome, round.mode);
      if (pending.current?.id === round.id) setResult({ awards, pending: false, failed: false });
    } catch {
      if (pending.current?.id === round.id) setResult({ awards: [], pending: false, failed: true });
    } finally {
      sending.current.delete(round.id);
    }
  }, [record]);

  useEffect(() => {
    const ended = active && ["round-over", "game-over"].includes(game.phase);
    const previous = lifecycle.current;
    lifecycle.current = { ended, active };
    if (!ended || previous.ended || !previous.active || forfeit) return;
    const round: PendingRound = {
      id: crypto.randomUUID(), kinds: [...game.deckKinds], mode,
      outcome: game.roundWinner === null ? "draw" : game.roundWinner === viewer ? "win" : "loss",
    };
    pending.current = round;
    window.setTimeout(() => void submit(round), 0);
  }, [active, forfeit, game.deckKinds, game.phase, game.roundWinner, mode, submit, viewer]);

  return { ...result, retry: () => pending.current && void submit(pending.current) };
}
