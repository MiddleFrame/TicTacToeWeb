import assert from "node:assert/strict";
import test from "node:test";
import { createHookRuntime, loadFrontendModule } from "../helpers/frontend-runtime.mjs";

test("native and browser visibility events pause activity, hidden resume stays paused, and teardown detaches listeners", () => {
  const hooks = createHookRuntime();
  function target() {
    const listeners = new Map();
    return { listeners, addEventListener: (event, callback) => listeners.set(event, callback), removeEventListener: event => listeners.delete(event) };
  }
  const document = { ...target(), visibilityState: "visible" };
  const window = target();
  const { useAppActivity } = loadFrontendModule("app/components/game/hooks/useAppActivity.ts", { react: hooks.react }, { document, window });
  const render = () => { const active = hooks.render(useAppActivity); hooks.commit(); return active; };
  assert.equal(render(), true);
  assert.equal(document.listeners.size + window.listeners.size, 5);
  window.listeners.get("tttp-app-pause")();
  assert.equal(render(), false);
  document.visibilityState = "hidden";
  window.listeners.get("tttp-app-resume")();
  assert.equal(render(), false);
  document.visibilityState = "visible";
  document.listeners.get("visibilitychange")();
  assert.equal(render(), true);
  window.listeners.get("pagehide")();
  assert.equal(render(), false);
  window.listeners.get("pageshow")();
  assert.equal(render(), true);
  hooks.unmount();
  assert.equal(document.listeners.size + window.listeners.size, 0);
  assert.equal(hooks.writesAfterUnmount(), 0);
});
