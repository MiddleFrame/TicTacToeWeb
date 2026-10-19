import { Capacitor, registerPlugin } from "@capacitor/core";
import { gameWorld, type GameWorld } from "./game-world.ts";

type WorldPreferencesPlugin = {
  read(): Promise<{ world: unknown }>;
  write(input: { world: GameWorld }): Promise<void>;
};

const WorldPreferences = registerPlugin<WorldPreferencesPlugin>("WorldPreferences");
const DEFAULT_WORLD_KEY = "tttp-default-world-v1";

export async function readWorldPreference(): Promise<GameWorld> {
  return Capacitor.getPlatform() === "android"
    ? gameWorld((await WorldPreferences.read()).world)
    : gameWorld(window.localStorage.getItem(DEFAULT_WORLD_KEY));
}

export async function writeWorldPreference(world: GameWorld): Promise<void> {
  if (Capacitor.getPlatform() === "android") await WorldPreferences.write({ world });
  else window.localStorage.setItem(DEFAULT_WORLD_KEY, world);
}
