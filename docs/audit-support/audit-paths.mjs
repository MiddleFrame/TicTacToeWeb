import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function findRepository(start) {
  let directory = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(directory, 'package.json')) && fs.existsSync(path.join(directory, 'app/game/player-progress.ts'))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

export const repositoryRoot = findRepository(path.dirname(fileURLToPath(import.meta.url))) ?? findRepository(process.cwd());
if (!repositoryRoot) throw new Error('Run the audit fixtures from a TicTacToeWeb checkout');

export const sourcePath = relative => path.join(repositoryRoot, relative);
export const readSource = relative => fs.readFileSync(sourcePath(relative), 'utf8');
export const importSource = relative => import(pathToFileURL(sourcePath(relative)).href);

export function writeResult(name, value) {
  if (!/^[a-z0-9-]+\.json$/.test(name)) throw new Error('Invalid audit result filename');
  const directory = sourcePath('work/technical-audit-2026-09-07/repro');
  fs.mkdirSync(directory, { recursive: true });
  const text = JSON.stringify(value, null, 2) + '\n';
  fs.writeFileSync(path.join(directory, name), text);
  process.stdout.write(text);
}
