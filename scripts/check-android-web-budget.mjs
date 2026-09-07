import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directory = path.join(root, "android-shell");
const policy = JSON.parse(await readFile(path.join(root, "android-config/release-policy.json"), "utf8"));
const measured = { files: 0, webAssetBytes: 0, javascriptBytes: 0 };

async function inspect(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Android web output must not contain symbolic links");
    if (entry.isDirectory()) await inspect(file);
    else if (entry.isFile()) {
      const { size } = await stat(file);
      measured.files++;
      measured.webAssetBytes += size;
      if (/\.m?js$/.test(entry.name)) measured.javascriptBytes += size;
    }
  }
}

await stat(path.join(directory, "index.html"));
await inspect(directory);
const maximum = policy.maximum.webAssetBytes;
if (!Number.isSafeInteger(maximum) || maximum <= 0 || measured.javascriptBytes === 0 || measured.webAssetBytes > maximum) {
  throw new Error(`Android web budget failed: ${measured.webAssetBytes} bytes, maximum ${maximum}`);
}
process.stdout.write(`${JSON.stringify({ ...measured, maximumWebAssetBytes: maximum }, null, 2)}\n`);
