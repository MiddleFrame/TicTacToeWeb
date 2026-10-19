import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Android uses Credential Manager instead of legacy Google Sign-In", async () => {
  const [plugin, activity, gradle, example] = await Promise.all([
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/GoogleAuthPlugin.java"),
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/GameActivity.java"),
    readProjectFile("android/app/build.gradle"),
    readProjectFile("android-config/google-auth.properties.example"),
  ]);

  assert.match(plugin, /CredentialManager/);
  assert.match(plugin, /GetSignInWithGoogleOption/);
  assert.match(plugin, /GoogleIdTokenCredential/);
  assert.doesNotMatch(plugin, /GoogleSignInOptions/);
  assert.match(activity, /registerPlugin\(GoogleAuthPlugin\.class\)/);
  assert.match(gradle, /androidx\.credentials:credentials:1\.6\.0/);
  assert.match(gradle, /googleid:1\.2\.0/);
  assert.match(example, /webClientId=/);
});

test("Android initializes Play Games Services v2 with the configured project", async () => {
  const [application, gradle, manifest, strings] = await Promise.all([
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/TicTacToeApplication.java"),
    readProjectFile("android/app/build.gradle"),
    readProjectFile("android/app/src/main/AndroidManifest.xml"),
    readProjectFile("android/app/src/main/res/values/strings.xml"),
  ]);

  assert.match(gradle, /play-services-games-v2:21\.0\.0/);
  assert.match(application, /PlayGamesSdk\.initialize\(this\)/);
  assert.match(manifest, /android:name="\.TicTacToeApplication"/);
  assert.match(manifest, /com\.google\.android\.gms\.games\.APP_ID/);
  assert.match(strings, /name="game_services_project_id"[^>]*>982871735055</);
});
