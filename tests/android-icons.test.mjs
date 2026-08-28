import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

const readPngSize = async (path) => {
  const bytes = await readFile(projectFile(path));

  assert.deepEqual([...bytes.subarray(1, 4)], [80, 78, 71]);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test("Android launcher icons use the original game artwork at every density", async () => {
  const densities = {
    ldpi: [36, 81],
    mdpi: [48, 108],
    hdpi: [72, 162],
    xhdpi: [96, 216],
    xxhdpi: [144, 324],
    xxxhdpi: [192, 432],
  };

  for (const [density, [legacySize, adaptiveSize]] of Object.entries(densities)) {
    const directory = `android/app/src/main/res/mipmap-${density}`;

    assert.deepEqual(await readPngSize(`${directory}/ic_launcher.png`), [legacySize, legacySize]);
    assert.deepEqual(await readPngSize(`${directory}/ic_launcher_round.png`), [legacySize, legacySize]);
    assert.deepEqual(await readPngSize(`${directory}/ic_launcher_background.png`), [adaptiveSize, adaptiveSize]);
    assert.deepEqual(await readPngSize(`${directory}/ic_launcher_foreground.png`), [adaptiveSize, adaptiveSize]);
  }

  assert.deepEqual(await readPngSize("android-config/app-icon-play-store.png"), [512, 512]);
});

test("Android launcher source and Play Store artwork match the original icon", async () => {
  const [source, playStore, original] = await Promise.all([
    readFile(projectFile("android-config/app-icon-source.png")),
    readFile(projectFile("android-config/app-icon-play-store.png")),
    readFile(projectFile("android-config/icon-variants/reference-icon-v2.png")),
  ]);

  assert.deepEqual(source, original);
  assert.deepEqual(playStore, original);
});

test("Android splash uses one compact branded image", async () => {
  assert.deepEqual(
    await readPngSize("android/app/src/main/res/drawable-nodpi/splash_logo.png"),
    [512, 512],
  );
});

test("Adaptive icon layers fill the mask without the old inset", async () => {
  const icon = await readFile(projectFile("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"), "utf8");
  const roundIcon = await readFile(projectFile("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml"), "utf8");
  const config = await readFile(projectFile("android-config/app.properties"), "utf8");

  for (const xml of [icon, roundIcon]) {
    assert.match(xml, /@mipmap\/ic_launcher_background/);
    assert.match(xml, /@mipmap\/ic_launcher_foreground/);
    assert.doesNotMatch(xml, /android:inset/);
  }

  assert.match(config, /^versionCode=42$/m);
});
