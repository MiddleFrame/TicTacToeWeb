import { STARTER_SELECTED_KINDS, type CardKind } from "./cards.ts";

export const TEST_COIN_GRANT = 500;

export type CollectionProgress = {
  selectedKinds: CardKind[];
  unlockedKinds: CardKind[];
};

export function grantCoins(current: number, amount = TEST_COIN_GRANT): number {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  return safeCurrent + safeAmount;
}

export function starterCollectionProgress(): CollectionProgress {
  return {
    selectedKinds: [...STARTER_SELECTED_KINDS],
    unlockedKinds: [...STARTER_SELECTED_KINDS],
  };
}
