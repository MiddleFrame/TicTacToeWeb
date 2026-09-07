import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export async function measureAndroidWeb(directory) {
  const files = new Map();
  const visit = async (folder) => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Android web output must not contain symbolic links");
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.set(path.relative(directory, file).replaceAll("\\", "/"), await readFile(file));
    }
  };
  await visit(directory);
  const html = files.get("index.html")?.toString("utf8");
  const entry = html?.match(/entry\.src\s*=\s*"(\.\/[^"<>]+\.js)"/)?.[1];
  if (!entry) throw new Error("Guarded Android module entry is missing");
  const initial = new Set();
  const inspectModule = (name) => {
    if (initial.has(name)) return;
    const content = files.get(name);
    if (!content || !/\.m?js$/.test(name)) throw new Error(`Missing initial JavaScript module: ${name}`);
    initial.add(name);
    const ast = ts.createSourceFile(name, content.toString("utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier)) continue;
      if (!specifier.text.startsWith("./") && !specifier.text.startsWith("../")) {
        throw new Error(`Unbundled initial module: ${specifier.text}`);
      }
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier.text));
      if (dependency.startsWith("../")) throw new Error("Initial module escapes Android web output");
      inspectModule(dependency);
    }
  };
  inspectModule(entry.slice(2));
  return {
    files: files.size,
    webAssetBytes: [...files.values()].reduce((sum, content) => sum + content.length, 0),
    javascriptBytes: [...files].reduce((sum, [name, content]) => sum + (/\.m?js$/.test(name) ? content.length : 0), 0),
    initialJavaScriptBytes: [...initial].reduce((sum, name) => sum + files.get(name).length, 0),
    initialJavaScriptModules: [...initial].sort(),
  };
}
