#!/usr/bin/env node
/**
 * Stage static assets expected by the production bundle.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ICON_SRC = join(
  ROOT,
  "..",
  "..",
  "vfc-build",
  "artifacts",
  "arcade",
  "dist",
  "public",
  "assets",
);

const PORTRAIT_SRC = join(ROOT, "..", "1111111", "ObjectStore", "heroes", "portraits");

const UNITFRAME_SRC = join(
  ROOT,
  "..",
  "..",
  "vfc-build",
  "attached_assets",
  "ui",
  "rpg",
  "part_1",
  "unitframes",
);

const UNITFRAME_FALLBACK = join(
  ROOT,
  "..",
  "..",
  ".grok",
  "worktrees",
  "github-grudanode",
  "grudge-ui-editor",
  "assets",
  "rpg",
  "part_1",
  "unitframes",
);

const KAYKIT = join(
  ROOT,
  "..",
  "..",
  ".grok",
  "worktrees",
  "github-grudanode",
  "ObjectStore",
  "models",
  "KayKit_MedievalBuilder",
  "objects",
  "gltf",
);

/** Vite hashed names referenced by index-warlord-fix3.js */
const unitFrames = [
  ["uf_frame.png", "uf_frame_1782526063043-DJb8nLKx.png"],
  ["uf2_frame.png", "uf2_frame_1782526063042-BuxhAA3q.png"],
  ["uf3_frame.png", "uf3_frame_1782526063042-Dm4QCduH.png"],
  ["uf_avatar_overlay.png", "uf_avatar_overlay_1782526063042-BCr1Uj8h.png"],
  ["uf2_avatar_overlay.png", "uf2_avatar_overlay_1782526063042-DrNyJPfT.png"],
  ["uf_level_frame.png", "uf_level_frame_1782526063043-Ch6VmpOe.png"],
  ["uf_fill_green.png", "uf_fill_green_1782526063043-BFRN-LId.png"],
  ["uf_fill_orange.png", "uf_fill_orange_1782526063043-DRAjEP_L.png"],
  ["uf3_fill_red.png", "uf3_fill_red_1782526063042-D3wTAswl.png"],
  ["uf2_fill_blue.png", "uf2_fill_blue_1782526063042-BbEdnJZv.png"],
];

const headerIcons = [
  ["header_icon_lab-C6zKQekY.png", "header_icon_lab_1782526441783-C6zKQekY.png"],
  ["header_icon_settings-cQ5nZMWa.png", "header_icon_settings_1782526441784-cQ5nZMWa.png"],
  ["header_icon_tune-BglHXqco.png", "header_icon_tune_1782526441785-BglHXqco.png"],
  ["header_icon_chat-YCWzimGI.png", "header_icon_chat_1782526441785-YCWzimGI.png"],
  ["header_icon_chest-BGIvPD-6.png", "header_icon_chest_1782526441786-BGIvPD-6.png"],
  ["header_icon_cup-D13uawsM.png", "header_icon_cup_1782526441786-D13uawsM.png"],
  ["header_icon_fist-B6X1s2Va.png", "header_icon_fist_1782526441787-B6X1s2Va.png"],
  ["header_icon_hammer-uwDO1Qnw.png", "header_icon_hammer_1782526441788-uwDO1Qnw.png"],
];

function resolveUnitFrameSrc(baseName) {
  const stem = baseName.replace(/\.png$/, "");
  for (const dir of [ICON_SRC, UNITFRAME_SRC, UNITFRAME_FALLBACK]) {
    if (!existsSync(dir)) continue;
    const exact = join(dir, baseName);
    if (existsSync(exact)) return exact;
    const hit = readdirSync(dir).find(
      (f) => f.startsWith(`${stem}-`) || f.startsWith(`${stem}_`) || f === baseName,
    );
    if (hit) return join(dir, hit);
  }
  return null;
}

function ensureCopy(src, dest) {
  if (!existsSync(src)) {
    console.warn("[stage] missing source:", src);
    return false;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log("[stage]", dest.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
  return true;
}

let copied = 0;

const assetsDir = join(ROOT, "assets");
for (const [shortName, longName] of headerIcons) {
  if (ensureCopy(join(ICON_SRC, shortName), join(assetsDir, longName))) copied++;
}

for (const [srcName, destName] of unitFrames) {
  const src = resolveUnitFrameSrc(srcName);
  if (src && ensureCopy(src, join(assetsDir, destName))) copied++;
}

const buildingsDir = join(ROOT, "models", "buildings");
const buildingSets = [
  ["barracks.gltf.glb", "barracks"],
  ["archeryrange.gltf.glb", "archery"],
];
for (const [srcName, prefix] of buildingSets) {
  const src = join(KAYKIT, srcName);
  for (const tier of [1, 2, 3]) {
    if (ensureCopy(src, join(buildingsDir, `${prefix}_l${tier}.glb`))) copied++;
  }
}

const portraitsDir = join(ROOT, "media", "heroes", "portraits");
if (existsSync(PORTRAIT_SRC)) {
  const { readdirSync } = await import("node:fs");
  for (const file of readdirSync(PORTRAIT_SRC)) {
    if (!file.endsWith(".png")) continue;
    if (ensureCopy(join(PORTRAIT_SRC, file), join(portraitsDir, file))) copied++;
  }
} else {
  console.warn("[stage] portrait source missing:", PORTRAIT_SRC);
}

const ground = spawnSync("node", ["scripts/generate-ground-textures.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (ground.status !== 0) {
  process.exit(ground.status ?? 1);
}

const baked = spawnSync("node", ["scripts/stage-baked-anims.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (baked.status !== 0) {
  process.exit(baked.status ?? 1);
}

console.log(`[stage] copied ${copied} files`);