import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Photon awards a forfeit win to the remaining player", async () => {
  const [photon, hook] = await Promise.all([
    readProjectFile("app/game/photon.ts"),
    readProjectFile("app/components/game/hooks/usePhotonGame.ts"),
  ]);

  assert.match(photon, /client\.onActorLeave/);
  assert.match(photon, /this\.callbacks\.onOpponentLeave\(winner\)/);
  assert.match(hook, /awardMatchByForfeit\(current, winner\)/);
});

test("online round results hide controls and advance from the host timer", async () => {
  const [effects, overlay, scene] = await Promise.all([
    readProjectFile("app/components/game/hooks/useGamePhaseEffects.ts"),
    readProjectFile("app/components/game/GameOverlays.tsx"),
    readProjectFile("app/components/game/GameScene.tsx"),
  ]);

  assert.match(effects, /networkSide !== 1/);
  assert.match(effects, /onlineRoundAdvanceDelay/);
  assert.match(effects, /startNextRound\(current\)/);
  assert.match(overlay, /autoAdvance[\s\S]*result-auto-advance/);
  assert.match(scene, /props\.mode === "online" && game\.phase === "round-over"/);
});
