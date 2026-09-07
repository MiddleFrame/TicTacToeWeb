import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToReadableStream } from "react-dom/server";
import { loadFrontendModule } from "./helpers/frontend-runtime.mjs";

function fixture(fail = false) {
  const loaded = [];
  const localization = { useLocalization: () => ({ language: "ru", t: (key) => key }) };
  const { DeferredScreen } = loadFrontendModule("app/components/game/DeferredScreen.tsx", {
    react: React, "react/jsx-runtime": jsxRuntime, "../../game/localization": localization,
  });
  const deferred = (name) => () => {
    loaded.push(name);
    if (fail) throw new Error("offline module");
    return { [name]: () => React.createElement("div", null, name) };
  };
  const { GameNavigation } = loadFrontendModule("app/components/game/GameNavigation.tsx", {
    react: React, "react/jsx-runtime": jsxRuntime,
    "./DeferredScreen": { DeferredScreen },
    "./PassScreen": deferred("PassScreen"),
    "./DeckScreen": deferred("DeckScreen"),
    "./SettingsScreen": deferred("SettingsScreen"),
    "./StoreScreen": deferred("StoreScreen"),
    "./MatchmakingScreen": { MatchmakingScreen: () => React.createElement("div", null, "matchmaking") },
    "./MenuScreen": { MenuScreen: () => React.createElement("div", null, "menu") },
  });
  const props = { audio: {}, collection: { progression: {}, purchasedKinds: [] }, network: {}, onMenu() {} };
  return { loaded, GameNavigation, DeferredScreen, props };
}

async function render(f, screen) {
  const stream = await renderToReadableStream(React.createElement(f.GameNavigation, { ...f.props, screen }));
  await stream.allReady;
  return new Response(stream).text();
}

test("initial menu imports none of the four deferred screens", async () => {
  const f = fixture();
  assert.match(await render(f, "menu"), /menu/);
  assert.deepEqual(f.loaded, []);
});

for (const [screen, name] of [["passes", "PassScreen"], ["collection", "DeckScreen"], ["settings", "SettingsScreen"], ["store", "StoreScreen"]]) {
  test(`${screen} loads on demand and reuses its loaded component`, async () => {
    const f = fixture();
    assert.match(await render(f, screen), new RegExp(name));
    assert.match(await render(f, screen), new RegExp(name));
    assert.deepEqual(f.loaded, [name]);
  });
}

test("screen boundary replaces a failed screen with recovery controls", () => {
  const f = fixture();
  const child = React.createElement("span", null, "screen");
  const element = f.DeferredScreen({ children: child, onBack: f.props.onMenu });
  const boundary = new element.type(element.props);
  assert.equal(boundary.render(), element.props.children);
  boundary.state = element.type.getDerivedStateFromError(new Error("module failed"));
  const fallback = boundary.render();
  assert.equal(fallback.props.failed, true);
  assert.equal(fallback.props.onBack, f.props.onMenu);
});
