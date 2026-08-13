import type { CardTarget } from "./cards.ts";

export type CardDropLocation = {
  hoverIndex: number | null;
  overField: boolean;
};

export type CardDrop =
  | { type: "cancel" }
  | { type: "play"; targetIndex?: number };

const cancelDrop: CardDrop = { type: "cancel" };

const targetedDrop = (location: CardDropLocation): CardDrop =>
  location.overField && location.hoverIndex !== null
    ? { type: "play", targetIndex: location.hoverIndex }
    : cancelDrop;

const DROP_RESOLVERS: Record<CardTarget, (location: CardDropLocation) => CardDrop> = {
  ally: targetedDrop,
  empty: targetedDrop,
  none: (location) => location.overField ? { type: "play" } : cancelDrop,
};

export function resolveCardDrop(
  target: CardTarget,
  location: CardDropLocation,
): CardDrop {
  return DROP_RESOLVERS[target](location);
}
