import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const VIRTUAL_ROOT = "/__architecture__";
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const normalize = (value) => value.replaceAll("\\", "/");
const within = (file, directory) => file === directory || file.startsWith(`${directory}/`);
const packageMatches = (name, prefix) => name === prefix || name.startsWith(`${prefix}/`)
  || (prefix.endsWith(":") && name.startsWith(prefix));

function compiler(files, policy) {
  const sources = new Map(Object.entries(files).map(([file, text]) => {
    const absolute = `${VIRTUAL_ROOT}/${normalize(file)}`;
    return [absolute, ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true)];
  }));
  const options = {
    noLib: true,
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    baseUrl: VIRTUAL_ROOT,
    paths: policy.modulePaths ?? {},
    allowImportingTsExtensions: true,
  };
  const host = {
    getSourceFile: (file) => sources.get(normalize(file)),
    getDefaultLibFileName: () => `${VIRTUAL_ROOT}/lib.d.ts`,
    writeFile() {},
    getCurrentDirectory: () => VIRTUAL_ROOT,
    getDirectories: () => [],
    fileExists: (file) => sources.has(normalize(file)),
    readFile: (file) => sources.get(normalize(file))?.text,
    directoryExists: (directory) => [...sources.keys()].some((file) => within(file, normalize(directory))),
    getCanonicalFileName: normalize,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  const program = ts.createProgram([...sources.keys()], options, host);
  return {
    sources,
    checker: program.getTypeChecker(),
    resolve(specifier, from) {
      const resolved = ts.resolveModuleName(specifier, from, options, host).resolvedModule;
      return resolved ? normalize(resolved.resolvedFileName).slice(VIRTUAL_ROOT.length + 1) : null;
    },
  };
}

function moduleReference(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    const bindings = clause?.namedBindings;
    const allTypes = !clause?.name && bindings && ts.isNamedImports(bindings)
      && bindings.elements.length > 0 && bindings.elements.every((item) => item.isTypeOnly);
    return { argument: node.moduleSpecifier, typeOnly: Boolean(clause?.isTypeOnly || allTypes) };
  }
  if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
    const bindings = node.exportClause;
    const allTypes = bindings && ts.isNamedExports(bindings) && bindings.elements.length > 0
      && bindings.elements.every((item) => item.isTypeOnly);
    return { argument: node.moduleSpecifier, typeOnly: Boolean(node.isTypeOnly || allTypes) };
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return { argument: node.moduleReference.expression, typeOnly: Boolean(node.isTypeOnly) };
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return { argument: node.argument.literal, typeOnly: true };
  }
  if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
    || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
    return { argument: node.arguments[0], typeOnly: false };
  }
  return null;
}

function isValueReference(node) {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent)) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  if (ts.isShorthandPropertyAssignment(parent)) return true;
  if (parent.name === node && !ts.isComputedPropertyName(parent)) return false;
  return !ts.isImportSpecifier(parent) && !ts.isExportSpecifier(parent);
}

function executableNodes(source, visit) {
  function walk(node) {
    if (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)
      && node.parent.token === ts.SyntaxKind.ExtendsKeyword
      && (ts.isClassDeclaration(node.parent.parent) || ts.isClassExpression(node.parent.parent))) {
      walk(node.expression);
      return;
    }
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      || ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return;
    visit(node);
    ts.forEachChild(node, walk);
  }
  if (!source.isDeclarationFile) walk(source);
}

function hasRuntimeDeclaration(symbol) {
  return symbol?.declarations?.some((declaration) => {
    for (let node = declaration; node; node = node.parent) {
      if (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Ambient) return false;
      if (ts.isSourceFile(node) && node.isDeclarationFile) return false;
    }
    return true;
  });
}

function coreViolations(source, checker, policy, add) {
  const globals = new Set(policy.forbiddenCoreGlobals ?? []);
  const methods = new Set(policy.forbiddenCoreMethods ?? []);
  executableNodes(source, (node) => {
    if (ts.isIdentifier(node) && globals.has(node.text) && isValueReference(node)) {
      const symbol = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
      if (!hasRuntimeDeclaration(symbol)) add("core-platform-global", node, node.text);
    }
    if (ts.isCallExpression(node)) {
      const target = node.expression;
      const member = ts.isPropertyAccessExpression(target) ? target.name.text
        : ts.isElementAccessExpression(target) && ts.isStringLiteralLike(target.argumentExpression)
          ? target.argumentExpression.text : null;
      if (methods.has(member)) add("core-storage-call", node, member);
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      add("core-ui-expression", node, "JSX");
    }
  });
}

function connectedComponents(files, edges, includeTypes) {
  const graph = new Map(files.map((file) => [file, []]));
  edges.filter((edge) => includeTypes || !edge.typeOnly).forEach((edge) => graph.get(edge.from).push(edge.to));
  const indices = new Map();
  const lows = new Map();
  const stack = [];
  const active = new Set();
  const cycles = [];
  let cursor = 0;
  function visit(file) {
    indices.set(file, cursor);
    lows.set(file, cursor++);
    stack.push(file);
    active.add(file);
    for (const child of graph.get(file)) {
      if (!indices.has(child)) {
        visit(child);
        lows.set(file, Math.min(lows.get(file), lows.get(child)));
      } else if (active.has(child)) lows.set(file, Math.min(lows.get(file), indices.get(child)));
    }
    if (lows.get(file) !== indices.get(file)) return;
    const group = [];
    let item;
    do {
      item = stack.pop();
      active.delete(item);
      group.push(item);
    } while (item !== file);
    if (group.length > 1 || graph.get(file).includes(file)) cycles.push(group.sort());
  }
  files.forEach((file) => { if (!indices.has(file)) visit(file); });
  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}

