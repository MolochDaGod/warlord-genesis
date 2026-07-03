#!/usr/bin/env node
/**
 * Patch production bundle: fleet URLs, lobby/about UI, canonical player sync.
 */
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "deploy-manifest.json");
const SRC = join(ROOT, "assets", "index-warlord-fix2.js");
const OUT = join(ROOT, "assets", "index-warlord-fix3.js");
const INDEX = join(ROOT, "index.html");
const CSS = join(ROOT, "assets", "index-BNWYZMT1.css");

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const patchFailures = [];
function mustPatch(id, ok) {
  if (!ok) patchFailures.push(id);
}

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

// Unit palette + CDN probe — local file (CDN /api/assets returns 403/HTML).
js = js.replace(
  'unitPalette:`${PQ}/grudge-nexus/textures/Color_Palette.png`',
  'unitPalette:"/models/units/Color_Palette.png"',
);
js = js.replace(
  'fetch(`${mt.pipeline.cdn}/grudge-nexus/textures/Color_Palette.png`,{method:"HEAD",mode:"cors"})',
  'fetch("/models/units/Color_Palette.png",{method:"HEAD"})',
);
js = js.replace(
  "try{A=(await fetch(`${mt.pipeline.cdn}/grudge-nexus/textures/Color_Palette.png`,{method:\"HEAD\"})).ok}catch{A=!1}",
  'try{const r=await fetch("/models/units/Color_Palette.png",{method:"HEAD"});A=r.ok&&/image\\//i.test(r.headers.get("content-type")||"")}catch{A=!1}',
);

// Baked clips ship from this deploy (/anims/baked), not the broken CDN proxy.
js = js.replaceAll("${PQ}/anims/baked/", "/anims/baked/");

// Baked anim loader — warn + null instead of uncaught throw (battle can still boot)
js = js.replace(
  'async function zc(C){const A=R6(C),I=await fetch(A);if(!I.ok)throw new Error(`Baked clip ${A} HTTP ${I.status}`);const g=await I.json();return b6(oa.parse(g))}',
  'async function zc(C){const A=R6(C),I=await fetch(A);if(!I.ok){console.warn(`[warlord] baked clip missing ${A} (${I.status})`);return null}try{const g=await I.json();return b6(oa.parse(g))}catch(e){console.warn(`[warlord] baked clip parse failed ${A}`,e);return null}}',
);

// Animation pack binder — skip null clips instead of clipAction(null) crash
js = js.replace(
  'async function pY(C,A){const I=sx[A],[g,i,e,t,Q]=await Promise.all([zc(I.idle),zc(I.walk),zc(I.run),zc(I.sprint),zc(N6[A])]),o={idle:g,walk:i,run:e,sprint:t},f=g||i||e||t||Q,s=a=>a?C.clipAction(a):f?C.clipAction(f):null;return{director:new G6(C,o),attackClip:Q,actions:{idle:s(g),walk:s(i),run:s(e),attack:s(Q)}}}',
  'async function pY(C,A){const I=sx[A],[g,i,e,t,Q]=await Promise.all([zc(I.idle),zc(I.walk),zc(I.run),zc(I.sprint),zc(N6[A])]),f=g||i||e||t||Q,o={idle:g||f,walk:i||f,run:e||f,sprint:t||f},s=a=>a?C.clipAction(a):f?C.clipAction(f):null;return{director:new G6(C,o),attackClip:Q,actions:{idle:s(g),walk:s(i),run:s(e),attack:s(Q)}}}',
);

