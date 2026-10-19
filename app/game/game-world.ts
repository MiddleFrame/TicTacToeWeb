export type GameWorld = "tttp" | "tttr";

export function gameWorld(value: unknown): GameWorld {
  return value === "tttr" ? "tttr" : "tttp";
}
