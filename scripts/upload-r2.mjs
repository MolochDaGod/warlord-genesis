import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const root = path.join(import.meta.dirname, "..", "models", "towers");
const MODELS = {
  medieval: ["tower_02_1", "tower_03_1_full"],
  elven: ["tower_2", "tower_3_full"],
  orc: ["tower_02", "tower_3_full"],
  ruins: ["ruin_11", "ruin_15"],
};

function put(r2Key, filePath) {
  const res = spawnSync(
    "wrangler",
    ["r2", "object", "put", `grudge-assets/${r2Key}`, "--file", filePath, "--remote"],
    { encoding: "utf8", shell: true },
  );
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    throw new Error(`upload failed: ${r2Key}`);
  }
  console.log("uploaded", r2Key);
}

// Boot probe — makes engine treat CDN as reachable
const paletteSrc = path.join(root, "medieval", "atlas.png");
put("grudge-nexus/textures/Color_Palette.png", paletteSrc);

for (const [theme, names] of Object.entries(MODELS)) {
  const dir = path.join(root, theme);
  const atlas = path.join(dir, "atlas.png");
  if (fs.existsSync(atlas)) {
    put(`models/maps/${theme}/atlas.png`, atlas);
  }
  for (const name of names) {
    put(`models/maps/${theme}/${name}.glb`, path.join(dir, `${name}.glb`));
  }
}

console.log("All tower assets uploaded to R2 (remote)");