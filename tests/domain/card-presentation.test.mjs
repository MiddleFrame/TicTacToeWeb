import assert from "node:assert/strict";
import test from "node:test";
import { canPlayCard, createGame } from "../../app/game/engine.ts";
import { deckKindsForFilter } from "../../app/game/card-filters.ts";

import { chooseRandomTarget } from "../../app/game/bot-player.ts";
import { findClosestCardTarget, resolveCardDrop } from "../../app/game/card-interaction.ts";
import { CARD_MECHANICS, mechanicsForCard } from "../../app/game/card-mechanics.ts";
import { CARD_DEFINITIONS } from "../../app/game/cards.ts";
import { cardRevealProfile } from "../../app/game/card-reveal-profile.ts";
import { cardTransferSlot } from "../../app/game/card-transfer-layout.ts";

import { canTargetCard, getGamePlayers, getRoundResult } from "../../app/game/game-presentation.ts";

test("describes mechanics for every card kind", () => {
  assert.deepEqual(Object.keys(CARD_MECHANICS).sort(), Object.keys(CARD_DEFINITIONS).sort());
  assert.ok(mechanicsForCard("freeze-cell").includes("ice"));
  assert.ok(mechanicsForCard("place-draw").includes("draw"));
});

test("deck filters separate ice and regular cards", () => {
  const all = deckKindsForFilter("all");
  const ice = deckKindsForFilter("ice");
  const regular = deckKindsForFilter("regular");

  assert.equal(ice.length + regular.length, all.length);
  assert.ok(ice.every((kind) => mechanicsForCard(kind).includes("ice")));
  assert.ok(regular.every((kind) => !mechanicsForCard(kind).includes("ice")));
});

test("builds reveal profiles from rarity and mechanics", () => {
  const profiles = Object.keys(CARD_DEFINITIONS).map((kind) => cardRevealProfile(kind));
  assert.ok(profiles.every((profile) => profile.durationMs >= 5000 && profile.durationMs <= 10000));
  assert.equal(cardRevealProfile("freeze-cell").accent, "ice");
  assert.equal(cardRevealProfile("destroy-freeze").accent, "ice");
  assert.equal(cardRevealProfile("place-more").accent, "white");
  assert.equal(cardRevealProfile("place-more").accentRgb, "255 255 255");
  assert.equal(cardRevealProfile("place-more").rarity, "legendary");
  assert.ok(cardRevealProfile("place-more").scale > cardRevealProfile("place").scale);
  assert.ok(profiles.every((profile) => profile.cues.at(-1)?.sound === "light"));
});

test("scatters purchased cards horizontally in alternating directions", () => {
  const slots = Array.from({ length: 10 }, (_, index) => cardTransferSlot(index));
  assert.deepEqual(slots.map((slot) => slot.direction), [-1, 1, -1, 1, -1, 1, -1, 1, -1, 1]);
  assert.ok(slots.every((slot) => slot.insetPx >= 0));
});

test("resolves card drops through target strategies", () => {
  assert.deepEqual(resolveCardDrop("none", { overField: true, hoverIndex: null }), { type: "play" });
  assert.deepEqual(resolveCardDrop("empty", { overField: true, hoverIndex: 4 }), { type: "play", targetIndex: 4 });
  assert.deepEqual(resolveCardDrop("ally", { overField: false, hoverIndex: 4 }), { type: "cancel" });
});

test("resolves board gaps to the closest valid card target", () => {
  const areas = [
    { index: 0, left: 0, right: 40, top: 0, bottom: 40 },
    { index: 1, left: 50, right: 90, top: 0, bottom: 40 },
  ];
  assert.equal(findClosestCardTarget(47, 20, areas), 1);
  assert.equal(findClosestCardTarget(45, 20, areas), 0);
  assert.equal(findClosestCardTarget(45, 20, [areas[1]]), 1);
  assert.equal(findClosestCardTarget(45, 20, []), null);
});

test("chooses random targets through an injected random source", () => {
  const game = { ...createGame(), board: [1, null, null, 2, 1, 2, 1, 2, 1] };
  assert.equal(chooseRandomTarget(game, () => 0), 1);
  assert.equal(chooseRandomTarget(game, () => 0.99), 2);
});

test("derives player placement without UI state", () => {
  assert.deepEqual(getGamePlayers("local", 2, null), {
    bottomPlayer: 2,
    displayedPlayer: 2,
    topPlayer: 1,
  });
  assert.deepEqual(getGamePlayers("online", 1, 2), {
    bottomPlayer: 2,
    displayedPlayer: 2,
    topPlayer: 1,
  });
});

test("keeps the round result separate from a drawn match result", () => {
  const game = {
    ...createGame(),
    phase: "game-over",
    completedRounds: 3,
    roundWinner: 2,
    gameWinner: null,
    roundWins: { 1: 1, 2: 1 },
  };

  assert.deepEqual(getRoundResult(game, 1, (key) => key), {
    headline: "roundDefeat",
    tone: "defeat",
    winner: 2,
  });
});

test("shares card play validation between the engine and interface", () => {
  const game = createGame();
  const card = game.hands[1].find((item) => item.kind === "place");
  assert.ok(card);
  assert.equal(canPlayCard(game, card.id, 0), true);
  assert.equal(canTargetCard(game, card.id, 0, true), true);
  const occupied = { ...game, board: [2, ...game.board.slice(1)] };
  assert.equal(canPlayCard(occupied, card.id, 0), false);
  assert.equal(canTargetCard(occupied, card.id, 0, true), false);
  assert.equal(canPlayCard({ ...game, mana: -1 }, card.id, 0), false);
  assert.equal(canTargetCard(game, card.id, 0, false), false);

  const targetless = {
    ...game,
    hands: { ...game.hands, 1: [{ id: "1-shortage-targetless", kind: "shortage" }] },
  };
  assert.equal(canPlayCard(targetless, "1-shortage-targetless"), true);
  assert.equal(canTargetCard(targetless, "1-shortage-targetless", 0, true), false);
});
