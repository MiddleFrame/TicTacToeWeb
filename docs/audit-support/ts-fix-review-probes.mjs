import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { repositoryRoot, readSource, sourcePath, writeResult } from './audit-paths.mjs';

const baselineRef = 'e0e8cbfcebf002ac72b667e980574d166ad5502a';
const original = (file) => execFileSync('git', ['show', `${baselineRef}:${file}`], { encoding: 'utf8', cwd: repositoryRoot });
const current = readSource;
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const animationPath = 'app/components/game/hooks/useMatchmakingAnimation.ts';
assert.equal(transpile(original(animationPath)), transpile(current(animationPath)));

const interactionPath = 'app/game/card-interaction.ts';
function targetFunction(source) {
  const exports = {};
  vm.runInNewContext(transpile(source), { exports });
  return exports.findClosestCardTarget;
}
const before = targetFunction(original(interactionPath));
const after = targetFunction(current(interactionPath));
let randomState = 31415926;
const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const box = (index, left, top, width, height) => ({ index, left, top, right: left + width, bottom: top + height });
const explicit = [
  { x: 0, y: 0, areas: [], expected: null },
  { x: 0, y: 0, areas: new Array(12), expected: null },
  { x: 0, y: 0, areas: [box(22, -5, -5, 1, 1), box(17, 4, 4, 1, 1)], expected: 22 },
  { x: 0, y: 0, areas: [box(9, -2, -2, 4, 4), box(8, -3, -3, 6, 6)], expected: 9 },
  { x: 10, y: 10, areas: [, , box(31, 9, 9, 2, 2), , box(32, 100, 100, 1, 1)], expected: 31 },
];
for (const sample of explicit) {
  assert.equal(before(sample.x, sample.y, sample.areas), sample.expected);
  assert.equal(after(sample.x, sample.y, sample.areas), sample.expected);
}
let sparseCases = 0;
for (let index = 0; index < 10000; index += 1) {
  const x = Math.floor(random() * 1000) - 500;
  const y = Math.floor(random() * 1000) - 500;
  const areas = Array.from({ length: Math.floor(random() * 80) }, (_, position) =>
    box(position, random() * 1000 - 500, random() * 1000 - 500, random() * 100, random() * 100));
  if (index % 2 === 0) {
    sparseCases += 1;
    for (let position = 0; position < areas.length; position += 3) delete areas[position];
  }
  assert.equal(before(x, y, areas), after(x, y, areas));
}

const patternPath = 'app/components/game/hooks/useScenePattern.ts';
function runPattern(source) {
  const exports = {};
  const operations = [];
  let cleanup;
  const context = { beginPath() {}, arc() {}, stroke() {}, moveTo() {}, lineTo() {} };
  vm.runInNewContext(transpile(source), {
    exports,
    require: () => ({ useEffect: (effect) => { cleanup = effect(); } }),
    document: {
      createElement: () => ({ getContext: () => context, toDataURL: () => 'synthetic-pattern' }),
      documentElement: { style: {
        setProperty: (...args) => operations.push(['set', ...args]),
        removeProperty: (...args) => { operations.push(['remove', ...args]); return 'previous-css-value'; },
      } },
    },
  });
  exports.useScenePattern();
  return { operations, cleanupResult: cleanup() };
}
const patternBefore = runPattern(original(patternPath));
const patternAfter = runPattern(current(patternPath));
assert.deepEqual(patternBefore.operations, patternAfter.operations);
assert.equal(patternAfter.cleanupResult, undefined);

const assetDirectory = sourcePath('android-shell/assets');
const indexFiles = fs.existsSync(assetDirectory) ? fs.readdirSync(assetDirectory).filter(file => /^index-.*\.js$/.test(file)) : [];
const indexFile = indexFiles.length === 1 ? indexFiles[0] : null;
const indexSource = indexFile ? readSource(`android-shell/assets/${indexFile}`) : null;
const source = indexSource === null ? null : ts.createSourceFile(indexFile, indexSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let optionalChains = 0;
let nullishOperators = 0;
function inspect(node) {
  if (node.questionDotToken) optionalChains += 1;
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) nullishOperators += 1;
  ts.forEachChild(node, inspect);
}
if (source) inspect(source);
writeResult('ts-fix-review-probes.json', {
  baselineRef,
  typeAnnotationEmittedJavaScriptIdentical: true,
  closestTargetCasesCompared: 10000 + explicit.length,
  sparseGeneratedCases: sparseCases,
  tieBehavior: 'first visited minimum preserved',
  cleanupDomOperationsIdentical: true,
  cleanupReturnsVoidAfterFix: true,
  androidBundleAnalysis: source ? {
    status: 'measured-existing-artifact',
    androidMainBundle: indexFile,
    optionalChains,
    nullishOperators,
  } : {
    status: 'skipped',
    reason: 'Expected one existing android-shell/assets/index-*.js; run pnpm run android:web explicitly to prepare that artifact',
  },
});
