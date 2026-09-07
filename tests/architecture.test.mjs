import assert from "node:assert/strict";
import test from "node:test";
import { checkArchitecture } from "../scripts/check-architecture.mjs";

const policy = {
  sourceRoots: ["app", "db"],
  gameRoot: "app/game",
  backendRoot: "app/backend",
  serverRoots: ["app/backend", "app/api", "db", "worker"],
  frontendRoots: ["app/components", "android-client"],
  modulePaths: { "@/*": ["./*"] },
  pureGameModules: ["core.ts", "rules.ts", "types.ts", "view.tsx"],
  adapterGameModules: ["storage.ts"],
  platformPackages: ["react", "@capacitor"],
  serverPackages: ["drizzle-orm", "cloudflare:workers", "node:"],
  forbiddenCoreGlobals: ["window", "document", "fetch", "localStorage", "globalThis"],
  forbiddenCoreMethods: ["getItem", "setItem", "removeItem"],
};
const check = (files) => checkArchitecture({ files, policy });
const rules = (result) => result.violations.map((item) => item.rule);

test("server revalidation shares core runtime while type-only cycles and platform types stay erased", () => {
  const result = check({
    "app/game/core.ts": 'import type { State } from "./types.ts"; export function validate(state: State) { return state.value > 0; }',
    "app/game/types.ts": 'import type { validate } from "./core.ts"; export type State = { value: number; validator?: typeof validate; document?: Document };',
    "app/backend/check.ts": 'import { validate } from "../game/core.js"; export const trustedValidation = validate;',
    "app/components/ui.ts": 'import type { trustedValidation } from "../backend/check"; export type Validator = typeof trustedValidation;',
  });
  assert.equal(result.ok, true);
  assert.equal(result.internalRuntimeEdges, 1);
  assert.equal(result.internalTypeEdges, 3);
  assert.equal(result.runtimeCycles.length, 0);
  assert.deepEqual(result.cyclesIncludingTypes, [["app/game/core.ts", "app/game/types.ts"]]);
});

test("runtime cycles include re-exports, alias paths, dynamic imports, require and self edges", () => {
  const result = check({
    "app/shared/a.ts": 'export { value } from "@/app/shared/b";',
    "app/shared/b.ts": 'export const value = 1; const dependency = import("./c");',
    "app/shared/c.ts": 'const dependency = require("./a"); export {};',
    "app/shared/self.ts": 'import "./self";',
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.runtimeCycles, [["app/shared/a.ts", "app/shared/b.ts", "app/shared/c.ts"], ["app/shared/self.ts"]]);
  assert.equal(result.runtimeImports, 4);
});

test("type specifiers stay erased but empty imports and mixed exports remain runtime", () => {
  const result = check({
    "app/shared/a.ts": 'import { type A } from "./b"; export { type A } from "./b"; type B = import("./b").A; import {} from "./b"; export { type A, value } from "./b";',
    "app/shared/b.ts": 'export type A = number; export const value = 1;',
  });
  assert.equal(result.ok, true);
  assert.equal(result.runtimeImports, 2);
  assert.equal(result.typeImports, 3);
});

test("client and game adapters cannot reach server modules through a barrel", () => {
  const result = check({
    "app/components/ui.tsx": 'import { value } from "../shared/bridge";',
    "app/admin/client.ts": '"use client"; import { value } from "../shared/bridge";',
    "app/game/storage.ts": 'import { value } from "../shared/bridge";',
    "app/shared/bridge.ts": 'export { value } from "../../db/index";',
    "db/index.ts": 'export const value = 1;',
  });
  const blocked = result.violations.filter((item) => item.rule === "client-server-runtime");
  assert.equal(blocked.length, 3);
  assert.deepEqual(blocked.find((item) => item.file === "app/components/ui.tsx").chain,
    ["app/components/ui.tsx", "app/shared/bridge.ts", "db/index.ts"]);
});

test("backend cannot reach UI, game adapters or external platform runtime through helpers", () => {
  const result = check({
    "app/backend/check.ts": 'import "../shared/bridge";',
    "app/shared/bridge.ts": 'import "../components/ui"; import "../game/storage"; import "@capacitor/core";',
    "app/components/ui.ts": 'export {};',
    "app/game/storage.ts": 'export {};',
  });
  assert.equal(result.violations.filter((item) => item.rule === "backend-platform-runtime").length, 3);
});

test("core forbids runtime platform and storage use while allowing DOM types and local names", () => {
  const result = check({
    "app/game/core.ts": 'type Element = Document; function local(window: number) { return window; } const model = { document: 1 }; export const get = () => document.title; export const call = () => fetch("/"); export const store = (storage: Storage) => storage.setItem("key", "value");',
  });
  assert.deepEqual(result.violations.filter((item) => item.rule === "core-platform-global").map((item) => item.detail), ["document", "fetch"]);
  assert.equal(result.violations.filter((item) => item.rule === "core-storage-call").length, 1);
});

test("core runtime cannot import adapters, external packages or implicit JSX runtime", () => {
  const result = check({
    "app/game/core.ts": 'import type { StoragePort } from "./storage"; import "react"; import "./storage";',
    "app/game/storage.ts": 'export type StoragePort = Storage;',
    "app/game/view.tsx": 'export const view = <div />;',
  });
  assert.equal(result.violations.filter((item) => item.rule === "core-runtime-dependency").length, 2);
  assert.ok(rules(result).includes("core-ui-expression"));
});

test("ambient declarations and class heritage cannot conceal platform globals from core checks", () => {
  const result = check({
    "app/game/core.ts": 'declare const document: Document; export const read = () => document.title; export class Feature extends window.Feature {}',
  });
  assert.deepEqual(result.violations.filter((item) => item.rule === "core-platform-global").map((item) => item.detail), ["document", "window"]);
});

test("client runtime cannot import database or server-only packages while their types remain usable", () => {
  const result = check({
    "app/components/ui.ts": 'import type { D1Database } from "cloudflare:workers"; import "cloudflare:workers"; import "drizzle-orm/d1"; import "node:fs";',
  });
  assert.equal(result.violations.filter((item) => item.rule === "client-server-runtime").length, 3);
});

test("new unclassified game modules and opaque runtime imports fail with actionable locations", () => {
  const result = check({
    "app/game/new-feature.ts": 'export const enabled = true;',
    "app/shared/opaque.ts": 'const moduleName = "./missing";\nimport(moduleName);',
    "app/shared/broken.ts": 'import "./missing";',
  });
  assert.ok(rules(result).includes("game-classification"));
  assert.ok(rules(result).includes("unresolved-runtime-module"));
  assert.equal(result.violations.find((item) => item.rule === "nonliteral-module-reference").line, 2);
});
