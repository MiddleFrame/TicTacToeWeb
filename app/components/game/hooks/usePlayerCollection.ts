import { flushRoundProgress } from "../../../game/round-progress-client";
import { useElementProgression } from "./useElementProgression";
import type { CardDrop } from "../../../game/card-purchase";
import { compatibleDeck } from "../../../game/collections";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DECK_BUILDING_KINDS,
  STARTER_SELECTED_KINDS,
  type CardKind,
} from "../../../game/cards";
import {
  connectGoogleAccount,
  getGoogleAccountState,
  grantCloudAdReward,
  initializePlayerProgress,
  purchaseCloudCardPack,
  refreshCloudPlayerProgress,
  saveCloudPlayerProgress,
} from "../../../game/player-progress-client";
import {
  normalizeCoins,
  normalizeSelectedKinds,
  normalizeUnlockedKinds,
  parseStoredKinds,
  STARTER_COINS,
  type LocalProgressSnapshot,
  type PlayerProgressSnapshot,
} from "../../../game/player-progress";
import type { PlaySound } from "./useGameAudio";

const DECK_KEY = "tttp-deck";
const UNLOCKED_KEY = "tttp-unlocked";
const COINS_KEY = "tttp-coins";
const NAME_KEY = "tttp-player-name";
const PENDING_DECK_KEY = "tttp-pending-deck";
const PENDING_NAME_KEY = "tttp-pending-name";
const PENDING_REWARDS_KEY = "tttp-pending-rewards";

function readLocalProgress(): LocalProgressSnapshot {
  const unlockedKinds = normalizeUnlockedKinds(
    parseStoredKinds(window.localStorage.getItem(UNLOCKED_KEY)),
  );
  const selectedKinds = normalizeSelectedKinds(
    parseStoredKinds(window.localStorage.getItem(DECK_KEY)),
    unlockedKinds,
  );
  const savedCoinsRaw = window.localStorage.getItem(COINS_KEY);
  return {
    nickname: window.localStorage.getItem(NAME_KEY) || "Игрок",
    coins: savedCoinsRaw === null ? STARTER_COINS : normalizeCoins(Number(savedCoinsRaw)),
    selectedKinds,
    unlockedKinds,
  };
}

function cacheProgress(progress: PlayerProgressSnapshot): void {
  window.localStorage.setItem(DECK_KEY, JSON.stringify(progress.selectedKinds));
  window.localStorage.setItem(UNLOCKED_KEY, JSON.stringify(progress.unlockedKinds));
  window.localStorage.setItem(COINS_KEY, String(progress.coins));
  window.localStorage.setItem(NAME_KEY, progress.nickname);
}

