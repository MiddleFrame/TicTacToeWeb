import { compatibleDeck } from "../../../game/collections";
import { useCallback, useEffect, useRef, useState } from "react";
import { DECK_BUILDING_KINDS, STARTER_SELECTED_KINDS, type CardKind } from "../../../game/cards";
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
  type ProgressOperation,
} from "../../../game/progress-operation-queue";
import { createAccountOperationGate } from "../../../game/account-operation-gate";
import { useCloudAccount } from "./useCloudAccount";
import { CARD_PRICE, type CardDrop } from "../../../game/card-purchase";
import { PROGRESSION_VERSION } from "../../../game/element-progression";
import { commitLocalProgressOperation } from "../../../game/local-progress-commit";
import type { PlayerProgressSnapshot } from "../../../game/player-progress";
import type { PlaySound } from "./useGameAudio";
import { useElementProgression } from "./useElementProgression";

const PENDING_NAME_KEY = "tttp-pending-name";

export function usePlayerCollection(playSfx: PlaySound) {
  const [initial] = useState(initialLocalPlayerProgress);
  const progressRef = useRef(initial);
  const syncElements = useRef<(progress: PlayerProgressSnapshot) => void>(() => undefined);
  const requestSync = useRef<() => void>(() => undefined);
  const [accountGate] = useState(createAccountOperationGate);
  const [selectedKinds, setSelectedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [unlockedKinds, setUnlockedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [coins, setCoins] = useState(initial.coins);
  const [drops, setDrops] = useState<CardDrop[]>([]);
  const [purchaseError, setPurchaseError] = useState(false);
  const purchaseLock = useRef(false);
  const [purchasedKinds, setPurchasedKinds] = useState<CardKind[]>([]);
  const [profileName, setProfileName] = useState(initial.nickname);
  const [transactionPending, setTransactionPending] = useState(false);

  const displayProgress = useCallback((progress: PlayerProgressSnapshot) => {
    progressRef.current = progress;
    setSelectedKinds(progress.selectedKinds);
    setUnlockedKinds(progress.unlockedKinds);
    setCoins(progress.coins);
    setProfileName(progress.nickname);
    syncElements.current(progress);
  }, []);

  const applyProgress = useCallback((progress: PlayerProgressSnapshot) => {
    cacheLocalPlayerProgress(window.localStorage, progress);
    displayProgress(progress);
  }, [displayProgress]);
  const commitProgress = useCallback((operation: ProgressOperation, progress: PlayerProgressSnapshot) => {
    commitLocalProgressOperation(window.localStorage, operation, progress);
    displayProgress(progress);
    requestSync.current();
  }, [displayProgress]);
  const cloud = useCloudAccount(applyProgress, accountGate);

  const progression = useElementProgression(
    commitProgress,
    useCallback(() => progressRef.current, []),
    cloud.assertMutable,
  );
  useEffect(() => { syncElements.current = progression.sync; }, [progression.sync]);

  useEffect(() => { requestSync.current = cloud.requestSync; }, [cloud.requestSync]);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const local = readLocalPlayerProgress(window.localStorage);
      progressRef.current = local;
      applyProgress(local);
      migrateLegacyProgressOperations(window.localStorage, local);
      requestSync.current();
    }, 0);
    return () => window.clearTimeout(restore);
  }, [applyProgress]);

  const enqueue = (operation: ProgressOperation) => {
    cloud.assertMutable();
    enqueueProgressOperation(window.localStorage, operation);
    requestSync.current();
  };

  const toggleCard = (kind: CardKind) => {
    if (cloud.mutationsBlocked || !unlockedKinds.includes(kind)) return;
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
    if (cloud.mutationsBlocked) return;
    applyProgress(updateLocalProfile(progressRef.current, name));
    window.localStorage.setItem(PENDING_NAME_KEY, name);
  };

  const saveProfile = () => {
    if (cloud.mutationsBlocked) return;
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
      cloud.assertMutable();
      const operation = { id: crypto.randomUUID(), type: "purchase" as const, count, collectionId, progressionVersion: PROGRESSION_VERSION };
      const result = purchaseLocalCardPack(progressRef.current, operation.id, count, collectionId);
      commitProgress(operation, result.progress);
      setDrops(result.drops);
      playSfx("click", 0.38);
      setPurchasedKinds(result.purchasedKinds);
    } catch {
      setPurchaseError(true);
    } finally {
      purchaseLock.current = false;
      setTransactionPending(false);
    }
  };

  const creditCoins = (amount: number) => {
    const normalized = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (normalized === 0) return;
    const operation = { id: crypto.randomUUID(), type: "reward-ad" as const };
    playSfx("click", 0.38);
    commitProgress(operation, rewardLocalCoins(progressRef.current, normalized));
  };

  const beginRewardAd = () => {
    try {
      cloud.assertMutable();
      return accountGate.beginReward(() => creditCoins(CARD_PRICE));
    } catch {
      return null;
    }
  };

  return {
    ...cloud, progression, drops, purchaseError, beginRewardAd,
    buyCards,
    changeName,
    coins,
    lockedKinds: DECK_BUILDING_KINDS.filter((kind) => !unlockedKinds.includes(kind)),
    profileName,
    purchasedKinds,
    saveDeck,
    saveProfile,
    selectedKinds,
    setPurchasedKinds,
    toggleCard,
    transactionPending: transactionPending || cloud.mutationsBlocked,
    unlockedKinds,
  };
}
