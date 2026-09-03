import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Android includes only the approved MAS networks and their mediation adapters", async () => {
  const gradle = await source("android/app/build.gradle");
  const networks = await source("android/gradle/rewarded-networks.gradle");
  assert.match(gradle, /apply from: '\.\.\/gradle\/rewarded-networks.gradle'/);
  assert.doesNotMatch(gradle + networks, /implementation 'com.yodo1.mas:full/);
  assert.deepEqual([...networks.matchAll(/implementation 'com.yodo1.mas.mediation:([^:]+):/g)]
    .map((match) => match[1]).sort(), ["admob", "applovin", "unityads"]);
  assert.equal([...networks.matchAll(/implementation '/g)].length, 10);
  assert.match(networks, /com.yodo1.mas:gplibrary:4\.18\.1/);
  assert.match(networks, /verifyRewardedNetworks/);
  assert.match(networks, /dependsOn\(verifyRewardedNetworks\)/);
});

test("MAS runtime entry points stay protected without retaining generated resource tables", async () => {
  const rules = await source("android/app/proguard-rules.pro");
  assert.ok(rules.includes("-keep class !com.yodo1.**.R,!com.yodo1.**.R$*,com.yodo1.** { *; }"));
  assert.match(rules, /extends com\.yodo1\.mas\.mediation\.Yodo1MasAdapterBase/);
  assert.match(rules, /extends com\.yodo1\.mas\.ad\.Yodo1MasAdAdapterBase/);
  assert.doesNotMatch(rules, /-ignorewarnings|-dontoptimize|-dontshrink|-dontobfuscate/);
  assert.doesNotMatch(rules, /-dontwarn\s+\*\*/);
});

test("release bundles validate embedded R8 scores instead of relying on enabled flags", async () => {
  const gradle = await source("android/app/build.gradle");
  const verification = await source("android/gradle/verify-release-optimization.gradle");
  assert.match(gradle, /apply from: '\.\.\/gradle\/verify-release-optimization.gradle'/);
  assert.match(verification, /it\.name == 'bundleRelease'/);
  assert.match(verification, /BUNDLE-METADATA\/com\.android\.tools\/r8\.json/);
  assert.match(verification, /100 - value/);
  assert.match(verification, /percentage < 25/);
  assert.match(verification, /Missing or invalid R8/);
  assert.match(verification, /testOptimizationVerification/);
});