// AnimationDirector — tolerate missing individual locomotion clips
js = js.replace(
  "constructor(A,I){this.mixer=A;const g=i=>{const e=A.clipAction(i);return e.setLoop(cr,1/0),e.enabled=!0,e.setEffectiveWeight(0),e.play(),e};this.loco={idle:g(I.idle),walk:g(I.walk),run:g(I.run),sprint:g(I.sprint)},this.loco.idle.setEffectiveWeight(1)",
  "constructor(A,I){this.mixer=A;const g=i=>{if(!i)return null;const e=A.clipAction(i);return e.setLoop(cr,1/0),e.enabled=!0,e.setEffectiveWeight(0),e.play(),e},f=I.idle||I.walk||I.run||I.sprint;this.loco={idle:g(I.idle||f),walk:g(I.walk||f),run:g(I.run||f),sprint:g(I.sprint||f)},this.loco.idle?.setEffectiveWeight(1)",
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
  mustPatch("title-v3", true);
} else {
  mustPatch("title-v3", js.includes("gw-screen gw-title-v3"));
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

// GRUDGE6 hero meshes — fleet CDN (/api/assets proxy returns SPA HTML).
js = js.replace(
  "function K6(C){const A=fH[C];if(!A)throw new Error(`Unknown race repo: ${C}`);return`${PQ}/assets/${A.folder}/models/characters/${A.modelFile}`}",
  "function K6(C){const A=fH[C];if(!A)throw new Error(`Unknown race repo: ${C}`);return`https://assets.grudge-studio.com/assets/${A.folder}/models/characters/${A.modelFile}`}",
);
js = js.replace(
  "function F6(C){const A=fH[C];if(!A)throw new Error(`Unknown race repo: ${C}`);return`${PQ}/assets/${A.folder}/textures/${A.textureFile}`}",
  "function F6(C){const A=fH[C];if(!A)throw new Error(`Unknown race repo: ${C}`);return`https://assets.grudge-studio.com/assets/${A.folder}/textures/${A.textureFile}`}",
);

// /play boot — persist active match + auto-onboard + one-click deploy.
const PLAY_HELPERS = `function WgAutoOnboard(){const s=zC.getState();if(s.onboardingDone)return!0;const p=s.starterPrefabId||"sir-aldric-valorheart";if(!Da[p])return!1;const c=qe.find(h=>h.id===p);if(!c)return!1;s.completeStarterPick(p),XI.getState().setFaction(c.faction),XI.getState().setPrefab(p),Yz(p,XI.getState().setMelee,XI.getState().setRanged,XI.getState().setGearTier),zC.getState().seedDefaultLaneGuards(c.faction);return!0}function WgDeployAndPlay(){WgAutoOnboard();const x=XI.getState();x.loadoutLocked||x.lockLoadout(),BI.getState().startGame();return!0}`;
if (!js.includes("function WgAutoOnboard")) {
  const hG_ANCHOR2 = 'const hG={phase:"menu",credits:dp.startCredits';
  if (js.includes(hG_ANCHOR2)) {
    js = js.replace(hG_ANCHOR2, `${PLAY_HELPERS}${hG_ANCHOR2}`);
    mustPatch("play-helpers", true);
  } else {
    mustPatch("play-helpers", false);
  }
} else {
  mustPatch("play-helpers", true);
}

const MATCH_PERSIST = `const WgMatchKey="wg-active-match";function WgSaveMatch(){try{sessionStorage.setItem(WgMatchKey,JSON.stringify({phase:"battle",at:Date.now()}))}catch{}}function WgClearMatch(){try{sessionStorage.removeItem(WgMatchKey)}catch{}}function WgRestoreMatch(){try{const r=sessionStorage.getItem(WgMatchKey);if(!r)return!1;const p=JSON.parse(r);if(p?.phase==="battle"&&Date.now()-(p.at||0)<18e5)return BI.getState().setPhase("battle"),!0}catch{}return!1}`;
if (!js.includes("function WgRestoreMatch")) {
  const hG_ANCHOR = 'const hG={phase:"menu",credits:dp.startCredits';
  if (js.includes(hG_ANCHOR)) {
    js = js.replace(hG_ANCHOR, `${MATCH_PERSIST}${hG_ANCHOR}`);
  } else {
    console.warn("[patch] match persist anchor missing");
  }
}

const START_GAME_SAVE =
  'A().pushMessage("YOUR GRUDGE6 HEROES MARCH THE LANES — CONFIGURE WAVE CREEPS (`)","info")},reset:';
const START_GAME_SAVE_PATCHED =
  'A().pushMessage("YOUR GRUDGE6 HEROES MARCH THE LANES — CONFIGURE WAVE CREEPS (`)","info"),WgSaveMatch()},reset:';
if (js.includes(START_GAME_SAVE)) {
  js = js.replace(START_GAME_SAVE, START_GAME_SAVE_PATCHED);
} else {
  console.warn("[patch] startGame save hook missing");
}

const RESET_ORIG =
  "reset:()=>{const I=A().mapSize;Z.newMatch(I),_g.getState().resetCommand(),C({...hG,mapSize:I,difficulty:A().difficulty,mapVersion:A().mapVersion+1})}";
const RESET_PATCHED =
  "reset:()=>{WgClearMatch();const I=A().mapSize;Z.newMatch(I),_g.getState().resetCommand(),C({...hG,mapSize:I,difficulty:A().difficulty,mapVersion:A().mapVersion+1})}";
if (js.includes(RESET_ORIG)) {
  js = js.replace(RESET_ORIG, RESET_PATCHED);
} else {
  console.warn("[patch] reset clear hook missing");
}

js = js.replace(
  'win:()=>{A().phase==="battle"&&C({phase:"victory"})}',
  'win:()=>{A().phase==="battle"&&(WgClearMatch(),C({phase:"victory"}))}',
);
js = js.replace(
  'lose:()=>{A().phase==="battle"&&C({phase:"defeat"})}',
  'lose:()=>{A().phase==="battle"&&(WgClearMatch(),C({phase:"defeat"}))}',
);

const PLAY_ROUTE_ORIG =
  'function PgA(){const C=BI(e=>e.phase),A=_g(e=>e.mode),[I,g]=T.useState(!1);if(T.useEffect(()=>{WS()},[]),T.useEffect(()=>{const e=()=>g(!!document.pointerLockElement);return document.addEventListener("pointerlockchange",e),()=>document.removeEventListener("pointerlockchange",e)},[]),C==="menu")return d.jsx(aq,{to:"/lobby",replace:!0});';
const PLAY_ROUTE_PATCHED =
  'function PgA(){const nav=Fh(),C=BI(e=>e.phase),A=_g(e=>e.mode),[I,g]=T.useState(!1),[boot,o]=T.useState(C!=="menu"?!0:null),[gateErr,s]=T.useState("");T.useEffect(()=>{WS()},[]),T.useEffect(()=>{const e=()=>g(!!document.pointerLockElement);return document.addEventListener("pointerlockchange",e),()=>document.removeEventListener("pointerlockchange",e)},[]),T.useEffect(()=>{if(!WgAutoOnboard()){o(!1);s("Pick a champion in the warcamp first.");return}s("");if(C!=="menu"){o(!0);return}if(WgRestoreMatch()){o(!0);return}WgDeployAndPlay(),o(!0)},[C]);const deploy=()=>{WgAutoOnboard()?(WgDeployAndPlay(),o(!0),s("")):s("Could not ready your warlord — visit the warcamp.")};if(boot===null)return d.jsx("div",{className:"gw-screen gw-play-boot",children:d.jsxs("div",{className:"gw-play-boot-inner",children:[d.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),d.jsx("span",{className:"gw-hint",children:"Preparing the battlefield…"})]})});if(!boot)return d.jsx("div",{className:"gw-screen gw-play-gate",children:d.jsxs("div",{className:"gw-play-gate-panel",children:[d.jsx("span",{className:"gw-play-gate-kicker",children:"Warlord Genesis"}),d.jsx("h1",{className:"gw-play-gate-title",children:"Deploy to the Field"}),d.jsx("p",{className:"gw-play-gate-lead",children:"Lock your loadout in the warcamp, then fight in third-person combat behind your GRUDGE6 champion."}),s&&d.jsx("p",{className:"gw-play-gate-error",children:s}),d.jsxs("div",{className:"gw-play-gate-actions",children:[d.jsx("button",{type:"button",className:"gw-btn gw-play-gate-deploy",onClick:deploy,children:"Deploy Now"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost",onClick:()=>nav("/lobby"),children:"Open Warcamp"})]})]})});';
if (js.includes(PLAY_ROUTE_ORIG)) {
  js = js.replace(PLAY_ROUTE_ORIG, PLAY_ROUTE_PATCHED);
  mustPatch("play-boot", true);
} else {
  mustPatch("play-boot", js.includes("gw-play-gate") || js.includes("gw-play-boot"));
}

const ENGAGE_ORIG =
  'const i=C==="battle"&&!I&&A==="combat";return d.jsxs("div",{className:"gw-canvas-wrap",children:[d.jsx(sgA,{}),d.jsx(_gA,{}),i&&d.jsx("div",{id:"lock-target",className:"gw-engage",children:d.jsxs("div",{className:"gw-engage-inner",children:[d.jsx("span",{className:"gw-engage-sub",children:"The host awaits your command"}),d.jsx("h2",{className:"gw-engage-title",children:"TAKE THE FIELD"}),d.jsx("span",{className:"gw-hint",children:"Click to lock the mouse · press ` to switch to command"})]})}),d.jsx(OgA,{}),d.jsx(bH,{})]})}';
const ENGAGE_PATCHED =
  'const i=C==="battle"&&!I&&A==="combat";return d.jsxs("div",{className:"gw-canvas-wrap gw-canvas-wrap--play",children:[d.jsx(sgA,{}),d.jsx(_gA,{}),i&&d.jsx("div",{id:"lock-target",className:"gw-engage gw-engage-v2",children:d.jsxs("div",{className:"gw-engage-inner",children:[d.jsx("span",{className:"gw-engage-sub",children:"Third-person warrior mode"}),d.jsx("h2",{className:"gw-engage-title",children:"ENGAGE COMBAT"}),d.jsx("p",{className:"gw-engage-copy",children:"WASD move · mouse aim · LMB attack · RMB block. Press ` for warlord command view."}),d.jsx("button",{type:"button",className:"gw-btn gw-engage-btn",children:"Take the Field"}),d.jsxs("div",{className:"gw-engage-tips",children:[d.jsxs("span",{children:[d.jsx("kbd",{children:"`"})," Command lanes"]}),d.jsxs("span",{children:[d.jsx("kbd",{children:"R"})," Reload · ",d.jsx("kbd",{children:"Q"})," Swap weapon"]})]})]})}),d.jsx(OgA,{}),d.jsx(bH,{})]})}';
if (js.includes(ENGAGE_ORIG)) {
  js = js.replace(ENGAGE_ORIG, ENGAGE_PATCHED);
  mustPatch("engage-v2", true);
} else {
  mustPatch("engage-v2", js.includes("gw-engage-v2"));
}

// Pointer lock — whole engage overlay + touch; force combat mode on battle start.
js = js.replace(
  'const OA=j=>{j.target?.closest?.("#lock-target")&&I.domElement.requestPointerLock()};return document.addEventListener("mousedown",OA),()=>document.removeEventListener("mousedown",OA)},[I]',
  'const OA=j=>{j.target?.closest?.("#lock-target, .gw-engage, .gw-engage-btn")&&I.domElement.requestPointerLock()},jA=j=>{j.preventDefault(),I.domElement.requestPointerLock()};return document.addEventListener("mousedown",OA),document.addEventListener("touchstart",jA,{passive:!1}),()=>{document.removeEventListener("mousedown",OA),document.removeEventListener("touchstart",jA)}},[I]',
);
js = js.replace(
  'A().pushMessage("THE WAR BEGINS — RAZE THEIR CITADEL","good"),A().pushMessage("YOUR GRUDGE6 HEROES MARCH THE LANES — CONFIGURE WAVE CREEPS (`)","info"),WgSaveMatch()},reset:',
  'A().pushMessage("THE WAR BEGINS — RAZE THEIR CITADEL","good"),A().pushMessage("CLICK TAKE THE FIELD FOR THIRD-PERSON COMBAT · ` FOR LANE COMMAND","info"),_g.getState().setMode("combat"),WgSaveMatch()},reset:',
);

// Lobby deploy CTA — clearer path into TPS battle.
js = js.replace(
  'children:"MARCH TO WAR"}),!m&&d.jsx("span",{className:"gw-deploy-hint",children:N(h)?"Canonical weapons apply automatically — check loadout.":"Recruit this warlord with 10 shards in the War Chest."})',
  'children:"MARCH TO WAR — TPS COMBAT"}),d.jsx("span",{className:"gw-deploy-hint gw-deploy-hint--ok",children:"Third-person champion · ` toggles lane command"}),!m&&d.jsx("span",{className:"gw-deploy-hint",children:N(h)?"Canonical weapons apply automatically — check loadout.":"Recruit this warlord with 10 shards in the War Chest."})',
);

// Title — quick path to /play for returning players.
js = js.replace(
  'd.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-secondary",onClick:()=>C("/mp"),children:"Multiplayer"})',
  'd.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-quick",onClick:()=>C("/play"),children:"Quick Battle"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-secondary",onClick:()=>C("/mp"),children:"Multiplayer"})',
);

// Tower GLBs — always serve from this deploy (/models/towers). CDN Assimp exports crash GLTFLoader.
js = js.replace(
  "function fT(C,A,I){const g=CIA[C][A];return I?`${mt.pipeline.r2.mapTowers}${C}/${g}.glb`:`${pT}models/towers/${C}/${g}.glb`}",
  "function fT(C,A,I){const g=CIA[C][A];return`${pT}models/towers/${C}/${g}.glb`}",
);
js = js.replace(
  "function tIA(C,A){return A?`${mt.pipeline.r2.mapTowerAtlases}${C}/atlas.png`:`${pT}models/towers/${C}/atlas.png`}",
  "function tIA(C,A){return`${pT}models/towers/${C}/atlas.png`}",
);
js = js.replace("cdnReachable:!0,bootedAt:0", "cdnReachable:!1,bootedAt:0");
js = js.replace('Dq="gw_engine_boot_v3"', 'Dq="gw_engine_boot_v4"');

// Route map: / → /lobby (warcamp) → /play (battle) → /mp
const LOBBY_ROUTE =
  'd.jsx(jc,{path:"/lobby",element:d.jsx(u7,{})}),d.jsx(jc,{path:"/play",element:d.jsx(PgA,{})})';
const LOBBY_ROUTE_PATCHED =
  'd.jsx(jc,{path:"/warcamp",element:d.jsx(aq,{to:"/lobby",replace:!0})}),d.jsx(jc,{path:"/lobby",element:d.jsx(u7,{})}),d.jsx(jc,{path:"/play",element:d.jsx(PgA,{})}),d.jsx(jc,{path:"/battle",element:d.jsx(aq,{to:"/play",replace:!0})})';
if (js.includes(LOBBY_ROUTE)) {
  js = js.replace(LOBBY_ROUTE, LOBBY_ROUTE_PATCHED);
  mustPatch("routes", true);
} else {
  mustPatch("routes", js.includes('path:"/warcamp"') && js.includes('path:"/battle"'));
}

// Pack reveal — portrait cards + effect copy (not text-only pills).
const PACK_CARDS_ORIG =
  'd.jsx("div",{className:"gw-pack-cards",children:i.shardGrants.map((Q,o)=>d.jsxs("div",{className:"gw-pack-card",style:{animationDelay:`${o*.12}s`},children:[d.jsx("span",{className:"gw-pack-card-kind",children:Q.kind==="character"?"Warlord":"Lane Guard"}),d.jsx("span",{className:"gw-pack-card-name",children:Q.label}),d.jsx("span",{className:"gw-pack-card-shard",children:"+1 shard"})]},`${Q.id}-${o}`))})';
const PACK_CARDS_PATCHED =
  'd.jsx("div",{className:"gw-pack-cards",children:i.shardGrants.map((Q,o)=>{const s=Q.kind==="character"?jK(Q.id)||YH(Q.id):"",l=Q.kind==="character"?"Unlock or tier-up warlord":"Upgrade lane creep tier";return d.jsxs("div",{className:"gw-pack-card",style:{animationDelay:`${o*.12}s`},children:[s?d.jsx("img",{className:"gw-pack-card-art",src:s,alt:"",loading:"lazy"}):d.jsxs("div",{className:"gw-pack-card-art gw-pack-card-art--lane",children:[d.jsx("img",{src:Ji.hammer,alt:"",draggable:!1})]}),d.jsx("span",{className:"gw-pack-card-kind",children:Q.kind==="character"?"Warlord":"Lane Guard"}),d.jsx("span",{className:"gw-pack-card-name",children:Q.label}),d.jsx("span",{className:"gw-pack-card-effect",children:l}),d.jsx("span",{className:"gw-pack-card-shard",children:"+1 shard"})]},`${Q.id}-${o}`)})})';
if (js.includes(PACK_CARDS_ORIG)) {
  js = js.replace(PACK_CARDS_ORIG, PACK_CARDS_PATCHED);
  mustPatch("pack-cards", true);
} else {
  mustPatch("pack-cards", js.includes("gw-pack-card-art"));
}

// War Chest — stack button labels so long copy stays inside buttons.
js = js.replace(
  'children:w?`DAILY PACK (+${QS.gbux} GBUX · ${QS.shards} shards)`:"DAILY PACK CLAIMED"',
  'children:w?d.jsxs(d.Fragment,{children:[d.jsx("span",{className:"gw-chest-btn-title",children:"Daily Pack"}),d.jsxs("span",{className:"gw-chest-btn-meta",children:["+",QS.gbux," GBUX · ",QS.shards," shards"]})]}):"Daily pack claimed"',
);
js = js.replace(
  'children:["UPGRADE PACK (",oS," GBUX · 3 shards)"]',
  'children:d.jsxs(d.Fragment,{children:[d.jsx("span",{className:"gw-chest-btn-title",children:"Upgrade Pack"}),d.jsxs("span",{className:"gw-chest-btn-meta",children:[oS," GBUX · 3 shards"]})]})',
);

// Victory reward pills — mini portrait when warlord shard.
js = js.replace(
  'children:c.shardGrants.map((h,w)=>d.jsxs("span",{className:"gw-reward-shard-pill",children:["+1 ",h.label]},`${h.id}-${w}`))',
  'children:c.shardGrants.map((h,w)=>{const u=h.kind==="character"?jK(h.id)||YH(h.id):"";return d.jsxs("span",{className:"gw-reward-shard-pill",children:[u&&d.jsx("img",{className:"gw-reward-shard-art",src:u,alt:"",loading:"lazy"}),d.jsxs("span",{children:["+1 ",h.label]})]},`${h.id}-${w}`)})',
);

// Lane guard cards — icon header so they are not text-only.
js = js.replace(
  'children:[d.jsx("span",{className:"gw-char-card-name",children:A}),o&&d.jsxs("span",{className:"gw-char-card-lvl",children:["T",Q]}),d.jsx("div",{className:"gw-char-card-shards",children:d.jsx("span",{className:"gw-char-card-shard-text",children:o?`${e}/${t} upgrade`:`${e}/${s} unlock`})})]})}const a7=',
  'children:[d.jsx("img",{className:"gw-lane-card-icon",src:Ji.hammer,alt:"",draggable:!1}),d.jsx("span",{className:"gw-char-card-name",children:A}),o&&d.jsxs("span",{className:"gw-char-card-lvl",children:["T",Q]}),d.jsx("span",{className:"gw-lane-card-effect",children:o?"Gear tier upgrade":"Unlock lane creep"}),d.jsx("div",{className:"gw-char-card-shards",children:d.jsx("span",{className:"gw-char-card-shard-text",children:o?`${e}/${t} → T${Math.min(8,Q+1)}`:`${e}/${s} to unlock`})})]})}const a7=',
);

// Manifest-driven patch fingerprints — hard fail if any critical needle missing.
for (const { id, needle } of manifest.bundlePatches) {
  mustPatch(id, js.includes(needle));
}

if (patchFailures.length) {
  console.error("[patch] FAILED patches:", patchFailures.join(", "));
  process.exit(1);
}

writeFileSync(OUT, js);
const bundleHash = createHash("sha256").update(js).digest("hex").slice(0, 16);
manifest.lastBuilt = new Date().toISOString();
manifest.bundleBytes = js.length;
manifest.bundleSha256 = bundleHash;
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
console.log("[patch] wrote", OUT, `(${js.length} bytes, sha ${bundleHash})`);

let html = readFileSync(INDEX, "utf8");
const BUNDLE_BUST = String(manifest.bundleVersion);
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
if (!css.includes(".gw-pack-card-art")) {
  css += `
.gw-pack-reveal{display:flex;flex-direction:column;align-items:center;gap:1rem;max-width:min(920px,94vw);padding:1rem}
.gw-pack-cards{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center;max-width:100%}
.gw-pack-card{display:flex;flex-direction:column;align-items:center;gap:.3rem;width:132px;padding:.5rem .55rem .65rem;border-radius:10px;border:1px solid rgba(201,162,39,.45);background:linear-gradient(165deg,#1a2234e6,#0a0f18f2);overflow:hidden;text-align:center;box-sizing:border-box}
.gw-pack-card-art{width:100%;height:96px;object-fit:cover;object-position:top center;border-radius:6px;background:#0b1018}
.gw-pack-card-art--lane{display:grid;place-items:center;height:96px;width:100%;border-radius:6px;background:#121a28}
.gw-pack-card-art--lane img{width:40px;height:40px;opacity:.85}
.gw-pack-card-kind{font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:#8fa3c4}
.gw-pack-card-name{font-size:.78rem;font-weight:700;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gw-pack-card-effect{font-size:.62rem;color:#9dffd8;line-height:1.25;padding:0 .15rem}
.gw-pack-card-shard{font-size:.65rem;color:#fbbf24;font-weight:700}
.gw-pack-gbux{font-size:1.35rem;color:#fbbf24;font-weight:800;margin-bottom:.25rem}
.gw-collection-actions .gw-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.15rem;min-width:148px;max-width:220px;padding:10px 14px;font-size:11px;letter-spacing:.06em;line-height:1.2;white-space:normal;text-align:center;box-sizing:border-box}
.gw-chest-btn-title{font-family:Inter,sans-serif;font-size:12px;font-weight:700;letter-spacing:.08em}
.gw-chest-btn-meta{font-family:Inter,sans-serif;font-size:10px;font-weight:500;opacity:.85}
.gw-char-card{overflow:hidden;min-width:0}
.gw-char-card-main{overflow:hidden;min-width:0}
.gw-char-card-name,.gw-char-card-title,.gw-char-card-meta,.gw-char-card-gear{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gw-char-card-kit{display:flex;flex-direction:column;gap:.1rem;width:100%;font-size:.62rem;opacity:.8}
.gw-char-card-kit span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gw-lane-card{align-items:flex-start;text-align:left;gap:.25rem}
.gw-lane-card-icon{width:28px;height:28px;opacity:.9;margin-bottom:.15rem}
.gw-lane-card-effect{font-size:.6rem;color:#9dffd8;line-height:1.2}
.gw-lobby-v2{overflow-x:hidden;overflow-y:auto}
.gw-lobby-top-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;max-width:min(520px,48vw)}
.gw-lobby-main{min-width:0;overflow:hidden}
.gw-lobby-deploy{position:sticky;top:72px;min-width:0}
.gw-deploy-panel{overflow:hidden;max-width:100%}
.gw-mapsize-toggle{display:flex;flex-wrap:wrap;gap:6px}
.gw-mapsize-toggle .gw-btn-mini{flex:1 1 72px;min-width:0;max-width:100%;padding:6px 8px;font-size:9px;letter-spacing:.04em;white-space:normal;line-height:1.15;text-align:center;box-sizing:border-box}
.gw-reward-shard-pill{display:inline-flex;align-items:center;gap:.35rem;max-width:100%}
.gw-reward-shard-art{width:22px;height:22px;border-radius:4px;object-fit:cover;flex-shrink:0}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended pack/card/lobby UI containment styles");
}
if (!css.includes(".gw-play-gate")) {
  css += `
.gw-play-boot-inner{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px}
.gw-play-boot-spinner{width:36px;height:36px;border-radius:50%;border:3px solid rgba(120,150,200,.25);border-top-color:#e0b852;animation:gw-spin .9s linear infinite}
@keyframes gw-spin{to{transform:rotate(360deg)}}
.gw-play-gate{display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(224,178,82,.12),transparent 55%),#080c14}
.gw-play-gate-panel{max-width:min(480px,92vw);padding:28px 24px;border-radius:14px;border:1px solid rgba(120,150,200,.28);background:rgba(10,14,22,.92);text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.gw-play-gate-kicker{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#7f93b4}
.gw-play-gate-title{margin:10px 0 8px;font-family:Cinzel Decorative,serif;font-size:1.6rem;color:#f0e6d0}
.gw-play-gate-lead{margin:0 0 16px;color:#a8b8d0;line-height:1.55;font-size:.95rem}
.gw-play-gate-error{margin:0 0 12px;padding:8px 10px;border-radius:8px;background:rgba(180,40,40,.18);border:1px solid rgba(248,113,113,.35);color:#fecaca;font-size:.85rem}
.gw-play-gate-actions{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.gw-play-gate-deploy{padding:14px 20px;font-size:1rem;letter-spacing:.06em}
.gw-canvas-wrap--play{position:relative}
.gw-engage-v2{position:absolute;inset:0;z-index:12;display:grid;place-items:center;background:radial-gradient(ellipse 70% 55% at 50% 45%,rgba(8,12,20,.35),rgba(8,12,20,.82));cursor:pointer}
.gw-engage-v2 .gw-engage-inner{max-width:min(520px,92vw);padding:28px 24px;border-radius:14px;border:1px solid rgba(224,178,82,.45);background:rgba(8,12,20,.88);text-align:center;pointer-events:auto}
.gw-engage-v2 .gw-engage-sub{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#9dffd8}
.gw-engage-v2 .gw-engage-title{margin:8px 0;font-family:Cinzel Decorative,serif;font-size:clamp(1.5rem,5vw,2.2rem);color:#f0e6d0}
.gw-engage-v2 .gw-engage-copy{margin:0 0 16px;color:#b8c4d8;line-height:1.5;font-size:.9rem}
.gw-engage-btn{width:100%;padding:14px 18px;font-size:1rem;letter-spacing:.08em;margin-bottom:12px}
.gw-engage-tips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;font-size:.72rem;color:#8fa3c4}
.gw-engage-tips kbd{font-family:inherit;padding:2px 6px;border-radius:4px;border:1px solid rgba(120,150,200,.35);background:rgba(14,20,32,.8);color:#dce6f4}
.gw-deploy-hint--ok{color:#9dffd8;font-size:.72rem;margin-top:6px;display:block}
.gw-title-quick{width:100%;padding:10px 20px;font-size:.9rem;border-color:rgba(224,178,82,.35);color:#e0c878}
.gw-mode-combat .gw-crosshair{opacity:1}
.gw-hud.gw-mode-combat .gw-mode-badge{background:rgba(224,178,82,.15);border-color:rgba(224,178,82,.45)}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended play/combat UX styles");
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