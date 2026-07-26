#!/usr/bin/env node
/**
 * Fix /play HUD freak-show:
 *  - Champion Path = single vertical light-up slot rail (round progress)
 *  - RTS command mode = 9 craftpix slots on the right
 *  - Combat TPS = proper craftpix action bar (globes + plate + scaled slots)
 *  - Favicon = Grudox (grudoxfavicon.png)
 *
 * Run from repo root: node scripts/fix-play-hud.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE = path.join(ROOT, "assets", "gw-core-20260713.js");
const CSS = path.join(ROOT, "assets", "index-BNWYZMT1.css");
const INDEX = path.join(ROOT, "index.html");
const MANIFEST = path.join(ROOT, "deploy-manifest.json");
const FAV_SRC_CANDIDATES = [
  "C:\\Users\\nugye\\Pictures\\grudoxfavicon.png",
  path.join(ROOT, "favicon.png"),
  path.join(ROOT, "public", "favicon.png"),
];
const MARKER = "/* v75 play-hud — vertical path + 9 RTS + combat scale */";
const CACHE_HASH = "b25";

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Favicon
// ---------------------------------------------------------------------------
const FAV_SRC = FAV_SRC_CANDIDATES.find((p) => fs.existsSync(p));
if (FAV_SRC) {
  for (const rel of [
    "favicon.png",
    "public/favicon.png",
    "assets/favicon.png",
    "artifacts/grudge-warlords/public/favicon.png",
  ]) {
    const dest = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (path.resolve(FAV_SRC) !== path.resolve(dest)) {
      fs.copyFileSync(FAV_SRC, dest);
      console.log("favicon →", rel);
    }
  }
} else {
  console.warn("favicon source missing — keep existing favicon.png if present");
}

if (fs.existsSync(INDEX)) {
  let html = fs.readFileSync(INDEX, "utf8");
  const iconLinks = `    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <link rel="shortcut icon" href="/favicon.png" />`;
  if (html.includes('href="/favicon.svg"')) {
    html = html.replace(
      /<link rel="icon"[^>]*href="\/favicon\.svg"[^>]*\/>/,
      iconLinks
    );
  } else if (!html.includes('href="/favicon.png"')) {
    html = html.replace("</title>", `</title>\n${iconLinks}`);
  }
  // Pin cache bust after patch-bundle (which may set b22/b23)
  html = html.replace(/\?h=b\d+/g, `?h=${CACHE_HASH}`);
  if (!html.includes(`h=${CACHE_HASH}`)) {
    html = html.replace(
      /href="\/assets\/index-BNWYZMT1\.css[^"]*"/,
      `href="/assets/index-BNWYZMT1.css?h=${CACHE_HASH}"`
    );
    html = html.replace(
      /src="\/assets\/gw-core-20260713\.js[^"]*"/,
      `src="/assets/gw-core-20260713.js?h=${CACHE_HASH}"`
    );
    html = html.replace(
      /src="\/grudge-game-bootstrap\.js[^"]*"/,
      `src="/grudge-game-bootstrap.js?h=${CACHE_HASH}"`
    );
  }
  // ensure png favicon even if patch-bundle rewrote index
  if (!html.includes('href="/favicon.png"')) {
    html = html.replace(
      /<link rel="icon"[^>]*>/,
      `<link rel="icon" type="image/png" href="/favicon.png" />\n    <link rel="apple-touch-icon" href="/favicon.png" />`
    );
  }
  fs.writeFileSync(INDEX, html);
  console.log(`index.html favicon + h=${CACHE_HASH}`);
}

// ---------------------------------------------------------------------------
// CSS — definitive HUD layout (strip prior v74/v75 if re-run)
// ---------------------------------------------------------------------------
let css = fs.readFileSync(CSS, "utf8");
if (css.includes(MARKER)) {
  css = css.slice(0, css.indexOf(MARKER));
}
// also strip unapplied half-states that fight layout
const shellIdx = css.indexOf("/* === GW shell fix");
const shellBlock = shellIdx >= 0 ? css.slice(shellIdx) : "";
if (shellIdx >= 0) css = css.slice(0, shellIdx);

