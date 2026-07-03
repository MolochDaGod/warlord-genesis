#!/usr/bin/env node
/**
 * Stage KayKit lane-unit GLBs into models/kaykit/ + RTS creep fallbacks in models/units/.
 * Bundle expects lowercase paths: /models/kaykit/heroes/barbarian.glb, etc.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = [
  join(ROOT, "..", "Flare-Boss-Arena", "artifacts", "grudge-game", "public", "models", "kaykit"),
  join(
    ROOT,
    "..",
    "..",
    ".grok",
    "worktrees",
    "github-grudanode",
    "ObjectStore",
    "models",
    "characters",
    "kaykit",
  ),
];

function findSrc(relPath, fileName) {
  for (const base of SOURCES) {
    const pascal = join(base, relPath, fileName);
    if (existsSync(pascal)) return pascal;
    const lower = join(base, relPath, fileName.toLowerCase());
    if (existsSync(lower)) return lower;
  }
  return null;
}

function stageCopy(src, dest) {
  if (!src) {
    console.warn("[kaykit] missing source for", dest);
    return false;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log("[kaykit]", dest.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
  return true;
}

/** PascalCase KayKit export → bundle slug (kaykit_barbarian → barbarian). */
const HEROES = [
  ["Barbarian.glb", "barbarian.glb"],
  ["Rogue_Hooded.glb", "rogue_hooded.glb"],
  ["Knight.glb", "knight.glb"],
  ["Ranger.glb", "ranger.glb"],
];

const ENEMIES = [
  ["Skeleton_Warrior.glb", "skeleton_warrior.glb"],
  ["Skeleton_Mage.glb", "skeleton_mage.glb"],
];

let staged = 0;

for (const [srcName, destName] of HEROES) {
  const src = findSrc("heroes", srcName);
  if (stageCopy(src, join(ROOT, "models", "kaykit", "heroes", destName))) staged++;
}

for (const [srcName, destName] of ENEMIES) {
  const src = findSrc("enemies", srcName);
  if (stageCopy(src, join(ROOT, "models", "kaykit", "enemies", destName))) staged++;
}

/** RTS lane creeps (cdnReachable=false → /models/units/*.glb). Reuse KayKit until grudge-nexus RTS pack ships. */
const UNIT_ALIASES = [
  ["footman.glb", "heroes", "Barbarian.glb"],
  ["archer.glb", "heroes", "Ranger.glb"],
  ["knight.glb", "heroes", "Knight.glb"],
];

for (const [destName, folder, srcName] of UNIT_ALIASES) {
  const src = findSrc(folder, srcName);
  if (stageCopy(src, join(ROOT, "models", "units", destName))) staged++;
}

const paletteSrc = join(ROOT, "models", "towers", "medieval", "atlas.png");
const paletteDest = join(ROOT, "models", "units", "Color_Palette.png");
if (existsSync(paletteSrc) && stageCopy(paletteSrc, paletteDest)) staged++;

console.log(`[kaykit] staged=${staged} files`);
if (staged < 9) process.exit(1);