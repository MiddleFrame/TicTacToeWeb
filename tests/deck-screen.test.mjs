import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("deck header stays visible with a centered vector back icon", async () => {
  const [screen, primitives, styles] = await Promise.all([
    readProjectFile("app/components/game/DeckScreen.tsx"),
    readProjectFile("app/components/game/Primitives.tsx"),
    readProjectFile("app/globals.css"),
  ]);

  assert.match(screen, /collection-header deck-header/);
  assert.match(screen, /<BackIcon \/>/);
  assert.match(primitives, /className="back-icon"/);
  assert.match(styles, /\.deck-header \{[\s\S]*position: sticky;/);
  assert.match(styles, /\.back-button \{[\s\S]*place-items: center;/);
});

test("deck screen exposes all, ice and regular filters", async () => {
  const screen = await readProjectFile("app/components/game/DeckScreen.tsx");

  assert.match(screen, /COLLECTIONS.map/);
  assert.match(screen, /className="deck-filters"/);
  assert.match(screen, /kinds=\{visibleKinds\}/);
});
