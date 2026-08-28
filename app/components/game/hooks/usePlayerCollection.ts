import { useEffect, useState } from "react";
import { DECK_BUILDING_KINDS, STARTER_SELECTED_KINDS, type CardKind } from "../../../game/cards";
import { cardPackCost, drawCardPack } from "../../../game/card-purchase";
import type { PlaySound } from "./useGameAudio";

function validKinds(value: unknown): CardKind[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (kind): kind is CardKind =>
      typeof kind === "string" && DECK_BUILDING_KINDS.includes(kind as CardKind),
  );
}

export function usePlayerCollection(playSfx: PlaySound) {
  const [selectedKinds, setSelectedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [unlockedKinds, setUnlockedKinds] = useState<CardKind[]>([...STARTER_SELECTED_KINDS]);
  const [coins, setCoins] = useState(220);
  const [purchasedKinds, setPurchasedKinds] = useState<CardKind[]>([]);
  const [profileName, setProfileName] = useState("Игрок");

  useEffect(() => {
    let timeout: number | undefined;
    try {
      const deck = validKinds(JSON.parse(window.localStorage.getItem("tttp-deck") ?? "null"));
      const unlocked = validKinds(JSON.parse(window.localStorage.getItem("tttp-unlocked") ?? "null"));
      const restoredUnlocked = [...new Set([...STARTER_SELECTED_KINDS, ...unlocked])];
      const restoredDeck = deck.filter((kind) => restoredUnlocked.includes(kind));
      const savedCoinsRaw = window.localStorage.getItem("tttp-coins");
      const savedCoins = savedCoinsRaw === null ? null : Number(savedCoinsRaw);
      const savedName = window.localStorage.getItem("tttp-player-name");
      timeout = window.setTimeout(() => {
        setUnlockedKinds(restoredUnlocked);
        setSelectedKinds(restoredDeck.length >= 5 ? [...new Set(restoredDeck)] : [...STARTER_SELECTED_KINDS]);
        if (savedCoins !== null && Number.isFinite(savedCoins) && savedCoins >= 0) setCoins(savedCoins);
        if (savedName) setProfileName(savedName.slice(0, 20));
      }, 0);
    } catch {}
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, []);

  const toggleCard = (kind: CardKind) => {
    if (!unlockedKinds.includes(kind)) return;
    setSelectedKinds((current) => current.includes(kind)
      ? current.length <= 5 ? current : current.filter((item) => item !== kind)
      : [...current, kind]);
  };

  const saveDeck = () => {
    window.localStorage.setItem("tttp-deck", JSON.stringify(selectedKinds));
  };

  const changeName = (name: string) => {
    setProfileName(name);
    window.localStorage.setItem("tttp-player-name", name);
  };

  const buyCards = (count: number) => {
    const locked = DECK_BUILDING_KINDS.filter((kind) => !unlockedKinds.includes(kind));
    const cost = cardPackCost(count);
    if (coins < cost || locked.length < count || count < 1) return;
    playSfx("click", 0.38);
    const kinds = drawCardPack(locked, count);
    const nextCoins = coins - cost;
    const nextUnlocked = [...unlockedKinds, ...kinds];
    const nextDeck = [...new Set([...selectedKinds, ...kinds])];
    setCoins(nextCoins);
    setUnlockedKinds(nextUnlocked);
    setSelectedKinds(nextDeck);
    setPurchasedKinds(kinds);
    window.localStorage.setItem("tttp-coins", String(nextCoins));
    window.localStorage.setItem("tttp-unlocked", JSON.stringify(nextUnlocked));
    window.localStorage.setItem("tttp-deck", JSON.stringify(nextDeck));
  };

  const creditCoins = (amount: number) => {
    const normalized = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (normalized === 0) return;
    playSfx("click", 0.38);
    setCoins((current) => {
      const next = current + normalized;
      window.localStorage.setItem("tttp-coins", String(next));
      return next;
    });
  };

  return {
    buyCards,
    changeName,
    coins,
    creditCoins,
    lockedKinds: DECK_BUILDING_KINDS.filter((kind) => !unlockedKinds.includes(kind)),
    profileName,
    purchasedKinds,
    saveDeck,
    selectedKinds,
    setPurchasedKinds,
    toggleCard,
    unlockedKinds,
  };
}
