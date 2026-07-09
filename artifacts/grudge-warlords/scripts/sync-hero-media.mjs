/**
 * Downloads hero portraits from grudge-heros.puter.site and writes media manifest.
 * Run: node scripts/sync-hero-media.mjs
 * Optional videos: place WebM files at public/media/heroes/videos/{codexId}.webm
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CODEX_PATH = path.join(ROOT, "src/data/heroCodexSite.json");
const PORTRAIT_DIR = path.join(ROOT, "public/media/heroes/portraits");
const VIDEO_DIR = path.join(ROOT, "public/media/heroes/videos");
const MANIFEST_PATH = path.join(ROOT, "public/media/heroes/manifest.json");
const CODEX_ORIGIN = "https://grudge-heros.puter.site";

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          fetchBuffer(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

const bundle = JSON.parse(fs.readFileSync(CODEX_PATH, "utf8"));
fs.mkdirSync(PORTRAIT_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const entries = [];
for (const hero of bundle.heroes) {
  const primary = `${CODEX_ORIGIN}/hero-portraits/${hero.id}.png`;
  const fallback = `${CODEX_ORIGIN}/${hero.portrait}`;
  const localPortrait = `media/heroes/portraits/${hero.id}.png`;
  const localVideo = `media/heroes/videos/${hero.id}.webm`;
  const portraitPath = path.join(PORTRAIT_DIR, `${hero.id}.png`);

  let ok = false;
  for (const url of [primary, fallback]) {
    try {
      const buf = await fetchBuffer(url);
      if (buf.length > 500) {
        fs.writeFileSync(portraitPath, buf);
        ok = true;
        break;
      }
    } catch {
      // try next
    }
  }

  const videoFile = path.join(VIDEO_DIR, `${hero.id}.webm`);
  let videoOk = fs.existsSync(videoFile);
  if (!videoOk) {
    const remoteVideoUrls = [
      `${CODEX_ORIGIN}/hero-videos/${hero.id}.webm`,
      `${CODEX_ORIGIN}/videos/${hero.id}.webm`,
      `${CODEX_ORIGIN}/media/heroes/videos/${hero.id}.webm`,
    ];
    for (const url of remoteVideoUrls) {
      try {
        const buf = await fetchBuffer(url);
        if (buf.length > 2000) {
          fs.writeFileSync(videoFile, buf);
          videoOk = true;
          break;
        }
      } catch {
        // try next
      }
    }
  }

  entries.push({
    codexId: hero.id,
    name: hero.name,
    prefabMatch: hero.id,
    portrait: ok ? `/${localPortrait}` : fallback,
    portraitLocal: ok,
    video: videoOk ? `/${localVideo}` : null,
    codexUrl: `${CODEX_ORIGIN}/`,
  });
  process.stdout.write(`${ok ? "✓" : "·"} ${hero.id}${videoOk ? " 🎬" : ""}\n`);
}

const manifest = {
  source: CODEX_ORIGIN,
  syncedAt: new Date().toISOString(),
  note: "Add WebM showcase clips to public/media/heroes/videos/{codexId}.webm then re-run.",
  heroes: entries,
};
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log(`Manifest → ${MANIFEST_PATH}`);