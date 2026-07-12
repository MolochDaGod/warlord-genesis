#!/usr/bin/env node
/**
 * Pre/post deploy gate — static files, bundle checks, routes, and optional live smoke.
 * Usage: node scripts/verify-deploy.mjs [--live] [--url=https://...]
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "deploy-manifest.json");
const LIVE = process.argv.includes("--live");
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const SITE = urlArg?.slice(6) || JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).site;

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const GW_CORE =
  manifest.buildMode === "gw-core" || /gw-core-\d+\.js/.test(manifest.bundleFile ?? "");
const VITE = manifest.buildMode === "vite";
let failures = 0;
let warnings = 0;

function fail(msg) {
  console.error(`[verify] FAIL: ${msg}`);
  failures++;
}
function warn(msg) {
  console.warn(`[verify] WARN: ${msg}`);
  warnings++;
}
function ok(msg) {
  console.log(`[verify] OK: ${msg}`);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

function sha256Full(pathOrBuf) {
  const buf = typeof pathOrBuf === "string" ? readFileSync(pathOrBuf) : pathOrBuf;
  return createHash("sha256").update(buf).digest("hex");
}

/** Fail deploy if bundle is not valid JavaScript (catches corrupt minified output). */
function assertBundleSyntax(relPath, label = relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) {
    fail(`${label} missing for syntax check`);
    return;
  }
  try {
    execSync(`node --check ${JSON.stringify(abs)}`, { stdio: "pipe" });
    ok(`${label} parses (node --check)`);
  } catch (err) {
    const msg = String(err.stderr ?? err.stdout ?? err.message).split("\n")[0];
    fail(`${label} syntax invalid: ${msg}`);
  }
}