function pendingRewards(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(PENDING_REWARDS_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function usePlayerCollection(playSfx: PlaySound) {
  const [selectedKinds, setSelectedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [unlockedKinds, setUnlockedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [coins, setCoins] = useState(STARTER_COINS);
  const [drops, setDrops] = useState<CardDrop[]>([]);
  const [purchaseError, setPurchaseError] = useState(false);
  const purchaseLock = useRef(false);
  const purchaseOperation = useRef<{ id: string; count: number; collectionId: string } | null>(null);
  const syncElements = useRef<(progress: PlayerProgressSnapshot) => void>(() => undefined);
  const [purchasedKinds, setPurchasedKinds] = useState<CardKind[]>([]);
  const [profileName, setProfileName] = useState("Игрок");
  const [cloudReady, setCloudReady] = useState(false);
  const [transactionPending, setTransactionPending] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  const applyProgress = useCallback((progress: PlayerProgressSnapshot) => {
    setSelectedKinds(progress.selectedKinds);
    setUnlockedKinds(progress.unlockedKinds);
    setCoins(progress.coins);
    setProfileName(progress.nickname);
    cacheProgress(progress);
    syncElements.current(progress);
  }, []);

  const progression = useElementProgression(applyProgress);
  useEffect(() => { syncElements.current = progression.sync; }, [progression.sync]);

  useEffect(() => {
    let active = true;
    const local = readLocalProgress();
    const restoreTimeout = window.setTimeout(() => {
      if (!active) return;
      setSelectedKinds(local.selectedKinds);
      setUnlockedKinds(local.unlockedKinds);
      setCoins(local.coins);
      setProfileName(local.nickname);
    }, 0);
    void initializePlayerProgress().then(async (initial) => {
      window.clearTimeout(restoreTimeout);
      let progress = await flushRoundProgress().catch(() => null) ?? initial;
      const pendingDeck = parseStoredKinds(window.localStorage.getItem(PENDING_DECK_KEY));
      const pendingName = window.localStorage.getItem(PENDING_NAME_KEY);
      if (pendingDeck.length >= 5 || pendingName) {
        progress = await saveCloudPlayerProgress({
          ...(pendingDeck.length >= 5 ? { selectedKinds: pendingDeck } : {}),
          ...(pendingName ? { nickname: pendingName } : {}),
        });
        window.localStorage.removeItem(PENDING_DECK_KEY);
        window.localStorage.removeItem(PENDING_NAME_KEY);
      }
      for (const operationId of pendingRewards()) {
        progress = await grantCloudAdReward(operationId);
      }
      window.localStorage.removeItem(PENDING_REWARDS_KEY);
      if (!active) return;
      applyProgress(progress);
      setCloudReady(true);
      const google = await getGoogleAccountState();
      if (!active) return;
      setGoogleAvailable(google.available);
      setGoogleEmail(google.email);
      setGoogleLinked(google.linked);
    }).catch(() => {
      if (active) setCloudReady(false);
    });
    return () => {
      active = false;
      window.clearTimeout(restoreTimeout);
    };
  }, [applyProgress]);

  useEffect(() => {
    const reconnect = () => {
      void initializePlayerProgress().then(async () => {
        const latest = await flushRoundProgress();
        applyProgress(latest ?? await refreshCloudPlayerProgress());
        setCloudReady(true);
      }).catch(() => setCloudReady(false));
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [applyProgress]);

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
    setProfileName(name);
    window.localStorage.setItem(NAME_KEY, name);
    window.localStorage.setItem(PENDING_NAME_KEY, name);
  };

  const saveProfile = () => {
    if (!cloudReady) return;
    void saveCloudPlayerProgress({ nickname: profileName }).then((progress) => {
      window.localStorage.removeItem(PENDING_NAME_KEY);
      applyProgress(progress);
    }).catch(() => setCloudReady(false));
  };

  const buyCards = async (count: number, collectionId: string) => {
    if (!cloudReady || purchaseLock.current) return;
    purchaseLock.current = true;
    setTransactionPending(true);
    setPurchaseError(false);
    try {
      purchaseOperation.current ??= { id: crypto.randomUUID(), count, collectionId };
      const pending = purchaseOperation.current;
      const result = await purchaseCloudCardPack(pending.count, pending.collectionId, pending.id);
      purchaseOperation.current = null;
      setDrops(result.drops);
      playSfx("click", 0.38);
      applyProgress(result.progress);
      setPurchasedKinds(result.purchasedKinds);
    } catch (error) {
      const definitive = ["insufficient-coins", "invalid-pack-size", "unknown-collection", "invalid-purchase"];
      if (error instanceof Error && definitive.includes(error.message)) purchaseOperation.current = null;
      setPurchaseError(true);
    } finally {
      purchaseLock.current = false;
      setTransactionPending(false);
    }
  };

  const creditCoins = async (amount: number) => {
    const normalized = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (normalized === 0) return;
    const operationId = crypto.randomUUID();
    playSfx("click", 0.38);
    setCoins((current) => {
      const next = current + normalized;
      window.localStorage.setItem(COINS_KEY, String(next));
      return next;
    });
    if (!cloudReady) {
      const queued = [...pendingRewards(), operationId];
      window.localStorage.setItem(PENDING_REWARDS_KEY, JSON.stringify(queued));
      return;
    }
    try {
      const progress = await grantCloudAdReward(operationId);
      applyProgress(progress);
    } catch {
      const queued = [...pendingRewards(), operationId];
      window.localStorage.setItem(PENDING_REWARDS_KEY, JSON.stringify(queued));
      setCloudReady(false);
    }
  };

  const connectGoogle = async () => {
    if (!googleAvailable || googlePending) return;
    setGooglePending(true);
    setGoogleError(false);
    try {
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
