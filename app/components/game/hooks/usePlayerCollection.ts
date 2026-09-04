import { compatibleDeck } from "../../../game/collections";
import { useCallback, useEffect, useRef, useState } from "react";
import { DECK_BUILDING_KINDS, STARTER_SELECTED_KINDS, type CardKind } from "../../../game/cards";
import { connectGoogleAccount, getGoogleAccountState, initializePlayerProgress, sendCloudProgressOperation } from "../../../game/player-progress-client";
import {
  cacheLocalPlayerProgress,
  initialLocalPlayerProgress,
  purchaseLocalCardPack,
  readLocalPlayerProgress,
  rewardLocalCoins,
  updateLocalProfile,
} from "../../../game/local-player-progress";
import {
  enqueueProgressOperation,
  migrateLegacyProgressOperations,
  readProgressOperations,
  type ProgressOperation,
} from "../../../game/progress-operation-queue";
import { flushProgressOperations } from "../../../game/progress-sync";
import type { CardDrop } from "../../../game/card-purchase";
import type { PlayerProgressSnapshot } from "../../../game/player-progress";
import type { PlaySound } from "./useGameAudio";
import { useElementProgression } from "./useElementProgression";

const PENDING_NAME_KEY = "tttp-pending-name";

export function usePlayerCollection(playSfx: PlaySound) {
  const initial = initialLocalPlayerProgress();
  const progressRef = useRef(initial);
  const syncElements = useRef<(progress: PlayerProgressSnapshot) => void>(() => undefined);
  const requestSync = useRef<() => void>(() => undefined);
  const syncLock = useRef<Promise<boolean> | null>(null);
  const [selectedKinds, setSelectedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [unlockedKinds, setUnlockedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [coins, setCoins] = useState(initial.coins);
  const [drops, setDrops] = useState<CardDrop[]>([]);
  const [purchaseError, setPurchaseError] = useState(false);
  const purchaseLock = useRef(false);
  const [purchasedKinds, setPurchasedKinds] = useState<CardKind[]>([]);
  const [profileName, setProfileName] = useState(initial.nickname);
  const [cloudReady, setCloudReady] = useState(false);
  const [transactionPending, setTransactionPending] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  const applyProgress = useCallback((progress: PlayerProgressSnapshot) => {
    progressRef.current = progress;
    setSelectedKinds(progress.selectedKinds);
    setUnlockedKinds(progress.unlockedKinds);
    setCoins(progress.coins);
    setProfileName(progress.nickname);
    cacheLocalPlayerProgress(window.localStorage, progress);
    syncElements.current(progress);
  }, []);

  const progression = useElementProgression(
    applyProgress,
    useCallback(() => progressRef.current, []),
    useCallback(() => requestSync.current(), []),
  );
  useEffect(() => { syncElements.current = progression.sync; }, [progression.sync]);

  const synchronize = useCallback((): Promise<boolean> => {
    if (syncLock.current) return syncLock.current;
    const run = (async () => {
      try {
        const initialProgress = await initializePlayerProgress();
        const progress = await flushProgressOperations(window.localStorage, initialProgress, sendCloudProgressOperation);
        applyProgress(progress);
        setCloudReady(true);
        const google = await getGoogleAccountState().catch(() => null);
        if (google) {
          setGoogleAvailable(google.available);
          setGoogleEmail(google.email);
          setGoogleLinked(google.linked);
        }
        return true;
      } catch {
        setCloudReady(false);
        return false;
      } finally {
        syncLock.current = null;
      }
    })();
    syncLock.current = run;
    return run;
  }, [applyProgress]);

  useEffect(() => { requestSync.current = () => { void synchronize(); }; }, [synchronize]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const local = readLocalPlayerProgress(window.localStorage);
      progressRef.current = local;
      applyProgress(local);
      migrateLegacyProgressOperations(window.localStorage, local);
      void synchronize();
    }, 0);
    return () => window.clearTimeout(restore);
  }, [applyProgress, synchronize]);

  useEffect(() => {
    const reconnect = () => { void synchronize(); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [synchronize]);

  const enqueue = (operation: ProgressOperation) => {
    enqueueProgressOperation(window.localStorage, operation);
    requestSync.current();
  };

  const toggleCard = (kind: CardKind) => {
    if (!unlockedKinds.includes(kind)) return;
    setSelectedKinds((current) => current.includes(kind)
      ? current.length <= 5 ? current : current.filter((item) => item !== kind)
      : compatibleDeck([...current, kind]) ? [...current, kind] : current);
  };

  const saveDeck = async () => {
    const library = { ...progression.deckLibrary, decks: progression.deckLibrary.decks.map((deck) =>
      deck.id === progression.deckLibrary.activeId ? { ...deck, kinds: selectedKinds } : deck) };
    return progression.saveLibrary(library);
  };

  const changeName = (name: string) => {
    applyProgress(updateLocalProfile(progressRef.current, name));
    window.localStorage.setItem(PENDING_NAME_KEY, name);
  };

  const saveProfile = () => {
    const nickname = progressRef.current.nickname;
    enqueue({ id: crypto.randomUUID(), type: "profile", input: { nickname } });
    window.localStorage.removeItem(PENDING_NAME_KEY);
  };

  const buyCards = async (count: number, collectionId: string) => {
    if (purchaseLock.current) return;
    purchaseLock.current = true;
    setTransactionPending(true);
    setPurchaseError(false);
    try {
      const operation = { id: crypto.randomUUID(), type: "purchase" as const, count, collectionId };
      const result = purchaseLocalCardPack(progressRef.current, operation.id, count, collectionId);
      enqueueProgressOperation(window.localStorage, operation);
      setDrops(result.drops);
      playSfx("click", 0.38);
      applyProgress(result.progress);
      setPurchasedKinds(result.purchasedKinds);
      requestSync.current();
    } catch {
      setPurchaseError(true);
    } finally {
      purchaseLock.current = false;
      setTransactionPending(false);
    }
  };

  const creditCoins = async (amount: number) => {
    const normalized = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (normalized === 0) return;
    const operation = { id: crypto.randomUUID(), type: "reward-ad" as const };
    playSfx("click", 0.38);
    enqueueProgressOperation(window.localStorage, operation);
    applyProgress(rewardLocalCoins(progressRef.current, normalized));
    requestSync.current();
  };

  const connectGoogle = async () => {
    if (!googleAvailable || googlePending) return;
    setGooglePending(true);
    setGoogleError(false);
    try {
      if (!await synchronize() || readProgressOperations(window.localStorage).length > 0) throw new Error("progress-sync-pending");
      const connected = await connectGoogleAccount();
      applyProgress(connected.progress);
      setGoogleEmail(connected.email);
      setGoogleLinked(true);
      setCloudReady(true);
    } catch {
      const refreshed = await getGoogleAccountState().catch(() => null);
      if (refreshed) {
        setGoogleAvailable(refreshed.available);
        setGoogleEmail(refreshed.email);
        setGoogleLinked(refreshed.linked);
      }
      setGoogleError(!refreshed?.linked);
    } finally {
      setGooglePending(false);
    }
  };

  return {
    progression, drops, purchaseError,
    buyCards,
    changeName,
    cloudReady,
    coins,
    creditCoins,
    connectGoogle,
    googleAvailable,
    googleEmail,
    googleError,
    googleLinked,
    googlePending,
    lockedKinds: DECK_BUILDING_KINDS.filter((kind) => !unlockedKinds.includes(kind)),
    profileName,
    purchasedKinds,
    saveDeck,
    saveProfile,
    selectedKinds,
    setPurchasedKinds,
    toggleCard,
    transactionPending,
    unlockedKinds,
  };
}
