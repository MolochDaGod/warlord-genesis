#!/usr/bin/env node
/**
 * generate-vercel-config.mjs rewrites vercel.json on every CI/CLI ship.
 * Re-inject LFS media redirects so Vercel never serves 133 B git-lfs pointers
 * as model/gltf-binary (GLTFLoader: Unexpected token 'v', "version ht").
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "vercel.json");
const MEDIA =
  "https://media.githubusercontent.com/media/MolochDaGod/warlord-genesis/main";

const LFS_REDIRECTS = [
  {
    source: "/models/maps/:file",
    destination: `${MEDIA}/models/maps/:file`,
    permanent: false,
  },
  {
    source: "/models/units/jungle/:file",
    destination: `${MEDIA}/models/units/jungle/:file`,
    permanent: false,
  },
  {
    source: "/models/units/defaultcreeps/:file",
    destination: `${MEDIA}/models/units/defaultcreeps/:file`,
    permanent: false,
  },
];

const cfg = JSON.parse(readFileSync(FILE, "utf8"));
const existing = Array.isArray(cfg.redirects) ? cfg.redirects : [];
const skip = new Set(LFS_REDIRECTS.map((r) => r.source));
cfg.redirects = [...LFS_REDIRECTS, ...existing.filter((r) => !skip.has(r.source))];
writeFileSync(FILE, JSON.stringify(cfg, null, 2) + "\n");
console.log(
  "[vercel-lfs] prepended", LFS_REDIRECTS.length, "media redirects — total",
  cfg.redirects.length,
);
