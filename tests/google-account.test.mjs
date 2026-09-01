import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { googleSessionNonce } from "../app/backend/google-identity.ts";

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("binds Google credentials to the active session nonce", async () => {
  const first = await googleSessionNonce("a".repeat(64));
  const second = await googleSessionNonce("b".repeat(64));

  assert.equal(first.length, 43);
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
});

test("Google account linking validates tokens and rotates native sessions", async () => {
  const [route, identity, accounts] = await Promise.all([
    readProjectFile("app/api/account/google/route.ts"),
    readProjectFile("app/backend/google-identity.ts"),
    readProjectFile("app/backend/accounts.ts"),
  ]);

  assert.match(route, /authenticateRequest/);
  assert.match(route, /verifyGoogleIdToken/);
  assert.match(route, /revokeSession/);
  assert.match(route, /sessionToken/);
  assert.match(identity, /createRemoteJWKSet/);
  assert.match(identity, /payload\.nonce !== expectedNonce/);
  assert.match(identity, /payload\.email_verified === true/);
  assert.match(accounts, /connectGoogleIdentity/);
  assert.match(accounts, /providerEmail/);
  assert.match(accounts, /provider: "google"/);
});

test("Android uses Credential Manager instead of legacy Google Sign-In", async () => {
  const [plugin, activity, gradle, settings, example] = await Promise.all([
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/GoogleAuthPlugin.java"),
    readProjectFile("android/app/src/main/java/com/MiddleFrame/Tictactoe/MainActivity.java"),
    readProjectFile("android/app/build.gradle"),
    readProjectFile("app/components/game/SettingsScreen.tsx"),
    readProjectFile("android-config/google-auth.properties.example"),
  ]);

  assert.match(plugin, /CredentialManager/);
  assert.match(plugin, /GetSignInWithGoogleOption/);
  assert.match(plugin, /GoogleIdTokenCredential/);
  assert.doesNotMatch(plugin, /GoogleSignInOptions/);
  assert.match(activity, /registerPlugin\(GoogleAuthPlugin\.class\)/);
  assert.match(gradle, /androidx\.credentials:credentials:1\.6\.0/);
  assert.match(gradle, /googleid:1\.2\.0/);
  assert.match(settings, /googleConnected/);
  assert.match(settings, /googleEmail/);
  assert.match(settings, /googleRelink/);
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
