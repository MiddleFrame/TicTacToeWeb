import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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

test("Android release excludes site-only assets and shrinks native code", async () => {
  const viteConfig = await readProjectFile("vite.android.config.ts");
  const gradle = await readProjectFile("android/app/build.gradle");
  const styles = await readProjectFile("android/app/src/main/res/values/styles.xml");
  const resources = await readdir(new URL("../android/app/src/main/res", import.meta.url), {
    recursive: true,
  });

  assert.match(viteConfig, /publicDir:\s*false/);
  assert.match(viteConfig, /androidPublicAssetsPlugin/);
  assert.match(gradle, /minifyEnabled true/);
  assert.match(gradle, /shrinkResources true/);
  assert.match(styles, /@color\/splash_background/);
  assert.doesNotMatch(styles, /@drawable\/splash/);
  assert.equal(resources.filter((path) => path.endsWith("splash.png")).length, 0);
});