function runtimeBoundaries(files, references, clients, adapters, policy, violations) {
  const graph = new Map(files.map((file) => [file, []]));
  references.filter((edge) => !edge.typeOnly).forEach((edge) => graph.get(edge.from).push(edge));
  for (const start of files) {
    const backend = within(start, policy.backendRoot);
    const frontend = clients.has(start) || within(start, policy.gameRoot);
    if (!backend && !frontend) continue;
    const visited = new Set([start]);
    const pending = [{ file: start, chain: [start], first: null }];
    while (pending.length) {
      const current = pending.shift();
      for (const edge of graph.get(current.file)) {
        const first = current.first ?? edge;
        const chain = [...current.chain, edge.to ?? edge.specifier];
        const serverTarget = edge.to ? policy.serverRoots.some((directory) => within(edge.to, directory))
          : (policy.serverPackages ?? []).some((prefix) => packageMatches(edge.specifier, prefix));
        const platformTarget = edge.to ? clients.has(edge.to) || adapters.has(edge.to)
          : policy.platformPackages.some((prefix) => packageMatches(edge.specifier, prefix));
        if ((frontend && serverTarget) || (backend && platformTarget)) {
          violations.push({ rule: frontend ? "client-server-runtime" : "backend-platform-runtime", file: start, line: first.line, chain });
          continue;
        }
        if (edge.to && !visited.has(edge.to)) {
          visited.add(edge.to);
          pending.push({ file: edge.to, chain, first });
        }
      }
    }
  }
}

export function checkArchitecture({ files: inputFiles, policy }) {
  const files = Object.fromEntries(Object.entries(inputFiles).map(([file, text]) => [normalize(file), text]));
  const names = Object.keys(files).sort();
  const pure = new Set(policy.pureGameModules.map((file) => `${policy.gameRoot}/${file}`));
  const adapters = new Set(policy.adapterGameModules.map((file) => `${policy.gameRoot}/${file}`));
  const clients = new Set(names.filter((file) => policy.frontendRoots.some((directory) => within(file, directory))));
  const engine = compiler(files, policy);
  const references = [];
  const violations = [];
  for (const file of names) {
    if (within(file, policy.gameRoot) && pure.has(file) === adapters.has(file)) {
      violations.push({ rule: "game-classification", file, line: 1, detail: "Classify exactly once as pure or adapter" });
    }
    const source = engine.sources.get(`${VIRTUAL_ROOT}/${file}`);
    const add = (rule, node, detail) => violations.push({ rule, file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, detail });
    if (source.statements.some((node) => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === "use client")) clients.add(file);
    function visit(node) {
      const reference = moduleReference(node);
      if (reference) {
        if (!reference.argument || !ts.isStringLiteralLike(reference.argument)) {
          add("nonliteral-module-reference", node, "Use a statically resolvable module specifier");
        } else {
          const specifier = reference.argument.text;
          const to = engine.resolve(specifier, source.fileName);
          const typeOnly = reference.typeOnly || source.isDeclarationFile;
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          references.push({ from: file, to, specifier, typeOnly, line });
          if (!typeOnly && pure.has(file) && !pure.has(to)) add("core-runtime-dependency", node, to ?? specifier);
          if (!typeOnly && !to && (specifier.startsWith(".") || specifier.startsWith("@/"))
            && (!path.posix.extname(specifier) || SOURCE_EXTENSION.test(specifier))) add("unresolved-runtime-module", node, specifier);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    if (pure.has(file)) coreViolations(source, engine.checker, policy, add);
  }
  const edges = references.filter((edge) => edge.to);
  const runtimeCycles = connectedComponents(names, edges, false);
  runtimeCycles.forEach((cycle) => violations.push({ rule: "runtime-cycle", file: cycle[0], line: 1, cycle }));
  runtimeBoundaries(names, references, clients, adapters, policy, violations);
  const uniqueViolations = [...new Map(violations.map((item) => [JSON.stringify(item), item])).values()];
  return {
    ok: uniqueViolations.length === 0,
    sourceFiles: names.length,
    runtimeImports: references.filter((edge) => !edge.typeOnly).length,
    typeImports: references.filter((edge) => edge.typeOnly).length,
    internalRuntimeEdges: edges.filter((edge) => !edge.typeOnly).length,
    internalTypeEdges: edges.filter((edge) => edge.typeOnly).length,
    runtimeCycles,
    cyclesIncludingTypes: connectedComponents(names, edges, true),
    violations: uniqueViolations,
  };
}

export function readArchitectureProject(root, policy) {
  const files = {};
  function walk(directory) {
    if (!fs.existsSync(directory) || fs.lstatSync(directory).isSymbolicLink()) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink() || entry.name === "private") continue;
      if (entry.isDirectory()) walk(absolute);
      else if (SOURCE_EXTENSION.test(entry.name)) files[normalize(path.relative(root, absolute))] = fs.readFileSync(absolute, "utf8");
    }
  }
  for (const directory of policy.sourceRoots) {
    const absolute = path.resolve(root, directory);
    if (!within(normalize(absolute), normalize(path.resolve(root))) || normalize(directory).includes("private")) throw new Error("invalid-source-root");
    walk(absolute);
  }
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const policy = JSON.parse(fs.readFileSync(path.join(root, "engineering/architecture-policy.json"), "utf8"));
  const result = checkArchitecture({ files: readArchitectureProject(root, policy), policy });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}
