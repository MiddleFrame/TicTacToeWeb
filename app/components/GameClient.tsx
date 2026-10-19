"use client";

import { useGameWorld } from "./game/hooks/useGameWorld";
import { WorldLoading } from "./game/WorldLoading";
import { DeferredScreen } from "./game/DeferredScreen";
import { GameSessionProvider } from "./game/GameSessionProvider";
import { useLocalization } from "../game/localization";

export function GameClient() {
  return <GameSessionProvider><div className="game-viewport"><GameWorlds /></div></GameSessionProvider>;
}

function GameWorlds() {
  const { language } = useLocalization();
  const world = useGameWorld();
  const Scene = world.scene?.component;
  return <>
    {Scene && <div className="game-world-scene" inert={world.loading || world.failed || undefined}><DeferredScreen key={world.scene!.world}
      onBack={() => world.switchWorld(world.scene!.world === "tttr" ? "tttp" : "tttr")}><Scene worldControls={{
      world: world.scene!.world, defaultWorld: world.defaultWorld,
      onSwitch: world.switchWorld, onMakeDefault: world.makeDefault, error: world.preferenceFailed, pending: world.preferencePending,
    }} /></DeferredScreen></div>}
    {(world.loading || world.failed) && <WorldLoading world={world.target} failed={world.failed}
      onRetry={world.retry} onBack={world.scene ? world.cancel : () => world.switchWorld(world.target === "tttr" ? "tttp" : "tttr")}
      language={language} />}
  </>;
}
