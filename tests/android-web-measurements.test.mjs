import assert from "node:assert/strict";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { measureAndroidWeb } from "../scripts/lib/android-web-measurements.mjs";

async function fixture(t, modules) {
  const temporaryRoot = await realpath(tmpdir());
  const root = await realpath(await mkdtemp(path.join(temporaryRoot, "tttp-web-budget-")));
  if (path.dirname(root) !== temporaryRoot || !path.basename(root).startsWith("tttp-web-budget-")) throw new Error("Unexpected fixture directory");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), '<script>entry.src = "./assets/index.js";</script>');
  for (const [name, text] of Object.entries(modules)) await writeFile(path.join(root, "assets", name), text);
  return root;
}

test("initial budget includes shared imports and re-exports once, excluding deferred chunks", async (t) => {
  const modules = {
    "index.js": 'import "./shared.js"; export * from "./shared.js"; const open = () => import("./later.js");',
    "shared.js": 'export { value } from "./leaf.js";',
    "leaf.js": 'export const value = "import fake from bad";',
    "later.js": 'export const deferred = 1;',
  };
  const measured = await measureAndroidWeb(await fixture(t, modules));
  assert.equal(measured.javascriptBytes, Object.values(modules).reduce((sum, text) => sum + Buffer.byteLength(text), 0));
  assert.equal(measured.initialJavaScriptBytes, measured.javascriptBytes - Buffer.byteLength(modules["later.js"]));
  assert.deepEqual(measured.initialJavaScriptModules, ["assets/index.js", "assets/leaf.js", "assets/shared.js"]);
});

for (const [name, source, expected] of [
  ["missing dependency", 'import "./missing.js";', /Missing initial/],
  ["external dependency", 'import "https://example.invalid/a.js";', /Unbundled/],
  ["escaping dependency", 'export * from "../../outside.js";', /escapes/],
]) {
  test(`initial budget rejects ${name}`, async (t) => {
    await assert.rejects(measureAndroidWeb(await fixture(t, { "index.js": source })), expected);
  });
}
