import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { discoverTests } from "../../scripts/lib/test-suites.mjs";

test("test discovery includes nested tests once, selects a suite and rejects unclassified tests", t => {
  const temporaryRoot = realpathSync(tmpdir());
  const root = realpathSync(mkdtempSync(join(temporaryRoot, "tttp-discovery-")));
  if (dirname(root) !== temporaryRoot || !basename(root).startsWith("tttp-discovery-")) throw new Error("Unexpected test fixture directory");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "domain", "nested"), { recursive: true }); mkdirSync(join(root, "backend"));
  const domain = join(root, "domain", "nested", "example.test.mjs");
  const backend = join(root, "backend", "example.test.mjs");
  for (const file of [domain, backend, join(root, "domain", "helper.mjs")]) writeFileSync(file, "");
  assert.deepEqual(discoverTests(root), [backend, domain].sort());
  assert.deepEqual(discoverTests(root, "domain"), [domain]);
  assert.throws(() => discoverTests(root, "unknown"), /Unknown test suite/);
  assert.throws(() => discoverTests(root, "ui"), /No tests found/);
  writeFileSync(join(root, "lost.test.mjs"), "");
  assert.throws(() => discoverTests(root), /Unclassified test/);
});