const hudCss = `
${MARKER}
:root{
  --gk-kit:/assets/ui-kit/craftpix;
  --gk-ink:#e8eef8;
  --gk-ink-dim:#9aacc8;
  --gk-gold:#e0c878;
  --gk-green:#9dffd8;
  --gk-slot:56px;
  --gk-slot-sm:48px;
}

/* ========== COMBAT HUD (third-person) ========== */
.gk-combat-hud,.gk-root.gk-combat-hud{
  font-family:Cinzel,EB Garamond,Inter,system-ui,sans-serif;
  color:var(--gk-ink);
  pointer-events:none;
}
.gk-combat-hud *{box-sizing:border-box}
.gk-combat-hud button,
.gk-combat-hud .gk-actionbar,
.gk-combat-hud .gk-minimap-panel,
.gk-combat-hud .gk-ab-slot,
.gk-combat-hud .gk-mode-swap,
.gk-combat-hud .gk-path-rail,
.gk-combat-hud .gk-rts-rail,
.gk-combat-hud .gw-hero-upgrades,
.gk-combat-hud .gw-buildbar,
.gk-combat-hud .gw-prod-panel,
.gk-combat-hud .gw-shop,
.gk-combat-hud .gw-orders{pointer-events:auto}

/* hide legacy skill chips — kit owns skills */
.gk-combat-hud .gw-weapon-skills,
.gk-combat-hud .gw-skills{display:none!important}

/* Minimap top-left */
.gk-combat-hud .gk-minimap-panel,
.gk-minimap-panel{
  position:absolute!important;
  top:12px!important;left:12px!important;
  width:168px!important;height:184px!important;
  z-index:20!important;
  padding:0!important;margin:0!important;
  background:none!important;border:none!important;border-image:none!important;
  filter:drop-shadow(0 8px 18px rgba(0,0,0,.55));
}
.gk-minimap-canvas{
  position:absolute!important;
  left:14px!important;top:14px!important;
  width:140px!important;height:140px!important;
  margin:0!important;border-radius:10px!important;
  z-index:1!important;background:#0a0f16!important;
}
.gk-minimap-chrome{
  position:absolute!important;inset:0!important;z-index:2!important;
  background-size:100% 100%!important;background-repeat:no-repeat!important;
  pointer-events:none!important;
}
.gk-minimap-btn{
  position:absolute!important;right:6px!important;bottom:22px!important;
  width:26px!important;height:26px!important;object-fit:contain;z-index:3;
  pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));
}
.gk-minimap-label{
  position:absolute!important;left:0!important;right:0!important;bottom:2px!important;
  z-index:3!important;text-align:center!important;font-size:9px!important;
  letter-spacing:.16em!important;text-transform:uppercase!important;
  color:var(--gk-green)!important;text-shadow:0 1px 3px #000;margin:0!important;
}
.gk-combat-hud.gw-mode-command .gk-minimap-label{color:#7ec8ff!important}

/* Action bar — bottom center, combat only */
.gk-combat-hud .gk-actionbar,
.gk-actionbar{
  position:absolute!important;
  left:50%!important;bottom:12px!important;
  transform:translateX(-50%)!important;
  z-index:22!important;
  display:flex!important;flex-direction:row!important;
  align-items:flex-end!important;justify-content:center!important;
  gap:6px!important;
  width:auto!important;min-width:0!important;
  max-width:min(860px,96vw)!important;
  min-height:0!important;padding:0!important;margin:0!important;
  background:none!important;background-image:none!important;
  border:none!important;border-image:none!important;
  filter:drop-shadow(0 10px 24px rgba(0,0,0,.55));
}
.gk-combat-hud.gw-mode-command .gk-actionbar{display:none!important}
.gk-frame-actionbar{background-image:none!important;min-height:0!important;padding:0!important}

/* Globes */
.gk-globe{position:relative;width:84px;height:80px;flex:0 0 auto;margin-bottom:2px}
.gk-globe-frame{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:2;pointer-events:none}
.gk-globe-fill-wrap{
  position:absolute;left:18%;right:18%;top:16%;bottom:18%;
  overflow:hidden;border-radius:50%;z-index:1;background:rgba(0,0,0,.35)
}
.gk-globe-fill{
  position:absolute;left:0;right:0;bottom:0;
  background-size:100% 100%;background-position:bottom center;background-repeat:no-repeat;
  transition:height .2s ease
}
.gk-globe-readout{
  position:absolute;left:0;right:0;bottom:-2px;z-index:3;text-align:center;
  text-shadow:0 1px 3px #000;line-height:1.05;pointer-events:none
}
.gk-globe-readout strong{display:block;font-size:12px;font-weight:800;color:#fff;font-family:Cinzel,serif}
.gk-globe-readout em{display:block;font-style:normal;font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--gk-gold)}
.gk-globe-hp .gk-globe-readout strong{color:#ffb4a8}
.gk-globe-mp .gk-globe-readout strong{color:#a8d8ff}

/* Core plate */
.gk-actionbar-core{
  position:relative;display:flex;flex-direction:column;align-items:center;
  min-width:min(380px,58vw);padding:8px 14px 12px
}
.gk-actionbar-plate{
  position:absolute;inset:0;width:100%;height:100%;object-fit:fill;
  z-index:0;pointer-events:none;image-rendering:auto
}
.gk-actionbar-slots{
  position:relative;z-index:1;
  display:flex!important;flex-wrap:nowrap!important;
  justify-content:center;align-items:flex-end;
  gap:3px;padding:4px 6px 0;max-width:100%;overflow-x:auto
}
.gk-ab-slot{
  position:relative;
  width:var(--gk-slot)!important;height:var(--gk-slot)!important;
  min-width:var(--gk-slot)!important;min-height:var(--gk-slot)!important;
  border:0;padding:0;margin:0;background:transparent!important;
  background-image:none!important;cursor:pointer;flex:0 0 auto
}
.gk-ab-slot-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:0;pointer-events:none}
.gk-ab-icon{
  position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);
  width:28px;height:28px;object-fit:contain;z-index:1;
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));pointer-events:none
}
.gk-ab-cd-art{position:absolute;inset:8%;width:84%;height:84%;object-fit:contain;z-index:2;pointer-events:none;mix-blend-mode:multiply}
.gk-ab-timer{
  position:absolute;inset:0;display:grid;place-items:center;z-index:3;
  font-size:13px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none
}
.gk-ab-key{
  position:absolute;top:2px;left:4px;z-index:3;font-size:9px;font-weight:700;
  color:#f0e6d0;text-shadow:0 1px 2px #000;pointer-events:none
}
.gk-ab-name{
  position:absolute;left:0;right:0;bottom:-11px;font-size:8px;letter-spacing:.03em;
  color:var(--gk-ink-dim);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 2px #000;pointer-events:none
}
.gk-ab-slot.is-ready{filter:brightness(1.08)}
.gk-ab-slot.is-cd{filter:brightness(.78)}
.gk-ab-slot:hover{filter:brightness(1.12)}

.gk-xp-row{
  position:relative;z-index:1;display:flex;align-items:center;gap:8px;
  width:min(340px,90%);margin-top:12px
}
.gk-xp-track{
  flex:1;height:12px;background-size:100% 100%;background-repeat:no-repeat;
  position:relative;border-radius:2px;overflow:hidden
}
.gk-xp-fill{
  display:block;height:100%;background-size:cover;background-position:left center;
  background-repeat:no-repeat;transition:width .25s ease;min-width:0
}
.gk-xp-lvl{font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--gk-gold);text-shadow:0 1px 2px #000;white-space:nowrap}
.gk-ab-util{position:relative;z-index:1;display:flex;align-items:center;gap:10px;margin-top:4px}
.gk-ab-credits{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:var(--gk-gold);text-shadow:0 1px 2px #000}
.gk-ab-credits img{width:16px;height:16px;object-fit:contain}
.gk-mode-swap{position:relative;width:40px;height:40px;border:0;padding:0;background:transparent;cursor:pointer}
.gk-ab-util-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.gk-ab-util-icon{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:18px;height:18px;object-fit:contain;z-index:1}
.gk-mode-swap-label{
  position:absolute;left:0;right:0;bottom:-2px;font-size:7px;letter-spacing:.08em;
  color:#f0e6d0;text-align:center;text-shadow:0 1px 2px #000;z-index:1
}

/* Top chrome */
.gk-combat-hud .gw-top{
  top:10px!important;left:50%!important;right:auto!important;
  transform:translateX(-50%)!important;width:min(640px,62vw)!important;
  justify-content:center!important;gap:8px!important;pointer-events:none
}
.gk-combat-hud .gw-mode-badge{
  top:12px!important;right:12px!important;left:auto!important;transform:none!important;
  border:1px solid rgba(224,178,82,.4)!important;background:rgba(8,12,20,.9)!important;
  border-radius:10px!important;padding:8px 12px!important;pointer-events:auto;z-index:18
}
.gk-combat-hud.gw-mode-command .gw-mode-badge{
  border-color:rgba(93,200,255,.45)!important;background:rgba(8,16,28,.9)!important
}
.gk-combat-hud.gw-mode-command .gw-crosshair{opacity:0!important}
.gk-combat-hud.gw-mode-combat .gw-orders,
.gk-combat-hud.gw-mode-combat .gw-prod-panel,
.gk-combat-hud.gw-mode-combat .gw-lane-deploy,
.gk-combat-hud.gw-mode-combat .gw-buildbar,
.gk-combat-hud.gw-mode-combat .gw-shop,
.gk-combat-hud.gw-mode-combat .gk-rts-rail{opacity:0!important;pointer-events:none!important;visibility:hidden!important}

/* bottom-left messages clear of action bar */
.gk-combat-hud .gw-bottom-left{left:14px;bottom:132px;max-width:min(260px,30vw)}
.gk-combat-hud.gw-mode-command .gw-bottom-left{bottom:24px}
.gk-combat-hud .gw-bottom-right{display:none!important} /* kit globes own HP/ammo */

/* ========== CHAMPION PATH — vertical light-up rail ========== */
.gw-hero-upgrades,
.gk-path-rail{
  position:absolute!important;
  top:50%!important;left:10px!important;
  transform:translateY(-50%)!important;
  width:auto!important;min-width:0!important;max-width:72px!important;
  padding:10px 6px!important;
  background:rgba(8,12,18,.72)!important;
  border:1px solid rgba(224,178,82,.28)!important;
  border-radius:14px!important;
  box-shadow:0 10px 28px rgba(0,0,0,.45)!important;
  z-index:16!important;
  pointer-events:auto!important;
  backdrop-filter:blur(6px);
}
.gw-hero-upgrades-head{
  display:flex!important;flex-direction:column!important;align-items:center!important;
  gap:2px!important;padding:0 0 8px!important;width:100%!important;
  background:transparent!important;border:none!important;cursor:default!important;
  color:var(--gk-gold)!important
}
.gw-hero-upgrades-title{
  font-family:Cinzel,serif!important;font-size:8px!important;letter-spacing:.14em!important;
  text-transform:uppercase!important;writing-mode:horizontal-tb!important;
  text-align:center!important;flex:none!important;line-height:1.1
}
.gw-hero-upgrades-lvl{font-size:10px!important;font-weight:800!important;color:var(--gk-green)!important}
.gw-hero-upgrades-pending{
  font-size:8px!important;color:#ffdf9b!important;animation:gw-path-pulse 1s ease-in-out infinite
}
.gw-hero-upgrades-chevron,.gw-hero-upgrades .gw-title-icon{display:none!important}
.gw-hero-upgrades-body{padding:0!important;display:flex!important;flex-direction:column!important;gap:0!important}
.gw-hero-xp-row,.gw-hero-upgrades-hint{display:none!important}
.gw-hero-upgrades-collapsed .gw-hero-upgrades-body{display:flex!important} /* never collapse the rail */

.gw-hero-level-track,
.gk-path-slots{
  display:flex!important;flex-direction:column!important;align-items:center!important;
  gap:0!important;position:relative!important;padding:4px 0!important
}
/* vertical connector line */
.gw-hero-level-track::before,
.gk-path-slots::before{
  content:"";position:absolute;top:8px;bottom:8px;left:50%;
  width:2px;transform:translateX(-50%);
  background:linear-gradient(180deg,rgba(224,178,82,.15),rgba(224,178,82,.55),rgba(224,178,82,.15));
  z-index:0
}
.gw-hero-lvl-node,
.gk-path-slot{
  position:relative;z-index:1;
  width:44px;height:44px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  margin:3px 0;
  border-radius:10px;
  background:rgba(6,10,16,.85);
  border:1px solid rgba(120,150,200,.25);
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.4);
  transition:border-color .15s,box-shadow .15s,filter .15s,transform .12s;
  overflow:hidden
}
.gw-hero-lvl-node.is-reached,
.gk-path-slot.is-lit{
  border-color:rgba(224,178,82,.7);
  box-shadow:0 0 12px rgba(224,178,82,.35),inset 0 0 8px rgba(224,178,82,.12);
  filter:brightness(1.12)
}
.gw-hero-lvl-node.is-filled,
.gk-path-slot.is-filled{
  border-color:rgba(157,255,216,.65);
  box-shadow:0 0 14px rgba(157,255,216,.3)
}
.gw-hero-lvl-node.is-pending,
.gk-path-slot.is-pending{
  border-color:rgba(255,220,120,.95);
  animation:gw-path-pulse 1s ease-in-out infinite;
  transform:scale(1.06)
}
.gw-hero-lvl-node.is-passive:not(.is-reached){opacity:.4}
.gw-hero-lvl-node:not(.is-reached){opacity:.45;filter:grayscale(.4)}
.gw-hero-lvl-num{
  position:absolute;top:2px;left:3px;font-size:8px;font-weight:800;
  color:var(--gk-ink-dim);line-height:1
}
.gw-hero-lvl-node.is-reached .gw-hero-lvl-num{color:var(--gk-gold)}
.gw-hero-lvl-icon{font-size:14px;line-height:1;filter:drop-shadow(0 1px 2px #000)}
.gw-hero-lvl-name{
  position:absolute;left:48px;top:50%;transform:translateY(-50%);
  white-space:nowrap;font-size:10px;color:var(--gk-ink);
  background:rgba(8,12,18,.92);padding:3px 8px;border-radius:6px;
  border:1px solid rgba(120,150,200,.25);
  opacity:0;pointer-events:none;transition:opacity .12s;z-index:5
}
.gw-hero-lvl-node:hover .gw-hero-lvl-name{opacity:1}
@keyframes gw-path-pulse{
  0%,100%{box-shadow:0 0 8px rgba(255,220,120,.35)}
  50%{box-shadow:0 0 18px rgba(255,220,120,.7)}
}

/* ========== RTS — 9 slots right rail ========== */
.gk-combat-hud.gw-mode-command .gw-buildbar,
.gk-rts-rail,
.gw-buildbar{
  position:absolute!important;
  top:50%!important;right:12px!important;left:auto!important;bottom:auto!important;
  transform:translateY(-50%)!important;
  display:flex!important;flex-direction:column!important;align-items:center!important;
  gap:6px!important;z-index:18!important;
  width:auto!important;max-width:78px!important;
  padding:10px 8px!important;
  background:rgba(8,12,18,.78)!important;
  border:1px solid rgba(93,200,255,.35)!important;
  border-radius:14px!important;
  box-shadow:0 12px 32px rgba(0,0,0,.5)!important;
  backdrop-filter:blur(6px);
}
.gw-buildbar-title{
  writing-mode:horizontal-tb!important;
  font-size:8px!important;letter-spacing:.14em!important;
  text-transform:uppercase!important;color:#7ec8ff!important;
  text-align:center!important;margin:0!important
}
.gw-buildbar-slots,
.gk-rts-slots{
  display:flex!important;flex-direction:column!important;
  gap:5px!important;padding:0!important;
  background:none!important;border:none!important;box-shadow:none!important
}
.gw-buildbar-slot,
.gk-rts-slot{
  position:relative!important;
  width:58px!important;height:58px!important;
  min-width:58px!important;min-height:58px!important;
  padding:0!important;margin:0!important;
  border:0!important;border-radius:0!important;
  background:transparent!important;
  cursor:pointer!important;
  display:flex!important;align-items:center!important;justify-content:center!important;
  color:var(--gk-ink)!important;
  transition:filter .12s,transform .1s
}
.gw-buildbar-slot .gk-rts-slot-bg,
.gk-rts-slot-bg{
  position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;z-index:0
}
.gw-buildbar-key,.gk-rts-key{
  position:absolute!important;top:3px!important;left:5px!important;
  font-size:9px!important;font-weight:800!important;color:#f0e6d0!important;
  text-shadow:0 1px 2px #000;z-index:2
}
.gw-buildbar-glyph,.gk-rts-glyph{
  position:relative;z-index:1;font-size:18px;line-height:1;
  filter:drop-shadow(0 1px 2px #000)
}
.gw-buildbar-name,.gk-rts-name{
  position:absolute!important;left:0!important;right:0!important;bottom:3px!important;
  font-size:7px!important;letter-spacing:.02em!important;text-align:center!important;
  color:var(--gk-ink-dim)!important;z-index:2;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 2px #000;padding:0 2px
}
.gw-buildbar-cost,.gk-rts-cost{
  position:absolute!important;top:3px!important;right:4px!important;
  font-size:8px!important;font-weight:700!important;color:var(--gk-gold)!important;
  text-shadow:0 1px 2px #000;z-index:2
}
.gw-buildbar-slot.is-armed,.gk-rts-slot.is-armed{
  filter:brightness(1.2) drop-shadow(0 0 8px rgba(93,200,255,.55))
}
.gw-buildbar-slot.is-disabled,.gk-rts-slot.is-disabled{opacity:.42;cursor:not-allowed!important}
.gw-buildbar-slot:hover:not(.is-disabled),.gk-rts-slot:hover:not(.is-disabled){
  filter:brightness(1.12);transform:scale(1.04)
}
.gw-buildbar-hint{display:none!important}
.gw-cost-cant{color:#f87171!important}

/* command-mode: tuck production / shop so they don't collide with rails */
.gk-combat-hud.gw-mode-command .gw-prod-panel{
  left:86px!important;bottom:16px!important;right:auto!important;
  max-width:min(280px,32vw)!important;transform:none!important
}
.gk-combat-hud.gw-mode-command .gw-shop{
  left:50%!important;bottom:0!important;transform:translateX(-50%)!important;
  max-width:min(640px,90vw)!important
}

/* pregame path also vertical-friendly */
.wg-pregame-path .wg-path-grid{
  display:flex!important;flex-direction:column!important;gap:8px!important;
  max-height:min(58vh,620px);overflow:auto
}
.wg-path-row{
  display:flex!important;flex-direction:column!important;gap:6px!important
}
.wg-path-opts{
  display:flex!important;flex-direction:column!important;gap:6px!important
}

@media(max-width:900px){
  .gk-globe{width:68px;height:64px}
  .gk-ab-slot{--gk-slot:48px}
  .gw-hero-upgrades,.gk-path-rail{max-width:60px!important;left:6px!important}
  .gw-hero-lvl-node,.gk-path-slot{width:38px;height:38px}
  .gw-buildbar,.gk-rts-rail{right:6px!important;max-width:64px!important}
  .gw-buildbar-slot,.gk-rts-slot{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important}
}
@media(max-width:720px){
  .gk-minimap-panel{width:132px!important;height:146px!important;top:8px!important;left:6px!important}
  .gk-minimap-canvas{left:10px!important;top:10px!important;width:112px!important;height:112px!important}
  .gk-actionbar-core{min-width:min(300px,70vw)}
  .gk-ab-slot{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important}
  .gk-ab-icon{width:22px;height:22px}
  .gk-ab-name{display:none}
}

`;

