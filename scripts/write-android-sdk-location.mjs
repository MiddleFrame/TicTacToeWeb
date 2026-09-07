import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function androidSdkProperties(directory) {
  if (!directory || /[\r\n\0]/.test(directory)) throw new Error("Invalid Android SDK directory");
  const escaped = directory.replaceAll("\\", "/").split("").map((character) => {
    const code = character.charCodeAt(0);
    if (code < 32 || code > 126) return `\\u${code.toString(16).padStart(4, "0")}`;
    return /[ :=#!]/.test(character) ? `\\${character}` : character;
  }).join("");
  return `sdk.dir=${escaped}\n`;
}

export async function writeAndroidSdkLocation(directory, destination) {
  if (!path.isAbsolute(directory) || !(await stat(directory)).isDirectory()) throw new Error("Expected an existing absolute Android SDK directory");
  await writeFile(destination, androidSdkProperties(directory), { flag: "wx" });
}

export function replaceSdkLocation(original, directory) {
  const text = original.toString("latin1");
  if (text.split(/\r?\n/).some((line) => (line.match(/\\+$/)?.[0].length ?? 0) % 2 === 1)) {
    throw new Error("SDK properties with line continuations require manual review");
  }
  const lines = [...text.matchAll(/^[\t\f ]*sdk\.dir[\t\f ]*[=:][^\r\n]*(?:\r?\n|$)/gm)];
  if (lines.length !== 1) throw new Error("Expected exactly one simple sdk.dir property");
  const match = lines[0];
  const ending = match[0].endsWith("\r\n") ? "\r\n" : match[0].endsWith("\n") ? "\n" : "";
  const replacement = androidSdkProperties(directory).trimEnd() + ending;
  return Buffer.from(text.slice(0, match.index) + replacement + text.slice(match.index + match[0].length), "latin1");
}

export async function repairAndroidSdkLocation(directory, destination, backup) {
  if (!path.isAbsolute(directory) || !(await stat(directory)).isDirectory()) throw new Error("Expected an existing absolute SDK directory");
  const original = await readFile(destination);
  const replacement = replaceSdkLocation(original, directory);
  if (original.equals(replacement)) return false;
  await mkdir(path.dirname(backup), { recursive: true });
  await writeFile(backup, original, { flag: "wx" });
  if (!(await readFile(destination)).equals(original)) throw new Error("SDK properties changed during repair; no update was applied");
  const temporary = `${destination}.tttp-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, replacement, { flag: "wx", mode: (await stat(destination)).mode });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--sdk-dir");
  const directory = index >= 0 ? process.argv[index + 1] : undefined;
  if (!directory) {
    process.stderr.write("Usage: node scripts/write-android-sdk-location.mjs --sdk-dir <SDK directory>\n");
    process.exitCode = 1;
  } else {
    const destination = fileURLToPath(new URL("../android/local.properties", import.meta.url));
    const operation = process.argv.includes("--repair")
      ? repairAndroidSdkLocation(directory, destination, fileURLToPath(new URL(`../work/android-sdk-location-backup-${randomUUID()}.properties`, import.meta.url)))
      : writeAndroidSdkLocation(directory, destination);
    operation.then(() => process.stdout.write("Android SDK location is configured; existing unrelated bytes were preserved.\n"))
      .catch((error) => {
        process.stderr.write(error.code === "EEXIST" ? "android/local.properties already exists; preserve it and ask its owner before replacing it.\n" : "Could not create Android SDK location properties.\n");
        process.exitCode = 1;
      });
  }
}
