import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "vite";

export function guardAndroidBootstrap(html: string, minimum: number, errorPage: string) {
  const entries = [...html.matchAll(/<script\b(?=[^>]*\btype=["']module["'])[^>]*>[\s\S]*?<\/script>/g)];
  if (entries.length !== 1) throw new Error("Android bootstrap requires exactly one module entry");
  const source = entries[0][0].match(/\bsrc=["']([^"']+)["']/)?.[1];
  if (!source?.startsWith("./") || source.includes(":")) throw new Error("Android entry must be a local built asset");
  if (!Number.isInteger(minimum) || minimum < 55 || !/^[a-z-]+\.html$/.test(errorPage)) {
    throw new Error("Invalid Android WebView compatibility policy");
  }
  const script = `<script>(function () {
var engine = navigator.userAgent.match(/(?:Chrome|Chromium)\\/(\\d+)/);
if (!engine || Number(engine[1]) < ${minimum}) {
  window.location.replace(${JSON.stringify(`./${errorPage}`)});
  return;
}
function startGame() {
  document.removeEventListener("DOMContentLoaded", startGame, false);
  var entry = document.createElement("script");
  entry.type = "module";
  entry.crossOrigin = "anonymous";
  entry.src = ${JSON.stringify(source)};
  document.head.appendChild(entry);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startGame, false);
else startGame();
}());</script>`;
  return html.replace(entries[0][0], script).replace(/<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*>/g, "");
}

export function androidCompatibilityPlugin(options: {
  outputDirectory: string;
  errorPageSource: string;
  errorPage: string;
  minimumChromiumMajor: number;
}): Plugin {
  return {
    name: "tttp-android-compatibility",
    async closeBundle() {
      const index = join(options.outputDirectory, "index.html");
      const html = await readFile(index, "utf8");
      await copyFile(options.errorPageSource, join(options.outputDirectory, options.errorPage));
      await writeFile(index, guardAndroidBootstrap(html, options.minimumChromiumMajor, options.errorPage));
    },
  };
}
