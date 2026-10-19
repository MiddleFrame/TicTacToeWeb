import assert from "node:assert/strict";
import test from "node:test";
import { cardCost, createGame, endTurn, playCard, rechangeRandomCard } from "../../app/game/engine.ts";

test("base placement cards gain one cost after every placement until the turn ends", () => {
  let game = createGame();
  const first = game.hands[1].find((card) => card.kind === "place");
  assert.ok(first);
  assert.equal(cardCost(game, first), 0);

  game = playCard(game, first.id, 0);
  const nextBase = [...game.hands[1], ...game.decks[1]].find(
    (card) => card.kind === "place" && card.id !== first.id,
  );
  assert.ok(nextBase);
  assert.equal(cardCost(game, nextBase), 1);

  game = endTurn(game);
  assert.equal(game.basePlacementCosts[1], 0);
});

test("duplicate cards share their increasing mana cost", () => {
  let game = createGame();
  game = {
    ...game,
    hands: {
      ...game.hands,
      1: [
        { id: "1-shortage-a", kind: "shortage" },
        { id: "1-shortage-b", kind: "shortage" },
      ],
    },
  };
  assert.equal(cardCost(game, game.hands[1][1]), 1);
  game = playCard(game, "1-shortage-a");
  const duplicate = game.hands[1].find((card) => card.id === "1-shortage-b");
  assert.ok(duplicate);
  assert.equal(cardCost(game, duplicate), 2);
});

test("spends mana and freezes three cells with the freeze card", () => {
  let game = createGame();
  game = {
    ...game,
    hands: {
      ...game.hands,
      1: [{ id: "1-freeze-test", kind: "freeze-3" }],
    },
  };

  game = playCard(game, "1-freeze-test");
  assert.equal(game.mana, 1);
  assert.equal(game.manaByPlayer[1], 1);
  assert.equal(Object.keys(game.frozen).length, 3);
  assert.equal(game.hands[1].length, 0);

  game = endTurn(game);
  assert.equal(game.manaByPlayer[1], 1);
  assert.equal(game.manaByPlayer[2], game.maxMana);
});

test("keeps an activated random-figure effect for three turns", () => {
  let game = createGame();
  game = {
    ...game,
    hands: {
      ...game.hands,
      1: [{ id: "1-effect-test", kind: "random-effect" }],
    },
  };

  game = playCard(game, "1-effect-test");
  assert.equal(game.randomFigureTurns[1], 3);
  assert.equal(game.mana, 2);
});

test("ice encirclement only accepts an ally and freezes orthogonal neighbours", () => {
  let game = createGame();
  game = {
    ...game,
    board: [null, null, null, null, 1, null, null, null, null],
    hands: {
      ...game.hands,
      1: [{ id: "1-encircle-test", kind: "ice-encirclement" }],
    },
  };

  const rejected = playCard(game, "1-encircle-test", 0);
  assert.equal(rejected, game);

  game = playCard(game, "1-encircle-test", 4);
  assert.deepEqual(
    Object.keys(game.frozen).map(Number).sort((a, b) => a - b),
    [1, 3, 5, 7],
  );
  assert.equal(game.mana, 1);
});

test("a card can be replaced only once during the turn", () => {
  let game = createGame();
  const originalIds = game.hands[1].map((card) => card.id);
  game = rechangeRandomCard(game);

  assert.equal(game.hands[1].length, 2);
  assert.equal(game.rechangerAvailable[1], false);
  assert.notDeepEqual(
    game.hands[1].map((card) => card.id),
    originalIds,
  );

  const unchanged = rechangeRandomCard(game);
  assert.equal(unchanged, game);
});

test("freeze all mana converts every remaining point into two ice", () => {
  let game = createGame();
  game = {
    ...game,
    maxMana: 5,
    mana: 5,
    hands: {
      ...game.hands,
      1: [{ id: "1-freeze-mana-test", kind: "freeze-all-mana" }],
    },
  };

  game = playCard(game, "1-freeze-mana-test");
  assert.equal(game.mana, 0);
  assert.equal(game.manaByPlayer[1], 0);
  assert.equal(Object.keys(game.frozen).length, 4);
});

