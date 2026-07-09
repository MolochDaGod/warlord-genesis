#!/usr/bin/env node
/**
 * Stage canonical arrow projectile GLB (GRDG-3D-5B98764B) from KayKit weapons pack.
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "models", "projectiles");
const OUT = join(OUT_DIR, "GRDG-3D-5B98764B.glb");

const SOURCES = [
  "D:/Games/Dungeon-Crawler-Quest/attached_assets/staging/kaykit-weapons/KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf/arrow_A.gltf",
  "D:/Games/Dungeon-Crawler-Quest/attached_assets/staging/kaykit-weapons/KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf/arrow_B.gltf",
];

mkdirSync(OUT_DIR, { recursive: true });

let src = SOURCES.find((p) => existsSync(p));
if (!src) {
  console.error("[stage-arrow] No KayKit arrow glTF found at expected paths");
  process.exit(1);
}

console.log("[stage-arrow] source:", src);

try {
  execSync(`npx --yes @gltf-transform/cli copy "${src}" "${OUT}"`, {
    stdio: "inherit",
    shell: true,
  });
} catch {
  const dir = dirname(src);
  const bin = join(dir, src.includes("arrow_A") ? "arrow_A.bin" : "arrow_B.bin");
  if (!existsSync(bin)) {
    console.error("[stage-arrow] gltf-transform failed and no .bin fallback");
    process.exit(1);
  }
  copyFileSync(src, join(OUT_DIR, "_arrow.gltf"));
  copyFileSync(bin, join(OUT_DIR, "_arrow.bin"));
  console.warn("[stage-arrow] packed glb failed — copied gltf+bin; patch uses .glb path only");
  process.exit(1);
}

if (!existsSync(OUT)) {
  console.error("[stage-arrow] output missing:", OUT);
  process.exit(1);
}

console.log("[stage-arrow] wrote", OUT);