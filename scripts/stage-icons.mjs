#!/usr/bin/env node
/**
 * Stage voxgrudge custom icons + canonical Grudge Studio fleet icons into /assets/icons.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VOX_SRC = process.env.WG_VOX_SRC || "C:\\Users\\nugye\\Desktop\\grudgeproduction\\voxgrudge";
const OS_BASE = "https://objectstore.grudge-studio.com";

const VOX_COPY = [
  ["bosslogo.png", "brand/bosslogo.png"],
  ["grudgevox.png", "brand/grudgevox.png"],
  ["voxel_grudge_helmet_logo.png", "brand/voxel-helmet.png"],
  ["living4characters.png", "brand/living4characters.png"],
  ["holy.png", "factions/holy.png"],
  ["ice.png", "factions/ice.png"],
  ["storm.png", "factions/storm.png"],
  ["fire.png", "vox/fire.png"],
  ["fire-rock.png", "vox/fire-rock.png"],
  ["flaming-spear.png", "vox/flaming-spear.png"],
  ["flaming-staff.png", "vox/flaming-staff.png"],
  ["golden-arrow.png", "vox/golden-arrow.png"],
  ["gray-spear.png", "vox/gray-spear.png"],
  ["ornate-spear.png", "vox/ornate-spear.png"],
  ["spectral-dagger.png", "vox/spectral-dagger.png"],
  ["water-sword.png", "vox/water-sword.png"],
  ["small-trident.png", "vox/small-trident.png"],
];

const FLEET_DOWNLOAD = [
  ["icons/weapons_full/Sword_01.png", "weapons/sword.png"],
  ["icons/weapons_full/Sword_02.png", "weapons/greatsword.png"],
  ["icons/weapons_full/Bow_01.png", "weapons/bow.png"],
  ["icons/weapons_full/Dagger_01.png", "weapons/dagger.png"],
  ["icons/weapons_full/Hammer_01.png", "weapons/hammer.png"],
  ["icons/weapons_full/Staff_51.png", "weapons/staff.png"],
  ["icons/weapons_full/Axe_01.png", "weapons/axe.png"],
  ["icons/weapons_full/Axe_02.png", "weapons/greataxe.png"],
  ["icons/weapons_full/Crossbow_01.png", "weapons/crossbow.png"],
  ["icons/weapons_full/shield_01.png", "weapons/shield.png"],
  ["icons/weapons_full/Scythe_01.png", "weapons/scythe.png"],
  ["icons/496_rpg_icons/W_Gun001.png", "weapons/gun.png"],
  ["icons/496_rpg_icons/W_Mace001.png", "weapons/mace.png"],
  ["icons/weapons/holy-tome.png", "weapons/tome.png"],
  ["icons/weapons/kinrend-bow.png", "weapons/bow-kinrend.png"],
  ["icons/496_rpg_icons/S_Holy01.png", "elements/holy.png"],
  ["icons/496_rpg_icons/S_Fire01.png", "elements/fire.png"],
  ["icons/skill_nobg/Warriorskill_01_nobg.png", "skills/warrior-01.png"],
  ["icons/skill_nobg/Warriorskill_02_nobg.png", "skills/warrior-02.png"],
  ["icons/skill_nobg/Warriorskill_03_nobg.png", "skills/warrior-03.png"],
  ["icons/skill_nobg/Archerskill_01_nobg.png", "skills/archer-01.png"],
  ["icons/skill_nobg/Archerskill_02_nobg.png", "skills/archer-02.png"],
  ["icons/skill_nobg/Mageskill_01_Nobg.png", "skills/mage-01.png"],
  ["icons/skill_nobg/Mageskill_02_nobg.png", "skills/mage-02.png"],
  ["icons/skill_nobg/Priestskill_01_nobg.png", "skills/priest-01.png"],
];

let staged = 0;
let skipped = 0;
let failed = 0;

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function stageCopy(src, destRel) {
  const dest = join(ROOT, "assets", "icons", destRel);
  if (!existsSync(src)) {
    console.warn(`[icons] missing source: ${src}`);
    skipped++;
    return false;
  }
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  staged++;
  return true;
}

async function downloadFleet(remotePath, destRel) {
  const dest = join(ROOT, "assets", "icons", destRel);
  ensureDir(dirname(dest));
  const url = `${OS_BASE}/${remotePath}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[icons] HTTP ${res.status} ${url}`);
      failed++;
      return false;
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("image")) {
      console.warn(`[icons] not an image (${ct}): ${url}`);
      failed++;
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buf);
    staged++;
    return true;
  } catch (err) {
    console.warn(`[icons] fetch failed ${url}:`, err.message);
    failed++;
    return false;
  }
}

// Vox lance fallback when fleet has no dedicated lance icon
stageCopy(join(VOX_SRC, "golden-arrow.png"), "weapons/lance.png");
stageCopy(join(VOX_SRC, "ornate-spear.png"), "weapons/lance-ornate.png");

for (const [srcName, destRel] of VOX_COPY) {
  stageCopy(join(VOX_SRC, srcName), destRel);
}

for (const [remote, destRel] of FLEET_DOWNLOAD) {
  await downloadFleet(remote, destRel);
}

const manifest = {
  stagedAt: new Date().toISOString(),
  voxSrc: VOX_SRC,
  fleetBase: OS_BASE,
  counts: { staged, skipped, failed },
};
writeFileSync(join(ROOT, "assets", "icons", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`[icons] staged=${staged} skipped=${skipped} failed=${failed}`);