#!/usr/bin/env node
/**
 * Vercel git entry — verify already-pinned Vite SPA.
 * Does not compile TS (artifacts/ is not uploaded). Does not patch gw-core.
 * Compile path: GHA Deploy Genesis SPA or `pnpm run deploy:spa`.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(ROOT, "index.html");

function run(cmd, { optional = false } = {}) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
    return true;
  } catch (err) {
    if (optional) {
      console.warn(`[ci-build] optional step failed (continuing): ${cmd}`);
      return false;
    }
    throw err;
  }
}

if (!existsSync(INDEX)) {
  console.error("[ci-build] missing index.html");
  process.exit(1);
}

const html = readFileSync(INDEX, "utf8");
const vite = /\/assets\/index-[^"'?]+\.js/.test(html);
const bootsGwCore = /src=["'][^"']*gw-core-/.test(html);
if (bootsGwCore) {
  console.error("[ci-build] index.html still boots gw-core. Run: node scripts/ship-vite-spa.mjs");
  process.exit(1);
}
if (!vite) {
  console.error("[ci-build] index.html is not a Vite pin (/assets/index-*.js)");
  process.exit(1);
}

console.log("[ci-build] Vite SPA pin — verify only (source is artifacts/grudge-warlords)");
run("node scripts/generate-vercel-config.mjs", { optional: true });
run("node scripts/verify-deploy.mjs");
console.log("[ci-build] done (vite)");
