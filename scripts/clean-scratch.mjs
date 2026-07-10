#!/usr/bin/env node
/**
 * Remove agent probe dumps and local diagnostic outputs.
 * Safe to re-run. Does not touch production assets or patch sources.
 */
import { existsSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

const ROOT_DUMPS = [
  "deploy-err.txt",
  "deploy-output.txt",
  "verify-output.txt",
  "patch-out.txt",
  "patch-run-output.txt",
  "SYMBOL_MAP.json",
];

let n = 0;

function nuke(path) {
  if (!existsSync(path)) return;
  try {
    rmSync(path, { recursive: true, force: true });
    n++;
    console.log("  -", path.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
  } catch (e) {
    console.warn("  !", path, e.message);
  }
}

console.log("[clean] scratch / probes");
for (const f of ROOT_DUMPS) nuke(join(ROOT, f));

for (const name of readdirSync(SCRIPTS)) {
  if (
    name.startsWith("_") ||
    name === "wg-debug-code.txt" ||
    /-dump\.txt$/.test(name) ||
    name.endsWith(".tmp.png")
  ) {
    nuke(join(SCRIPTS, name));
  }
}

// temp texture conversion leftovers
const tex = join(ROOT, "textures");
if (existsSync(tex)) {
  for (const name of readdirSync(tex)) {
    if (name.endsWith(".tmp.png")) nuke(join(tex, name));
  }
}

console.log(`[clean] removed ${n} paths`);
