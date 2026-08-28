import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  applyNetworkIntent,
  createPhotonSession,
  INITIAL_PHOTON_SNAPSHOT,
  type NetworkIntent,
  type PhotonSession,
  type PhotonSessionFactory,
  type PhotonSnapshot,
} from "../../../game/photon";
import { awardMatchByForfeit, type GameState } from "../../../game/engine";
import type { PhotonGameConfig } from "../../../game/photon-config";
import type { GameMode } from "../types";

export function usePhotonGame(
  game: GameState,
  mode: GameMode,
  setGame: Dispatch<SetStateAction<GameState>>,
  onOpponentLeave?: () => void,
  sessionFactory: PhotonSessionFactory = createPhotonSession,
) {
  const [network, setNetwork] = useState<PhotonSnapshot>(INITIAL_PHOTON_SNAPSHOT);
  const [intentPending, setIntentPending] = useState(false);
  const sessionRef = useRef<PhotonSession | null>(null);

  if (sessionRef.current === null) {
    sessionRef.current = sessionFactory({
      onOpponentLeave: () => undefined,
      onSnapshot: () => undefined,
      onState: () => undefined,
      onIntent: () => undefined,
    });
  }

  useEffect(() => {
    sessionRef.current?.updateCallbacks({
      onOpponentLeave: (winner) => {
        setIntentPending(false);
        setGame((current) => awardMatchByForfeit(current, winner));
        onOpponentLeave?.();
      },
      onSnapshot: (snapshot) => {
        setNetwork(snapshot);
        if (snapshot.phase !== "ready") setIntentPending(false);
      },
      onState: (remoteState) => {
        setIntentPending(false);
        setGame(remoteState);
      },
      onIntent: (intent) => {
        if (network.side !== 1) return;
        setGame((current) => applyNetworkIntent(current, intent, 2));
      },
    });
  }, [network.side, onOpponentLeave, setGame]);

  useEffect(() => {
    if (!intentPending) return;
    const timeout = window.setTimeout(() => setIntentPending(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [intentPending]);

  useEffect(() => {
    if (mode === "online" && network.phase === "ready" && network.side === 1) {
      sessionRef.current?.broadcastState(game);
    }
  }, [game, mode, network.phase, network.side]);

  useEffect(() => () => sessionRef.current?.disconnect(), []);

  const connect = useCallback((config: PhotonGameConfig) => {
    setIntentPending(false);
    return sessionRef.current?.connect(config) ?? Promise.resolve();
  }, []);

  const disconnect = useCallback(() => {
    setIntentPending(false);
    sessionRef.current?.disconnect();
  }, []);

  const sendIntent = useCallback((intent: NetworkIntent) => {
    setIntentPending(true);
    sessionRef.current?.sendIntent(intent);
  }, []);

  return { connect, disconnect, intentPending, network, sendIntent };
}
