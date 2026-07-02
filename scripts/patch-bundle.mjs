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

// Baked anim loader — warn + null instead of uncaught throw (battle can still boot)
js = js.replace(
  'async function zc(C){const A=R6(C),I=await fetch(A);if(!I.ok)throw new Error(`Baked clip ${A} HTTP ${I.status}`);const g=await I.json();return b6(oa.parse(g))}',
  'async function zc(C){const A=R6(C),I=await fetch(A);if(!I.ok){console.warn(`[warlord] baked clip missing ${A} (${I.status})`);return null}try{const g=await I.json();return b6(oa.parse(g))}catch(e){console.warn(`[warlord] baked clip parse failed ${A}`,e);return null}}',
);

// Animation pack binder — skip null clips instead of clipAction(null) crash
js = js.replace(
  'async function pY(C,A){const I=sx[A],[g,i,e,t,Q]=await Promise.all([zc(I.idle),zc(I.walk),zc(I.run),zc(I.sprint),zc(N6[A])]),o={idle:g,walk:i,run:e,sprint:t};return{director:new G6(C,o),attackClip:Q,actions:{idle:C.clipAction(g),walk:C.clipAction(i),run:C.clipAction(e),attack:C.clipAction(Q)}}}',
  'async function pY(C,A){const I=sx[A],[g,i,e,t,Q]=await Promise.all([zc(I.idle),zc(I.walk),zc(I.run),zc(I.sprint),zc(N6[A])]),o={idle:g,walk:i,run:e,sprint:t},f=g||i||e||t||Q,s=a=>a?C.clipAction(a):f?C.clipAction(f):null;return{director:new G6(C,o),attackClip:Q,actions:{idle:s(g),walk:s(i),run:s(e),attack:s(Q)}}}',
);

// Standard Grudge fleet auth — /api/auth/* rewrites to grudge-api (JWT in body, not cookies).
js = js.replace('GN="/api/grudge/auth"', 'GN="/api/auth"');
js = js.replace(
  'async function nO(C,A){const I=await fetch(`${GN}${C}`,{method:"POST",headers:{"Content-Type":"application/json","X-Grudge-Client":"web"},body:A?JSON.stringify(A):"{}",credentials:"same-origin"}),g=await I.json();if(!I.ok)throw new Error(g.error||`Request failed (${I.status})`);return g}',
  'async function nO(C,A){const I=await fetch(`${GN}${C}`,{method:"POST",headers:{"Content-Type":"application/json","X-Grudge-Client":"web"},body:A?JSON.stringify(A):"{}",credentials:"same-origin"}),g=await I.json();if(!I.ok)throw new Error(g.error||g.message||`Request failed (${I.status})`);const t=g.token||g.sessionToken;t&&cq(t);const u=yO(g.user||g);return(g.username?.toLowerCase?.()==="guest"||String(A?.puterId||"").startsWith("guest_"))?{...u,role:"guest"}:u}',
);
js = js.replace(
  'function lO(){return nO("/guest",{deviceId:rO()})}',
  'function lO(){const d=rO(),p=`guest_${d.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,48)}`;return nO("/puter",{puterId:p,displayName:"Guest"})}',
);
js = js.replace(
  "async function cO(){const C=await fetch(`${GN}/me`,{credentials:\"same-origin\"});return C.ok?await C.json():null}",
  'async function cO(){const C=SO();if(!C)return null;const I=await fetch(`${GN}/me`,{credentials:"same-origin",headers:{Authorization:`Bearer ${C}`}});if(!I.ok){I.status===401&&NN();return null}const g=await I.json();return yO(g.user||g)}',
);

js = js.replace(
  'async function kO(){const C=SO();if(!C)return null;try{return await hq(C)}catch{return NN(),null}}',
  'async function kO(){const C=SO();if(!C)return null;const I=await cO();if(!I)return NN(),null;return I}',
);

