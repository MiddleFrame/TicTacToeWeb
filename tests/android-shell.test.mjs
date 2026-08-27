import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Android launches the bundled game instead of a remote server", async () => {
  const config = await readProjectFile("capacitor.config.ts");
  const properties = await readProjectFile("android-config/app.properties");

  assert.match(config, /webDir:\s*["']android-shell["']/);
  assert.doesNotMatch(config, /server\s*:/);
  assert.doesNotMatch(config, /stofs\.chatgpt\.site/);
  assert.doesNotMatch(properties, /serverUrl/);
});

test("Android sync builds the local client before copying web assets", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const entrypoint = await readProjectFile("android-client/main.tsx");

  assert.match(packageJson.scripts["android:sync"], /npm run android:web && cap sync android/);
  assert.match(entrypoint, /GameClient/);
  assert.match(entrypoint, /LocalizationProvider/);
});
