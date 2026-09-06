#!/usr/bin/env node
/**
 * ONE Genesis ship path.
 * Source: artifacts/grudge-warlords (Vite).
 * Output: root index.html + /assets/index-*.js|css pins.
 * Vercel does not compile TS (.vercelignore drops /artifacts).
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "artifacts/grudge-warlords/dist/public");
const ASSETS = join(ROOT, "assets");
const skipBuild = process.argv.includes("--skip-build");

function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

function sha16(p) {
  return createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
}

if (!skipBuild) {
  run("pnpm run build", join(ROOT, "artifacts/grudge-warlords"));
}

const distIndex = join(DIST, "index.html");
if (!existsSync(distIndex)) {
  console.error("[ship] missing", distIndex);
  process.exit(1);
}

const distHtml = readFileSync(distIndex, "utf8");
const js = distHtml.match(/\/assets\/(index-[^"'?]+\.js)/)?.[1];
const css = distHtml.match(/\/assets\/(index-[^"'?]+\.css)/)?.[1];
if (!js || !css) {
  console.error("[ship] dist index.html missing hashed index JS/CSS");
  process.exit(1);
}

mkdirSync(ASSETS, { recursive: true });
const distAssets = join(DIST, "assets");
for (const name of readdirSync(distAssets)) {
  copyFileSync(join(distAssets, name), join(ASSETS, name));
}

const version = Number(
  new Date().toISOString().slice(0, 10).replaceAll("-", ""),
);
const pinJs = `/assets/${js}?v=${version}`;
const pinCss = `/assets/${css}?v=${version}`;

let html = readFileSync(join(ROOT, "index.html"), "utf8");
html = html.replace(/\/assets\/index-[^"'?]+\.js(\?v=\d+)?/g, pinJs);
html = html.replace(/\/assets\/index-[^"'?]+\.css(\?v=\d+)?/g, pinCss);
html = html.replace(/<!-- v=\d+ Vite SPA[^>]*-->/, `<!-- v=${version} Vite SPA from artifacts/grudge-warlords -->`);
if (!html.includes("Warlord Genesis")) {
  console.error("[ship] root index.html must stay Warlord Genesis");
  process.exit(1);
}
writeFileSync(join(ROOT, "index.html"), html);

const manifestPath = join(ROOT, "deploy-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.buildMode = "vite";
manifest.bundleVersion = version;
manifest.bundleFile = `assets/${js}`;
manifest.bundleCacheHash = js.replace(/^index-|\.js$/g, "");
manifest.bundleSha256 = sha16(join(ASSETS, js));
manifest.requiredStatic = (manifest.requiredStatic || []).map((p) => {
  if (p.endsWith(".js") && p.startsWith("assets/index-")) return `assets/${js}`;
  if (p.endsWith(".css") && p.startsWith("assets/index-")) return `assets/${css}`;
  return p;
});
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

run("node scripts/generate-vercel-config.mjs");
run("node scripts/verify-deploy.mjs");
console.log(`[ship] pinned ${pinJs} sha ${manifest.bundleSha256}`);
