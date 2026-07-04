#!/usr/bin/env node
/** Vercel CI entry — keeps buildCommand under 256 chars; assets ship from git. */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const steps = [
  "node scripts/stage-textures.mjs",
  "node scripts/stage-icons.mjs",
  "node scripts/stage-vfx-catalog.mjs",
  "node scripts/fix-glb-header.mjs models/towers",
  "node scripts/fix-glb-header.mjs models/heroes",
  "node scripts/fix-glb-header.mjs models/pets",
  "node scripts/fix-glb-header.mjs models/anims",
  "node scripts/validate-tower-glbs.mjs",
  "node scripts/patch-bundle.mjs",
  "node scripts/generate-vercel-config.mjs",
  "node scripts/verify-deploy.mjs",
];

for (const cmd of steps) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}