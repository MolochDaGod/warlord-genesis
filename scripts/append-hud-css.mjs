#!/usr/bin/env node
/**
 * Definitive Craftpix HUD CSS — kills prior broken frame hacks, uses real kit art.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = join(ROOT, "assets", "index-BNWYZMT1.css");
const MARKER = "/* v74 craftpix hud — real assets */";

let css = readFileSync(CSS, "utf8");
if (css.includes(MARKER)) {
  // replace previous v74 block
  const i = css.indexOf(MARKER);
  css = css.slice(0, i);
}

const block = `
${MARKER}
:root{
  --gk-kit:/assets/ui-kit/craftpix;
  --gk-ink:#e8eef8;
  --gk-ink-dim:#9aacc8;
  --gk-gold:#e0c878;
  --gk-green:#9dffd8;
}
/* ---- Combat HUD shell ---- */
.gk-combat-hud,.gk-root.gk-combat-hud{
  font-family:Cinzel,EB Garamond,Inter,system-ui,sans-serif;
  color:var(--gk-ink);
  pointer-events:none;
}
.gk-combat-hud *{box-sizing:border-box}
.gk-combat-hud button,.gk-combat-hud .gk-actionbar,.gk-combat-hud .gk-minimap-panel,
.gk-combat-hud .gk-ab-slot,.gk-combat-hud .gk-mode-swap{pointer-events:auto}

/* Hide legacy skill chips — kit action bar owns skills */
.gk-combat-hud .gw-weapon-skills,
.gk-combat-hud .gw-skills{display:none!important}

/* ---- Minimap (Overlay 444² as chrome) ---- */
.gk-combat-hud .gk-minimap-panel,
.gk-minimap-panel{
  position:absolute!important;
  top:12px!important;left:12px!important;
  width:172px!important;height:188px!important;
  z-index:20!important;
  padding:0!important;margin:0!important;
  background:none!important;border:none!important;
  border-image:none!important;
  filter:drop-shadow(0 8px 18px rgba(0,0,0,.55));
}
.gk-minimap-canvas{
  position:absolute!important;
  left:16px!important;top:16px!important;
  width:140px!important;height:140px!important;
  margin:0!important;border-radius:10px!important;
  z-index:1!important;
  background:#0a0f16!important;
  image-rendering:auto;
}
.gk-minimap-chrome{
  position:absolute!important;
  inset:0!important;
  z-index:2!important;
  background-size:100% 100%!important;
  background-repeat:no-repeat!important;
  pointer-events:none!important;
}
.gk-minimap-btn{
  position:absolute!important;
  right:6px!important;bottom:22px!important;
  width:28px!important;height:28px!important;
  z-index:3!important;
  object-fit:contain;
  pointer-events:none;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));
}
.gk-minimap-label{
  position:absolute!important;
  left:0!important;right:0!important;bottom:2px!important;
  z-index:3!important;
  text-align:center!important;
  font-size:9px!important;
  letter-spacing:.16em!important;
  text-transform:uppercase!important;
  color:var(--gk-green)!important;
  text-shadow:0 1px 3px #000;
  margin:0!important;
}

/* ---- Action bar: plate + orbs + slots + XP ---- */
.gk-combat-hud .gk-actionbar,
.gk-actionbar{
  position:absolute!important;
  left:50%!important;bottom:10px!important;
  transform:translateX(-50%)!important;
  z-index:22!important;
  display:flex!important;
  flex-direction:row!important;
  align-items:flex-end!important;
  justify-content:center!important;
  gap:8px!important;
  width:auto!important;
  min-width:0!important;max-width:min(920px,98vw)!important;
  min-height:0!important;
  padding:0!important;margin:0!important;
  background:none!important;background-image:none!important;
  border:none!important;border-image:none!important;
  filter:drop-shadow(0 10px 24px rgba(0,0,0,.55));
}
.gk-combat-hud.gw-mode-command .gk-actionbar{display:none!important}

/* HP / Ammo globes */
.gk-globe{
  position:relative;
  width:92px;height:88px;
  flex:0 0 auto;
  margin-bottom:4px;
}
.gk-globe-frame{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:contain;
  z-index:2;pointer-events:none;
  filter:drop-shadow(0 4px 8px rgba(0,0,0,.45));
}
.gk-globe-fill-wrap{
  position:absolute;
  left:18%;right:18%;top:16%;bottom:18%;
  overflow:hidden;
  border-radius:50%;
  z-index:1;
  background:rgba(0,0,0,.35);
}
.gk-globe-fill{
  position:absolute;left:0;right:0;bottom:0;
  background-size:100% 100%;
  background-position:bottom center;
  background-repeat:no-repeat;
  transition:height .2s ease;
}
.gk-globe-readout{
  position:absolute;left:0;right:0;bottom:-2px;
  z-index:3;text-align:center;
  text-shadow:0 1px 3px #000;
  line-height:1.05;
  pointer-events:none;
}
.gk-globe-readout strong{
  display:block;font-size:13px;font-weight:800;color:#fff;
  font-family:Cinzel,serif;
}
.gk-globe-readout em{
  display:block;font-style:normal;font-size:8px;
  letter-spacing:.14em;text-transform:uppercase;color:var(--gk-gold);
}
.gk-globe-hp .gk-globe-readout strong{color:#ffb4a8}
.gk-globe-mp .gk-globe-readout strong{color:#a8d8ff}

/* Core plate */
.gk-actionbar-core{
  position:relative;
  display:flex;flex-direction:column;
  align-items:center;
  min-width:min(420px,62vw);
  padding:10px 18px 14px;
}
.gk-actionbar-plate{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:fill;
  z-index:0;pointer-events:none;
  image-rendering:auto;
}
.gk-actionbar-slots{
  position:relative;z-index:1;
  display:flex;flex-wrap:nowrap;
  justify-content:center;align-items:flex-end;
  gap:4px;
  padding:6px 8px 0;
  max-width:100%;
  overflow-x:auto;
}
.gk-ab-slot{
  position:relative;
  width:58px;height:58px;
  min-width:58px;min-height:58px;
  border:0;padding:0;margin:0;
  background:transparent!important;
  cursor:pointer;
  flex:0 0 auto;
}
.gk-ab-slot-bg{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:contain;
  z-index:0;pointer-events:none;
}
.gk-ab-icon{
  position:absolute;
  left:50%;top:46%;
  transform:translate(-50%,-50%);
  width:30px;height:30px;
  object-fit:contain;
  z-index:1;
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.6));
  pointer-events:none;
}
.gk-ab-cd-art{
  position:absolute;inset:8%;
  width:84%;height:84%;
  object-fit:contain;
  z-index:2;pointer-events:none;
  mix-blend-mode:multiply;
}
.gk-ab-timer{
  position:absolute;inset:0;
  display:grid;place-items:center;
  z-index:3;font-size:14px;font-weight:800;
  color:#fff;text-shadow:0 1px 3px #000;
  pointer-events:none;
}
.gk-ab-key{
  position:absolute;top:2px;left:4px;
  z-index:3;font-size:9px;font-weight:700;
  color:#f0e6d0;text-shadow:0 1px 2px #000;
  pointer-events:none;
}
.gk-ab-name{
  position:absolute;left:0;right:0;bottom:-12px;
  font-size:8px;letter-spacing:.04em;
  color:var(--gk-ink-dim);text-align:center;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  text-shadow:0 1px 2px #000;
  pointer-events:none;
}
.gk-ab-slot.is-ready{filter:brightness(1.08)}
.gk-ab-slot.is-cd{filter:brightness(.78)}
.gk-ab-slot:hover{filter:brightness(1.12)}

/* XP */
.gk-xp-row{
  position:relative;z-index:1;
  display:flex;align-items:center;gap:8px;
  width:min(360px,90%);
  margin-top:14px;
}
.gk-xp-track{
  flex:1;height:14px;
  background-size:100% 100%;
  background-repeat:no-repeat;
  position:relative;
  border-radius:2px;
  overflow:hidden;
}
.gk-xp-fill{
  display:block;height:100%;
  background-size:cover;
  background-position:left center;
  background-repeat:no-repeat;
  transition:width .25s ease;
  min-width:0;
}
.gk-xp-lvl{
  font-size:10px;font-weight:700;
  letter-spacing:.08em;color:var(--gk-gold);
  text-shadow:0 1px 2px #000;
  white-space:nowrap;
}

/* util row */
.gk-ab-util{
  position:relative;z-index:1;
  display:flex;align-items:center;gap:10px;
  margin-top:6px;
}
.gk-ab-credits{
  display:flex;align-items:center;gap:4px;
  font-size:12px;font-weight:700;color:var(--gk-gold);
  text-shadow:0 1px 2px #000;
}
.gk-ab-credits img{width:18px;height:18px;object-fit:contain}
.gk-mode-swap{
  position:relative;
  width:44px;height:44px;
  border:0;padding:0;background:transparent;
  cursor:pointer;
}
.gk-ab-util-bg{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:contain;
}
.gk-ab-util-icon{
  position:absolute;
  left:50%;top:42%;
  transform:translate(-50%,-50%);
  width:20px;height:20px;
  object-fit:contain;
  z-index:1;
}
.gk-mode-swap-label{
  position:absolute;left:0;right:0;bottom:-2px;
  font-size:8px;letter-spacing:.08em;
  color:#f0e6d0;text-align:center;
  text-shadow:0 1px 2px #000;z-index:1;
}

/* ---- Windows (true 9-slice from 128² kit) ---- */
.gk-window-panel,.gk-frame-window,.gk-deploy-window,
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel,
.gk-deploy-v2 .gk-deploy-window{
  position:relative!important;
  border:22px solid transparent!important;
  border-image-source:url(/assets/ui-kit/craftpix/Window/Window_Background.png)!important;
  border-image-slice:40 fill!important;
  border-image-width:22px!important;
  border-image-repeat:stretch!important;
  background:transparent!important;
  background-image:none!important;
  border-radius:0!important;
  padding:8px 12px 14px!important;
  box-shadow:0 12px 36px rgba(0,0,0,.4)!important;
  overflow:visible!important;
}
.gk-window-frame{display:none}
.gk-window-head{
  display:flex;align-items:center;justify-content:space-between;
  gap:8px;min-height:36px;
  margin:-4px -6px 10px;
  padding:8px 14px;
  background-size:100% 100%;
  background-repeat:no-repeat;
  font-family:Cinzel,serif;
  font-size:14px;letter-spacing:.08em;
  color:#f0e6d0;
}
.gk-window-close{width:22px;height:22px;object-fit:contain;opacity:.85}
.gk-window-body{min-width:0}

/* ---- Quest rail (full panel art, not broken slice) ---- */
.gk-quest-rail,.gk-frame-quest{
  position:relative!important;
  border:none!important;border-image:none!important;
  background:transparent!important;background-image:none!important;
  padding:36px 28px 28px!important;
  min-width:200px!important;
  min-height:170px!important;
  overflow:visible!important;
}
.gk-quest-frame{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:fill;
  z-index:0;pointer-events:none;
}
.gk-quest-title,.gk-quest-steps{position:relative;z-index:1}
.gk-quest-title{
  display:block;margin:0 0 10px;
  font-family:Cinzel,serif;font-size:13px;
  letter-spacing:.1em;color:#f0e6d0;
  text-shadow:0 1px 2px #000;
}
.gk-quest-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.gk-quest-step{
  display:flex;align-items:center;gap:8px;
  font-size:12px;color:var(--gk-ink-dim);
}
.gk-quest-step.is-active{color:#f0e6d0;font-weight:700}
.gk-quest-step.is-done{color:var(--gk-green)}
.gk-quest-tick{width:18px;height:18px;object-fit:contain;flex-shrink:0}
.gk-quest-dot{display:none}

/* ---- Resource bar ---- */
.gk-resource-bar{
  position:relative;z-index:5;
  display:flex;align-items:center;justify-content:space-between;
  gap:12px;flex-wrap:wrap;
  padding:10px 16px;
  background:linear-gradient(180deg,rgba(10,14,22,.94),rgba(8,12,20,.88));
  border-bottom:1px solid rgba(224,178,82,.22);
  box-shadow:0 6px 20px rgba(0,0,0,.35);
}
.gk-res-brand{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gk-ink-dim);font-weight:700}
.gk-res-brand img{width:28px;height:28px;object-fit:contain}
.gk-res-coin{display:flex;align-items:center;gap:6px}
.gk-coin-art{width:22px;height:22px;object-fit:contain}
.gk-coin-sm{width:16px;height:16px}
.gk-res-val{font-size:15px;font-weight:800;color:var(--gk-gold)}
.gk-res-label{font-size:10px;letter-spacing:.12em;color:var(--gk-ink-dim)}
.gk-account-chip{
  display:inline-flex;align-items:center;gap:6px;
  padding:6px 12px;border-radius:999px;
  border:1px solid rgba(120,150,200,.3);
  background:rgba(8,12,20,.75);
  color:var(--gk-ink);font:inherit;cursor:pointer;
}
.gk-account-chip:hover{border-color:rgba(224,178,82,.5)}

/* Top combat chrome */
.gk-combat-hud .gw-top{
  top:10px!important;left:50%!important;right:auto!important;
  transform:translateX(-50%)!important;
  width:min(720px,70vw)!important;
  justify-content:center!important;
  gap:8px!important;
  pointer-events:none;
}
.gk-combat-hud .gw-mode-badge{
  top:12px!important;right:12px!important;left:auto!important;
  transform:none!important;
  border:1px solid rgba(224,178,82,.4)!important;
  background:rgba(8,12,20,.9)!important;
  border-radius:10px!important;
  padding:8px 12px!important;
  pointer-events:auto;
}

/* Kill old contradictory frame rules */
.gk-frame-actionbar{background-image:none!important;min-height:0!important;padding:0!important}
.gk-frame-minimap{background:none!important;border-image:none!important}

@media(max-width:720px){
  .gk-minimap-panel{width:140px!important;height:154px!important;top:8px!important;left:6px!important}
  .gk-minimap-canvas{left:12px!important;top:12px!important;width:116px!important;height:116px!important}
  .gk-globe{width:72px;height:68px}
  .gk-ab-slot{width:48px;height:48px;min-width:48px;min-height:48px}
  .gk-ab-icon{width:24px;height:24px}
  .gk-actionbar-core{min-width:min(280px,58vw);padding:6px 10px 10px}
  .gk-ab-name{display:none}
}
`;

writeFileSync(CSS, css + block);
console.log("[hud-css] wrote craftpix v74 HUD styles");
