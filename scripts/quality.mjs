import { spawnSync } from "node:child_process";

const runner = process.env.npm_execpath;
if (!runner) throw new Error("Run this gate with npm run quality or pnpm run quality");

for (const task of ["check:architecture", "typecheck", "test", "lint", "build", "android:web", "check:android-web"]) {
  const result = spawnSync(process.execPath, [runner, "run", task], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
