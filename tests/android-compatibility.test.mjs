import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { guardAndroidBootstrap } from "../build/android-compatibility-plugin.ts";
import { androidWebViewPolicy } from "../build/android-webview-policy.ts";

const html = '<head><script type="module" crossorigin src="./assets/game-abc.js"></script><link rel="modulepreload" href="./assets/vendor.js"></head>';

test("unsupported and unidentified WebViews load only the local fallback", () => {
  const guarded = guardAndroidBootstrap(html, androidWebViewPolicy.minimumChromiumMajor, androidWebViewPolicy.errorPage);
  const code = guarded.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(guarded, /modulepreload/);
  assert.doesNotMatch(code, /\b(?:const|let|import)\b|=>|\?\./);
  for (const userAgent of ["Chrome/60.0", "Chrome/110.0", "HuaweiBrowser/12.0", "", "Chrome/111.0", "Chromium/140.0"]) {
    const loaded = [];
    const redirected = [];
    vm.runInNewContext(code, {
      navigator: { userAgent },
      window: { location: { replace: (url) => redirected.push(url) } },
      document: { removeEventListener() {}, createElement: () => ({}), head: { appendChild: (entry) => loaded.push(entry.src) } },
    });
    const supported = /(?:Chrome\/111|Chromium\/140)/.test(userAgent);
    assert.deepEqual(loaded, supported ? ["./assets/game-abc.js"] : []);
    assert.deepEqual(redirected, supported ? [] : ["./webview-update.html"]);
  }
});

test("supported WebView waits for the root element before loading game modules", () => {
  const code = guardAndroidBootstrap(html, 111, "webview-update.html").match(/<script>([\s\S]*?)<\/script>/)[1];
  const loaded = [];
  let ready;
  vm.runInNewContext(code, {
    navigator: { userAgent: "Chrome/111.0" },
    document: {
      readyState: "loading",
      addEventListener: (event, handler) => { assert.equal(event, "DOMContentLoaded"); ready = handler; },
      removeEventListener() {},
      createElement: () => ({}),
      head: { appendChild: (entry) => loaded.push(entry.src) },
    },
  });
  assert.deepEqual(loaded, []);
  ready();
  assert.deepEqual(loaded, ["./assets/game-abc.js"]);
});

test("unexpected bundler output fails instead of silently bypassing the bootstrap guard", () => {
  assert.throws(() => guardAndroidBootstrap("<head></head>", 111, "webview-update.html"));
  assert.throws(() => guardAndroidBootstrap(html + html, 111, "webview-update.html"));
  assert.throws(() => guardAndroidBootstrap(html.replace("./assets/game-abc.js", "https://example.com/game.js"), 111, "webview-update.html"));
});

test("the fallback is standalone and Android keeps the SDK 25 device floor", async () => {
  const fallback = await readFile(new URL("../android-client/webview-update.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../android-config/app.properties", import.meta.url), "utf8");
  const release = JSON.parse(await readFile(new URL("../android-config/release-policy.json", import.meta.url), "utf8"));
  assert.doesNotMatch(fallback, /<script\b|\b(?:src|href)=|https?:|Capacitor/);
  assert.match(fallback, /lang="ru"/);
  assert.match(fallback, /lang="en"/);
  assert.match(fallback, /Chromium 111/);
  assert.match(app, /^minSdk=25$/m);
  assert.deepEqual(release.webView, androidWebViewPolicy);
});
