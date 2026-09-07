import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function checkAndroidLint(text, policy, { repoRoot, startedAt, modifiedAt, now = Date.now() }) {
  if (![startedAt, modifiedAt, now].every(Number.isFinite) || startedAt > now || modifiedAt > now || modifiedAt < startedAt || startedAt < now - 86_400_000) {
    throw new Error("Android lint report is stale or its build start time is invalid");
  }
  const normalizedRoot = repoRoot.replaceAll("\\", "/").replace(/\/$/, "");
  const issues = [...text.matchAll(/^(.*?)(?::(\d+))?: (Error|Warning): (.*?) \[([^\]]+)\]$/gm)].map((match) => {
    const fullSource = match[1].replaceAll("\\", "/");
    return {
      source: fullSource.startsWith(`${normalizedRoot}/`) ? fullSource.slice(normalizedRoot.length + 1) : "dependency",
      line: match[2] ? Number(match[2]) : null,
      severity: match[3].toLowerCase(),
      message: match[4],
      id: match[5],
    };
  });
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const footer = text.match(/(\d+) errors?, (\d+) warnings?/);
  if (footer ? Number(footer[1]) !== errors.length || Number(footer[2]) !== warnings.length : !/No (?:issues|errors or warnings) found/i.test(text) || issues.length !== 0) {
    throw new Error("Android lint report is incomplete or its issue totals do not match");
  }
  const matches = new Map();
  const knownErrors = [];
  const unexpectedErrors = [];
  for (const issue of errors) {
    const known = policy.knownErrors.find((entry) => entry.id === issue.id && entry.source === issue.source && entry.line === issue.line
      && (entry.message ? issue.message === entry.message : entry.messageStartsWith && issue.message.startsWith(entry.messageStartsWith)));
    const count = (matches.get(known) ?? 0) + 1;
    const deadline = known && Date.parse(`${known.reviewBy}T23:59:59Z`);
    const safeIssue = { id: issue.id, source: issue.source, line: issue.line };
    if (!known || !Number.isInteger(known.maximumCount) || known.maximumCount < 1 || !Number.isFinite(deadline) || now > deadline || count > known.maximumCount) {
      unexpectedErrors.push(safeIssue);
    } else {
      matches.set(known, count);
      knownErrors.push({ ...safeIssue, owner: known.owner, reason: known.reason, reviewBy: known.reviewBy });
    }
  }
  return {
    fullLintStatus: errors.length ? "failed" : "passed",
    regressionStatus: unexpectedErrors.length ? "failed" : "no-new-errors",
    errors: errors.length,
    warnings: warnings.length,
    knownErrors,
    unexpectedErrors,
    reportFresh: true,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  if (!args.includes("--report") || !args.includes("--started-at")) {
    throw new Error("Usage: node scripts/check-android-lint.mjs --report <fresh lint text report> --started-at <build start ISO timestamp> [--output <work/report.json>]");
  }
  const report = path.resolve(root, value("--report"));
  const policy = JSON.parse(await readFile(path.join(root, "android-config/lint-known-issues.json"), "utf8"));
  const metadata = await stat(report);
  const summary = checkAndroidLint(await readFile(report, "utf8"), policy, {
    repoRoot: root, startedAt: Date.parse(value("--started-at")), modifiedAt: metadata.mtimeMs,
  });
  if (args.includes("--output")) {
    const destination = path.resolve(root, value("--output"));
    const relative = path.relative(path.join(root, "work"), destination);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.endsWith(".json")) throw new Error("Lint output must be a JSON file under ignored work");
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(summary, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.regressionStatus === "failed") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
