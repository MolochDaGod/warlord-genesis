#!/usr/bin/env node
/**
 * Ship rotation-only baked clips under /anims/baked/ for the warcamp bundle.
 * client.grudge-studio.com returns SPA HTML for these paths — they must be static.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "anims", "baked");

const BAKED_SRC = join(
  ROOT,
  "..",
  "Character-Animator-Mapper",
  "Character-Animator-Mapper",
  "attached_assets",
  "extracted",
  "baked",
);

const UPLOADS_SRC = join(
  ROOT,
  "..",
  "..",
  ".grok",
  "worktrees",
  "character-animator-two-character-animator-two",
  "grudge6",
  "attached_assets",
  "extracted",
  "baked",
  "uploads",
);

function copyTree(src, dest) {
  if (!existsSync(src)) {
    console.warn("[baked] missing source:", src);
    return 0;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  return 1;
}

function alias(srcRel, destRel) {
  const src = join(OUT, srcRel);
  const dest = join(OUT, destRel);
  if (!existsSync(src)) {
    console.warn("[baked] alias source missing:", srcRel);
    return false;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log("[baked]", destRel.replace(/\\/g, "/"));
  return true;
}

let staged = 0;
if (copyTree(BAKED_SRC, OUT)) {
  console.log("[baked] copied library from Character-Animator-Mapper");
  staged++;
}

if (existsSync(UPLOADS_SRC)) {
  copyTree(UPLOADS_SRC, join(OUT, "uploads"));
  console.log("[baked] copied uploads/ from grudge6");
  staged++;
}

// Paths referenced by sx / N6 that are absent from the baked library.
const aliases = [
  ["locomotion/idle.json", "venom/idle.json"],
  ["locomotion/walking.json", "venom/walk-forward.json"],
  ["locomotion/running.json", "venom/run-forward.json"],
  ["locomotion/running.json", "uploads_2026_06/locomotion/running.json"],
  ["unarmed/lead_jab.json", "unarmed/punching.json"],
  ["locomotion/walking.json", "rifle/walk forward.json"],
  ["rifle/idle aiming.json", "rifle/firing.json"],
  ["pistol/pistol run.json", "pistol/gunplay.json"],
  ["longbow/standing idle 01.json", "longbow/standing aim recoil.json"],
  ["rifle/firing.json", "rifle/firing 2.json"],
  ["uploads/combat/reloading.json", "rifle/reloading.json"],
  ["unarmed/punching.json", "rifle/punch.json"],
];

let aliased = 0;
for (const [from, to] of aliases) {
  if (alias(from, to)) aliased++;
}

console.log(`[baked] staged=${staged} aliases=${aliased} → ${OUT}`);