#!/usr/bin/env node
/**
 * Patch production bundle: fleet URLs, lobby/about UI, canonical player sync.
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "index-warlord-fix2.js");
const OUT = join(ROOT, "assets", "index-warlord-fix3.js");
const INDEX = join(ROOT, "index.html");
const CSS = join(ROOT, "assets", "index-BNWYZMT1.css");

let js = readFileSync(SRC, "utf8");

const replacements = [
  // Route CDN fetches through same-origin Vercel proxy (fixes CORS)
  ['PQ="https://assets.grudge-studio.com"', 'PQ="/api/assets"'],
  // ObjectStore → canonical fleet CDN
  [
    'zz="https://molochdagod.github.io/ObjectStore/api/v1"',
    'zz="https://objectstore.grudge-studio.com/api/v1"',
  ],
  [
    'O6="https://molochdagod.github.io/ObjectStore/api/v1"',
    'O6="https://objectstore.grudge-studio.com/api/v1"',
  ],
  // Intro badges
  [
    'bO=[{id:"r2",label:"Cloudflare R2",detail:"Units · textures · baked anims"},{id:"d1",label:"D1 Heroes",detail:"Canonical warlord roster"},{id:"eng",label:"Grudge Engine",detail:"Manifest-driven stats & mounts"}]',
    'bO=[{id:"r2",label:"Cloudflare R2",detail:"Units · towers · baked anims on assets.grudge-studio.com"},{id:"db",label:"Railway Postgres",detail:"warlord_genesis_players + canonical Grudge API"},{id:"eng",label:"Grudge Engine",detail:"Manifest-driven stats, mounts & lane combat"}]',
  ],
  // Title screen copy
  [
    "children:\"Grudge Nexus · Warlord Genesis\"",
    'children:"Grudge Studio · Warlord Genesis"',
  ],
  [
    'children:"Command three lanes. Raise tiered warbands. Siege with cannon, ballista, and arcane turrets."',
    'children:"Command three lanes. Sync your Grudge ID character. Progress saves to Grudge Studio Railway."',
  ],
  // Lobby header
  [
    'children:"GRUDGE6 viewer characters · Bip001 meshes in battle"',
    'children:"Canonical Grudge characters · Railway player saves · R2 tower assets"',
  ],
];

// CDN reachability probe — same-origin after PQ patch; drop cors mode
js = js.replace(
  'fetch(`${mt.pipeline.cdn}/grudge-nexus/textures/Color_Palette.png`,{method:"HEAD",mode:"cors"})',
  'fetch(`${mt.pipeline.cdn}/grudge-nexus/textures/Color_Palette.png`,{method:"HEAD"})',
);

for (const [from, to] of replacements) {
  if (!js.includes(from)) {
    console.warn("[patch] missing pattern:", from.slice(0, 80));
  } else {
    js = js.replaceAll(from, to);
  }
}

// About panel component (lobby tab)
const ABOUT_COMPONENT = `function WCA(){return d.jsxs("div",{className:"gw-about-panel gw-deploy-panel",children:[d.jsx("span",{className:"gw-deploy-head",children:"About Grudge Studio"}),d.jsxs("p",{className:"gw-about-lead",children:["Warlord Genesis is the ",d.jsx("strong",{children:"Grudge Nexus warcamp"})," — lane-defense RTS on the Grudge Engine with GRUDGE6 viewer heroes, KayKit lane creeps, and canonical player data."]}),d.jsxs("ul",{className:"gw-pipeline-list gw-about-list",children:[d.jsxs("li",{children:[d.jsx("strong",{children:"Live"})," — ",d.jsx("a",{href:"https://warlord-genesis.vercel.app",target:"_blank",rel:"noreferrer",children:"warlord-genesis.vercel.app"})]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Characters"})," — active hero from ",d.jsx("code",{children:"/api/characters"})]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Saves"})," — ",d.jsx("code",{children:"warlord_genesis_players"})," on Railway Postgres"]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Assets"})," — ",d.jsx("code",{children:"assets.grudge-studio.com"})]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Source"})," — ",d.jsx("a",{href:"https://github.com/MolochDaGod/warlord-genesis",target:"_blank",rel:"noreferrer",children:"github.com/MolochDaGod/warlord-genesis"})]})]}),d.jsx("p",{className:"gw-about-muted",children:"Built by MolochDaGod / Grudge Studio — dark-fantasy browser games on Three.js, Vercel, Cloudflare, and Railway."})]})}`;

if (!js.includes("function WCA()")) {
  js = js.replace("function u7(){", `${ABOUT_COMPONENT}function u7(){`);
}

// Lobby About tab
js = js.replace(
  'children:"Hero Codex"})]}),d.jsxs("div",{className:"gw-lobby-grid',
  'children:"Hero Codex"}),d.jsx("button",{type:"button",className:`gw-lobby-tab${Y==="about"?" is-active":""}`,onClick:()=>R("about"),children:"About Studio"})]}),d.jsxs("div",{className:"gw-lobby-grid',
);

js = js.replace(
  "children:Y===\"warcamp\"?d.jsx(h7,{}):Y===\"chest\"?d.jsx(D7,{}):d.jsx(w7,{})",
  'children:Y==="about"?d.jsx(WCA,{}):Y==="warcamp"?d.jsx(h7,{}):Y==="chest"?d.jsx(D7,{}):d.jsx(w7,{})',
);

// Hub About tab
const HUB_ABOUT = `function $CA(){return d.jsxs("div",{className:"gw-hub-body gw-about-hub",children:[d.jsx("h2",{className:"gw-about-title",children:"About Me — Grudge Studio"}),d.jsxs("p",{children:["I'm ",d.jsx("strong",{children:"MolochDaGod"}),", founder of ",d.jsx("strong",{children:"Grudge Studio"}),". Warlord Genesis is our public warcamp prototype: Three.js combat, GRUDGE6 roster, and fleet-backed player saves."]}),d.jsxs("div",{className:"gw-account-grid",children:[d.jsxs("div",{children:[d.jsx("span",{className:"gw-account-k",children:"Game"}),d.jsx("span",{className:"gw-account-v",children:"Warlord Genesis"})]}),d.jsxs("div",{children:[d.jsx("span",{className:"gw-account-k",children:"Engine"}),d.jsx("span",{className:"gw-account-v",children:"Grudge Nexus manifest"})]}),d.jsxs("div",{children:[d.jsx("span",{className:"gw-account-k",children:"Database"}),d.jsx("span",{className:"gw-account-v",children:"Railway Postgres SSOT"})]}),d.jsxs("div",{children:[d.jsx("span",{className:"gw-account-k",children:"Characters"}),d.jsx("span",{className:"gw-account-v",children:"GrudgeBuilder /api/characters"})]})]}),d.jsxs("p",{className:"gw-about-muted",children:["Links: ",d.jsx("a",{href:"https://grudge-studio.com",target:"_blank",rel:"noreferrer",children:"grudge-studio.com"})," · ",d.jsx("a",{href:"https://github.com/MolochDaGod",target:"_blank",rel:"noreferrer",children:"GitHub"})," · ",d.jsx("a",{href:"https://warlord-genesis.vercel.app",target:"_blank",rel:"noreferrer",children:"Play live"})]})]})}`;

if (!js.includes("function $CA()")) {
  // Anchor must include leading `const ` — otherwise we produce `const function $CA`.
  js = js.replace(
    'const JCA=[{key:"account",label:"ACCOUNT",icon:Ji.fist},{key:"codex",label:"CODEX",icon:Ji.chest},{key:"ai",label:"AI WORKER",icon:Ji.chat}]',
    `${HUB_ABOUT}const JCA=[{key:"account",label:"ACCOUNT",icon:Ji.fist},{key:"about",label:"ABOUT",icon:Ji.cup},{key:"codex",label:"CODEX",icon:Ji.chest},{key:"ai",label:"AI WORKER",icon:Ji.chat}]`,
  );
}

js = js.replace(
  'A==="account"&&d.jsx(KCA,{}),A==="codex"&&d.jsx(FCA,{}),A==="ai"&&d.jsx(mCA,{})',
  'A==="account"&&d.jsx(KCA,{}),A==="about"&&d.jsx($CA,{}),A==="codex"&&d.jsx(FCA,{}),A==="ai"&&d.jsx(mCA,{})',
);

// Title screen — open About hub from menu
js = js.replace(
  'onClick:()=>A("codex"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.chest',
  'onClick:()=>A("about"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.cup,alt:"",draggable:!1}),"ABOUT STUDIO"]}),d.jsxs("button",{className:"gw-btn gw-btn-ghost gw-btn-mini",onClick:()=>A("codex"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.chest',
);

// Cloud save + canonical character bridge.
// Name must NOT be a short minified id (e.g. gO is already NavLink in the bundle).
const CLOUD_SYNC = `async function WgFleetSync(C){try{const A=await fetch("/api/grudge/player/save?grudgeId="+encodeURIComponent(C.grudgeId),{credentials:"same-origin"});if(A.ok){const I=await A.json(),g=I?.save;if(g&&Object.keys(g).length){const i=zC.getState(),e={onboardingDone:g.onboardingDone??i.onboardingDone,starterPrefabId:g.starterPrefabId??i.starterPrefabId,gbux:g.gbux??i.gbux,cards:g.cards??i.cards,lastDailyClaim:g.lastDailyClaim??i.lastDailyClaim,lastMatchReward:g.lastMatchReward??i.lastMatchReward};JSON.stringify(i)!==JSON.stringify(e)&&zC.setState(e)}}const t=await fetch("/api/grudge/characters/active",{credentials:"same-origin"});if(t.ok){const Q=await t.json();Q?.character?.raceId&&XI.getState().setGrudgeHandoff(Q.character)}}catch{}}`;

if (!js.includes("async function WgFleetSync(")) {
  js = js.replace("const Rh=ca(C=>({", `${CLOUD_SYNC}const Rh=ca(C=>({`);
}

js = js.replace(
  "restore:async()=>{C({loading:!0});try{const A=await kO();if(A){C({user:A,loading:!1});return}const I=await cO();C({user:I,loading:!1})}catch{C({user:null,loading:!1})}}",
  "restore:async()=>{C({loading:!0});try{const A=await kO();if(A){C({user:A,loading:!1}),await WgFleetSync(A);return}const I=await cO();C({user:I,loading:!1}),I&&await WgFleetSync(I)}catch{C({user:null,loading:!1})}}",
);

if (!js.includes("let WgSaveTimer=null")) {
  js = js.replace(
    "zC.subscribe(C=>Fz({onboardingDone:C.onboardingDone,starterPrefabId:C.starterPrefabId,gbux:C.gbux,cards:C.cards,lastDailyClaim:C.lastDailyClaim,lastMatchReward:C.lastMatchReward}));",
    `let WgSaveTimer=null,WgLastSave="";zC.subscribe(C=>{Fz({onboardingDone:C.onboardingDone,starterPrefabId:C.starterPrefabId,gbux:C.gbux,cards:C.cards,lastDailyClaim:C.lastDailyClaim,lastMatchReward:C.lastMatchReward});const A=Rh.getState().user?.grudgeId;if(!A)return;const I=JSON.stringify({grudgeId:A,save:{onboardingDone:C.onboardingDone,starterPrefabId:C.starterPrefabId,gbux:C.gbux,cards:C.cards,lastDailyClaim:C.lastDailyClaim,lastMatchReward:C.lastMatchReward}});if(I===WgLastSave)return;clearTimeout(WgSaveTimer);WgSaveTimer=setTimeout(()=>{WgLastSave=I;fetch("/api/grudge/player/save",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:I}).catch(()=>{})},1500)});`,
  );
}

// Lobby hub button for About
js = js.replace(
  'onClick:()=>t("codex"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.chest,alt:"",draggable:!1}),"CODEX"]',
  'onClick:()=>t("about"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.cup,alt:"",draggable:!1}),"ABOUT"]}),d.jsxs("button",{type:"button",className:"gw-btn gw-btn-ghost gw-btn-mini",onClick:()=>t("codex"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.chest,alt:"",draggable:!1}),"CODEX"]',
);

writeFileSync(OUT, js);
console.log("[patch] wrote", OUT, `(${js.length} bytes)`);

let html = readFileSync(INDEX, "utf8");
const BUNDLE_BUST = "7";
html = html.replace(
  /index-warlord-fix\d\.js(?:\?v=[^"']+)?/g,
  `index-warlord-fix3.js?v=${BUNDLE_BUST}`,
);
html = html.replace(/index-BNWYZMT1\.css(?:\?v=\d+)?/, `index-BNWYZMT1.css?v=${BUNDLE_BUST}`);
writeFileSync(INDEX, html);

let css = readFileSync(CSS, "utf8");
if (!css.includes(".gw-about-panel")) {
  css += `
.gw-about-panel{margin-top:.5rem}
.gw-about-lead{color:var(--gw-muted,#a8b0c0);line-height:1.55;margin:.5rem 0 1rem}
.gw-about-list{margin:.25rem 0 1rem}
.gw-about-muted{color:var(--gw-muted,#8b93a7);font-size:.85rem;margin-top:.75rem}
.gw-about-muted a,.gw-about-list a{color:var(--gw-accent,#6ee7b7)}
.gw-about-hub .gw-about-title{margin:0 0 .75rem;font-size:1.1rem}
.gw-about-hub p{line-height:1.55;color:var(--gw-muted,#a8b0c0)}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended about styles to CSS");
}