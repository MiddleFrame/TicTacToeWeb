import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Android integrates Yodo1 MAS rewarded ads without exposing ad identifiers", async () => {
  const gradle = await readProjectFile("android/app/build.gradle");
  const manifest = await readProjectFile("android/app/src/main/AndroidManifest.xml");
  const activity = await readProjectFile(
    "android/app/src/main/java/com/MiddleFrame/Tictactoe/GameActivity.java",
  );

  assert.match(gradle, /apply from: '\.\.\/gradle\/rewarded-networks.gradle'/);
  assert.match(gradle, /multiDexEnabled true/);
  assert.match(gradle, /android-config\/private\/ads\.properties/);
  assert.match(manifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.match(activity, /registerPlugin\(RewardedAdsPlugin\.class\)/);
});

test("native rewarded plugin declares custom privacy and earned/closed bridge wiring", async () => {
  const plugin = await readProjectFile(
    "android/app/src/main/java/com/MiddleFrame/Tictactoe/RewardedAdsPlugin.java",
  );

  assert.match(plugin, /enableUserPrivacyDialog\(false\)/);
  assert.match(plugin, /configurePrivacy[\s\S]*setCOPPA/);
  assert.match(plugin, /onRewardAdEarned[\s\S]*result\.put\("rewarded", true\)/);
  assert.match(plugin, /onRewardAdClosed[\s\S]*result\.put\("rewarded", false\)/);
});
