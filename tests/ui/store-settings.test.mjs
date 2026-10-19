import assert from "node:assert/strict";
import test from "node:test";
import * as collections from "../../app/game/collections.ts";
import * as progression from "../../app/game/element-progression.ts";
import * as purchase from "../../app/game/card-purchase.ts";
import { progressionCopy } from "../../app/game/progression-copy.ts";
import { createHookRuntime, jsxRuntime, loadFrontendModule } from "../helpers/frontend-runtime.mjs";
import { element, elements } from "../helpers/elements.mjs";

const noop = () => {};
const localization = { useLocalization: () => ({ language: "ru", t: key => key }) };
const shared = { "react/jsx-runtime": jsxRuntime, "../../game/localization": localization,
  "./Image": { Image: noop }, "./Primitives": { BackIcon: noop, SoundIcon: noop } };

test("offline store permits affordable packs and disables only unaffordable or pending purchases", () => {
  const hooks = createHookRuntime();
  const calls = [];
  const Privacy = () => null;
  const ad = { supported: true, privacyConfigured: false, loaded: false, privacyOpen: false, showing: false, show: () => calls.push("ad") };
  const { StoreScreen } = loadFrontendModule("app/components/game/StoreScreen.tsx", {
    ...shared, react: hooks.react, "../../game/collections": collections, "../../game/element-progression": progression,
    "../../game/card-purchase": purchase, "../../game/progression-copy": { progressionCopy },
    "./ElementProgress": { ElementProgress: noop }, "./CardPurchaseFlow": { CardPurchaseFlow: noop },
    "./ProgressSyncNotice": { ProgressSyncNotice: noop }, "./AdPrivacyDialog": { AdPrivacyDialog: Privacy },
    "./hooks/useRewardedAd": { useRewardedAd: () => ad },
  });
  const props = { cloudReady: false, syncState: "offline", coins: 50, transactionPending: false,
    unlockedKinds: ["place"], passes: progression.initialPasses(), purchasedKinds: [],
    onBuy: (...args) => calls.push(args), beginRewardAd: noop };
  const render = () => hooks.render(() => StoreScreen(props));
  const buyButtons = view => elements(element(view, n => n.props.className === "collection-banners"), n => n.type === "button");
  let view = render();
  assert.deepEqual(buyButtons(view).map(n => n.props.disabled), [false, true, false, true]);
  buyButtons(view)[2].props.onClick();
  assert.deepEqual(calls, [[1, "ice"]]);
  assert.equal(element(view, n => n.props.role === "status").props.children, "progressOffline");
  props.coins = 250;
  assert.ok(buyButtons(render()).every(n => !n.props.disabled));
  props.transactionPending = true;
  assert.ok(buyButtons(render()).every(n => n.props.disabled));
  props.transactionPending = false; props.coins = 49;
  view = render();
  assert.ok(buyButtons(view).every(n => n.props.disabled));
  const adButton = element(view, n => n.props.className === "secondary-button store-reward-ad");
  assert.equal(adButton.props.disabled, false);
  adButton.props.onClick();
  assert.equal(calls.at(-1), "ad");
  ad.privacyConfigured = true;
  assert.equal(element(render(), n => n.props.className === "secondary-button store-reward-ad").props.disabled, true);
  ad.loaded = true;
  assert.equal(element(render(), n => n.props.className === "secondary-button store-reward-ad").props.disabled, false);
  ad.privacyOpen = true;
  assert.equal(elements(render(), n => n.type === Privacy).length, 1);
});

test("settings dispatch profile and account intentions and block edits during Google transition", () => {
  const calls = [];
  const { SettingsScreen } = loadFrontendModule("app/components/game/SettingsScreen.tsx", {
    ...shared, "../account/AccountDeletionPanel": { AccountDeletionPanel: noop },
  });
  const props = { googleAvailable: true, googlePending: false, googleLinked: false, muted: false, playerName: "Player",
    onBack: () => calls.push("back"), onNameChange: name => calls.push(name), onConnectGoogle: () => calls.push("google"), onToggleSound: () => calls.push("sound") };
  let view = SettingsScreen(props);
  element(view, n => n.type === "input").props.onChange({ target: { value: "New name" } });
  element(view, n => n.props.className === "settings-row settings-toggle settings-google").props.onClick();
  element(view, n => n.type === "button" && n.props["aria-pressed"] === false).props.onClick();
  assert.deepEqual(calls, ["New name", "google", "sound"]);
  props.googlePending = true;
  view = SettingsScreen(props);
  assert.equal(element(view, n => n.type === "input").props.disabled, true);
  assert.equal(element(view, n => n.props["aria-label"] === "back").props.disabled, true);
  assert.equal(element(view, n => n.props.className === "settings-row settings-toggle settings-google").props.disabled, true);
  props.googleAvailable = false;
  assert.equal(elements(SettingsScreen(props), n => n.props.className === "settings-row settings-toggle settings-google").length, 0);
});
