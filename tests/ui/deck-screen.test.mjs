import assert from "node:assert/strict";
import test from "node:test";
import * as collections from "../../app/game/collections.ts";
import * as cards from "../../app/game/cards.ts";
import * as filters from "../../app/game/card-filters.ts";
import { createHookRuntime, jsxRuntime, loadFrontendModule } from "../helpers/frontend-runtime.mjs";
import { element, elements } from "../helpers/elements.mjs";

function fixture(focusKind) {
  const hooks = createHookRuntime();
  const Grid = () => null;
  const Inspection = () => null;
  const calls = [];
  const { DeckScreen } = loadFrontendModule("app/components/game/DeckScreen.tsx", {
    react: hooks.react, "react/jsx-runtime": jsxRuntime,
    "../../game/collections": collections, "../../game/cards": cards, "../../game/card-filters": filters,
    "../../game/localization": { useLocalization: () => ({ language: "ru", t: key => key }) },
    "./DeckLibraryControls": { DeckLibraryControls: () => null }, "./DeckCardGrid": { DeckCardGrid: Grid },
    "./DeckCardInspection": { DeckCardInspection: Inspection }, "./Primitives": { BackIcon: () => null },
  });
  const props = {
    progression: { deckLibrary: { activeId: "main" }, busy: false }, selectedKinds: ["place"], unlockedKinds: ["place"], focusKind,
    onBack: () => calls.push("back"), onSave: () => calls.push("save"), onToggle: kind => calls.push(kind),
  };
  const render = () => { const view = hooks.render(() => DeckScreen(props)); hooks.commit(); return view; };
  return { render, calls, props, Grid, Inspection };
}

test("deck filters change the cards passed to the grid and keep selection callbacks", () => {
  const f = fixture();
  let view = f.render();
  assert.ok(element(view, n => n.type === f.Grid).props.kinds.includes("freeze-3"));
  const buttons = elements(element(view, n => n.type === "nav"), n => n.type === "button");
  assert.equal(buttons.length, 3);
  buttons[2].props.onClick();
  view = f.render();
  const grid = element(view, n => n.type === f.Grid);
  assert.ok(grid.props.kinds.includes("freeze-3"));
  assert.ok(!grid.props.kinds.includes("place"));
  assert.equal(elements(view, n => n.type === "button" && n.props["aria-pressed"])[0].props.children, collections.COLLECTIONS[1].name.ru);
  grid.props.onToggle("freeze-3");
  assert.deepEqual(f.calls, ["freeze-3"]);
  buttons[1].props.onClick();
  assert.ok(!element(f.render(), n => n.type === f.Grid).props.kinds.includes("freeze-3"));
});

test("deck inspection opens and closes, save respects busy state, and back dispatches", () => {
  const f = fixture("freeze-3");
  let view = f.render();
  const grid = element(view, n => n.type === f.Grid);
  assert.ok(!grid.props.kinds.includes("place"));
  grid.props.onInspect("freeze-3", { x: 10, y: 20 });
  view = f.render();
  const inspection = element(view, n => n.type === f.Inspection);
  assert.equal(inspection.props.kind, "freeze-3");
  inspection.props.onClose();
  assert.equal(elements(f.render(), n => n.type === f.Inspection).length, 0);
  element(view, n => n.type === "button" && n.props.children === "saveDeck").props.onClick();
  element(view, n => n.type === "button" && n.props["aria-label"] === "back").props.onClick();
  assert.deepEqual(f.calls, ["save", "back"]);
  f.props.progression.busy = true;
  assert.equal(element(f.render(), n => n.type === "button" && n.props.children === "saveDeck").props.disabled, true);
});
