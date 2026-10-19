import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const readProjectFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("native session declarations wire Keystore, AES-GCM and bridge registration", async () => {
  const [plugin, activity, viteConfig] = await Promise.all([
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/SecureSessionPlugin.java"),
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/GameActivity.java"),
    readProjectFile("vite.android.config.ts"),
  ]);

  assert.match(plugin, /AndroidKeyStore/);
  assert.match(plugin, /AES\/GCM\/NoPadding/);
  assert.match(activity, /registerPlugin\(SecureSessionPlugin\.class\)/);
  assert.match(viteConfig, /NEXT_PUBLIC_API_ORIGIN/);
});
