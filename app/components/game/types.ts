import type { Player } from "../../game/engine";

export type GameMode = "local" | "bot" | "roguelike" | "online";

export type DragState = {
  cardId: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  hoverIndex: number | null;
  overField: boolean;
  returning: boolean;
};

export type DamageFlight = {
  id: string;
  index: number;
  player: Player;
  dx: number;
  dy: number;
  fadeDx: number;
  fadeDy: number;
  delay: number;
};
