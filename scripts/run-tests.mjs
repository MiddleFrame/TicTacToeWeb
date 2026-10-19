import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { discoverTests } from "./lib/test-suites.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = process.argv.slice(2);
if (options[0] === "--") options.shift();
const suite = options[0] && !options[0].startsWith("-") ? options.shift() : "all";
if (options[0] === "--") options.shift();
const files = discoverTests(fileURLToPath(new URL("../tests", import.meta.url)), suite);
console.log(`Test suite: ${suite} (${files.length} files)`);
const result = spawnSync(process.execPath, ["--test", ...options, ...files], { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
