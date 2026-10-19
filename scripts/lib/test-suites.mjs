import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

export const TEST_SUITES = ["domain", "backend", "runtime", "ui", "platform", "tooling"];

export function discoverTests(directory, suite = "all") {
  if (suite !== "all" && !TEST_SUITES.includes(suite)) throw new Error(`Unknown test suite: ${suite}`);
  const files = [];
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith(".test.mjs")) {
        const group = relative(directory, file).split(/[\\/]/)[0];
        if (!TEST_SUITES.includes(group)) throw new Error(`Unclassified test: ${file}`);
        if (suite === "all" || suite === group) files.push(file);
      }
    }
  }
  visit(directory);
  if (!files.length) throw new Error(`No tests found for suite: ${suite}`);
  return files.sort();
}
