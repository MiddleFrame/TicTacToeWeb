import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { repositoryRoot, sourcePath, readSource, writeResult } from './audit-paths.mjs';

const sourceRoots = ['app', 'worker', 'db', 'android-client', 'build'];
const files = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path.relative(repositoryRoot, entryPath).replaceAll('\\', '/'));
  }
}
sourceRoots.forEach(root => walk(sourcePath(root)));
const known = new Set(files);
const edges = [];
const counts = [];
for (const file of files) {
  const text = readSource(file);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let imports = 0;
  let hookCalls = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^use[A-Z]/.test(node.expression.text)) hookCalls += 1;
    let specifier;
    let typeOnly = false;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports += 1;
      specifier = node.moduleSpecifier.text;
      const clause = node.importClause;
      typeOnly = !!clause?.isTypeOnly || !!(clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every((item) => item.isTypeOnly));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifier = node.moduleSpecifier.text;
      typeOnly = node.isTypeOnly;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
    if (specifier?.startsWith('.')) {
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => known.has(candidate));
      if (target) edges.push({ from: file, to: target, typeOnly });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  counts.push({ file, lines: text.trimEnd().split('\n').length, imports, hookCalls });
}
function components(includeTypes) {
  const graph = new Map(files.map((file) => [file, []]));
  edges.filter((edge) => includeTypes || !edge.typeOnly).forEach((edge) => graph.get(edge.from).push(edge.to));
  let cursor = 0;
  const indices = new Map();
  const lows = new Map();
  const stack = [];
  const onStack = new Set();
  const groups = [];
  function visit(file) {
    indices.set(file, cursor);
    lows.set(file, cursor++);
    stack.push(file);
    onStack.add(file);
    for (const child of graph.get(file)) {
      if (!indices.has(child)) { visit(child); lows.set(file, Math.min(lows.get(file), lows.get(child))); }
      else if (onStack.has(child)) lows.set(file, Math.min(lows.get(file), indices.get(child)));
    }
    if (lows.get(file) !== indices.get(file)) return;
    const group = [];
    let item;
    do { item = stack.pop(); onStack.delete(item); group.push(item); } while (item !== file);
    if (group.length > 1) groups.push(group.sort());
  }
  files.forEach((file) => { if (!indices.has(file)) visit(file); });
  return groups;
}
const result = {
  sourceFiles: files.length,
  internalEdges: edges.length,
  runtimeEdges: edges.filter((edge) => !edge.typeOnly).length,
  runtimeCycles: components(false),
  cyclesIncludingTypes: components(true),
  largestModules: counts.sort((a, b) => b.lines - a.lines).slice(0, 14),
  gameClient: counts.find((item) => item.file === 'app/components/GameClient.tsx'),
};
writeResult('dependency-probe.json', result);
