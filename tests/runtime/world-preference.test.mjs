import assert from "node:assert/strict";
import test from "node:test";
import { gameWorld } from "../../app/game/game-world.ts";
import { loadFrontendModule, memoryStorage } from "../helpers/frontend-runtime.mjs";

function fixture(platform) {
  const storage = memoryStorage();
  const calls = [];
  let saved = "tttr";
  const plugin = {
    read: async () => { calls.push("read"); return { world: saved }; },
    write: async ({ world }) => { calls.push(world); saved = world; },
  };
  const adapter = loadFrontendModule("app/game/world-preference.ts", {
    "@capacitor/core": { Capacitor: { getPlatform: () => platform }, registerPlugin: name => {
      assert.equal(name, "WorldPreferences"); return plugin;
    } }, "./game-world.ts": { gameWorld },
  }, { window: { localStorage: storage } });
  return { adapter, storage, calls, plugin };
}

test("Android reads the launcher's selection and menu default writes the same native preference", async () => {
  const f = fixture("android");
  f.storage.setItem("tttp-default-world-v1", "tttp");
  assert.equal(await f.adapter.readWorldPreference(), "tttr");
  await f.adapter.writeWorldPreference("tttp");
  assert.equal(await f.adapter.readWorldPreference(), "tttp");
  assert.deepEqual(f.calls, ["read", "tttp", "read"]);
  assert.equal(f.storage.getItem("tttp-default-world-v1"), "tttp");
});

test("native persistence errors propagate without a local mirror or fabricated saved default", async () => {
  const f = fixture("android");
  f.plugin.write = async () => { throw new Error("disk full"); };
  await assert.rejects(f.adapter.writeWorldPreference("tttp"), /disk full/);
  assert.equal(await f.adapter.readWorldPreference(), "tttr");
  assert.equal(f.storage.getItem("tttp-default-world-v1"), null);
  f.plugin.read = async () => { throw new Error("unavailable"); };
  await assert.rejects(f.adapter.readWorldPreference(), /unavailable/);
});

test("the website retains its existing preference key and never calls the Android bridge", async () => {
  const f = fixture("web");
  assert.equal(await f.adapter.readWorldPreference(), "tttp");
  await f.adapter.writeWorldPreference("tttr");
  assert.equal(await f.adapter.readWorldPreference(), "tttr");
  assert.equal(f.storage.getItem("tttp-default-world-v1"), "tttr");
  assert.deepEqual(f.calls, []);
  f.storage.setItem = () => { throw new Error("denied"); };
  await assert.rejects(f.adapter.writeWorldPreference("tttp"), /denied/);
});
