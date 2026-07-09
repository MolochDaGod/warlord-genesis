/**
 * Builds Ken Burns showcase WebMs from saved portraits (until Bip001 reels land).
 * Requires @ffmpeg-installer/ffmpeg or ffmpeg on PATH.
 * Run: node scripts/generate-hero-videos.mjs
 * Then: node scripts/sync-hero-media.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CODEX_PATH = path.join(ROOT, "src/data/heroCodexSite.json");
const PORTRAIT_DIR = path.join(ROOT, "public/media/heroes/portraits");
const VIDEO_DIR = path.join(ROOT, "public/media/heroes/videos");

async function resolveFfmpeg() {
  try {
    const mod = await import("@ffmpeg-installer/ffmpeg");
    if (mod?.path && fs.existsSync(mod.path)) return mod.path;
  } catch {
    // optional dep
  }
  const probe = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (probe.status === 0) return "ffmpeg";
  return null;
}

const ffmpeg = await resolveFfmpeg();
if (!ffmpeg) {
  console.error("ffmpeg not found. Install @ffmpeg-installer/ffmpeg or add ffmpeg to PATH.");
  process.exit(1);
}

fs.mkdirSync(VIDEO_DIR, { recursive: true });
const bundle = JSON.parse(fs.readFileSync(CODEX_PATH, "utf8"));

for (const hero of bundle.heroes) {
  const portrait = path.join(PORTRAIT_DIR, `${hero.id}.png`);
  const out = path.join(VIDEO_DIR, `${hero.id}.webm`);
  if (!fs.existsSync(portrait)) {
    process.stdout.write(`· ${hero.id} (no portrait)\n`);
    continue;
  }
  if (fs.existsSync(out) && fs.statSync(out).size > 2000) {
    process.stdout.write(`= ${hero.id} (exists)\n`);
    continue;
  }

  const vf = [
    "scale=1280:720:force_original_aspect_ratio=increase",
    "crop=1280:720",
    "zoompan=z='min(zoom+0.0004,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1280x720:fps=30",
  ].join(",");

  const args = [
    "-y",
    "-loop", "1",
    "-i", portrait,
    "-vf", vf,
    "-t", "5",
    "-c:v", "libvpx-vp9",
    "-b:v", "600k",
    "-an",
    out,
  ];

  const run = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (run.status === 0 && fs.existsSync(out)) {
    process.stdout.write(`✓ ${hero.id}\n`);
  } else {
    process.stdout.write(`✗ ${hero.id}\n`);
    if (run.stderr) process.stderr.write(run.stderr.slice(-400));
  }
}

console.log("Done. Re-run: node scripts/sync-hero-media.mjs");