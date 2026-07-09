#!/usr/bin/env node
/**
 * Stage v47/v48 tower, faction core, and weapon GLBs from user Documents folder.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "..");
const SPLIT = join(ROOT, "scripts", "split-glb-subtree.mjs");

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

function copy(srcName, relDst) {
  const src = join(DOCS, srcName);
  const dst = join(ROOT, relDst);
  if (!existsSync(src)) {
    console.warn("[stage-towers-v2] missing source:", src);
    return false;
  }
  ensureDir(dst);
  copyFileSync(src, dst);
  console.log("[stage-towers-v2] copied", relDst);
  return true;
}

function split(srcName, relDst, nodeName) {
  const src = join(DOCS, srcName);
  const dst = join(ROOT, relDst);
  if (!existsSync(src)) {
    console.warn("[stage-towers-v2] missing source for split:", src);
    return false;
  }
  const r = spawnSync("node", [SPLIT, src, dst, nodeName], { stdio: "inherit", shell: false });
  if (r.status !== 0) {
    console.error("[stage-towers-v2] split failed:", nodeName, "->", relDst);
    process.exit(r.status ?? 1);
  }
  return true;
}

// Direct copies
copy("animated_game-ready_turret.glb", "models/towers/medieval/game_ready_turret.glb");
copy("fantasy_archer_tower_-_low_poly_3d_game_asset.glb", "models/towers/elven/fantasy_crossbow_tower.glb");
copy("polygon_guns.glb", "models/weapons/polygon_guns.glb");

// Wooden watchtower tiers
split("wooden_watchtower_lvl_1-3.glb", "models/towers/medieval/watchtower_lvl1.glb", "Cylinder.013");
split("wooden_watchtower_lvl_1-3.glb", "models/towers/medieval/watchtower_lvl2.glb", "Cylinder.069");
split("wooden_watchtower_lvl_1-3.glb", "models/towers/medieval/watchtower_lvl3.glb", "Cylinder.106");

// Upgradeable tower monolith → 9 standalone GLBs
const upgradeSplits = [
  ["archer_t1.glb", "sm_ArcherTowerOne_Complete"],
  ["archer_t2.glb", "sm_ArcherTowerTwo_Complete"],
  ["archer_t3.glb", "sm_ArcherTowerThree_Complete"],
  ["bomber_t1.glb", "sm_BomberTowerOne_Complete"],
  ["bomber_t2.glb", "sm_BomberTowerTwo_Complete"],
  ["bomber_t3.glb", "sm_BomberTowerThree_Complete"],
  ["slow_t1.glb", "sm_SlowTowerV1_001"],
  ["slow_t2.glb", "sm_SlowTowerV2_001"],
  ["slow_t3.glb", "sm_SlowTowerV3_001"],
];

for (const [file, node] of upgradeSplits) {
  split("upgradeable_towers.glb", `models/towers/upgradeable/${file}`, node);
}

// Pack-specific aliases (fT uses models/towers/{pack}/{id}.glb)
const aliases = [
  ["models/towers/upgradeable/archer_t3.glb", "models/towers/elven/archer_t3.glb"],
  ["models/towers/upgradeable/bomber_t1.glb", "models/towers/orc/bomber_t1.glb"],
  ["models/towers/upgradeable/bomber_t3.glb", "models/towers/orc/bomber_t3.glb"],
  ["models/towers/upgradeable/slow_t1.glb", "models/towers/ruins/slow_t1.glb"],
  ["models/towers/upgradeable/slow_t3.glb", "models/towers/ruins/slow_t3.glb"],
  ["models/towers/medieval/watchtower_lvl2.glb", "models/towers/medieval/archer_t2.glb"],
];

for (const [from, to] of aliases) {
  const a = join(ROOT, from);
  const b = join(ROOT, to);
  if (!existsSync(a)) continue;
  ensureDir(b);
  copyFileSync(a, b);
  console.log("[stage-towers-v2] alias", to);
}

// v48 — stylized animated turret (medieval inner tier)
copy("stylized_game_asset_turret.glb", "models/towers/medieval/stylized_turret.glb");

// v48 — tribal hut faction citadels (4 packs)
const factionBuildings = [
  ["muu.glb", "Mainhouse_Muu_Lv3"],
  ["mantah.glb", "Mainhouse_Mantah_Lv3"],
  ["krakee.glb", "Mainhouse_Krakee_Lv3"],
  ["antuk.glb", "Mainhouse_Antuk_Lv3"],
];
for (const [file, node] of factionBuildings) {
  split("stylized_tribal_hut.glb", `models/buildings/faction/${file}`, node);
}

// v48 — medieval tower showcase splits
const medievalSplits = [
  ["luchnik.glb", "luchnik"],
  ["mag.glb", "mag"],
  ["pushka.glb", "pushka"],
  ["bashnia.glb", "bashnia"],
  ["bashnia1.glb", "bashnia1"],
  ["bashnia2.glb", "bashnia2"],
];
for (const [file, node] of medievalSplits) {
  split("3_medieval_towers.glb", `models/towers/medieval/${file}`, node);
}

// Pack-specific aliases for CIA v48
const v48Aliases = [
  ["models/towers/medieval/mag.glb", "models/towers/elven/mag.glb"],
  ["models/towers/medieval/pushka.glb", "models/towers/orc/pushka.glb"],
  ["models/towers/medieval/bashnia2.glb", "models/towers/orc/bashnia2.glb"],
  ["models/towers/medieval/bashnia.glb", "models/towers/ruins/bashnia.glb"],
];
for (const [from, to] of v48Aliases) {
  const a = join(ROOT, from);
  const b = join(ROOT, to);
  if (!existsSync(a)) continue;
  ensureDir(b);
  copyFileSync(a, b);
  console.log("[stage-towers-v2] v48 alias", to);
}

console.log("[stage-towers-v2] done");