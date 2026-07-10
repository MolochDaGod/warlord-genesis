#!/usr/bin/env node
/**
 * Seed src/grudge-warlords from Grand-Battle-Arena artifacts (reference Three.js + R3F patterns).
 * Does not replace the production bundle — prepares typed modules for a future Vite build.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(
  "C:",
  "Users",
  "nugye",
  "Documents",
  "Grand-Battle-Arena",
  "Grand-Battle-Arena",
  "artifacts",
  "grudge-warlords",
);
const OUT = join(ROOT, "src", "grudge-warlords");
const REF = join(OUT, "_baseline-ref");

const COPY_FILES = [
  "src/game/GameScene.tsx",
  "src/game/Character.tsx",
  "src/game/CombatSystem.ts",
  "src/game/types.ts",
  "src/game/stats.ts",
  "src/game/characterData.ts",
  "src/ui/HUD.tsx",
  "vite.config.ts",
  "tsconfig.json",
  "package.json",
];

if (!existsSync(BASELINE)) {
  console.error("[import-baseline] missing:", BASELINE);
  process.exit(1);
}

mkdirSync(REF, { recursive: true });

let copied = 0;
for (const rel of COPY_FILES) {
  const src = join(BASELINE, rel);
  if (!existsSync(src)) {
    console.warn("[import-baseline] skip (missing):", rel);
    continue;
  }
  const dest = join(REF, rel.replace(/\//g, "_"));
  cpSync(src, dest);
  copied++;
}

const manifest = JSON.parse(readFileSync(join(ROOT, "SYMBOL_MAP.json"), "utf8"));
manifest.baselineImportedAt = new Date().toISOString();
manifest.baselineSource = BASELINE;
manifest.baselineRefDir = "src/grudge-warlords/_baseline-ref";
writeFileSync(join(ROOT, "SYMBOL_MAP.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`[import-baseline] copied ${copied} reference files → ${REF}`);
console.log("[import-baseline] typed modules live in src/grudge-warlords/ (edit there for Vite migration)");