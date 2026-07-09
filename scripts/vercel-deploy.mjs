#!/usr/bin/env node
/**
 * Deploy without stale VERCEL_TOKEN overriding CLI session auth.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
delete env.VERCEL_TOKEN;

const args = process.argv.slice(2);
const vercelArgs = args.length ? args : ["deploy", "--prod", "--yes"];

console.log("[vercel-deploy]", vercelArgs.join(" "));

const r = spawnSync("vercel", vercelArgs, {
  cwd: ROOT,
  env,
  stdio: "inherit",
  shell: true,
});

process.exit(r.status ?? 1);