// Title screen — compact viewport-fit landing with visible Puter/guest auth (before copy replacements)
function sliceFunction(source, name) {
  const marker = `function ${name}()`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let braces = 0;
  let started = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") {
      braces++;
      started = true;
    }
    if (source[i] === "}") {
      braces--;
      if (started && braces === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}
const TITLE_XO_ORIG = sliceFunction(js, "xO");
const TITLE_XO_NEW =
  'function xO(){const C=Fh(),A=MN(o=>o.openHub),I=Rh(o=>o.user),g=Rh(o=>o.loading),i=Rh(o=>o.error),e=Rh(o=>o.guest),t=Rh(o=>o.signInWithPuter),[Q,o]=T.useState(!0),[s,l]=T.useState(!1);T.useEffect(()=>{WS().then(h=>{l(h.cdnReachable),o(!1)})},[]);return d.jsxs("div",{className:"gw-screen gw-title-v3",children:[d.jsx("div",{className:"gw-title-bg","aria-hidden":!0}),d.jsxs("header",{className:"gw-auth-bar",children:[d.jsx("span",{className:"gw-auth-brand",children:"Grudge Studio"}),d.jsxs("div",{className:"gw-auth-actions",children:[g&&d.jsx("span",{className:"gw-auth-pill is-loading",children:"Connecting session…"}),!g&&I&&d.jsxs("span",{className:"gw-auth-pill is-ok",title:I.grudgeId,children:[I.role==="guest"?"Guest":"Account"," · ",I.displayName||I.username]}),!g&&!I&&d.jsx("span",{className:"gw-auth-pill is-warn",children:"Not signed in"}),!g&&!I&&d.jsx("button",{type:"button",className:"gw-auth-btn",onClick:e,children:"Continue as guest"}),d.jsx("button",{type:"button",className:"gw-auth-btn gw-auth-btn-puter",onClick:t,disabled:g,children:"Sign in with Puter"})]})]}),d.jsxs("main",{className:"gw-title-main",children:[d.jsx("p",{className:"gw-title-eyebrow",children:"Warlord Genesis · Three-lane RTS"}),d.jsxs("h1",{className:"gw-title-headline",children:["GRUDGE ",d.jsx("span",{children:"WARLORDS"})]}),d.jsx("p",{className:"gw-title-lead",children:"Pick your champion in the warcamp, deploy lane waves, and siege the enemy citadel."}),i&&d.jsx("p",{className:"gw-title-error",children:i}),d.jsxs("div",{className:"gw-title-ctas",children:[d.jsx("button",{type:"button",className:"gw-btn gw-title-play",onClick:()=>C("/lobby"),children:g?"Preparing…":"Enter the Warcamp"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-secondary",onClick:()=>C("/mp"),children:"Multiplayer"})]}),d.jsxs("div",{className:"gw-title-chips",children:[d.jsx("span",{className:"gw-title-chip",children:Q?"Booting engine…":"Engine v"+mt.version}),d.jsx("span",{className:"gw-title-chip",children:s?"CDN assets online":"Local assets"}),d.jsx("span",{className:"gw-title-chip",children:"Puter login · Railway saves"})]})]}),d.jsxs("footer",{className:"gw-title-footer",children:[d.jsx("button",{type:"button",className:"gw-footer-link",onClick:()=>A("account"),children:"Account"}),d.jsx("button",{type:"button",className:"gw-footer-link",onClick:()=>A("codex"),children:"Codex"}),d.jsx("button",{type:"button",className:"gw-footer-link",onClick:()=>A("about"),children:"About"})]})]})}';
if (TITLE_XO_ORIG && js.includes(TITLE_XO_ORIG)) {
  js = js.replace(TITLE_XO_ORIG, TITLE_XO_NEW);
} else {
  console.warn("[patch] title screen pattern missing — xO not replaced");
}

for (const [from, to] of replacements) {
  if (!js.includes(from)) {
    console.warn("[patch] missing pattern:", from.slice(0, 80));
  } else {
    js = js.replaceAll(from, to);
  }
}

// FBX models reference WK_StandardUnits_Textures.psd beside the .FBX — remap to webp atlas on CDN.
if (js.includes("const Jb=new rK;")) {
  js = js.replace(
    "const Jb=new rK;",
    'const Jb=new rK;Jb.setURLModifier(u=>/StandardUnits_Textures\\.psd/i.test(u)?u.replace(/\\/models\\/characters\\/[^?#]+$/i,"/textures/WK_Standard_Units.webp"):u);',
  );
} else {
  console.warn("[patch] LoadingManager hook missing — PSD remap skipped");
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

// Puter login + cloud save bridge. Avoid short minified ids (gO is NavLink).
const CLOUD_SYNC = `async function WgPuterSignIn(){const w=typeof window<"u"?window.puter:null;if(!w?.auth)throw new Error("Puter SDK is still loading — wait a moment and retry.");try{if(!w.auth.isSignedIn?.())await w.auth.signIn()}catch(e){const m=e instanceof Error?e.message:String(e);throw new Error(/cancel|closed/i.test(m)?"Sign-in cancelled.":"Puter sign-in failed. Allow popups for warlord-genesis.vercel.app and retry.")}const u=await w.auth.getUser();if(!u?.uuid)throw new Error("Sign-in cancelled.");return nO("/puter",{puterId:u.uuid,displayName:u.username||u.name||"Puter"})}async function WgFleetSync(C){try{const tok=SO(),hdr=tok?{Authorization:\`Bearer \${tok}\`}:{},A=await fetch("/api/grudge/player/save?grudgeId="+encodeURIComponent(C.grudgeId),{credentials:"same-origin",headers:hdr});if(A.ok){const I=await A.json(),g=I?.save;if(g?.onboardingDone){const i=zC.getState(),e={onboardingDone:!0,starterPrefabId:g.starterPrefabId??i.starterPrefabId,gbux:typeof g.gbux==="number"?g.gbux:i.gbux,cards:Array.isArray(g.cards)?g.cards:i.cards,lastDailyClaim:g.lastDailyClaim??i.lastDailyClaim,lastMatchReward:g.lastMatchReward??i.lastMatchReward};(e.onboardingDone!==i.onboardingDone||e.starterPrefabId!==i.starterPrefabId||e.gbux!==i.gbux)&&zC.setState(e)}}const t=await fetch("/api/grudge/characters/active",{credentials:"same-origin",headers:hdr});if(t.ok){const Q=await t.json();Q?.character?.raceId&&XI.getState().setGrudgeHandoff(Q.character)}}catch{}}`;

if (!js.includes("async function WgFleetSync(")) {
  js = js.replace("const Rh=ca(C=>({", `${CLOUD_SYNC}const Rh=ca(C=>({`);
}

const RESTORE_ORIG =
  "restore:async()=>{C({loading:!0});try{const A=await kO();if(A){C({user:A,loading:!1});return}const I=await cO();C({user:I,loading:!1})}catch{C({user:null,loading:!1})}}";
const RESTORE_PATCHED =
  'restore:async()=>{C({loading:!0,error:null});try{const A=await kO();if(A){C({user:A,loading:!1}),await WgFleetSync(A);return}const I=await cO();if(I){C({user:I,loading:!1}),await WgFleetSync(I);return}const g=await lO();C({user:g,loading:!1}),await WgFleetSync(g)}catch(e){C({user:null,loading:!1,error:e instanceof Error?e.message:"Could not start session"})}}';
if (js.includes(RESTORE_ORIG)) {
  js = js.replace(RESTORE_ORIG, RESTORE_PATCHED);
} else {
  js = js.replace(
    'restore:async()=>{C({loading:!0,error:null});try{const A=await kO();if(A){C({user:A,loading:!1}),await WgFleetSync(A);return}const I=await cO();if(I){C({user:I,loading:!1}),await WgFleetSync(I);return}const g=await lO();C({user:g,loading:!1}),await WgFleetSync(g)}catch(e){C({user:null,loading:!1,error:e instanceof Error?e.message:"Could not start session"})}}',
    RESTORE_PATCHED,
  );
}

js = js.replace(
  "signInWithStudio:()=>xR(C,fO),signOut:",
  "signInWithStudio:()=>xR(C,fO),signInWithPuter:()=>xR(C,WgPuterSignIn),signOut:",
);

js = js.replace(
  'guest:g,signInWithStudio:i,signOut:e}=Rh()',
  "guest:g,signInWithPuter:i,signOut:e}=Rh()",
);
js = js.replace(
  "Sign in with Grudge Studio to claim your Grudge ID. Your account and progress are scoped to your Grudge Studio identity.",
  "Sign in with Puter to claim your Grudge ID. Progress syncs to Grudge Studio Railway and follows you across devices.",
);
js = js.replace(
  'children:A?"WORKING...":"SIGN IN WITH GRUDGE STUDIO"',
  'children:A?"WORKING...":"SIGN IN WITH PUTER"',
);
js = js.replace(
  "You are playing as a guest. Sign in with Grudge Studio to keep your progress across devices.",
  "Playing as guest. Sign in with Puter to keep progress across devices.",
);

js = js.replace(
  "gbuxRef.current!==v&&(gbuxRef.current=v,F(v))},[Q?.gbuxBalance,F])",
  "gbuxRef.current!==v&&(gbuxRef.current=v,zC.getState().syncGbuxFromAccount(v))},[Q?.gbuxBalance])",
);

if (!js.includes("let WgSaveTimer=null")) {
  js = js.replace(
    "zC.subscribe(C=>Fz({onboardingDone:C.onboardingDone,starterPrefabId:C.starterPrefabId,gbux:C.gbux,cards:C.cards,lastDailyClaim:C.lastDailyClaim,lastMatchReward:C.lastMatchReward}));",
    `let WgSaveTimer=null,WgLastSave="",WgLocalSnap="";zC.subscribe(C=>{const snap=JSON.stringify({onboardingDone:C.onboardingDone,starterPrefabId:C.starterPrefabId,gbux:C.gbux,cards:C.cards,lastDailyClaim:C.lastDailyClaim,lastMatchReward:C.lastMatchReward});if(snap===WgLocalSnap)return;WgLocalSnap=snap;Fz({onboardingDone:C.onboardingDone,starterPrefabId:C.starterPrefabId,gbux:C.gbux,cards:C.cards,lastDailyClaim:C.lastDailyClaim,lastMatchReward:C.lastMatchReward});const A=Rh.getState().user?.grudgeId;if(!A)return;const I=JSON.stringify({grudgeId:A,save:{onboardingDone:C.onboardingDone,starterPrefabId:C.starterPrefabId,gbux:C.gbux,cards:C.cards,lastDailyClaim:C.lastDailyClaim,lastMatchReward:C.lastMatchReward}});if(I===WgLastSave)return;clearTimeout(WgSaveTimer);WgSaveTimer=setTimeout(()=>{WgLastSave=I;fetch("/api/grudge/player/save",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:I}).catch(()=>{})},1500)});`,
  );
}

// Lobby hub button for About
js = js.replace(
  'onClick:()=>t("codex"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.chest,alt:"",draggable:!1}),"CODEX"]',
  'onClick:()=>t("about"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.cup,alt:"",draggable:!1}),"ABOUT"]}),d.jsxs("button",{type:"button",className:"gw-btn gw-btn-ghost gw-btn-mini",onClick:()=>t("codex"),children:[d.jsx("img",{className:"gw-btn-icon",src:Ji.chest,alt:"",draggable:!1}),"CODEX"]',
);

// React #185 — shardProgress() returns a new object every snapshot; use primitive selectors.
const SHARD_FIXES = [
  [
    "const{shards:t,need:Q,level:o}=zC(F=>F.shardProgress(\"character\",C.id)),",
    'const o=zC(F=>(F.cards.find(e=>e.kind==="character"&&e.id===C.id)?.level??0)),t=zC(F=>(F.cards.find(e=>e.kind==="character"&&e.id===C.id)?.shards??0)),Q=o===0?JS:BS,',
  ],
  [
    "const{shards:e,need:t,level:Q}=zC(l=>l.shardProgress(\"lane_guard\",C)),",
    'const Q=zC(l=>(l.cards.find(h=>h.kind==="lane_guard"&&h.id===C)?.level??0)),e=zC(l=>(l.cards.find(h=>h.kind==="lane_guard"&&h.id===C)?.shards??0)),t=Q===0?JS:BS,',
  ],
  [
    "{shards:o,need:s,level:l}=zC(w=>w.shardProgress(\"character\",C.id)),",
    "l=zC(w=>(w.cards.find(u=>u.kind===\"character\"&&u.id===C.id)?.level??0)),o=zC(w=>(w.cards.find(u=>u.kind===\"character\"&&u.id===C.id)?.shards??0)),s=l===0?JS:BS,",
  ],
];
for (const [from, to] of SHARD_FIXES) {
  if (!js.includes(from)) console.warn("[patch] shard selector missing:", from.slice(0, 60));
  else js = js.replace(from, to);
}

writeFileSync(OUT, js);
console.log("[patch] wrote", OUT, `(${js.length} bytes)`);

let html = readFileSync(INDEX, "utf8");
const BUNDLE_BUST = "15";
html = html.replace(
  /index-warlord-fix\d\.js(?:\?v=[^"']+)?/g,
  `index-warlord-fix3.js?v=${BUNDLE_BUST}`,
);
html = html.replace(/index-BNWYZMT1\.css(?:\?v=\d+)?/, `index-BNWYZMT1.css?v=${BUNDLE_BUST}`);
writeFileSync(INDEX, html);

let css = readFileSync(CSS, "utf8");
if (!css.includes(".gw-title-v3")) {
  css += `
html,body,#root{height:100%;margin:0;padding:0}
body{background:#080c14}
.gw-title-v3{display:flex;flex-direction:column;align-items:stretch;justify-content:space-between;padding:0;overflow:hidden}
.gw-title-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 90% 55% at 50% 0%,rgba(224,178,82,.14) 0%,transparent 55%),linear-gradient(180deg,#0a0f18 0%,#060910 100%)}
.gw-auth-bar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px clamp(16px,4vw,32px);border-bottom:1px solid rgba(120,150,200,.18);background:rgba(6,9,14,.82);backdrop-filter:blur(8px)}
.gw-auth-brand{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8fa3c4;font-weight:700}
.gw-auth-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.gw-auth-pill{font-size:11px;padding:6px 10px;border-radius:999px;border:1px solid rgba(120,150,200,.25);color:#c8d4e8;max-width:min(240px,42vw);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gw-auth-pill.is-loading{border-color:rgba(224,178,82,.35);color:#e0c878}
.gw-auth-pill.is-ok{border-color:rgba(110,231,183,.35);color:#9dffd8}
.gw-auth-pill.is-warn{border-color:rgba(251,146,60,.35);color:#fdba74}
.gw-auth-btn{font-size:11px;padding:6px 12px;border-radius:8px;border:1px solid rgba(120,150,200,.3);background:rgba(14,20,32,.9);color:#dce6f4;cursor:pointer;font-family:inherit}
.gw-auth-btn:hover{border-color:rgba(224,178,82,.5)}
.gw-auth-btn-puter{border-color:rgba(110,231,183,.45);color:#9dffd8}
.gw-title-main{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:clamp(10px,2vh,18px);padding:clamp(16px,4vh,32px) clamp(20px,5vw,40px);max-width:640px;margin:0 auto;width:100%}
.gw-title-eyebrow{margin:0;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#7f93b4}
.gw-title-headline{margin:0;font-family:Cinzel Decorative,serif;font-size:clamp(2rem,8vw,3.4rem);line-height:1.05;color:#f0e6d0;font-weight:900}
.gw-title-headline span{color:#e0b852}
.gw-title-lead{margin:0;max-width:36ch;font-size:clamp(.95rem,2.5vw,1.1rem);line-height:1.55;color:#a8b8d0}
.gw-title-error{margin:0;padding:8px 12px;border-radius:8px;background:rgba(180,40,40,.2);border:1px solid rgba(248,113,113,.35);color:#fecaca;font-size:.9rem;max-width:100%}
.gw-title-ctas{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:320px}
.gw-title-play{width:100%;padding:16px 24px;font-size:1.05rem;letter-spacing:.06em}
.gw-title-secondary{width:100%;padding:10px 20px;font-size:.9rem}
.gw-title-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px}
.gw-title-chip{font-size:10px;letter-spacing:.08em;padding:5px 10px;border-radius:999px;border:1px solid rgba(120,150,200,.2);color:#8fa3c4;background:rgba(8,12,20,.6)}
.gw-title-footer{position:relative;z-index:2;display:flex;justify-content:center;gap:20px;padding:14px;border-top:1px solid rgba(120,150,200,.15);background:rgba(6,9,14,.75)}
.gw-footer-link{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8fa3c4;background:none;border:none;cursor:pointer;font-family:inherit;padding:4px 8px}
.gw-footer-link:hover{color:#e0b852}
@media (max-height:700px){.gw-title-lead{display:none}.gw-title-chips{gap:6px}.gw-auth-bar{padding:8px 16px}}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended title-v3 layout styles");
}
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