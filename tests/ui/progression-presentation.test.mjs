import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFrontendModule } from "../helpers/frontend-runtime.mjs";
import * as collections from "../../app/game/collections.ts";
import * as progression from "../../app/game/element-progression.ts";
import { progressionCopy } from "../../app/game/progression-copy.ts";

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
