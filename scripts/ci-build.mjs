#!/usr/bin/env node
/**
 * Vercel CI entry.
 * Assets (bundle, CSS, models) ship from git — when present we skip heavy
 * texture generation and only verify the deploy inventory.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "deploy-manifest.json");
const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf8"))
  : { bundleFile: "assets/index-warlord-fix3.js" };
const BUNDLE = join(ROOT, manifest.bundleFile ?? "assets/index-warlord-fix3.js");

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

// Ship patched game bundle (fix2 → fix3 → gw-core). Skips only when source missing.
const FIX2 = join(ROOT, "assets", "index-warlord-fix2.js");
if (existsSync(FIX2)) {
  console.log("[ci-build] patching fix2 → gw-core");
  run("node scripts/patch-bundle.mjs");
  run("node scripts/generate-vercel-config.mjs", { optional: true });
  run("node scripts/verify-deploy.mjs");
  console.log("[ci-build] done");
  process.exit(0);
}

if (existsSync(BUNDLE)) {
  console.log("[ci-build] prebuilt bundle only — static ship mode (no fix2 source)");
  run("node scripts/generate-vercel-config.mjs", { optional: true });
  run("node scripts/verify-deploy.mjs");
  console.log("[ci-build] done");
  process.exit(0);
}

const steps = [
  { cmd: "node scripts/generate-ground-textures.mjs", optional: true },
  { cmd: "node scripts/generate-battle-textures.mjs", optional: true },
  { cmd: "node scripts/stage-textures.mjs", optional: true },
  { cmd: "node scripts/stage-icons.mjs", optional: true },
  { cmd: "node scripts/stage-vfx-catalog.mjs", optional: true },
  { cmd: "node scripts/fix-glb-header.mjs models/towers", optional: true },
  { cmd: "node scripts/fix-glb-header.mjs models/heroes", optional: true },
  { cmd: "node scripts/fix-glb-header.mjs models/pets", optional: true },
  { cmd: "node scripts/fix-glb-header.mjs models/anims", optional: true },
  { cmd: "node scripts/validate-tower-glbs.mjs", optional: true },
  { cmd: "node scripts/patch-bundle.mjs", optional: true },
  { cmd: "node scripts/generate-vercel-config.mjs", optional: false },
  { cmd: "node scripts/verify-deploy.mjs", optional: true },
];

for (const { cmd, optional } of steps) {
  run(cmd, { optional });
}
console.log("[ci-build] done");
