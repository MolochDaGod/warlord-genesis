#!/usr/bin/env node
/**
 * Full production deploy: CI build → Vercel prod → live smoke test.
 * Usage: node scripts/deploy.mjs [--skip-build] [--skip-live]
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const skipBuild = args.has("--skip-build");
const skipLive = args.has("--skip-live");

function run(cmd) {
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}

if (!skipBuild) {
  run("node scripts/ci-build.mjs");
}

run("node scripts/vercel-deploy.mjs");

if (!skipLive) {
  run("node scripts/verify-deploy.mjs --live");
}

console.log("\n[deploy] production deploy complete");