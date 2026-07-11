#!/usr/bin/env node
/**
 * Attach production env + secrets to Vercel project warlord-genesis.
 * Reads .env.production.local (gitignored) and sets Production environment.
 *
 * Usage: node scripts/attach-env.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.production.local");
const SCOPE = "grudgenexus";
const PROJECT = "warlord-genesis";

const REQUIRED_PUBLIC = [
  "GRUDGE_API_URL",
  "WARLORD_GENESIS_API_URL",
  "GRUDGE_AUTH_URL",
  "VITE_ASSETS_URL",
  "VITE_OBJECTSTORE_URL",
  "VITE_AUTH_GATEWAY_URL",
  "VITE_WORLD_URL",
  "VITE_WS_URL",
  "VITE_REALTIME_WS_URL",
  "VITE_SITE_URL",
  "VITE_CANONICAL_HOST",
  "OBJECT_STORAGE_PUBLIC_URL",
  "OBJECTSTORE_WORKER_URL",
];

const SECRET_KEYS = [
  "JWT_SECRET",
  "DATABASE_URL",
  "OBJECTSTORE_API_KEY",
  "OBJECT_STORAGE_KEY",
  "OBJECT_STORAGE_SECRET",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_REGION",
];

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function vercelEnvAdd(key, value, env = "production") {
  // Remove existing then add (idempotent)
  try {
    execFileSync(
      "npx",
      ["vercel", "env", "rm", key, env, "--yes", "--scope", SCOPE],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], shell: true },
    );
  } catch {
    /* not present */
  }
  // Pipe value on stdin — never log it
  execFileSync(
    "npx",
    ["vercel", "env", "add", key, env, "--scope", SCOPE],
    {
      cwd: ROOT,
      input: value + "\n",
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      env: process.env,
    },
  );
}

function main() {
  if (!existsSync(ENV_FILE)) {
    console.error(`[attach-env] Missing ${ENV_FILE}`);
    process.exit(1);
  }
  const env = parseEnv(readFileSync(ENV_FILE, "utf8"));
  const keys = [...REQUIRED_PUBLIC, ...SECRET_KEYS].filter((k) => env[k]);
  console.log(`[attach-env] attaching ${keys.length} vars to ${PROJECT} (production)`);

  let ok = 0;
  let fail = 0;
  for (const key of keys) {
    try {
      vercelEnvAdd(key, env[key], "production");
      // also preview for PR deploys (public only — secrets too for API rewrites)
      try {
        vercelEnvAdd(key, env[key], "preview");
      } catch {
        /* preview optional */
      }
      console.log(`  OK  ${key}${SECRET_KEYS.includes(key) ? " (secret)" : ""}`);
      ok += 1;
    } catch (e) {
      console.error(`  FAIL ${key}: ${e.message?.split("\n")[0] || e}`);
      fail += 1;
    }
  }
  console.log(`[attach-env] done ok=${ok} fail=${fail}`);
  if (fail) process.exit(1);
}

main();
