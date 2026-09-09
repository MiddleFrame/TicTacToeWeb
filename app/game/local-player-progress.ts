import { cardPackCost, drawCollectionPack, operationRandom, type CardDrop } from "./card-purchase.ts";
import { STARTER_SELECTED_KINDS, type CardKind } from "./cards.ts";
import {
  awardExperience,
  canClaim,
  claimableRewards,
  claimKey,
  initialPasses,
  normalizePasses,
  PROGRESSION_VERSION,
  rewardsFor,
  roundExperience,
  type RewardTrack,
  type RoundOutcome,
  type XpAward,
} from "./element-progression.ts";
import { progressionVersion, type ProgressionVersion } from "./progression-curve.ts";
import type { GameMode } from "./game-mode.ts";
import {
  normalizeCoins,
  normalizeNickname,
  normalizeSelectedKinds,
  normalizeUnlockedKinds,
  parseStoredKinds,
  STARTER_COINS,
  type PlayerProgressSnapshot,
} from "./player-progress.ts";
import { validRoundCards } from "./round-progression.ts";
import { initialDeckLibrary, validateLibrary, type DeckLibrary } from "./saved-decks.ts";

const SNAPSHOT_KEY = "tttp-local-progress-v2";
const DECK_KEY = "tttp-deck";
const UNLOCKED_KEY = "tttp-unlocked";
const COINS_KEY = "tttp-coins";
const NAME_KEY = "tttp-player-name";

type StoredProgress = Partial<PlayerProgressSnapshot>;
type ProgressionInput = Record<string, unknown>;

export type LocalPurchaseResult = {
  progress: PlayerProgressSnapshot;
  drops: CardDrop[];
  purchasedKinds: CardKind[];
  awards: XpAward[];
};

function parsedSnapshot(storage: Pick<Storage, "getItem">): StoredProgress {
  try {
    const value = JSON.parse(storage.getItem(SNAPSHOT_KEY) ?? "null");
    return value && typeof value === "object" ? value as StoredProgress : {};
  } catch {
    return {};
  }
}

export function initialLocalPlayerProgress(): PlayerProgressSnapshot {
  return {
    accountId: "local",
    publicCode: "",
    nickname: "Игрок",
    coins: STARTER_COINS,
    cosmeticCurrency: 0,
    selectedKinds: [...STARTER_SELECTED_KINDS],
    unlockedKinds: [...STARTER_SELECTED_KINDS],
    legacyImported: false,
    passes: initialPasses(),
    deckLibrary: initialDeckLibrary(),
  };
}

export function readLocalPlayerProgress(storage: Pick<Storage, "getItem">): PlayerProgressSnapshot {
  const stored = parsedSnapshot(storage);
  const unlockedKinds = normalizeUnlockedKinds(
    stored.unlockedKinds ?? parseStoredKinds(storage.getItem(UNLOCKED_KEY)),
  );
  const selectedKinds = normalizeSelectedKinds(
    stored.selectedKinds ?? parseStoredKinds(storage.getItem(DECK_KEY)),
    unlockedKinds,
  );
  const legacyCoins = storage.getItem(COINS_KEY);
  const coins = normalizeCoins(stored.coins ?? (legacyCoins === null ? STARTER_COINS : Number(legacyCoins)));
  const candidateLibrary = stored.deckLibrary;
  const deckLibrary = validateLibrary(candidateLibrary, unlockedKinds)
    ? candidateLibrary
    : initialDeckLibrary(selectedKinds);
  return {
    accountId: typeof stored.accountId === "string" ? stored.accountId : storage.getItem("tttp-cloud-account") ?? "local",
    publicCode: typeof stored.publicCode === "string" ? stored.publicCode : "",
    nickname: normalizeNickname(stored.nickname ?? storage.getItem(NAME_KEY), "Игрок"),
    coins,
    cosmeticCurrency: normalizeCoins(stored.cosmeticCurrency),
    selectedKinds: normalizeSelectedKinds(deckLibrary.decks.find((deck) => deck.id === deckLibrary.activeId)?.kinds, unlockedKinds),
    unlockedKinds,
    legacyImported: stored.legacyImported === true,
    passes: normalizePasses(stored.passes),
    deckLibrary,
  };
}

