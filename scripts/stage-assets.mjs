#!/usr/bin/env node
/**
 * Stage static assets expected by the production bundle.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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

console.log(`[stage] copied ${copied} files`);