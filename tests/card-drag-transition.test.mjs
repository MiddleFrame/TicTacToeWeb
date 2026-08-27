import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("cancelled cards settle into their hand slot before drag positioning is removed", async () => {
  const [hook, styles, types] = await Promise.all([
    readProjectFile("app/components/game/hooks/useCardDrag.ts"),
    readProjectFile("app/globals.css"),
    readProjectFile("app/components/game/types.ts"),
  ]);

  assert.match(hook, /CARD_RETURN_DURATION_MS = 650/);
  assert.match(hook, /CARD_SETTLE_DURATION_MS = 34/);
  assert.match(hook, /phase: "settled"/);
  assert.match(styles, /\.unity-hand-card\.dragging\.settled/);
  assert.match(types, /"holding" \| "returning" \| "settled"/);
});
