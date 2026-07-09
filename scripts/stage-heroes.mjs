#!/usr/bin/env node
/**
 * Stage desktop faction hero GLBs, pets, and anim-bank into the static deploy tree.
 * Sources: MouseWithoutBorders/{crusade,Legion,fabled,Pets}.zip + anim-bank.glb
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DESKTOP = process.env.WG_ASSET_SRC || "C:\\Users\\nugye\\Desktop\\MouseWithoutBorders";
const IMPORT = join(ROOT, ".tmp-asset-import");

const RACE_REPO = {
  human: "western-kingdoms",
  barbarian: "barbarians",
  dwarf: "dwarves",
  elf: "high-elves",
  orc: "orcs",
  undead: "undead",
};

const CLASS_FILE = {
  warrior: "warrior",
  worge: "knight",
  mage: "mage",
  ranger: "ranger",
};

const FACTION_DIRS = [
  { faction: "crusade", folder: join(IMPORT, "crusade", "crusade") },
  { faction: "fabled", folder: join(IMPORT, "fabled", "fabled") },
  { faction: "legion", folder: join(IMPORT, "Legion", "Legion") },
];

const PETS_SRC = join(IMPORT, "Pets", "Pets");
const PET_RENAME = {
  "american_aligator_from_cotw_game.glb": "american_aligator.glb",
  "canada_goose_from_cotw_game.glb": "canada_goose.glb",
  "cotw_black_grouse_male.glb": "black_grouse.glb",
  "bigfoot.glb": "bigfoot.glb",
  "boar.glb": "boar.glb",
};

let staged = 0;
let skipped = 0;

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function stageCopy(src, dest) {
  if (!existsSync(src)) {
    skipped++;
    return false;
  }
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  staged++;
  return true;
}

function findHeroSrc(repo, classKey) {
  const file = `${repo}_${classKey}.glb`;
  for (const { folder } of FACTION_DIRS) {
    const p = join(folder, file);
    if (existsSync(p)) return p;
  }
  return null;
}

// ── Faction hero GLBs → models/heroes/grudge6/{repo}_{class}.glb ─────────────
const heroesDir = join(ROOT, "models", "heroes", "grudge6");
ensureDir(heroesDir);

for (const [raceId, repo] of Object.entries(RACE_REPO)) {
  for (const [classId, classKey] of Object.entries(CLASS_FILE)) {
    const src = findHeroSrc(repo, classKey);
    const dest = join(heroesDir, `${repo}_${classId}.glb`);
    if (stageCopy(src, dest)) {
      console.log(`[heroes] ${repo}_${classId} ← ${src}`);
    } else {
      console.warn(`[heroes] missing ${repo}_${classKey}.glb for ${raceId}/${classId}`);
    }
  }
}

// ── Pets → models/pets/ ───────────────────────────────────────────────────────
const petsDir = join(ROOT, "models", "pets");
ensureDir(petsDir);

if (existsSync(PETS_SRC)) {
  for (const name of readdirSync(PETS_SRC)) {
    if (!name.endsWith(".glb")) continue;
    const destName = PET_RENAME[name] || name;
    stageCopy(join(PETS_SRC, name), join(petsDir, destName));
    console.log(`[pets] ${destName}`);
  }
} else {
  console.warn("[pets] extract dir missing — run Expand-Archive on Pets.zip first");
}

// ── anim-bank.glb → models/anims/anim-bank.glb ─────────────────────────────
const animBankSrc = join(DESKTOP, "anim-bank.glb");
const animBankDest = join(ROOT, "models", "anims", "anim-bank.glb");
if (stageCopy(animBankSrc, animBankDest)) {
  console.log(`[anims] anim-bank.glb (${statSync(animBankDest).size} bytes)`);
}

console.log(`[stage-heroes] staged ${staged} files, skipped ${skipped}`);