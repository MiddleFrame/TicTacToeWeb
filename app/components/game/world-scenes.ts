import type { ComponentType } from "react";
import type { GameWorld } from "../../game/game-world";
import type { WorldSceneProps } from "./WorldControls";

export type WorldScene = { world: GameWorld; component: ComponentType<WorldSceneProps> };

export async function loadWorld(world: GameWorld): Promise<WorldScene> {
  const component = world === "tttr"
    ? (await import("./RogueliteWorld")).RogueliteWorld
    : (await import("./PlusWorld")).PlusWorld;
  return { world, component };
}
