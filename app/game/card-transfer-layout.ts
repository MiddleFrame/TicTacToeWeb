export type CardTransferSlot = {
  direction: -1 | 1;
  insetPx: number;
  rotationDeg: number;
};

export function cardTransferSlot(index: number): CardTransferSlot {
  const direction = ([-1, 1] as const)[index % 2];
  const depth = Math.floor(index / 2);
  return {
    direction,
    insetPx: depth * 16,
    rotationDeg: direction * (4 + depth * 1.5),
  };
}