css = css.trimEnd() + "\n" + hudCss + "\n" + shellBlock;
fs.writeFileSync(CSS, css);
console.log("CSS patched", MARKER);

// ---------------------------------------------------------------------------
// JS — expand RTS buildbar to 9 craftpix slots; simplify path rail UX
// ---------------------------------------------------------------------------
let js = fs.readFileSync(CORE, "utf8");
const JS_MARK = "/*WG_HUD_V75*/";

const NEW_YGA = `function ygA(){${JS_MARK}
const ph=BI(t=>t.phase),md=_g(t=>t.mode),cr=BI(t=>t.credits),hp=BI(t=>t.allyCoreHp),hm=BI(t=>t.allyCoreMax),armed=_g(t=>t.build);
if(ph!=="battle"||md!=="command")return null;
const kit="/assets/ui-kit/craftpix";
const slotBg=kit+"/Action Bar/Slots/ActionBar_Slot_Background.png";
/* 9 RTS slots: 1-5 fortify, 6-8 units, 9 warrior mode */
const builds=typeof UT!=="undefined"&&UT&&UT.length?UT:[
  {id:"cannon",name:"Cannon",cost:130,kind:"build",ref:"cannon",description:"Splash turret"},
  {id:"ballista",name:"Ballista",cost:150,kind:"build",ref:"ballista",description:"Single-target turret"},
  {id:"mage",name:"Mage",cost:160,kind:"build",ref:"mage",description:"Slow + AoE tower"},
  {id:"barrier",name:"Barrier",cost:60,kind:"build",ref:"barrier",description:"Lane block"},
  {id:"repair",name:"Repair",cost:90,kind:"repair",ref:"core",description:"Mend citadel"}
];
const units=[
  {id:"footman",name:"Footman",cost:80,kind:"unit",ref:"footman",glyph:"⚔",description:"Melee infantry"},
  {id:"archer",name:"Archer",cost:120,kind:"unit",ref:"archer",glyph:"🏹",description:"Ranged line"},
  {id:"knight",name:"Knight",cost:180,kind:"unit",ref:"knight",glyph:"🛡",description:"Heavy frontline"}
];
const keys=["1","2","3","4","5","6","7","8","9"];
const glyphs=["💣","🏹","🔮","🧱","🔧",...units.map(u=>u.glyph),"⚔"];
const slots=[];
builds.forEach((t,i)=>slots.push({...t,key:keys[i],glyph:glyphs[i]}));
units.forEach((t,i)=>slots.push({...t,key:keys[5+i],glyph:t.glyph}));
slots.push({id:"warrior",name:"Warrior",cost:0,kind:"mode",ref:"combat",key:"9",glyph:"⚔",description:"Third-person combat"});
const buyUnit=(ref)=>{
  try{
    const item=units.find(u=>u.ref===ref);
    if(!item)return;
    if(typeof ngA==="function"){ngA(item);return}
    const st=BI.getState();
    if((st.credits||0)<item.cost){st.pushMessage&&st.pushMessage("NOT ENOUGH CREDITS","warn");return}
    st.spendCredits&&st.spendCredits(item.cost);
    try{const I=Z.map.rally,g=I.x+(Math.random()-.5)*10,i=I.z+(Math.random()-.5)*3,e=Z.spawnUnit("ally",item.ref,g,i,{commandable:!0});e.order="idle"}catch{}
    st.pushMessage&&st.pushMessage(item.name.toUpperCase()+" JOINS THE WARBAND","good");
  }catch(e){console.warn("[rts] unit",e)}
};
return d.jsxs("div",{className:"gw-buildbar gk-rts-rail",children:[
  d.jsx("span",{className:"gw-buildbar-title",children:"Command"}),
  d.jsx("div",{className:"gw-buildbar-slots gk-rts-slots",children:slots.map((t,Q)=>{
    const isRepair=t.kind==="repair",isUnit=t.kind==="unit",isMode=t.kind==="mode";
    const full=isRepair&&hp>=hm;
    const disabled=(!isMode&&cr<t.cost)||full;
    const isArmed=!isRepair&&!isUnit&&!isMode&&armed?.ref===t.ref;
    return d.jsxs("button",{
      type:"button",
      className:"gw-buildbar-slot gk-rts-slot"+(isArmed?" is-armed":"")+(disabled?" is-disabled":""),
      disabled:disabled,
      title:(t.description||t.name)+" ("+t.key+")",
      onClick:()=>{
        if(isMode){_g.getState().setMode("combat");return}
        if(isRepair){typeof FT==="function"?FT():null;return}
        if(isUnit){buyUnit(t.ref);return}
        if(isArmed)_g.getState().setBuild(null);
        else if(typeof KT==="function")KT(t.ref);
      },
      children:[
        d.jsx("img",{className:"gk-rts-slot-bg",src:slotBg,alt:"",draggable:!1}),
        d.jsx("span",{className:"gw-buildbar-key gk-rts-key",children:t.key}),
        d.jsx("span",{className:"gw-buildbar-glyph gk-rts-glyph",children:t.glyph}),
        d.jsx("span",{className:"gw-buildbar-name gk-rts-name",children:t.name}),
        !isMode&&d.jsx("span",{className:"gw-buildbar-cost gk-rts-cost"+(!full&&cr<t.cost?" gw-cost-cant":""),children:t.cost||""})
      ]
    },t.id||("s"+Q))
  })})
]})}
`;