export function cacheLocalPlayerProgress(storage: Pick<Storage, "setItem">, progress: PlayerProgressSnapshot): void {
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(progress));
}

export function purchaseLocalCardPack(
  progress: PlayerProgressSnapshot,
  operationId: string,
  count: number,
  collectionId: string,
  version: ProgressionVersion = PROGRESSION_VERSION,
): LocalPurchaseResult {
  const cost = cardPackCost(count);
  if (progress.coins < cost) throw new Error("insufficient-coins");
  const drops = drawCollectionPack(collectionId, count, progress.unlockedKinds, operationRandom(operationId), version);
  const passes = normalizePasses(progress.passes);
  const unlockedKinds = [...progress.unlockedKinds];
  const awards: XpAward[] = [];
  for (const drop of drops) {
    if (drop.duplicate) {
      const award = awardExperience(passes, { [collectionId]: drop.xp }, version)[0];
      drop.xp = award.amount;
      drop.xpBefore = award.before;
      drop.xpAfter = award.after;
      awards.push(award);
    } else {
      unlockedKinds.push(drop.kind);
    }
  }
  return {
    progress: { ...progress, coins: progress.coins - cost, passes, unlockedKinds },
    drops,
    awards,
    purchasedKinds: drops.map((drop) => drop.kind),
  };
}

export function rewardLocalCoins(progress: PlayerProgressSnapshot, amount: number): PlayerProgressSnapshot {
  return { ...progress, coins: normalizeCoins(progress.coins + Math.max(0, Math.floor(amount))) };
}

export function updateLocalProfile(progress: PlayerProgressSnapshot, nickname: string): PlayerProgressSnapshot {
  return { ...progress, nickname: normalizeNickname(nickname, progress.nickname) };
}

export function applyLocalProgressionAction(
  progress: PlayerProgressSnapshot,
  input: ProgressionInput,
): { progress: PlayerProgressSnapshot; awards: XpAward[] } {
  const type = String(input.type);
  const passes = normalizePasses(progress.passes);
  const version = progressionVersion(input.progressionVersion ?? PROGRESSION_VERSION);
  if (type === "save-decks") {
    if (!validateLibrary(input.library, progress.unlockedKinds)) throw new Error("invalid-deck-library");
    const library = structuredClone(input.library as DeckLibrary);
    const selectedKinds = library.decks.find((deck) => deck.id === library.activeId)!.kinds;
    return { progress: { ...progress, selectedKinds, deckLibrary: library }, awards: [] };
  }
  if (type === "claim") {
    const collectionId = String(input.collectionId);
    const level = Number(input.level);
    const track = input.track as RewardTrack;
    const pass = passes[collectionId];
    if (!pass || !canClaim(pass, level, track)) throw new Error("reward-unavailable");
    const rewards = rewardsFor(pass, level, track);
    pass.claimed.push(claimKey(level, track));
    const coins = rewards.reduce((total, reward) => total + (reward.currency === "coins" ? reward.amount : 0), progress.coins);
    return { progress: { ...progress, coins, passes }, awards: [] };
  }
  if (type === "claim-all") {
    const collectionId = String(input.collectionId);
    const pass = passes[collectionId];
    if (!pass) throw new Error("unknown-collection");
    const rewards = claimableRewards(pass);
    if (rewards.keys.length === 0) throw new Error("reward-unavailable");
    pass.claimed.push(...rewards.keys);
    return { progress: { ...progress, coins: progress.coins + rewards.coins, passes }, awards: [] };
  }
  if (type === "activate-test-premium") {
    const collectionId = String(input.collectionId);
    if (!passes[collectionId]) throw new Error("unknown-collection");
    passes[collectionId].premium = true;
    return { progress: { ...progress, passes }, awards: [] };
  }
  if (type === "record-round") {
    const outcome = input.outcome as RoundOutcome;
    if (!(["win", "loss", "draw"] as const).includes(outcome)) throw new Error("invalid-round-outcome");
    const cards = validRoundCards(input.mode as GameMode, input.kinds, progress.unlockedKinds);
    const awards = awardExperience(passes, roundExperience(cards, outcome), version);
    return { progress: { ...progress, passes }, awards };
  }
  throw new Error("unknown-progression-action");
}
