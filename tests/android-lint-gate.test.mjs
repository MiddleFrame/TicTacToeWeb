import assert from "node:assert/strict";
import test from "node:test";
import { checkAndroidLint } from "../scripts/check-android-lint.mjs";

const now = Date.parse("2026-09-07T15:00:00Z");
const timing = { repoRoot: "/repo", startedAt: now - 1000, modifiedAt: now, now };
const known = { id: "NotificationPermission", source: "android/app/src/main/AndroidManifest.xml", line: null, message: "Picasso notification path", maximumCount: 1, reviewBy: "2026-10-07" };
const policy = { knownErrors: [known] };
const line = "/repo/android/app/src/main/AndroidManifest.xml: Error: Picasso notification path [NotificationPermission]";

test("known vendor failures remain visibly failed while the regression gate accepts only the exact issue", () => {
  const result = checkAndroidLint(`${line}\n1 errors, 0 warnings`, policy, timing);
  assert.equal(result.fullLintStatus, "failed");
  assert.equal(result.regressionStatus, "no-new-errors");
  assert.equal(result.knownErrors.length, 1);
  assert.equal(checkAndroidLint(`${line.replace("Picasso", "Another SDK")}\n1 errors, 0 warnings`, policy, timing).regressionStatus, "failed");
  assert.equal(checkAndroidLint(`${line}\n${line}\n2 errors, 0 warnings`, policy, timing).regressionStatus, "failed");
});

test("stale, malformed, unexpected and expired lint results fail closed", () => {
  const report = `${line}\n1 errors, 0 warnings`;
  assert.throws(() => checkAndroidLint(report, policy, { ...timing, modifiedAt: now - 2000 }));
  assert.throws(() => checkAndroidLint(line, policy, timing));
  assert.throws(() => checkAndroidLint(`${line}\n0 errors, 0 warnings`, policy, timing));
  assert.equal(checkAndroidLint(report, { knownErrors: [{ ...known, reviewBy: "2026-09-06" }] }, timing).regressionStatus, "failed");
  assert.equal(checkAndroidLint(report.replace("NotificationPermission", "RestrictedApi"), policy, timing).regressionStatus, "failed");
});
