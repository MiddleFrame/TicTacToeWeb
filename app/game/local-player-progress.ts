import { cardPackCost, drawCollectionPack, operationRandom, type CardDrop } from "./card-purchase.ts";
import { COLLECTIONS } from "./collections.ts";
import { STARTER_SELECTED_KINDS, type CardKind } from "./cards.ts";
import {
  awardExperience,
  canClaim,
  claimKey,
  initialPasses,
  PASS_LEVELS,
  PASS_REWARDS,
  roundExperience,
  type ElementPasses,
  type RewardTrack,
  type RoundOutcome,
  type XpAward,
} from "./element-progression.ts";
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

function normalizedPasses(value: unknown): ElementPasses {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const passes = initialPasses();
  for (const { id } of COLLECTIONS) {
    const candidate = source[id];
    if (!candidate || typeof candidate !== "object") continue;
    const pass = candidate as Record<string, unknown>;
    passes[id] = {
      xp: Math.min(PASS_LEVELS * 1000, normalizeCoins(pass.xp)),
      premium: pass.premium === true,
      claimed: Array.isArray(pass.claimed)
        ? [...new Set(pass.claimed.filter((item): item is string => typeof item === "string" && /^\d{1,3}:(free|premium)$/.test(item)))]
        : [],
    };
  }
  return passes;
}

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
    passes: normalizedPasses(stored.passes),
    deckLibrary,
  };
}

export function cacheLocalPlayerProgress(storage: Pick<Storage, "setItem">, progress: PlayerProgressSnapshot): void {
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(progress));
  storage.setItem(DECK_KEY, JSON.stringify(progress.selectedKinds));
  storage.setItem(UNLOCKED_KEY, JSON.stringify(progress.unlockedKinds));
  storage.setItem(COINS_KEY, String(progress.coins));
  storage.setItem(NAME_KEY, progress.nickname);
}

export function purchaseLocalCardPack(
  progress: PlayerProgressSnapshot,
  operationId: string,
  count: number,
  collectionId: string,
): LocalPurchaseResult {
  const cost = cardPackCost(count);
  if (progress.coins < cost) throw new Error("insufficient-coins");
  const drops = drawCollectionPack(collectionId, count, progress.unlockedKinds, operationRandom(operationId));
  const passes = structuredClone(progress.passes);
  const unlockedKinds = [...progress.unlockedKinds];
  const awards: XpAward[] = [];
  for (const drop of drops) {
    if (drop.duplicate) {
      const award = awardExperience(passes, { [collectionId]: drop.xp })[0];
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
  const passes = structuredClone(progress.passes);
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
    const rewards = PASS_REWARDS[level - 1].rewards[track];
    pass.claimed.push(claimKey(level, track));
    const coins = rewards.reduce((total, reward) => total + (reward.currency === "coins" ? reward.amount : 0), progress.coins);
    return { progress: { ...progress, coins, passes }, awards: [] };
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
    const awards = awardExperience(passes, roundExperience(cards, outcome));
    return { progress: { ...progress, passes }, awards };
  }
  throw new Error("unknown-progression-action");
}
