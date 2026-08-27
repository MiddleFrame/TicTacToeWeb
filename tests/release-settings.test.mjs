import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("release settings do not expose collection debug controls", async () => {
  const files = await Promise.all([
    readProjectFile("app/components/game/SettingsScreen.tsx"),
    readProjectFile("app/components/game/GameNavigation.tsx"),
    readProjectFile("app/components/game/hooks/usePlayerCollection.ts"),
    readProjectFile("app/game/localization.tsx"),
    readProjectFile("app/globals.css"),
  ]);
  const source = files.join("\n");

  assert.doesNotMatch(source, /settings-test/);
  assert.doesNotMatch(source, /addTestCoins|onAddCoins|testCoinGrant/);
  assert.doesNotMatch(source, /resetCards|onResetCards/);
  assert.doesNotMatch(source, /testingHint|currentBalance|addCoins/);
});
