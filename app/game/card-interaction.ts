import type { CardTarget } from "./cards.ts";

export type CardDropLocation = {
  hoverIndex: number | null;
  overField: boolean;
};

export type CardTargetArea = {
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
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

const distanceToRange = (value: number, start: number, end: number) =>
  value < start ? start - value : value > end ? value - end : 0;

export function findClosestCardTarget(
  x: number,
  y: number,
  areas: CardTargetArea[],
): number | null {
  let closest: { index: number; distance: number } | null = null;
  areas.forEach((area) => {
    const dx = distanceToRange(x, area.left, area.right);
    const dy = distanceToRange(y, area.top, area.bottom);
    const distance = dx * dx + dy * dy;
    if (!closest || distance < closest.distance) closest = { index: area.index, distance };
  });
  return closest?.index ?? null;
}
