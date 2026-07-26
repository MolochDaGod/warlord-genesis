#!/usr/bin/env node
/**
 * Bulk upload warlord-genesis local asset trees → R2 grudge-assets
 * for machine handoff via assets.grudge-studio.com
 *
 *   node scripts/upload-handoff-to-r2.mjs
 *   node scripts/upload-handoff-to-r2.mjs --dry-run
 *   node scripts/upload-handoff-to-r2.mjs --concurrency=3
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BUCKET = "grudge-assets";
const CDN = "https://assets.grudge-studio.com";
const DRY = process.argv.includes("--dry-run");
// Default concurrency 1 — wrangler concurrent R2 puts crash libuv on Windows
const concurrency = Math.max(
  1,
  Number((process.argv.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1]) || 1,
);

/** Local folder → R2 key prefix (posix) */
const TREES = [
  { local: "models/warlords-era", prefix: "models/warlords-era" },
  { local: "models/maps", prefix: "models/maps" },
  { local: "models/voxel-only", prefix: "models/voxel-only" },
  { local: "models/tools", prefix: "models/tools" },
  { local: "models/units/lowpo", prefix: "models/units/lowpo" },
  { local: "models/warlords/haven_shore", prefix: "models/warlords/haven_shore" },
  // staging dump from prior work — keep under handoff prefix
  { local: "_tmp_untracked/public", prefix: "handoff/warlord-genesis/public" },
  { local: "_tmp_untracked/sdk", prefix: "handoff/warlord-genesis/sdk" },
];

const EXT_CT = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".fbx": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".bin": "application/octet-stream",
  ".ktx2": "image/ktx2",
  ".hdr": "application/octet-stream",
  ".exr": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".zip": "application/zip",
};

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else {
      const ext = path.extname(ent.name).toLowerCase();
      if (EXT_CT[ext] || /\.(glb|gltf|fbx|png|jpe?g|webp|json|bin)$/i.test(ent.name)) {
        out.push(full);
      }
    }
  }
  return out;
}

function contentType(file) {
  return EXT_CT[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function sleepMs(ms) {
  spawnSync(process.execPath, ["-e", `setTimeout(()=>{},${ms})`], { stdio: "ignore" });
}

function put(key, filePath, attempts = 4) {
  if (DRY) {
    console.log(`[dry] ${key}`);
    return true;
  }
  const args = [
    "r2",
    "object",
    "put",
    `${BUCKET}/${key}`,
    `--file=${filePath}`,
    `--content-type=${contentType(filePath)}`,
    "--remote",
  ];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const r = spawnSync("wrangler", args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      encoding: "utf8",
      // Isolate each wrangler process — concurrent puts crash libuv on Windows
      env: { ...process.env, WRANGLER_LOG: "error" },
    });
    if (r.status === 0) {
      console.log(`OK  ${key} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB)`);
      return true;
    }
    const err = (r.stderr || r.stdout || String(r.status)).slice(0, 200);
    console.warn(`retry ${attempt}/${attempts} ${key}: ${err.replace(/\s+/g, " ")}`);
    sleepMs(800 * attempt);
  }
  console.error(`FAIL ${key}`);
  return false;
}

async function runPool(items, limit, worker) {
  let i = 0;
  let ok = 0;
  let fail = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      const item = items[idx];
      const success = await worker(item, idx);
      if (success) ok++;
      else fail++;
    }
  });
  await Promise.all(runners);
  return { ok, fail };
}

const jobs = [];
for (const tree of TREES) {
  const abs = path.join(ROOT, tree.local);
  if (!fs.existsSync(abs)) {
    console.warn(`skip missing: ${tree.local}`);
    continue;
  }
  const files = walk(abs);
  console.log(`${tree.local}: ${files.length} files → ${tree.prefix}/`);
  for (const full of files) {
    const rel = path.relative(abs, full).replace(/\\/g, "/");
    const key = `${tree.prefix}/${rel}`.replace(/\/+/g, "/");
    jobs.push({ key, full });
  }
}

console.log(`\nTotal jobs: ${jobs.length} concurrency=${concurrency} dry=${DRY}\n`);

const started = Date.now();
const { ok, fail } = await runPool(jobs, concurrency, async (job) => put(job.key, job.full));

const manifest = {
  uploadedAt: new Date().toISOString(),
  bucket: BUCKET,
  cdn: CDN,
  concurrency,
  ok,
  fail,
  total: jobs.length,
  durationSec: Math.round((Date.now() - started) / 1000),
  keys: jobs.map((j) => j.key),
  trees: TREES,
  note: "Machine handoff for warlord-genesis local asset trees. Pull via assets.grudge-studio.com/{key}",
};

const outDir = path.join(ROOT, "docs");
fs.mkdirSync(outDir, { recursive: true });
const manPath = path.join(outDir, "R2_HANDOFF_MANIFEST.json");
const mdPath = path.join(outDir, "R2_HANDOFF.md");
fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2));

const md = `# R2 handoff — warlord-genesis assets

Uploaded **${ok}/${jobs.length}** objects to \`${BUCKET}\` (CDN: ${CDN}).

## Pull on other machine

\`\`\`bash
# Example single file
curl -LO ${CDN}/models/warlords/haven_shore/fruzer_islands.glb

# Or use wrangler (logged into same Cloudflare account Grudge)
wrangler r2 object get grudge-assets/models/warlords-era/SOME.glb --file=./SOME.glb --remote
\`\`\`

## Key prefixes

${TREES.map((t) => `- \`${t.prefix}/\` ← local \`${t.local}/\``).join("\n")}

## Manifest

See \`docs/R2_HANDOFF_MANIFEST.json\` for full key list (${jobs.length} keys).

## Grudge Studio usage

Load binaries as:

\`https://assets.grudge-studio.com/{r2Key}\`

Never commit multi-GB trees to git; CDN is SSOT after this handoff.
`;
fs.writeFileSync(mdPath, md);

console.log(`\nDone ok=${ok} fail=${fail} in ${manifest.durationSec}s`);
console.log(`Manifest: ${manPath}`);
console.log(`Doc: ${mdPath}`);
if (fail) process.exit(1);
