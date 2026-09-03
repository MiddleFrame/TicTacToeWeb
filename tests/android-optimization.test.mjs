import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Android toolchain is pinned and declares AGP 9 build requirements", async () => {
  const root = await source("android/build.gradle");
  const app = await source("android/app/build.gradle");
  const wrapper = await source("android/gradle/wrapper/gradle-wrapper.properties");
  const properties = await source("android/gradle.properties");
  assert.match(root, /com\.android\.tools\.build:gradle:9\.3\.2/);
  assert.match(root, /com\.android\.tools:r8:9\.4\.14/);
  assert.match(wrapper, /gradle-9\.5\.0-bin\.zip/);
  assert.match(wrapper, /^distributionSha256Sum=553c78f50dafcd54d65b9a444649057857469edf836431389695608536d6b746$/m);
  assert.match(wrapper, /^validateDistributionUrl=true$/m);
  const wrapperJar = await readFile(new URL("../android/gradle/wrapper/gradle-wrapper.jar", import.meta.url));
  assert.equal(createHash("sha256").update(wrapperJar).digest("hex"),
    "497c8c2a7e5031f6aa847f88104aa80a93532ec32ee17bdb8d1d2f67a194a9c7");
  assert.match(app, /buildFeatures\s*\{\s*buildConfig true\s*resValues true\s*\}/);
  assert.match(app, /implementation "androidx\.core:core:\$androidxCoreVersion"/);
  assert.match(app, /minifyEnabled true/);
  assert.match(app, /shrinkResources true/);
  assert.doesNotMatch(properties, /android\.newDsl=false|android\.r8\.fullMode=false/);
});

test("Android includes only the approved MAS networks and their mediation adapters", async () => {
  const gradle = await source("android/app/build.gradle");
  const networks = await source("android/gradle/rewarded-networks.gradle");
  const catalog = JSON.parse(await source("android-config/mas-network-catalog.json"));
  const profile = JSON.parse(await source("android-config/mas-networks.json"));
  assert.match(gradle, /apply from: '\.\.\/gradle\/rewarded-networks.gradle'/);
  assert.doesNotMatch(gradle + networks, /implementation 'com.yodo1.mas:full/);
  assert.equal(catalog.sdkVersion, "4.18.1");
  assert.equal(Object.keys(catalog.networks).length, 14);
  assert.equal(new Set(profile.enabled).size, profile.enabled.length);
  assert.ok(["admob", "applovin"].every((name) => profile.enabled.includes(name)));
  assert.ok(profile.enabled.every((name) => Object.hasOwn(catalog.networks, name)));
  assert.deepEqual(Object.keys(catalog.networks).filter((name) => !profile.enabled.includes(name)),
    ["bidmachine", "topon", "vungle"]);
  assert.deepEqual(profile.disabledRoutes, ["mintegral:ironsource"]);
  assert.match(networks, /mas-network-catalog\.json/);
  assert.match(networks, /mas-networks\.json/);
  assert.match(networks, /enabled\.contains\(mediator\(adapter\)\)/);
  assert.match(networks, /disabledRoutes\.contains/);
  assert.match(networks, /resolved != expected/);
  assert.match(networks, /verifyRewardedNetworks/);
  assert.match(networks, /dependsOn\(verifyRewardedNetworks\)/);
});

test("the MAS catalog keeps supported routes between the retained mediators", async () => {
  const { networks } = JSON.parse(await source("android-config/mas-network-catalog.json"));
  const { enabled, disabledRoutes } = JSON.parse(await source("android-config/mas-networks.json"));
  const mediator = (adapter) => adapter.startsWith("applovin-") ? "applovin" : adapter;
  for (const [network, adapters] of Object.entries(networks)) {
    assert.equal(new Set(adapters).size, adapters.length);
    assert.ok(adapters.every((adapter) => Object.hasOwn(networks, mediator(adapter))));
    assert.ok(adapters.every((adapter) => mediator(adapter) !== network));
  }
  for (const route of disabledRoutes) {
    const [network, adapter, extra] = route.split(":");
    assert.equal(extra, undefined);
    assert.ok(enabled.includes(network));
    assert.ok(enabled.includes(mediator(adapter)));
    assert.ok(networks[network].includes(adapter));
  }
  assert.ok(enabled.includes("mintegral"));
  assert.ok(["admob", "applovin"].every((adapter) => networks.mintegral.includes(adapter)));
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