if (js.includes(JS_MARK) && js.includes("gk-rts-rail") && js.includes("gk-path-rail")) {
  console.log("JS already v75 — leaving structure, refreshing is idempotent");
} else {
  // 1) Rewrite ygA (BuildBar) to 9-slot right rail with craftpix slot art
  const YGA_START = "function ygA(){";
  const ygaIdx = js.indexOf(YGA_START);
  must(ygaIdx > 0, "ygA BuildBar not found");

  let ygaEndFull = -1;
  if (js.includes(JS_MARK)) {
    // Already replaced once — find end by next top-level function after ygA body
    const after = js.indexOf("function ", ygaIdx + YGA_START.length);
    // Prefer known trailing const marker from stock buildbar
    const stockEnd = 'children:"1–5 place · Shift+1–5 groups · Ctrl+1–5 recall"})]})}';
    const se = js.indexOf(stockEnd, ygaIdx);
    if (se > ygaIdx) ygaEndFull = se + stockEnd.length;
    else {
      // find closing of our previous insert: ends with `]})}function` or `]})}const`
      const re = /function ygA\(\)\{[\s\S]*?\n\]\}\)\}/;
      const m = js.slice(ygaIdx).match(re);
      if (m) ygaEndFull = ygaIdx + m[0].length;
    }
  } else {
    const ygaEndMarker = 'children:"1–5 place · Shift+1–5 groups · Ctrl+1–5 recall"})]})}';
    const ygaEnd = js.indexOf(ygaEndMarker, ygaIdx);
    must(ygaEnd > ygaIdx, "ygA end marker not found — patch-bundle may have changed buildbar");
    ygaEndFull = ygaEnd + ygaEndMarker.length;
  }
  must(ygaEndFull > ygaIdx, "could not locate ygA end");

  js = js.slice(0, ygaIdx) + NEW_YGA + js.slice(ygaEndFull);
  console.log("replaced ygA with 9-slot RTS rail");

  // 2) Patch champion path (wgA) — always-open vertical rail
  if (!js.includes("gk-path-rail")) {
    const pathFrom =
      "function wgA(){const C=BI(h=>h.phase),A=BI(h=>h.heroLevel),I=BI(h=>h.heroXp),g=BI(h=>h.heroSkillPicks),i=BI(h=>h.pendingSkillPick),e=XI(h=>h.classId),[t,Q]=T.useState(!1);if(C!==\"battle\")return null;const o=SQ[e],s=qx(A,I),l=!t||!!i,c=Lx(e);return d.jsxs(\"div\",{className:`gw-hero-upgrades${l?\"\":\" gw-hero-upgrades-collapsed\"}`";
    const pathTo =
      "function wgA(){const C=BI(h=>h.phase),A=BI(h=>h.heroLevel),I=BI(h=>h.heroXp),g=BI(h=>h.heroSkillPicks),i=BI(h=>h.pendingSkillPick),e=XI(h=>h.classId),[t,Q]=T.useState(!1);if(C!==\"battle\")return null;const o=SQ[e],s=qx(A,I),l=!0,c=Lx(e);return d.jsxs(\"div\",{className:`gw-hero-upgrades gk-path-rail${l?\"\":\" gw-hero-upgrades-collapsed\"}`";
    if (js.includes(pathFrom)) {
      js = js.replace(pathFrom, pathTo);
    } else {
      js = js.replace(
        "className:`gw-hero-upgrades${l?\"\":\" gw-hero-upgrades-collapsed\"}`",
        "className:`gw-hero-upgrades gk-path-rail${l?\"\":\" gw-hero-upgrades-collapsed\"}`"
      );
      // force always open if still collapsible
      js = js.replace(
        "const o=SQ[e],s=qx(A,I),l=!t||!!i,c=Lx(e);return d.jsxs(\"div\",{className:`gw-hero-upgrades gk-path-rail",
        "const o=SQ[e],s=qx(A,I),l=!0,c=Lx(e);return d.jsxs(\"div\",{className:`gw-hero-upgrades gk-path-rail"
      );
    }
  }
  must(js.includes("gk-path-rail"), "failed to mark path rail");
  console.log("champion path → vertical rail class");

  // 3) Hotkeys 6-9 in command mode
  for (const { from, to } of [
    { from: "slot>=0&&slot<5", to: "slot>=0&&slot<9" },
    { from: "slot>=0&&slot<=4", to: "slot>=0&&slot<=8" },
    { from: "n>=1&&n<=5", to: "n>=1&&n<=9" },
    { from: "k>=1&&k<=5&&A===\"command\"", to: "k>=1&&k<=9&&A===\"command\"" },
  ]) {
    if (js.includes(from)) {
      js = js.split(from).join(to);
      console.log("hotkey range", from, "→", to);
    }
  }

  fs.writeFileSync(CORE, js);
  // Keep legacy aliases in sync with production pin
  for (const alias of [
    "assets/index-warlord-fix3.js",
    "assets/index-warlord-fix95.js",
  ]) {
    const ap = path.join(ROOT, alias);
    if (fs.existsSync(ap)) {
      fs.copyFileSync(CORE, ap);
      console.log("synced alias", alias);
    }
  }
  console.log("wrote", path.relative(ROOT, CORE), "bytes", js.length);
}

