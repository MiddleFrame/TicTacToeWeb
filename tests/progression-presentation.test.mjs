import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFrontendModule } from "./helpers/frontend-runtime.mjs";
import * as collections from "../app/game/collections.ts";
import * as progression from "../app/game/element-progression.ts";
import { progressionCopy } from "../app/game/progression-copy.ts";
import { progressionResponse } from "../app/backend/progression-response.ts";
import { apiJson, apiOptions } from "../app/backend/responses.ts";
import { initialLocalPlayerProgress } from "../app/game/local-player-progress.ts";

function screen(language) {
  const shared = {
    react: React, "react/jsx-runtime": jsxRuntime,
    "../../game/collections": collections,
    "../../game/element-progression": progression,
    "../../game/progression-copy": { progressionCopy },
    "../../game/localization": { useLocalization: () => ({ language, t: key => key }) },
  };
  const bars = loadFrontendModule("app/components/game/ElementProgress.tsx", { ...shared, "./Image": { Image: ({ src, alt, width, height, className }) => React.createElement("img", { src, alt, width, height, className }) } });
  const { PassScreen } = loadFrontendModule("app/components/game/PassScreen.tsx", { ...shared, "./ElementProgress": bars, "./Primitives": { BackIcon: () => React.createElement("span", null, "back") } });
  return { PassScreen, ...bars };
}

for (const language of ["ru", "en"]) {
  test(`${language} pass renders 100 empty reward pairs and all four future cosmetics without claim buttons`, () => {
    const { PassScreen } = screen(language);
    const passes = progression.initialPasses();
    passes.ice.xp = 124000;
    passes.ice.premium = true;
    const html = renderToStaticMarkup(React.createElement(PassScreen, { initialId: "ice", onBack() {}, progression: { passes, busy: false, error: false } }));
    assert.equal((html.match(/class="pass-reward pass-reward-placeholder"/g) ?? []).length, 200);
    for (const key of Object.values(progression.PREMIUM_MILESTONES)) assert.ok(html.includes(progressionCopy[language][key]));
    assert.ok(html.includes(progressionCopy[language].comingLater));
    assert.doesNotMatch(html, /pass-claim-all-button|pass-shortcut-dot|pass-reward-currency/);
    assert.match(html, /aria-valuemax="124000"/);
    assert.match(html, /aria-valuemax="277750"/);
  });
}

test("rendered progress bars use the next collection-specific cost and keep full core XP", () => {
  const { ElementProgress } = screen("en");
  const regular = renderToStaticMarkup(React.createElement(ElementProgress, { collectionId: "regular", xp: 186210 }));
  const ice = renderToStaticMarkup(React.createElement(ElementProgress, { collectionId: "ice", xp: 25610 }));
  assert.match(regular, /10 \/ 4150/);
  assert.match(regular, /Level 80/);
  assert.match(ice, /10 \/ 1050/);
  assert.match(ice, /Level 40/);
});

test("historical rewards remain a separate claim-all action, not replacement cosmetic rewards", () => {
  const { PassScreen } = screen("ru");
  const passes = progression.initialPasses();
  passes.ice = progression.normalizePass({ xp: 40000, premium: true, claimed: [] }, "ice");
  const html = renderToStaticMarkup(React.createElement(PassScreen, { initialId: "ice", onBack() {}, progression: { passes, busy: false, error: false } }));
  assert.match(html, /pass-claim-all-button/);
  assert.ok(html.includes(progressionCopy.ru.legacyRewards));
  assert.ok(html.includes(progressionCopy.ru.cardOpening));
  assert.equal((html.match(/class="pass-reward pass-reward-placeholder"/g) ?? []).length, 200);
});

test("old clients see legacy scale and no fictional unclaimed new rewards without changing stored state", async () => {
  const progress = initialLocalPlayerProgress();
  progress.passes.regular.xp = 277750;
  progress.passes.ice = progression.normalizePass({ xp: 2000, premium: true, claimed: ["1:free"] }, "ice");
  const body = { progress, progressionVersion: 2, awards: [{ collectionId: "ice", amount: 270, before: 250, after: 520 }], drops: [{ kind: "freeze-3", duplicate: true, collectionId: "ice", xp: 270, xpBefore: 250, xpAfter: 520 }] };
  const original = structuredClone(body);
  const legacy = progressionResponse(body, null);
  assert.equal(legacy.progress.passes.regular.xp, 100000);
  assert.deepEqual(progression.availableClaims(legacy.progress.passes.regular), []);
  assert.equal(legacy.progress.passes.ice.xp, 2000);
  assert.equal(progression.availableClaims(legacy.progress.passes.ice).length, 3);
  assert.deepEqual(legacy.awards[0], { collectionId: "ice", amount: 1000, before: 1000, after: 2000 });
  assert.equal(legacy.drops[0].xp, 1000);
  assert.deepEqual(body, original);
  assert.equal(progressionResponse(body, "2"), body);
  const request = new Request("https://test.invalid/api/progress", { headers: { Origin: "https://localhost", "X-TTTP-Progression": "2" } });
  const response = apiJson(request, body);
  assert.equal((await response.json()).progress.passes.regular.xp, 277750);
  assert.match(apiOptions(request).headers.get("Access-Control-Allow-Headers"), /X-TTTP-Progression/);
});

test("old offline clients cannot promise a new-only reward when crossing their next projected level", () => {
  const progress = initialLocalPlayerProgress();
  progress.passes.ice.xp = 249;
  const legacy = progressionResponse({ progress }, null).progress.passes.ice;
  assert.equal(legacy.xp, 996);
  legacy.xp += 6;
  assert.deepEqual(progression.availableClaims(legacy), []);
  progression.awardExperience(progress.passes, { ice: 6 }, 1);
  assert.equal(progress.passes.ice.xp, 250);
  assert.equal(progression.canClaim(progress.passes.ice, 1, "free"), false);
  assert.deepEqual(progress.passes.ice.claimed, []);
  progression.awardExperience(progress.passes, { ice: 994 }, 1);
  const earned = progressionResponse({ progress }, null).progress.passes.ice;
  assert.equal(earned.claimed.includes("1:free"), false);
  assert.equal(earned.claimed.includes("2:free"), true);
});
