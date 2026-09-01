import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Android integrates Yodo1 MAS rewarded ads without exposing ad identifiers", async () => {
  const gradle = await readProjectFile("android/app/build.gradle");
  const manifest = await readProjectFile("android/app/src/main/AndroidManifest.xml");
  const activity = await readProjectFile(
    "android/app/src/main/java/com/MiddleFrame/Tictactoe/MainActivity.java",
  );

  assert.match(gradle, /com\.yodo1\.mas:full:4\.18\.1/);
  assert.match(gradle, /multiDexEnabled true/);
  assert.match(gradle, /android-config\/private\/ads\.properties/);
  assert.match(manifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.match(activity, /registerPlugin\(RewardedAdsPlugin\.class\)/);
});

test("rewarded ads use a deferred custom privacy flow and resolve on the earned event", async () => {
  const plugin = await readProjectFile(
    "android/app/src/main/java/com/MiddleFrame/Tictactoe/RewardedAdsPlugin.java",
  );
  const hook = await readProjectFile("app/components/game/hooks/useRewardedAd.ts");
  const navigation = await readProjectFile("app/components/game/GameNavigation.tsx");
  const store = await readProjectFile("app/components/game/StoreScreen.tsx");
  const collection = await readProjectFile("app/components/game/hooks/usePlayerCollection.ts");

  assert.match(plugin, /enableUserPrivacyDialog\(false\)/);
  assert.match(plugin, /configurePrivacy[\s\S]*setCOPPA/);
  assert.match(plugin, /onRewardAdEarned[\s\S]*result\.put\("rewarded", true\)/);
  assert.match(plugin, /onRewardAdClosed[\s\S]*result\.put\("rewarded", false\)/);
  assert.match(hook, /result\.rewarded\) onReward\(\)/);
  assert.match(hook, /configurePrivacy/);
  assert.match(hook, /Capacitor\.getPlatform\(\) === "android"/);
  assert.match(navigation, /creditCoins\(CARD_PRICE\)/);
  assert.match(store, /rewardedAd\.supported/);
  assert.match(store, /AdPrivacyDialog/);
  assert.match(store, /!rewardedAd\.privacyConfigured \|\| rewardedAd\.loaded/);
  const creditCoins = collection.slice(collection.indexOf("const creditCoins"));
  assert.ok(creditCoins.indexOf("setCoins((current)") < creditCoins.indexOf("grantCloudAdReward(operationId)"));
});