function assertJsSyntaxFromText(js, label) {
  const tmp = join(tmpdir(), `wg-bundle-syntax-${Date.now()}.js`);
  try {
    writeFileSync(tmp, js);
    execSync(`node --check ${JSON.stringify(tmp)}`, { stdio: "pipe" });
    ok(`${label} parses (node --check)`);
  } catch (err) {
    const msg = String(err.stderr ?? err.stdout ?? err.message).split("\n")[0];
    fail(`${label} syntax invalid: ${msg}`);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function isStandardGlb(buf) {
  return buf.length >= 20 && buf.toString("utf8", 0, 4) === "glTF" && buf.slice(16, 20).toString("utf8") === "JSON";
}

/** Parse production bundle pin from index.html (gw-core | vite | legacy fix3). */
function parseBundlePin(html) {
  const gw = html.match(/gw-core-(\d+)\.js\?h=([a-z0-9]+)/i);
  if (gw) {
    return {
      mode: "gw-core",
      version: Number(gw[1]),
      hash: gw[2],
      file: `assets/gw-core-${gw[1]}.js`,
      query: `h=${gw[2]}`,
    };
  }
  const vite = html.match(/\/assets\/(index-[^"?]+\.js)\?v=(\d+)/);
  if (vite) {
    return {
      mode: "vite",
      version: Number(vite[2]),
      file: `assets/${vite[1]}`,
      query: `v=${vite[2]}`,
    };
  }
  const legacy = html.match(/index-warlord-fix3\.js\?v=(\d+)/);
  if (legacy) {
    return {
      mode: "legacy",
      version: Number(legacy[1]),
      file: "assets/index-warlord-fix3.js",
      query: `v=${legacy[1]}`,
    };
  }
  return null;
}

// ── Static files on disk ───────────────────────────────────────────────────
console.log("\n── Static deploy inventory ──");
for (const rel of manifest.requiredStatic) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    fail(`missing static file: ${rel}`);
    continue;
  }
  const stat = readFileSync(abs);
  if (rel.endsWith(".glb") && !isStandardGlb(stat)) {
    fail(`tower GLB not Khronos-standard: ${rel}`);
  } else {
    ok(`${rel} (${stat.length} bytes, sha ${sha256(abs)})`);
  }
}

// ── index.html bundle pin ────────────────────────────────────────────────────
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const pin = parseBundlePin(html);
if (!pin) {
  fail("index.html missing recognized bundle pin (gw-core, vite, or fix3)");
} else if (GW_CORE && manifest.bundleCacheHash && pin.hash !== manifest.bundleCacheHash) {
  // gw-core filename date (20260713) is not the same as manifest.bundleVersion (ship counter)
  fail(`index.html ?h=${pin.hash} ≠ manifest h=${manifest.bundleCacheHash}`);
} else if (!GW_CORE && pin.version !== manifest.bundleVersion) {
  fail(`index.html bundle ${pin.query} ≠ manifest v=${manifest.bundleVersion}`);
} else {
  ok(`index.html pins ${pin.file} ?${pin.query}`);
}

if (!html.includes("Warlord Genesis")) {
  fail("index.html missing Warlord Genesis title");
} else {
  ok("index.html is Warlord Genesis shell");
}

if (GW_CORE) {
  if (!html.includes("grudge-game-bootstrap")) {
    fail("index.html missing grudge-game-bootstrap.js");
  } else {
    ok("index.html loads fleet bootstrap");
  }
  if (!html.includes("#root")) {
    fail("index.html missing #root before gw-core script");
  } else {
    ok("index.html #root before bundle (classic script order)");
  }
}

// ── Bundle checks ───────────────────────────────────────────────────────────
const bundlePath = join(ROOT, manifest.bundleFile);
if (!existsSync(bundlePath)) {
  fail(`bundle missing: ${manifest.bundleFile}`);
} else {
  const bundle = readFileSync(bundlePath, "utf8");
  ok(`${manifest.bundleFile} (${bundle.length} bytes, sha ${sha256(bundlePath)})`);
  assertBundleSyntax(manifest.bundleFile);

  if (manifest.bundleSha256) {
    const full = sha256Full(bundlePath);
    const manifestSha = manifest.bundleSha256.slice(0, 16);
    const localSha = full.slice(0, 16);
    if (localSha !== manifestSha) {
      fail(
        `bundle sha256 ${localSha} ≠ manifest ${manifestSha} (${bundle.length} vs ${manifest.bundleBytes ?? "?"} bytes)`,
      );
    } else {
      ok(`bundle sha256 matches manifest`);
    }
  }

  const checks = GW_CORE || VITE
    ? (manifest.bundleChecks ?? [])
    : (manifest.bundlePatches ?? []);

  for (const check of checks) {
    if (!bundle.includes(check.needle)) {
      fail(`bundle check missing [${check.id}]: ${check.needle.slice(0, 60)}`);
    } else {
      ok(`check [${check.id}]`);
    }
  }

  if (GW_CORE || VITE) {
    for (const route of ["/lobby", "/deploy", "/play", "/warcamp", "/battle", "/mp"]) {
      const pathNeedle = `path:"${route}"`;
      if (!bundle.includes(pathNeedle) && !bundle.includes(route)) {
        fail(`bundle missing route: ${route}`);
      } else {
        ok(`route ${route}`);
      }
    }
  } else {
    for (const route of manifest.routes) {
      if (route.redirect) continue;
      const pathNeedle = `path:"${route.path}"`;
      if (!bundle.includes(pathNeedle) && route.path !== "*") {
        fail(`route not in bundle: ${route.path} (${route.screen})`);
      } else if (route.path !== "*") {
        ok(`route ${route.path} → ${route.component}`);
      }
    }

    for (const route of manifest.routes.filter((r) => r.redirect)) {
      const from = route.path === "*" ? 'path:"*"' : `path:"${route.path}"`;
      if (!bundle.includes(from)) {
        fail(`redirect route missing: ${route.path} → ${route.redirect}`);
      } else {
        ok(`redirect ${route.path} → ${route.redirect}`);
      }
    }
  }
}

// ── vercel.json ──────────────────────────────────────────────────────────────
const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
const rewriteSources = vercel.rewrites?.map((r) => r.source) ?? [];
for (const required of manifest.vercelRewritesRequired) {
  if (!rewriteSources.includes(required)) {
    fail(`vercel rewrite missing: ${required}`);
  } else {
    ok(`rewrite ${required}`);
  }
}
const spaFallback = vercel.rewrites?.find(
  (r) => r.destination === "/index.html" && r.source?.includes("((?!"),
);
if (!spaFallback?.source?.includes("models/")) {
  fail("SPA fallback must exclude /models/ from catch-all");
} else {
  ok("SPA fallback excludes static asset dirs");
}

const authCatchAll = vercel.rewrites?.find((r) => r.source === "/api/auth/:path*");
if (!authCatchAll?.destination?.includes("id.grudge-studio.com/api/auth")) {
  fail(`auth catch-all must proxy to id.grudge-studio.com/api/auth (got ${authCatchAll?.destination})`);
} else {
  ok("auth catch-all → id.grudge-studio.com/api/auth");
}
const deprecatedApi = vercel.rewrites?.find(
  (r) =>
    r.source === "/api/:path*" &&
    (r.destination?.includes("api.grudge-studio.com") ||
      r.destination === "https://grudge-studio.com/api/:path*"),
);
if (deprecatedApi) {
  fail(
    "remove deprecated grudge-studio.com / api.grudge-studio.com catch-all from vercel.json (leaks retro ROM catalog as /api/games)",
  );
} else {
  ok("no deprecated grudge-studio.com catch-all");
}
const gamesRewrite = vercel.rewrites?.find((r) => r.source === "/api/games" || r.source === "/api/games/:path*");
if (!gamesRewrite?.destination?.includes("warlord-genesis-api")) {
  fail("/api/games must proxy to warlord-genesis-api (not fleet retro host)");
} else {
  ok("/api/games → warlord-genesis-api");
}

if (!GW_CORE && !VITE && existsSync(bundlePath)) {
  const bundleAuth = readFileSync(bundlePath, "utf8");
  if (!bundleAuth.includes("login?redirect_uri")) {
    fail("bundle must use canonical Grudge ID login (/login?redirect_uri=)");
  } else if (bundleAuth.includes("/auth/sso-check")) {
    fail("bundle still references broken /auth/sso-check");
  } else {
    ok("canonical Grudge ID login URL in bundle");
  }
  if (!bundleAuth.includes("WgEnsureSession")) {
    fail("bundle missing WgEnsureSession (deploy auth boot)");
  } else {
    ok("deploy session boot [WgEnsureSession]");
  }
}

const CI_BUILD = "node scripts/ci-build.mjs";
if (vercel.buildCommand !== CI_BUILD) {
  fail(`Vercel buildCommand must be exactly "${CI_BUILD}" (got: ${vercel.buildCommand})`);
} else if ((vercel.buildCommand?.length ?? 0) > 256) {
  fail(`Vercel buildCommand exceeds 256-char limit (${vercel.buildCommand.length} chars)`);
} else {
  ok(`Vercel CI build: ${vercel.buildCommand}`);
}

// ── Live smoke (optional) ────────────────────────────────────────────────────
if (LIVE) {
  console.log(`\n── Live smoke: ${SITE} ──`);
  const home = await fetch(SITE, { redirect: "follow", cache: "no-store" });
  const homeHtml = await home.text();
  const livePin = parseBundlePin(homeHtml);

  if (!livePin) {
    fail("live HTML missing recognized bundle pin");
  } else if (livePin.version !== manifest.bundleVersion) {
    fail(`live bundle ${livePin.query} ≠ manifest v=${manifest.bundleVersion}`);
  } else if (GW_CORE && manifest.bundleCacheHash && livePin.hash !== manifest.bundleCacheHash) {
    warn(`live ?h=${livePin.hash} ≠ manifest h=${manifest.bundleCacheHash} (CDN may lag index.html)`);
    ok(`live serves gw-core v${livePin.version} (hash drift tolerated)`);
  } else {
    ok(`live serves bundle ${livePin.file} ?${livePin.query}`);
  }

  const liveBundleFile = livePin?.file ?? manifest.bundleFile;
  const liveQuery = livePin?.query ?? (GW_CORE ? `h=${manifest.bundleCacheHash}` : `v=${manifest.bundleVersion}`);
  const bundleUrl = `${SITE}/${liveBundleFile}?${liveQuery}`;
  const liveBundle = await fetch(bundleUrl, { cache: "no-store" }).then((r) => r.text());
  ok(`live bundle ${liveBundle.length} bytes from ${bundleUrl}`);
  assertJsSyntaxFromText(liveBundle, "live bundle");

  if (manifest.bundleSha256) {
    const liveSha = sha256Full(Buffer.from(liveBundle, "utf8")).slice(0, 16);
    const manifestSha = manifest.bundleSha256.slice(0, 16);
    if (liveSha !== manifestSha) {
      fail(
        `live bundle sha256 ${liveSha} ≠ manifest ${manifestSha} (stale/corrupt CDN artifact)`,
      );
    } else {
      ok("live bundle sha256 matches manifest");
    }
  } else if (existsSync(bundlePath)) {
    const localLen = readFileSync(bundlePath).length;
    const drift = Math.abs(liveBundle.length - localLen);
    if (drift > 512) {
      fail(`live bundle size ${liveBundle.length} ≠ local ${localLen} (>${drift} byte drift)`);
    } else {
      ok(`live bundle size within ${drift}b of local`);
    }
  }

  const liveChecks = GW_CORE || VITE
    ? (manifest.bundleChecks ?? [])
    : [
        "cdn-proxy",
        "lobby-onboarding-hook",
        "lobby-deploy-gate",
        "lobby-ensure-ready",
        "ensure-ready",
        "deploy-route",
        "local-palette",
      ]
        .map((id) => manifest.bundlePatches?.find((p) => p.id === id))
        .filter(Boolean);

  for (const check of liveChecks) {
    if (!check) continue;
    if (!liveBundle.includes(check.needle)) {
      fail(`live bundle missing check [${check.id}]`);
    } else {
      ok(`live check [${check.id}]`);
    }
  }

  const bundleMarker = livePin?.file?.replace(/^assets\//, "") ?? "";
  if (homeHtml.includes("Warlord Genesis") && homeHtml.includes(bundleMarker)) {
    ok(`live HTML is Warlord Genesis (${livePin?.mode ?? "unknown"} shell)`);
  } else if (homeHtml.includes("index-warlord-fix3.js")) {
    fail("live HTML still serves legacy fix3 bundle");
  } else if (homeHtml.includes("Grudge Warlords") && !homeHtml.includes("Warlord Genesis")) {
    fail("live HTML is wrong app (Grudge Warlords / old bundle)");
  } else {
    fail("live HTML missing Warlord Genesis shell");
  }

  if (!GW_CORE && !VITE && liveBundle.includes("shardProgress(")) {
    fail("live bundle still has shardProgress() — React #185 risk");
  } else if (!GW_CORE && !VITE) {
    ok("live bundle has no shardProgress()");
  }

  const towerUrl = `${SITE}/models/towers/medieval/tower_02_1.glb`;
  const towerRes = await fetch(towerUrl, { method: "HEAD" });
  const towerCt = towerRes.headers.get("content-type") || "";
  if (!towerRes.ok || !towerCt.includes("gltf")) {
    fail(`live tower GLB bad: ${towerRes.status} ${towerCt}`);
  } else {
    ok(`live tower GLB ${towerRes.status} ${towerCt}`);
  }

  const heroGlb = "/models/heroes/grudge6/western-kingdoms_warrior.glb";
  const heroRes = await fetch(`${SITE}${heroGlb}`, { method: "HEAD" });
  const heroCt = heroRes.headers.get("content-type") || "";
  if (!heroRes.ok || heroCt.includes("text/html") || !heroCt.includes("gltf")) {
    fail(`live hero GLB bad ${heroGlb}: ${heroRes.status} ${heroCt}`);
  } else {
    ok(`live hero GLB ${heroGlb} ${heroRes.status}`);
  }

  for (const unitPath of [
    "/models/kaykit/heroes/barbarian.glb",
    "/models/kaykit/enemies/skeleton_warrior.glb",
    "/models/units/footman.glb",
    "/models/units/Color_Palette.png",
    "/textures/concrete_diff.jpg",
    "/textures/metal_diff.jpg",
    "/textures/metal_nor.jpg",
    "/anims/baked/rifle/firing%202.json",
    "/anims/baked/rifle/reloading.json",
    "/anims/baked/rifle/punch.json",
  ]) {
    const res = await fetch(`${SITE}${unitPath}`, { method: "HEAD" });
    const ct = res.headers.get("content-type") || "";
    const badHtml = ct.includes("text/html");
    const badGlb = unitPath.endsWith(".glb") && !ct.includes("gltf");
    const badPng = unitPath.endsWith(".png") && !ct.includes("image");
    const badJpg = unitPath.endsWith(".jpg") && !ct.includes("image");
    const badJson = unitPath.endsWith(".json") && !ct.includes("json");
    if (!res.ok || badHtml || badGlb || badPng || badJpg || badJson) {
      fail(`live unit asset bad ${unitPath}: ${res.status} ${ct}`);
    } else {
      ok(`live unit ${unitPath} ${res.status}`);
    }
  }

  const guestRes = await fetch(`${SITE}/api/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Grudge-Client": "web" },
    body: JSON.stringify({ deviceId: `verify-${Date.now()}` }),
  });
  if (!guestRes.ok) {
    fail(`live /api/auth/guest returned ${guestRes.status}`);
  } else {
    ok(`live /api/auth/guest ${guestRes.status}`);
  }

  for (const route of ["/", "/lobby", "/deploy", "/warcamp", "/play", "/battle", "/mp"]) {
    const res = await fetch(`${SITE}${route}`, { redirect: "manual", cache: "no-store" });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) {
      fail(`${route} did not return HTML shell (${res.status} ${ct})`);
    } else {
      ok(`${route} → HTML shell (${res.status})`);
    }
  }
}

console.log(`\n[verify] ${failures} failure(s), ${warnings} warning(s)`);
if (failures > 0) process.exit(1);
console.log("[verify] deploy manifest satisfied");