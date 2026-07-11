/**
 * Surgical production-bundle patches for /play flow + auth safety.
 * Source TS is fixed in artifacts/grudge-warlords; this updates the shipped
 * assets/index-warlord-fix3.js used by Vercel static ship mode.
 */
import { copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = join(ROOT, "assets", "index-warlord-fix3.js");
const HTML = join(ROOT, "index.html");
const BUST = "71";

if (!existsSync(BUNDLE)) {
  console.error("[patch-play-flow] missing", BUNDLE);
  process.exit(1);
}

copyFileSync(BUNDLE, join(ROOT, "assets", `index-warlord-fix3.pre-play-patch.js`));
let js = readFileSync(BUNDLE, "utf8");
let n = 0;

function rep(from, to, label) {
  if (!js.includes(from)) {
    console.warn("[patch-play-flow] MISS", label);
    return false;
  }
  js = js.split(from).join(to);
  n += 1;
  console.log("[patch-play-flow] OK", label);
  return true;
}

// 1) Stop wiping fleet auth tokens on first visit
rep(
  'const _0="gw_site_data_cleared_v68",MO=["gw_","wg-","wg_","engine_boot_","grudge_","puter"]',
  'const _0="gw_site_data_cleared_v69",MO=["gw_","wg-","wg_","engine_boot_"]',
  "clearSiteData prefixes (no grudge_/puter auth wipe)",
);

// Soften clearKey helper — drop broad "warlord" / "grudge-warlords" includes that
// might still hit odd keys; keep DIFFICULTY + weapon_tuning.
rep(
  'return C==="DIFFICULTY"||C.includes("warlord")||C.includes("grudge-warlords")||C.includes("weapon_tuning")',
  'return C==="DIFFICULTY"||C==="gw_roster_v1"||C==="gw_roster_v2"||C==="gw_meta_v1"||C.includes("weapon_tuning")',
  "clearKey narrow exact game keys",
);

// Session wipe was full-session clear — only clear game keys (best-effort: leave as-is if pattern drifts)
// Session full wipe is aggressive but OK for sessionStorage (auth rarely lives there).

// 2) Intro primary CTA → warcamp lobby (not deploy)
// Kd is DEPLOY_PATH="/deploy" in this bundle — send warcamp traffic to /lobby.
rep(
  'onClick:()=>C(Kd),children:"ENTER THE WARCAMP"',
  'onClick:()=>C("/lobby"),children:"ENTER THE WARCAMP"',
  "intro CTA → /lobby",
);

// Add quick battle button after online CTA if missing
if (!js.includes("QUICK BATTLE")) {
  rep(
    'onClick:()=>C("/mp"),children:"WAGE WAR ONLINE"',
    'onClick:()=>C("/play?skirmish=1"),children:"QUICK BATTLE"}),S.jsx("button",{className:"gw-btn gw-btn-ghost gw-intro-cta-secondary",onClick:()=>C("/mp"),children:"WAGE WAR ONLINE"',
    "intro QUICK BATTLE button",
  );
}

// 3) Infinite "Entering the field…" spinner → real gate with recovery
rep(
  'if(I==="menu")return S.jsx("div",{className:"gw-screen gw-play-boot",children:S.jsxs("div",{className:"gw-play-boot-inner",children:[S.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),S.jsx("span",{className:"gw-hint",children:"Entering the field…"})]})})',
  'if(I==="menu")return S.jsx("div",{className:"gw-screen gw-play-gate",children:S.jsxs("div",{className:"gw-play-gate-inner",children:[S.jsx("h2",{className:"gw-engage-title",children:"Still arming"}),S.jsx("p",{className:"gw-hint",children:"Match did not start. Retry or open the warcamp."}),S.jsx("button",{type:"button",className:"gw-btn",onClick:()=>{const U=Ju();U.ok?(Af(),l(!0),D("")):D(U.error||"Still blocked")},children:"Retry auto-deploy"}),S.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost",onClick:()=>C("/lobby"),children:"Open warcamp"})]})})',
  "menu stuck → gate with retry",
);

// 4) Gate secondary button → lobby (not only deploy)
rep(
  'onClick:()=>C(Kd),children:"Open march orders"',
  'onClick:()=>C("/lobby"),children:"Open warcamp"',
  "gate → warcamp",
);

// 5) Engage copy clarity
rep(
  'children:"The host awaits your command"',
  'children:"Three lanes · one citadel"',
  "engage subtitle",
);
rep(
  'Click to lock the mouse · press ` to switch to command',
  "Click to lock mouse & fight · press ` for warlord command",
  "engage hint",
);

// 6) Victory return → lobby (minified: C(Kd) is navigate(DEPLOY_PATH))
rep(
  'II.getState().reset(),C(Kd)},children:"RETURN TO WARCAMP"',
  'II.getState().reset(),C("/lobby")},children:"RETURN TO WARCAMP"',
  "victory return → /lobby",
);
rep(
  'II.getState().reset(),C(Kd)},children:"RETURN TO CAMP"',
  'II.getState().reset(),C("/lobby")},children:"RETURN TO WARCAMP"',
  "victory return CAMP → /lobby",
);

// Also RETURN TO CAMP path variants
rep(
  'children:"RETURN TO CAMP"',
  'children:"RETURN TO WARCAMP"',
  "victory CTA label",
);

writeFileSync(BUNDLE, js);
console.log(`[patch-play-flow] wrote ${BUNDLE} (${n} patches)`);

// Bump cache bust on index.html
if (existsSync(HTML)) {
  let html = readFileSync(HTML, "utf8");
  html = html.replace(/index-warlord-fix3\.js\?v=\d+/g, `index-warlord-fix3.js?v=${BUST}`);
  html = html.replace(/index-BNWYZMT1\.css\?v=\d+/g, `index-BNWYZMT1.css?v=${BUST}`);
  writeFileSync(HTML, html);
  console.log(`[patch-play-flow] cache bust v=${BUST}`);
}

console.log("[patch-play-flow] done");
