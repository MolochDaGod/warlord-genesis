#!/usr/bin/env node
/**
 * Stage GRUDGE6 race texture atlases for local fallback + FBX PSD remap.
 * Canonical source: character-viewer public/assets or assets.grudge-studio.com CDN.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const VIEWER_ASSETS = join(
  ROOT,
  "..",
  "..",
  ".grok",
  "worktrees",
  "character-animator-two-character-animator-two",
  "grudge6",
  "artifacts",
  "character-viewer",
  "public",
  "assets",
);

/** folder → canonical textureFile (matches bundle fH map). */
const RACE_TEXTURES = [
  ["barbarians", "BRB_StandardUnits_texture.webp"],
  ["dwarves", "DWF_Standard_Units.webp"],
  ["elves", "ELF_HighElves_Texture.webp"],
  ["orcs", "ORC_StandardUnits.webp"],
  ["undead", "UD_Standard_Units.webp"],
  ["western-kingdoms", "WK_Standard_Units.webp"],
];

const CDN = "https://assets.grudge-studio.com/assets";

async function fetchToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  return true;
}

let staged = 0;

for (const [folder, file] of RACE_TEXTURES) {
  const dest = join(ROOT, "textures", "grudge6", folder, file);
  const localSrc = join(VIEWER_ASSETS, folder, "textures", file);
  mkdirSync(dirname(dest), { recursive: true });

  if (existsSync(localSrc)) {
    copyFileSync(localSrc, dest);
    console.log("[textures]", dest.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
    staged++;
    continue;
  }

  try {
    await fetchToFile(`${CDN}/${folder}/textures/${file}`, dest);
    console.log("[textures] fetched", file);
    staged++;
  } catch (e) {
    console.warn("[textures] missing", folder, file, e.message);
  }
}

// Legacy single-file remap target used by older bundle paths.
const wkSrc = join(ROOT, "textures", "grudge6", "western-kingdoms", "WK_Standard_Units.webp");
const wkLegacy = join(ROOT, "textures", "WK_Standard_Units.webp");
if (existsSync(wkSrc)) {
  mkdirSync(dirname(wkLegacy), { recursive: true });
  copyFileSync(wkSrc, wkLegacy);
  console.log("[textures] textures/WK_Standard_Units.webp");
  staged++;
}

console.log(`[textures] staged ${staged} race atlases`);
if (staged < RACE_TEXTURES.length) process.exit(1);