#!/usr/bin/env node
/**
 * Upload GRUDGE6 faction hero GLBs to R2 (grudge-assets bucket).
 * Served at assets.grudge-studio.com/models/heroes/grudge6/{repo}_{class}.glb
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HERO_DIR = path.join(ROOT, "models", "heroes", "grudge6");

function put(r2Key, filePath) {
  const res = spawnSync(
    "wrangler",
    ["r2", "object", "put", `grudge-assets/${r2Key}`, "--file", filePath, "--remote", "--content-type", "model/gltf-binary"],
    { encoding: "utf8", shell: true },
  );
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    throw new Error(`upload failed: ${r2Key}`);
  }
  console.log("[heroes-r2] uploaded", r2Key, `(${fs.statSync(filePath).size} bytes)`);
}

if (!fs.existsSync(HERO_DIR)) {
  console.error("[heroes-r2] missing", HERO_DIR, "— run npm run assets:heroes first");
  process.exit(1);
}

spawnSync("node", ["scripts/fix-glb-header.mjs", "models/heroes"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});

const files = fs.readdirSync(HERO_DIR).filter((f) => f.endsWith(".glb"));
if (!files.length) {
  console.error("[heroes-r2] no GLBs in", HERO_DIR);
  process.exit(1);
}

for (const file of files) {
  put(`models/heroes/grudge6/${file}`, path.join(HERO_DIR, file));
}

console.log(`[heroes-r2] done — ${files.length} heroes on R2`);