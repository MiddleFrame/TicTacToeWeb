import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { androidSdkProperties, replaceSdkLocation, writeAndroidSdkLocation } from "../scripts/write-android-sdk-location.mjs";

test("SDK property serialization handles Windows separators, Unicode and line injection", () => {
  assert.equal(androidSdkProperties("C:\\SDK Folder\\тест"), "sdk.dir=C\\:/SDK\\ Folder/\\u0442\\u0435\\u0441\\u0442\n");
  assert.throws(() => androidSdkProperties("/sdk\npassword=value"));
});

test("targeted SDK repair preserves unrelated bytes and rejects ambiguous properties", () => {
  const original = Buffer.from("# fixture\r\nother=\xff\r\nsdk.dir=C:/old\r\nlast=unchanged", "latin1");
  const expected = Buffer.from("# fixture\r\nother=\xff\r\nsdk.dir=C\\:/SDK\\ Folder\r\nlast=unchanged", "latin1");
  assert.deepEqual(replaceSdkLocation(original, "C:/SDK Folder"), expected);
  assert.throws(() => replaceSdkLocation(Buffer.from("sdk.dir=/one\nsdk.dir=/two\n"), "/sdk"));
  assert.throws(() => replaceSdkLocation(Buffer.from("sdk.dir=/one\\\ncontinued\n"), "/sdk"));
  assert.throws(() => replaceSdkLocation(Buffer.from("other=value\n"), "/sdk"));
});

test("the SDK writer preserves an existing local configuration", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tttp-sdk-writer-"));
  const destination = path.join(directory, "local.properties");
  try {
    await writeFile(destination, "existing-test-configuration");
    await assert.rejects(writeAndroidSdkLocation(directory, destination), { code: "EEXIST" });
    assert.equal(await readFile(destination, "utf8"), "existing-test-configuration");
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("tttp-sdk-writer-"));
    await rm(directory, { recursive: true, force: true });
  }
});