// Ensure combat action bar keeps craftpix structure
must(js.includes("function WgKitActionBar") || js.includes("WgKitActionBar"), "WgKitActionBar missing");
must(js.includes("gk-globe"), "combat globes missing");
must(js.includes("gk-rts-rail"), "RTS rail missing");
must(js.includes("gk-path-rail"), "path rail missing");

// Sync deploy-manifest so verify-deploy accepts post-HUD bundle
if (fs.existsSync(MANIFEST) && fs.existsSync(CORE)) {
  const buf = fs.readFileSync(CORE);
  const sha = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const man = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  man.bundleFile = "assets/gw-core-20260713.js";
  man.bundleSource = "assets/index-warlord-fix3.js";
  man.cssFile = "assets/index-BNWYZMT1.css";
  man.buildMode = "gw-core";
  man.bundleBytes = buf.length;
  man.bundleSha256 = sha;
  man.bundleCacheHash = CACHE_HASH;
  man.lastBuilt = new Date().toISOString();
  if (!man.bundleChecks?.some((c) => c.id === "hud-path-rail")) {
    man.bundleChecks = man.bundleChecks || [];
    man.bundleChecks.push(
      { id: "hud-path-rail", needle: "gk-path-rail" },
      { id: "hud-rts-rail", needle: "gk-rts-rail" },
      { id: "hud-combat-globe", needle: "gk-globe" }
    );
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(man, null, 2) + "\n");
  console.log("deploy-manifest → sha", sha, "h", CACHE_HASH, "bytes", buf.length);
}

// Verify
const checks = {
  pathRail: js.includes("gk-path-rail"),
  rts9: js.includes("gk-rts-rail") && js.includes('key:"9"'),
  actionBar: js.includes("WgKitActionBar") && js.includes("gk-globe"),
  cssPath: css.includes(".gk-path-rail") || css.includes("gw-hero-level-track::before"),
  cssRts: css.includes(".gk-rts-rail") || css.includes("gw-mode-command .gw-buildbar"),
  cssGlobe: css.includes(".gk-globe"),
  favicon: fs.existsSync(path.join(ROOT, "favicon.png")),
};
console.log("checks", checks);
for (const [k, v] of Object.entries(checks)) {
  if (!v) console.error("FAIL", k);
}
console.log("done — deploy with: node scripts/vercel-deploy.mjs deploy --prod --yes");
