/**
 * Patch the CURRENT live production bundle for lobby + play safety,
 * then write assets/index-warlord-fix3.js + bump index.html cache bust.
 *
 * Usage:
 *   node scripts/patch-lobby-fix.mjs [path-to-prod-bundle.js]
 * Default input: %TEMP%/prod-bundle.js (download from production first).
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "index-warlord-fix3.js");
const HTML = join(ROOT, "index.html");
const BUST = "72";
const input =
  process.argv[2] ||
  join(process.env.TEMP || "/tmp", "prod-bundle.js");

if (!existsSync(input)) {
  console.error("[patch-lobby-fix] missing input bundle:", input);
  console.error("  curl the live file first:");
  console.error(
    '  curl -o %TEMP%\\prod-bundle.js "https://warlord-genesis.vercel.app/assets/index-warlord-fix3.js?v=70"',
  );
  process.exit(1);
}

let js = readFileSync(input, "utf8");
const before = js.length;
let n = 0;

function rep(from, to, label) {
  if (!js.includes(from)) {
    console.warn("[patch-lobby-fix] MISS", label);
    return false;
  }
  const count = js.split(from).length - 1;
  js = js.split(from).join(to);
  n += count;
  console.log(`[patch-lobby-fix] OK x${count}`, label);
  return true;
}

// --- Auth safety: stop wiping fleet tokens ---
rep(
  'const _0="gw_site_data_cleared_v68",MO=["gw_","wg-","wg_","engine_boot_","grudge_","puter"]',
  'const _0="gw_site_data_cleared_v69",MO=["gw_","wg-","wg_","engine_boot_"]',
  "clearSiteData: no grudge_/puter wipe",
);
rep(
  'return C==="DIFFICULTY"||C.includes("warlord")||C.includes("grudge-warlords")||C.includes("weapon_tuning")',
  'return C==="DIFFICULTY"||C==="gw_roster_v1"||C==="gw_roster_v2"||C==="gw_meta_v1"||C.includes("weapon_tuning")',
  "clearKey narrow",
);

// --- Intro flow ---
rep(
  'onClick:()=>C(Kd),children:"ENTER THE WARCAMP"',
  'onClick:()=>C("/lobby"),children:"ENTER THE WARCAMP"',
  "intro → /lobby",
);
if (!js.includes("QUICK BATTLE")) {
  rep(
    'onClick:()=>C("/mp"),children:"WAGE WAR ONLINE"',
    'onClick:()=>C("/play?skirmish=1"),children:"QUICK BATTLE"}),S.jsx("button",{className:"gw-btn gw-btn-ghost gw-intro-cta-secondary",onClick:()=>C("/mp"),children:"WAGE WAR ONLINE"',
    "intro QUICK BATTLE",
  );
}

// --- Lobby: origins URL (404 today) → try /api/origins then fail soft ---
// Common minified patterns for the origins constant
rep(
  'https://api.grudge-studio.com/origins',
  "https://api.grudge-studio.com/api/health",
  "origins URL → health (soft probe; lobby catches failures)",
);

// --- Lobby crash: playerFaction.color when H undefined ---
// Minified: const H=Il[Q],T=Il[s]
// Replace with safe fallbacks: H=Il[Q]||Object.values(Il)[0]
rep(
  "const H=Il[Q],T=Il[s]",
  'const H=Il[Q]||Object.values(Il)[0]||{name:"Crusade",color:"#d4a84b",id:"crusade"},T=Il[s]||Object.values(Il)[1]||H',
  "lobby faction safe fallbacks",
);

// --- Play stuck spinner ---
rep(
  'if(I==="menu")return S.jsx("div",{className:"gw-screen gw-play-boot",children:S.jsxs("div",{className:"gw-play-boot-inner",children:[S.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),S.jsx("span",{className:"gw-hint",children:"Entering the field…"})]})})',
  'if(I==="menu")return S.jsx("div",{className:"gw-screen gw-play-gate",children:S.jsxs("div",{className:"gw-play-gate-inner",children:[S.jsx("h2",{className:"gw-engage-title",children:"Still arming"}),S.jsx("p",{className:"gw-hint",children:"Match did not start. Retry or open the warcamp."}),S.jsx("button",{type:"button",className:"gw-btn",onClick:()=>{const U=Ju();U.ok?(Af(),l(!0),D("")):D(U.error||"Still blocked")},children:"Retry auto-deploy"}),S.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost",onClick:()=>C("/lobby"),children:"Open warcamp"})]})})',
  "play menu stuck → gate",
);
rep(
  'onClick:()=>C(Kd),children:"Open march orders"',
  'onClick:()=>C("/lobby"),children:"Open warcamp"',
  "play gate → lobby",
);

// Victory return
rep(
  'II.getState().reset(),C(Kd)},children:"RETURN TO CAMP"',
  'II.getState().reset(),C("/lobby")},children:"RETURN TO WARCAMP"',
  "victory → lobby",
);
rep(
  'II.getState().reset(),C(Kd)},children:"RETURN TO WARCAMP"',
  'II.getState().reset(),C("/lobby")},children:"RETURN TO WARCAMP"',
  "victory → lobby (warcamp label)",
);

// Engage copy
rep(
  'children:"The host awaits your command"',
  'children:"Three lanes · one citadel"',
  "engage subtitle",
);

writeFileSync(OUT, js);
console.log(`[patch-lobby-fix] ${before} → ${js.length} bytes, ${n} replacements → ${OUT}`);

if (existsSync(HTML)) {
  let html = readFileSync(HTML, "utf8");
  html = html
    .replace(/index-warlord-fix\d+\.js\?v=\d+/g, `index-warlord-fix3.js?v=${BUST}`)
    .replace(/index-BNWYZMT1\.css\?v=\d+/g, `index-BNWYZMT1.css?v=${BUST}`);
  writeFileSync(HTML, html);
  console.log(`[patch-lobby-fix] index.html bust v=${BUST}`);
}

// sanity
const must = [
  ["v69", js.includes("gw_site_data_cleared_v69")],
  ["no auth wipe", !js.includes('"grudge_","puter"')],
  ["lobby CTA", js.includes('C("/lobby"),children:"ENTER THE WARCAMP"')],
  ["faction safe", js.includes("Object.values(Il)[0]")],
];
for (const [k, ok] of must) console.log(ok ? "✓" : "✗", k);
if (must.some(([, ok]) => !ok)) process.exit(2);
console.log("[patch-lobby-fix] done");
