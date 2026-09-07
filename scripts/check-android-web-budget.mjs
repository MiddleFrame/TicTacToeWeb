import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { measureAndroidWeb } from "./lib/android-web-measurements.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = path.join(root, "android-shell");
const policy = JSON.parse(await readFile(path.join(root, "android-config/release-policy.json"), "utf8"));
const measured = await measureAndroidWeb(directory);
const maximum = policy.maximum.webAssetBytes;
const initialMaximum = policy.webLoading.maximumInitialJavaScriptBytes;
if (!Number.isSafeInteger(maximum) || maximum <= 0 || measured.javascriptBytes === 0 || measured.webAssetBytes > maximum) {
  throw new Error(`Android web budget failed: ${measured.webAssetBytes} bytes, maximum ${maximum}`);
}
if (!Number.isSafeInteger(initialMaximum) || initialMaximum <= 0 || measured.initialJavaScriptBytes > initialMaximum) {
  throw new Error(`Initial JavaScript budget failed: ${measured.initialJavaScriptBytes} bytes, maximum ${initialMaximum}`);
}
process.stdout.write(`${JSON.stringify({ ...measured, maximumWebAssetBytes: maximum, maximumInitialJavaScriptBytes: initialMaximum }, null, 2)}\n`);