test("all field cards spend the configured mana and resolve their exact effects", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    let game = createGame();
    game = {
      ...game,
      mana: 5,
      hands: { ...game.hands, 1: [{ id: "1-place-five", kind: "place-5" }] },
    };
    game = playCard(game, "1-place-five");
    assert.equal(game.mana, 1);
    assert.equal(game.board.filter(Boolean).length, 2);
    assert.equal(game.scores[1], 3);

    game = createGame();
    game = {
      ...game,
      mana: 5,
      hands: { ...game.hands, 1: [{ id: "1-freeze-all", kind: "freeze-all-mana" }] },
    };
    game = playCard(game, "1-freeze-all");
    assert.equal(game.mana, 0);
    assert.equal(Object.keys(game.frozen).length, 4);

    game = createGame();
    game = {
      ...game,
      mana: 3,
      hands: { ...game.hands, 1: [{ id: "1-place-more", kind: "place-more" }] },
    };
    game = playCard(game, "1-place-more");
    assert.equal(game.mana, 0);
    assert.equal(game.phase, "clearing");
    assert.equal(game.clearingCells.length, 3);
  } finally {
    Math.random = originalRandom;
  }
});

test("ice cards preserve ownership, duration and neighbour rules", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    let game = createGame();
    game = {
      ...game,
      board: [1, 1, 1, 1, 1, 1, 1, null, null],
      hands: { ...game.hands, 1: [{ id: "1-freeze-six", kind: "freeze-6-figures" }] },
    };
    game = playCard(game, "1-freeze-six");
    assert.equal(game.board.filter((cell) => cell === 1).length, 1);
    assert.equal(Object.keys(game.frozen).length, 6);
    assert.ok(Object.values(game.frozen).every((ice) => ice.owner === 1 && ice.turns === 2));

    game = createGame();
    game = {
      ...game,
      board: [null, null, null, null, 1, null, null, null, null],
      hands: { ...game.hands, 1: [{ id: "1-surround", kind: "ice-encirclement" }] },
    };
    game = playCard(game, "1-surround", 4);
    assert.deepEqual(Object.keys(game.frozen).map(Number).sort(), [1, 3, 5, 7]);

    game = {
      ...createGame(),
      board: [null, null, null, null, 1, null, null, null, null],
      frozen: { 1: { owner: 2, turns: 2 }, 3: { owner: 2, turns: 2 }, 0: { owner: 2, turns: 2 } },
      hands: { 1: [{ id: "1-break-near", kind: "surrounded-by-ice" }], 2: [] },
    };
    game = playCard(game, "1-break-near", 4);
    assert.equal(game.phase, "thawing");
    assert.deepEqual(game.thawingCells.sort(), [1, 3]);
    assert.equal(game.frozen[0].owner, 2);
  } finally {
    Math.random = originalRandom;
  }
});

test("draw and timed-effect cards match their turn counts", () => {
  let game = createGame();
  game = {
    ...game,
    hands: { ...game.hands, 1: [{ id: "1-full", kind: "full-house" }] },
  };
  game = playCard(game, "1-full");
  assert.equal(game.hands[1].length, 5);

  game = {
    ...createGame(),
    hands: { 1: [{ id: "1-short", kind: "shortage" }], 2: [] },
  };
  game = playCard(game, "1-short");
  assert.equal(game.hands[1].length, 2);

  game = {
    ...createGame(),
    hands: { 1: [{ id: "1-ice-effect", kind: "freeze-effect" }], 2: [] },
  };
  game = playCard(game, "1-ice-effect");
  assert.equal(game.randomFreezeTurns[1], 3);
  game = endTurn(game);
  game = endTurn(game);
  assert.equal(game.randomFreezeTurns[1], 2);
  assert.equal(Object.keys(game.frozen).length, 1);
});

test("destroy and spread ice cards match the limits", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const frozen = Object.fromEntries(Array.from({ length: 8 }, (_, index) => [index, { owner: 2, turns: 2 }]));
    let game = {
      ...createGame(),
      frozen,
      hands: { 1: [{ id: "1-destroy", kind: "destroy-freeze" }], 2: [] },
    };
    game = playCard(game, "1-destroy");
    assert.equal(game.thawingCells.length, 6);
    assert.equal(Object.keys(game.frozen).length, 2);

    game = {
      ...createGame(),
      frozen: { 4: { owner: 1, turns: 2 } },
      hands: { 1: [{ id: "1-spread", kind: "place-around-freeze" }], 2: [] },
    };
    game = playCard(game, "1-spread");
    assert.equal(Object.keys(game.frozen).length, 2);
  } finally {
    Math.random = originalRandom;
  }
});
