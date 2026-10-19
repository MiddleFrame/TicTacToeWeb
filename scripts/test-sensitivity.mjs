import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoot = realpathSync(tmpdir());
const root = realpathSync(mkdtempSync(join(temporaryRoot, "tttp-sensitivity-")));
if (dirname(root) !== temporaryRoot || !basename(root).startsWith("tttp-sensitivity-")) throw new Error("Unexpected mutation fixture directory");

const faults = [
  { name: "admin bypass", file: "app/backend/admin-auth.ts", before: "if (!isAdminEmail(identity?.email, env.ADMIN_GOOGLE_EMAILS))", after: "if (false)", test: "backend/http-auth", pattern: "admin authorization uses" },
  { name: "free or concurrent purchases", file: "app/components/game/StoreScreen.tsx", before: "!props.transactionPending && props.coins >= cardPackCost(count)", after: "true", test: "ui/store-settings", pattern: "offline store permits" },
  { name: "broken deck filter", file: "app/components/game/DeckScreen.tsx", before: "setFilter(value)", after: 'setFilter("all")', test: "ui/deck-screen", pattern: "deck filters change" },
  { name: "duplicate ad reward", file: "app/game/account-operation-gate.ts", before: "if (completed) return;", after: "", test: "runtime/progress-reliability", pattern: "a rewarded attempt owns" },
  { name: "wrong account acknowledgement", file: "app/game/progress-sync.ts", before: 'if (response.progress.accountId !== initial.accountId) throw new ProgressRequestError("account-progress-conflict", 409);', after: "", test: "runtime/progress-reliability", pattern: "late or wrong-account acknowledgements" },
  { name: "SQL quota off by one", file: "app/backend/rewarded-rewards.ts", before: "created_at > ?) < ?", after: "created_at > ?) <= ?", test: "backend/backend-rewards", pattern: "concurrent rewarded requests reserve only" },
  { name: "ignored Worker rate-limit rejection", file: "worker/index.ts", before: "if (rejected) return rejected;", after: "", test: "backend/worker-rate-limit", pattern: "Worker enforces the real SQL quota" },
];

function run(fault) {
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", `--test-name-pattern=${fault.pattern}`, join(root, "tests", `${fault.test}.test.mjs`)], { cwd: root, encoding: "utf8", timeout: 30_000 });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

try {
  for (const directory of ["app", "worker", "tests", "drizzle"]) cpSync(join(source, directory), join(root, directory), { recursive: true });
  cpSync(join(source, "package.json"), join(root, "package.json"));
  symlinkSync(join(source, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  for (const fault of faults) {
    const file = join(root, fault.file);
    const original = readFileSync(file, "utf8");
    if (original.split(fault.before).length !== 2) throw new Error(`Mutation anchor changed: ${fault.name}`);
    const baseline = run(fault);
    if (baseline.status !== 0 || !/^# pass 1$/m.test(baseline.output)) throw new Error(`Sensitivity baseline failed: ${fault.name}\n${baseline.output}`);
    writeFileSync(file, original.replace(fault.before, fault.after));
    try {
      const mutated = run(fault);
      if (mutated.status === 0 || !mutated.output.includes("ERR_ASSERTION") || !new RegExp(`^not ok \\d+ - ${fault.pattern}`, "m").test(mutated.output)) {
        throw new Error(`Fault was not caught by its behavioral assertion: ${fault.name}\n${mutated.output}`);
      }
      console.log(`Caught: ${fault.name}`);
    } finally {
      writeFileSync(file, original);
    }
  }
  console.log(`Sensitivity: ${faults.length}/${faults.length} representative faults detected`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
