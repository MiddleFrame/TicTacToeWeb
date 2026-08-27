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
  assert.match(styles, /@drawable\/splash_logo/);
  assert.equal(resources.filter((path) => path.endsWith("splash.png")).length, 0);
});

test("Android uses edge-to-edge rendering in portrait orientation", async () => {
  const activity = await readProjectFile(
    "android/app/src/main/java/com/MiddleFrame/Tictactoe/MainActivity.java",
  );
  const manifest = await readProjectFile("android/app/src/main/AndroidManifest.xml");

  assert.match(activity, /WindowCompat\.enableEdgeToEdge\(getWindow\(\)\)/);
  assert.match(manifest, /android:screenOrientation="portrait"/);
});

test("Android keeps the branded bootstrap splash visible for two seconds", async () => {
  const activity = await readProjectFile(
    "android/app/src/main/java/com/MiddleFrame/Tictactoe/MainActivity.java",
  );

  assert.match(activity, /SPLASH_DURATION_MS = 2000/);
  assert.match(activity, /SplashScreen\.installSplashScreen\(this\)/);
  assert.match(activity, /setKeepOnScreenCondition/);
});

test("Android reserves navigation-bar space even when WebView reports no safe area", async () => {
  const entrypoint = await readProjectFile("android-client/main.tsx");
  const styles = await readProjectFile("app/globals.css");

  assert.match(entrypoint, /document\.documentElement\.dataset\.platform = "android"/);
  assert.match(styles, /:root\[data-platform="android"\]/);
  assert.match(styles, /--safe-area-bottom: max\(48px,/);
  assert.match(styles, /\.unity-menu-content \{\s+min-height: 0;/);
});
