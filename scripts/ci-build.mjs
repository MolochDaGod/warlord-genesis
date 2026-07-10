#!/usr/bin/env node
/** Vercel CI entry — keeps buildCommand under 256 chars; assets ship from git. */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const steps = [
  // Textures (skip if already baked; use --force via npm run textures:bake locally)
  "node scripts/bake-map-textures.mjs",
  "node scripts/generate-ground-textures.mjs",
  "node scripts/generate-battle-textures.mjs",
  "node scripts/stage-textures.mjs",
  "node scripts/stage-icons.mjs",
  "node scripts/stage-vfx-catalog.mjs",
  // GLB hygiene
  "node scripts/fix-glb-header.mjs models/towers",
  "node scripts/fix-glb-header.mjs models/heroes",
  "node scripts/fix-glb-header.mjs models/pets",
  "node scripts/fix-glb-header.mjs models/anims",
  "node scripts/validate-tower-glbs.mjs",
  // Bundle + CSS
  "node scripts/patch-bundle.mjs",
  "node scripts/append-pregame-css.mjs",
  "node scripts/append-hud-css.mjs",
  "node scripts/generate-vercel-config.mjs",
  "node scripts/verify-deploy.mjs",
];

for (const cmd of steps) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}