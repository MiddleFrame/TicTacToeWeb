import assert from "node:assert/strict";
import test from "node:test";

import { chooseCardReward, createRoguelikeGame, createRoguelikeRun, getRoguelikeStage, resolveRoguelikeResult } from "../../app/game/roguelike.ts";

test("roguelike starts with stage rules and ten base cards", () => {
  const run = createRoguelikeRun();
  const game = createRoguelikeGame(run);

  assert.equal(game.size, 3);
  assert.equal(game.scoreToWin, 3);
  assert.equal(game.maxMana, 0);
  assert.equal(game.singleRound, true);
  assert.equal([...game.hands[1], ...game.decks[1]].length, 10);
  assert.ok([...game.hands[1], ...game.decks[1]].every((card) => card.kind === "place"));
});

test("first roguelike victory grants one mana and a mandatory card reward", () => {
  const run = resolveRoguelikeResult(createRoguelikeRun(), 1);

  assert.equal(run.victories, 1);
  assert.equal(run.stageIndex, 1);
  assert.equal(run.maximumMana, 1);
  assert.equal(run.status, "reward");
  assert.equal(run.rewardChoices.length, 3);

  const rewarded = chooseCardReward(run, run.rewardChoices[0]);
  assert.equal(rewarded.status, "playing");
  assert.equal(rewarded.deck.filter((kind) => kind === "place").length, 9);
});

test("roguelike keeps every completed stage outcome for its follow-up screen", () => {
  const run = createRoguelikeRun();

  assert.equal(resolveRoguelikeResult(run, null).status, "draw");
  assert.equal(resolveRoguelikeResult(run, 2).status, "defeat");
  assert.equal(resolveRoguelikeResult(run, 1).status, "reward");
});

test("roguelike stage progression matches the configured values", () => {
  assert.deepEqual(getRoguelikeStage(3), {
    boardSize: 4,
    scoreToWin: 15,
    smartFigures: 2,
    randomFigures: 1,
  });
  assert.deepEqual(getRoguelikeStage(6), {
    boardSize: 6,
    scoreToWin: 20,
    smartFigures: 0,
    randomFigures: 5,
  });
});
