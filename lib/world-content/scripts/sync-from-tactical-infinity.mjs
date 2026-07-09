/**
 * Sync Aethermoor world data from the Tactical-Infinity GitHub repo.
 *
 * Source: https://github.com/MolochDaGod/Tactical-Infinity.git
 * File:   client/src/lib/worldMapData.ts
 *
 * Usage:
 *   node scripts/sync-from-tactical-infinity.mjs
 *   TACTICAL_INFINITY_ROOT=C:\path\to\clone node scripts/sync-from-tactical-infinity.mjs
 *   TACTICAL_INFINITY_PULL=1 node scripts/sync-from-tactical-infinity.mjs
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORLD_CONTENT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TI_ROOT = path.resolve(WORLD_CONTENT_ROOT, "..", "..", "..", "Tactical-Infinity");
const TI_GITHUB = "https://github.com/MolochDaGod/Tactical-Infinity.git";
const SOURCE_REL = "client/src/lib/worldMapData.ts";
const OUT_FILE = path.join(WORLD_CONTENT_ROOT, "src", "aethermoor.ts");

const tiRoot = process.env.TACTICAL_INFINITY_ROOT ?? DEFAULT_TI_ROOT;
const sourceFile = path.join(tiRoot, SOURCE_REL);

const shouldPull = process.argv.includes("--pull") || process.env.TACTICAL_INFINITY_PULL === "1";

function ensureClone() {
  if (fs.existsSync(path.join(tiRoot, ".git"))) {
    if (shouldPull) {
      console.log(`Pulling ${tiRoot} …`);
      execSync("git pull --ff-only", { cwd: tiRoot, stdio: "inherit" });
    }
    return;
  }

  const parent = path.dirname(tiRoot);
  fs.mkdirSync(parent, { recursive: true });
  console.log(`Cloning ${TI_GITHUB} → ${tiRoot} …`);
  execSync(`git clone --depth 1 ${TI_GITHUB} "${tiRoot}"`, { stdio: "inherit" });
}

function transformWorldData(raw) {
  let out = raw.replace(/^import \* as THREE from ['"]three['"];\s*\n?/m, "");

  const header = `// Aethermoor World Map Data — synced from Tactical-Infinity
// Source: ${TI_GITHUB}
// File:   ${SOURCE_REL}
// Run:    pnpm --filter @workspace/world-content sync:ti

export interface Vec2 {
  x: number;
  z: number;
}

`;

  out = header + out.trimStart();

  out = out.replace(
    /export function getNearestIsland\(position: THREE\.Vector3\): WorldIslandData \| null \{[\s\S]*?return nearest;\s*\}/m,
    `export function getNearestIsland(position: Vec2): WorldIslandData | null {
  let nearest: WorldIslandData | null = null;
  let minDist = Infinity;

  for (const island of WORLD_ISLANDS) {
    const dx = position.x - island.position.x;
    const dz = position.z - island.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < minDist) {
      minDist = dist;
      nearest = island;
    }
  }

  return nearest;
}`,
  );

  out = out.replace(
    /export function getEnemyShipsInArea\(center: THREE\.Vector3, radius: number\): EnemyShipData\[\] \{[\s\S]*?\}\);?\s*\}/m,
    `export function getEnemyShipsInArea(center: Vec2, radius: number): EnemyShipData[] {
  return WORLD_ENEMY_SHIPS.filter((ship) => {
    const dx = center.x - ship.patrolCenter.x;
    const dz = center.z - ship.patrolCenter.z;
    return Math.hypot(dx, dz) < radius + ship.patrolRadius;
  });
}`,
  );

  if (!out.includes("export function getCapitalIsland")) {
    out = out.replace(
      /export function getPlayerFactionStanding/,
      `export function getCapitalIsland(faction: Faction): WorldIslandData | undefined {
  return WORLD_ISLANDS.find((i) => i.faction === faction && i.size === "capital");
}

export function islandAtPosition(position: Vec2): WorldIslandData | null {
  for (const island of WORLD_ISLANDS) {
    const dx = position.x - island.position.x;
    const dz = position.z - island.position.z;
    if (Math.hypot(dx, dz) <= island.radius + 40) return island;
  }
  return null;
}

export function getPlayerFactionStanding`,
    );
  }

  return out;
}

function main() {
  ensureClone();

  if (!fs.existsSync(sourceFile)) {
    console.error(`Missing source file: ${sourceFile}`);
    console.error(`Clone Tactical-Infinity from ${TI_GITHUB}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(sourceFile, "utf8");
  const transformed = transformWorldData(raw);
  fs.writeFileSync(OUT_FILE, transformed, "utf8");
  console.log(`Wrote ${OUT_FILE}`);

  console.log("Rebuilding @workspace/world-content declarations …");
  execSync("npx tsc -p tsconfig.json --force", {
    cwd: WORLD_CONTENT_ROOT,
    stdio: "inherit",
  });
}

main();