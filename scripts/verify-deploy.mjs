#!/usr/bin/env node
/**
 * Pre/post deploy gate — static files, bundle patches, routes, and optional live smoke.
 * Usage: node scripts/verify-deploy.mjs [--live] [--url=https://...]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "deploy-manifest.json");
const LIVE = process.argv.includes("--live");
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const SITE = urlArg?.slice(6) || JSON.parse(readFileSync(MANIFEST_PATH, "utf8")).site;

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
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

function isStandardGlb(buf) {
  return buf.length >= 20 && buf.toString("utf8", 0, 4) === "glTF" && buf.slice(16, 20).toString("utf8") === "JSON";
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
const vMatch = html.match(/index-warlord-fix3\.js\?v=(\d+)/);
const htmlVersion = vMatch ? Number(vMatch[1]) : null;
if (htmlVersion !== manifest.bundleVersion) {
  fail(`index.html bundle v=${htmlVersion} ≠ manifest v=${manifest.bundleVersion}`);
} else {
  ok(`index.html pins bundle v${manifest.bundleVersion}`);
}

// ── Bundle patches ───────────────────────────────────────────────────────────
const bundlePath = join(ROOT, manifest.bundleFile);
if (!existsSync(bundlePath)) {
  fail(`bundle missing: ${manifest.bundleFile}`);
} else {
  const bundle = readFileSync(bundlePath, "utf8");
  ok(`${manifest.bundleFile} (${bundle.length} bytes, sha ${sha256(bundlePath)})`);

  for (const patch of manifest.bundlePatches) {
    if (!bundle.includes(patch.needle)) {
      fail(`bundle patch missing [${patch.id}]: ${patch.needle.slice(0, 60)}`);
    } else {
      ok(`patch [${patch.id}]`);
    }
  }

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
const spaFallback = vercel.rewrites?.find((r) => r.destination === "/index.html");
if (!spaFallback?.source?.includes("models/")) {
  fail("SPA fallback must exclude /models/ from catch-all");
} else {
  ok("SPA fallback excludes static asset dirs");
}
const ciBuild = vercel.buildCommand?.includes("patch-bundle") && vercel.buildCommand?.includes("verify-deploy");
if (!ciBuild) {
  fail(`Vercel buildCommand must patch bundle + verify: ${vercel.buildCommand}`);
} else {
  ok(`Vercel CI build: ${vercel.buildCommand}`);
}

// ── Live smoke (optional) ────────────────────────────────────────────────────
if (LIVE) {
  console.log(`\n── Live smoke: ${SITE} ──`);
  const home = await fetch(SITE, { redirect: "follow" });
  const homeHtml = await home.text();
  const liveV = homeHtml.match(/index-warlord-fix3\.js\?v=(\d+)/)?.[1];
  if (Number(liveV) !== manifest.bundleVersion) {
    fail(`live bundle v=${liveV} ≠ manifest v=${manifest.bundleVersion}`);
  } else {
    ok(`live serves bundle v${liveV}`);
  }

  const bundleUrl = `${SITE}/${manifest.bundleFile}?v=${manifest.bundleVersion}`;
  const liveBundle = await fetch(bundleUrl).then((r) => r.text());
  for (const patch of manifest.bundlePatches.slice(0, 6)) {
    if (!liveBundle.includes(patch.needle)) {
      fail(`live bundle missing patch [${patch.id}]`);
    }
  }
  ok("live bundle contains core patches");

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

  for (const route of ["/", "/lobby", "/warcamp", "/play", "/battle", "/mp"]) {
    const res = await fetch(`${SITE}${route}`, { redirect: "manual" });
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