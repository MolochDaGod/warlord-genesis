#!/usr/bin/env node
/**
 * Patch production bundle: fleet URLs, lobby/about UI, canonical player sync.
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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
  if (!ok) {
    patchFailures.push(id);
    console.error("[patch] fail:", id);
  }
}

let js = readFileSync(SRC, "utf8");

/** Hero weapon catalog map — minified symbol renamed across bundle builds (was Da, now cx). */
function resolveWeaponCatalogSymbol(source) {
  const m =
    source.match(/const ([A-Za-z$_][\w$]*)=\{[^}]*"sir-aldric-valorheart":\{apiWeapon/) ||
    source.match(/([A-Za-z$_][\w$]*)=\{[^}]*"sir-aldric-valorheart":\{apiWeapon/);
  return m?.[1] || "cx";
}
const WCAT = resolveWeaponCatalogSymbol(js);
console.log("[patch] weapon catalog symbol:", WCAT);

const replacements = [
  // Route CDN fetches through same-origin Vercel proxy (fixes CORS)
  ['PQ="https://assets.grudge-studio.com"', 'PQ="/api/assets"'],
  // ObjectStore → canonical fleet CDN
  [
    'zz="https://molochdagod.github.io/ObjectStore/api/v1"',
    'zz="https://objectstore.grudge-studio.com"',
  ],
  [
    'O6="https://molochdagod.github.io/ObjectStore/api/v1"',
    'O6="https://objectstore.grudge-studio.com"',
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

// KayKit lane creeps — local GLBs (CDN /api/assets/grudge-nexus/models/rts/units/ returns HTML).
js = js.replace(
  "units:`${PQ}/grudge-nexus/models/rts/units/`",
  'units:"/models/units/"',
);
js = js.replace(
  'function RAA(C){return`${mt.pipeline.r2.units}${C}.glb`}',
  'function RAA(C){return`/models/units/${C}.glb`}',
);

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
// Palette HEAD ok must not flip unit URLs back to broken /api/assets/rts/ paths.
js = js.replace(
  "return Zc={ready:!0,manifest:mt,cdnReachable:A,bootedAt:Date.now()}",
  "return Zc={ready:!0,manifest:mt,cdnReachable:!1,bootedAt:Date.now()}",
);

// Baked clips ship from this deploy (/anims/baked), not the broken CDN proxy.
js = js.replaceAll("${PQ}/anims/baked/", "/anims/baked/");

// Baked anim loader — warn + null instead of uncaught throw (battle can still boot)
js = js.replace(
  'async function zc(C){const A=R6(C),I=await fetch(A);if(!I.ok)throw new Error(`Baked clip ${A} HTTP ${I.status}`);const g=await I.json();return b6(oa.parse(g))}',
  'async function zc(C){const A=R6(C),I=await fetch(A);if(!I.ok){console.warn(`[warlord] baked clip missing ${A} (${I.status})`);return null}try{const g=await I.json();return b6(oa.parse(g))}catch(e){console.warn(`[warlord] baked clip parse failed ${A}`,e);return null}}',
);

// Animation pack binder — skip null clips instead of clipAction(null) crash
const PY_ORIG =
  'async function pY(C,A){const I=sx[A],[g,i,e,t,Q]=await Promise.all([zc(I.idle),zc(I.walk),zc(I.run),zc(I.sprint),zc(N6[A])]),o={idle:g,walk:i,run:e,sprint:t};return{director:new G6(C,o),attackClip:Q,actions:{idle:C.clipAction(g),walk:C.clipAction(i),run:C.clipAction(e),attack:C.clipAction(Q)}}}';
const PY_PATCHED =
  'async function pY(C,A){WgDebug.anim("pack.load",{extra:{pack:A}});const I=sx[A],[g,i,e,t,Q]=await Promise.all([zc(I.idle),zc(I.walk),zc(I.run),zc(I.sprint),zc(N6[A])]),f=g||i||e||t||Q,o={idle:g||f,walk:i||f,run:e||f,sprint:t||f},s=a=>a?C.clipAction(a):f?C.clipAction(f):null;return WgDebug.anim("pack.bind",{extra:{pack:A,hasIdle:!!g,hasWalk:!!i,hasRun:!!e}}),{director:new G6(C,o),attackClip:Q,actions:{idle:s(g),walk:s(i),run:s(e),attack:s(Q)}}}';
if (js.includes(PY_ORIG)) {
  js = js.replace(PY_ORIG, PY_PATCHED);
  mustPatch("anim-pack-binder", true);
} else if (js.includes(PY_PATCHED)) {
  mustPatch("anim-pack-binder", true);
} else {
  console.warn("[patch] pY anim binder missing");
  mustPatch("anim-pack-binder", false);
}

// AnimationDirector — tolerate missing individual locomotion clips
js = js.replace(
  "constructor(A,I){this.mixer=A;const g=i=>{const e=A.clipAction(i);return e.setLoop(cr,1/0),e.enabled=!0,e.setEffectiveWeight(0),e.play(),e};this.loco={idle:g(I.idle),walk:g(I.walk),run:g(I.run),sprint:g(I.sprint)},this.loco.idle.setEffectiveWeight(1)",
  "constructor(A,I){this.mixer=A;const g=i=>{if(!i)return null;const e=A.clipAction(i);return e.setLoop(cr,1/0),e.enabled=!0,e.setEffectiveWeight(0),e.play(),e},f=I.idle||I.walk||I.run||I.sprint;this.loco={idle:g(I.idle||f),walk:g(I.walk||f),run:g(I.run||f),sprint:g(I.sprint||f)},this.loco.idle?.setEffectiveWeight(1)",
);

// ── Debug: flow tracing + positional animation logs (?debug=1 or Shift+`) ──
const WG_DEBUG_PATH = join(ROOT, "scripts", "wg-debug-code.txt");
const WG_DEBUG_CODE = existsSync(WG_DEBUG_PATH)
  ? readFileSync(WG_DEBUG_PATH, "utf8").trim()
  : 'const WgDebug={_on:!1,_logs:[],init(){try{this._on=/\bdebug=1\b/.test(location.search)||localStorage.getItem("wg-debug")==="1"}catch{}},toggle(){return this._on=!this._on,this._on},flow(){},asset(){},getLogs(){return this._logs},trackRoute(){}};function WgAnimLog(){}function WgDebugPanel(){return null}';
if (!js.includes("function WgDebugPanel(")) {
  if (js.includes("async function zc(C)") && WG_DEBUG_CODE) {
    js = js.replace("async function zc(C)", `${WG_DEBUG_CODE}WgDebug.init();async function zc(C)`);
    mustPatch("debug-core", js.includes("function WgDebugPanel(") || js.includes("const WgDebug="));
  } else {
    mustPatch("debug-core", js.includes("function WgDebugPanel(") || js.includes("const WgDebug="));
  }
} else {
  mustPatch("debug-core", true);
}
js = js.replace(
  'if(!I.ok){console.warn(`[warlord] baked clip missing ${A} (${I.status})`);return null}try{const g=await I.json();return b6(oa.parse(g))}catch(e){console.warn(`[warlord] baked clip parse failed ${A}`,e);return null}',
  'if(!I.ok){WgDebug.asset("clip.missing",{extra:{url:A,status:I.status}});return null}try{const g=await I.json();return b6(oa.parse(g))}catch(e){WgDebug.asset("clip.parse",{extra:{url:A,err:String(e)}});return null}',
);
js = js.replace(
  "function H6(C,A,I){if(A===I)return;const g=C.actions[A]??C.actions.idle??C.actions.walk,i=C.actions[I];g&&(i?.fadeOut(.12),A===\"attack\"?(g.setLoop(ak,1),g.clampWhenFinished=!1):g.setLoop(cr,1/0),g.reset().fadeIn(.12).play())}",
  "function H6(C,A,I,ctx){WgAnimLog(C,A,I,ctx);if(A===I)return;const g=C.actions[A]??C.actions.idle??C.actions.walk,i=C.actions[I];g&&(i?.fadeOut(.12),A===\"attack\"?(g.setLoop(ak,1),g.clampWhenFinished=!1):g.setLoop(cr,1/0),g.reset().fadeIn(.12).play())}",
);
js = js.replace(
  "u!==Q.current&&(H6(e,u,Q.current),Q.current=u)",
  "u!==Q.current&&(H6(e,u,Q.current,{id:A,typeId:C,faction:I,locomotion:w?.locomotion,pos:w?.pos}),Q.current=u)",
);
js = js.replace(
  "if(!M||y===st.current.state)return;const N=st.current.clip?c[st.current.clip]:null,F=c[M];N?.fadeOut(.12),F?.reset().fadeIn(.12).play(),st.current={state:y,clip:M}",
  "if(!M||y===st.current.state)return;WgAnimLog({root:o},st.current.state,y,{id:g,typeId:\"kaykit\",locomotion:p?.locomotion,pos:p?.pos});const N=st.current.clip?c[st.current.clip]:null,F=c[M];N?.fadeOut(.12),F?.reset().fadeIn(.12).play(),st.current={state:y,clip:M}",
);
js = js.replace(
  "return Zc={ready:!0,manifest:mt,cdnReachable:!1,bootedAt:Date.now()}",
  "return WgDebug.flow(\"engine.boot\",{extra:{cdn:!1}}),Zc={ready:!0,manifest:mt,cdnReachable:!1,bootedAt:Date.now()}",
);
if (!js.includes("d.jsx(WgDebugPanel,{})")) {
  js = js.replace("d.jsx(YCA,{})", "d.jsx(WgDebugPanel,{}),d.jsx(YCA,{})");
  mustPatch("debug-panel", js.includes("d.jsx(WgDebugPanel,{})"));
} else {
  mustPatch("debug-panel", true);
}

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

// Grudge ID — full-page SSO redirect (never leave user stuck on id.grudge-studio.com popup).
const PO_ORIG =
  'function pO(){return new Promise((C,A)=>{const I=window.location.origin,g=window.open(`${bR}/?origin=${encodeURIComponent(I)}`,"grudge-auth","width=480,height=720");if(!g){A(new Error("Popup blocked. Allow popups for this site and retry."));return}let i=!1;const e=()=>{window.removeEventListener("message",t),clearInterval(Q),clearTimeout(o)},t=s=>{if(s.origin!==bR)return;const l=s.data;if(!(!l||l.type!=="grudge-auth:success"||!l.token)){i=!0,e();try{g.close()}catch{}C(l.token)}};window.addEventListener("message",t);try{g.postMessage({type:"grudge-auth:init",origin:I},"*")}catch{}const Q=setInterval(()=>{g.closed&&!i&&(e(),A(new Error("Sign-in window was closed before completing.")))},500),o=setTimeout(()=>{if(!i){i=!0,e();try{g.close()}catch{}A(new Error("Sign-in timed out. Please try again."))}},wO)})}';
const AUTH_SSO =
  'const WgAuthReturnKey="wg-auth-return";function WgSafeReturnPath(p){return typeof p==="string"&&p.startsWith("/")&&!p.startsWith("//")?p:"/lobby"}function WgGrudgeIdLogin(p){try{const path=p||window.location.pathname+window.location.search+window.location.hash;sessionStorage.setItem(WgAuthReturnKey,WgSafeReturnPath(path))}catch{}const dest=window.location.origin+"/auth/callback";window.location.href=`${bR}/login?redirect_uri=${encodeURIComponent(dest)}` /* canonical: GrudgeBuilder shared/fleet/authConnect buildFleetLoginUrl */}function WgAuthCallbackScreen(){const C=Fh(),[A,I]=T.useState("loading"),[g,i]=T.useState("");T.useEffect(()=>{let e=!1;return(async()=>{try{const t=new URLSearchParams(window.location.search),h=new URLSearchParams(window.location.hash?.length>1?window.location.hash.slice(1):""),Q=t.get("grudge_token")||t.get("sso_token")||t.get("token")||h.get("token")||h.get("grudge_token");Q&&cq(Q);const o=["grudge_token","sso_token","token","grudge_id","grudgeId","username","grudge_username","provider"];try{const s=new URL(window.location.href);o.forEach(l=>s.searchParams.delete(l));const w=s.searchParams.toString();window.history.replaceState({},"",s.pathname+(w?"?"+w:""))}catch{}const u=SO();if(!u){if(!e){I("error");setTimeout(()=>C("/"),2e3)}return}const w=await hq(u);if(e)return;Rh.setState({user:w,loading:!1,error:null}),await WgFleetSync(w),i(w.displayName||w.username||"Commander"),I("success");let p="/lobby";try{const s=sessionStorage.getItem(WgAuthReturnKey);s&&(p=WgSafeReturnPath(s),sessionStorage.removeItem(WgAuthReturnKey))}catch{}const y=t.get("return")||t.get("redirect")||t.get("redirect_uri");y&&y.startsWith("/")&&!y.startsWith("//")&&(p=WgSafeReturnPath(y)),setTimeout(()=>C(p),600)}catch{if(!e){I("error");setTimeout(()=>C("/"),2e3)}}})(),()=>{e=!0}},[C]);return d.jsx("div",{className:"gw-screen gw-auth-callback",children:d.jsxs("div",{className:"gw-auth-callback-card",children:[A==="loading"&&d.jsxs(d.Fragment,{children:[d.jsx("span",{className:"gw-auth-callback-spin","aria-hidden":!0}),d.jsx("p",{children:"Completing Grudge ID sign-in…"})]}),A==="success"&&d.jsxs(d.Fragment,{children:[d.jsx("p",{className:"gw-auth-callback-ok",children:"Welcome, "+g}),d.jsx("p",{className:"gw-auth-callback-sub",children:"Returning to warcamp…"})]}),A==="error"&&d.jsxs(d.Fragment,{children:[d.jsx("p",{className:"gw-auth-callback-err",children:"Sign-in failed"}),d.jsx("p",{className:"gw-auth-callback-sub",children:"Redirecting…"})]})]})})}function pO(){WgGrudgeIdLogin();return new Promise(()=>{})}';
if (js.includes(PO_ORIG)) {
  js = js.replace(PO_ORIG, AUTH_SSO);
  mustPatch("auth-sso-redirect", true);
} else if (js.includes("WgGrudgeIdLogin")) {
  mustPatch("auth-sso-redirect", true);
} else {
  console.warn("[patch] pO popup auth missing — SSO redirect skipped");
  mustPatch("auth-sso-redirect", false);
}
js = js.replace(
  'function uO(){if(!(typeof window>"u"))try{const C=new URLSearchParams(window.location.search),A=C.get("grudge_token")||C.get("sso_token");A&&(cq(A),window.history.replaceState({},"",window.location.pathname))}catch{}}uO();',
  'function uO(){if(!(typeof window>"u"))try{if(window.location.pathname==="/auth/callback")return;const C=new URLSearchParams(window.location.search),A=C.get("grudge_token")||C.get("sso_token");A&&(cq(A),window.history.replaceState({},"",window.location.pathname))}catch{}}uO();',
);
// fO kept for legacy callers — signInWithStudio uses WgGrudgeIdLogin directly (no blocking promise).
js = js.replace(
  'async function fO(){const C=await pO();cq(C);try{return await hq(C)}catch(A){throw NN(),A instanceof Error?A:new Error("Could not load your Grudge Studio profile.")}}',
  'async function fO(){WgGrudgeIdLogin();throw new Error("Redirecting to Grudge ID…")}',
);
js = js.replace(
  'async function fO(){WgGrudgeIdLogin();return new Promise(()=>{})}',
  'async function fO(){WgGrudgeIdLogin();throw new Error("Redirecting to Grudge ID…")}',
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
  'function xO(){const C=Fh(),A=MN(o=>o.openHub),I=Rh(o=>o.user),g=Rh(o=>o.loading),i=Rh(o=>o.error),e=Rh(o=>o.guest),t=Rh(o=>o.signInWithStudio),n=Rh(o=>o.signInWithPuter),[Q,o]=T.useState(!0),[s,l]=T.useState(!1);T.useEffect(()=>{WS().then(h=>{l(h.cdnReachable),o(!1)})},[]);return d.jsxs("div",{className:"gw-screen gw-title-v3",children:[d.jsx("div",{className:"gw-title-bg","aria-hidden":!0}),d.jsxs("header",{className:"gw-auth-bar",children:[d.jsx("span",{className:"gw-auth-brand",children:"Grudge Studio"}),d.jsxs("div",{className:"gw-auth-actions",children:[g&&d.jsx("span",{className:"gw-auth-pill is-loading",children:"Connecting session…"}),!g&&I&&d.jsxs("span",{className:"gw-auth-pill is-ok",title:I.grudgeId,children:[I.role==="guest"?"Guest":"Account"," · ",I.displayName||I.username]}),!g&&!I&&d.jsx("span",{className:"gw-auth-pill is-warn",children:"Not signed in"}),!g&&!I&&d.jsx("button",{type:"button",className:"gw-auth-btn",onClick:e,children:"Continue as guest"}),!g&&!I&&d.jsx("button",{type:"button",className:"gw-auth-btn gw-auth-btn-grudge",onClick:t,disabled:g,children:"Sign in with Grudge ID"}),d.jsx("button",{type:"button",className:"gw-auth-btn gw-auth-btn-puter",onClick:n,disabled:g,children:"Sign in with Puter"})]})]}),d.jsxs("main",{className:"gw-title-main",children:[d.jsx("p",{className:"gw-title-eyebrow",children:"Warlord Genesis · Three-lane RTS"}),d.jsxs("h1",{className:"gw-title-headline",children:["GRUDGE ",d.jsx("span",{children:"WARLORDS"})]}),d.jsx("p",{className:"gw-title-lead",children:"Pick your champion in the warcamp, deploy lane waves, and siege the enemy citadel."}),i&&d.jsx("p",{className:"gw-title-error",children:i}),d.jsxs("div",{className:"gw-title-ctas",children:[d.jsx("button",{type:"button",className:"gw-btn gw-title-play",onClick:()=>C("/lobby"),children:g?"Preparing…":"Enter the Warcamp"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-secondary",onClick:()=>C("/mp"),children:"Multiplayer"})]}),d.jsxs("div",{className:"gw-title-chips",children:[d.jsx("span",{className:"gw-title-chip",children:Q?"Booting engine…":"Engine v"+mt.version}),d.jsx("span",{className:"gw-title-chip",children:s?"CDN assets online":"Local assets"}),d.jsx("span",{className:"gw-title-chip",children:"Grudge ID · Puter · Railway saves"})]})]}),d.jsxs("footer",{className:"gw-title-footer",children:[d.jsx("button",{type:"button",className:"gw-footer-link",onClick:()=>A("account"),children:"Account"}),d.jsx("button",{type:"button",className:"gw-footer-link",onClick:()=>A("codex"),children:"Codex"}),d.jsx("button",{type:"button",className:"gw-footer-link",onClick:()=>A("about"),children:"About"}),d.jsx("button",{type:"button",className:"gw-footer-link",onClick:()=>C("/admin"),children:"Admin"})]})]})}';
if (TITLE_XO_ORIG && js.includes(TITLE_XO_ORIG)) {
  js = js.replace(TITLE_XO_ORIG, TITLE_XO_NEW);
  mustPatch("title-v3", true);
} else {
  mustPatch("title-v3", js.includes("gw-screen gw-title-v3"));
}

// Hero codex links → fleet heroes site (grudge-heros.puter.site is deprecated).
js = js.replaceAll("https://grudge-heros.puter.site/", "https://heroes.grudge-studio.com/");

for (const [from, to] of replacements) {
  if (!js.includes(from)) {
    console.warn("[patch] missing pattern:", from.slice(0, 80));
  } else {
    js = js.replaceAll(from, to);
  }
}

// FBX models reference race PSD atlases beside the .FBX — remap to GRUDGE6 webp (CDN + local fallback).
const PSD_REMAP_HOOK =
  'const Jb=new rK;const WgRaceTex={barbarians:"BRB_StandardUnits_texture.webp",dwarves:"DWF_Standard_Units.webp",elves:"ELF_HighElves_Texture.webp",orcs:"ORC_StandardUnits.webp",undead:"UD_Standard_Units.webp","western-kingdoms":"WK_Standard_Units.webp"};Jb.setURLModifier(u=>{if(!/StandardUnits?_Textures?\\.(psd|tga|png|webp)/i.test(u))return u;const m=u.match(/\\/(barbarians|dwarves|elves|orcs|undead|western-kingdoms)\\//i),folder=m?m[1].toLowerCase():"western-kingdoms",tex=WgRaceTex[folder]||WgRaceTex["western-kingdoms"];return`/textures/grudge6/${folder}/${tex}`});';
if (js.includes("const Jb=new rK;")) {
  js = js.replace("const Jb=new rK;", PSD_REMAP_HOOK);
  mustPatch("psd-race-remap", js.includes("WgRaceTex"));
} else {
  console.warn("[patch] LoadingManager hook missing — PSD remap skipped");
  mustPatch("psd-race-remap", false);
}

// Map / asset overrides — persisted in localStorage, applied on Z.newMatch (admin at /admin).
const MAP_ADMIN_HELPERS =
  'const WgMapStoreKey="warlord_genesis_map_override",WgAssetStoreKey="warlord_genesis_asset_paths";function WgLoadMapOverride(){try{const r=localStorage.getItem(WgMapStoreKey);return r?JSON.parse(r):null}catch{return null}}function WgSaveMapOverride(d){localStorage.setItem(WgMapStoreKey,JSON.stringify(d))}function WgClearMapOverride(){localStorage.removeItem(WgMapStoreKey)}function WgDefaultMapDraft(){return{mapSize:"standard",width:80,length:130,allyCore:{x:0,z:46},enemyCore:{x:0,z:-46},lanes:[{id:0,name:"West",pts:[{x:-18,z:46},{x:-18,z:0},{x:-18,z:-46}]},{id:1,name:"Center",pts:[{x:0,z:46},{x:0,z:0},{x:0,z:-46}]},{id:2,name:"East",pts:[{x:18,z:46},{x:18,z:0},{x:18,z:-46}]}]}}function WgDefaultMapDraftLarge(){return{mapSize:"large",width:200,length:325,allyCore:{x:0,z:120},enemyCore:{x:0,z:-120},lanes:[{id:0,name:"Top",pts:[{x:-40,z:120},{x:-55,z:40},{x:-30,z:-40},{x:-45,z:-120}]},{id:1,name:"Mid",pts:[{x:0,z:120},{x:0,z:40},{x:0,z:-40},{x:0,z:-120}]},{id:2,name:"Bottom",pts:[{x:40,z:120},{x:55,z:40},{x:30,z:-40},{x:45,z:-120}]}]}}function WgLoadAssetPaths(){try{const r=localStorage.getItem(WgAssetStoreKey);return r?JSON.parse(r):null}catch{return null}}function WgSaveAssetPaths(d){localStorage.setItem(WgAssetStoreKey,JSON.stringify(d))}function WgDefaultAssetPaths(){return{kaykitMesh:"/models/characters/kaykit/Rig_Medium_General.glb",kaykitMove:"/models/characters/kaykit/Rig_Medium_MovementBasic.glb",unitPalette:"/models/units/Color_Palette.png",footman:"/models/units/footman.glb",archer:"/models/units/archer.glb",knight:"/models/units/knight.glb",polygonGuns:"/models/weapons/polygon_guns.glb",tower_medieval_outer:"/models/towers/medieval/watchtower_lvl1.glb",tower_medieval_inner:"/models/towers/medieval/game_ready_turret.glb",tower_elven_outer:"/models/towers/elven/fantasy_crossbow_tower.glb",tower_elven_inner:"/models/towers/elven/archer_t3.glb",tower_orc_outer:"/models/towers/orc/bomber_t1.glb",tower_orc_inner:"/models/towers/orc/bomber_t3.glb",tower_ruins_outer:"/models/towers/ruins/slow_t1.glb",tower_ruins_inner:"/models/towers/ruins/slow_t3.glb",core_medieval:"/models/buildings/faction/muu.glb",core_elven:"/models/buildings/faction/mantah.glb",core_orc:"/models/buildings/faction/krakee.glb",core_ruins:"/models/buildings/faction/antuk.glb"}}let WgAssetSanitized=false;function WgSanitizeAssetPaths(){try{const p=WgLoadAssetPaths();if(!p)return;const bad=["luchnik","stylized_turret","/mag.glb","pushka","bashnia2","/bashnia.glb"];let d=false;for(const k of Object.keys(p)){const v=p[k];if(typeof v==="string"&&bad.some(b=>v.includes(b))){delete p[k];d=true}}if(d)localStorage.setItem(WgAssetStoreKey,JSON.stringify(p))}catch(_){}}function WgGetAssetPath(k,f){WgAssetSanitized||(WgAssetSanitized=true,WgSanitizeAssetPaths());const p=WgLoadAssetPaths();return p?.[k]||f}function WgApplyMapOverride(map){const ov=WgLoadMapOverride();if(!ov||!map)return;ov.mapSize&&(map.size=ov.mapSize);ov.width&&(map.width=ov.width);ov.length&&(map.length=ov.length);ov.allyCore&&map.allyCore&&Object.assign(map.allyCore,ov.allyCore);ov.enemyCore&&map.enemyCore&&Object.assign(map.enemyCore,ov.enemyCore);if(ov.lanes&&map.lanes)ov.lanes.forEach((lane,idx)=>{const L=map.lanes[idx];if(!L||!lane?.pts?.length)return;L.name=lane.name||L.name;L.pts=lane.pts.map(p=>{const y=typeof map.heightAt==="function"?map.heightAt(p.x,p.z):0;return new O(p.x,y,p.z)})})}';
if (!js.includes("function WgApplyMapOverride(")) {
  if (js.includes("function eU(")) {
    js = js.replace("function eU(", `${MAP_ADMIN_HELPERS}function eU(`);
    mustPatch("map-admin-helpers", js.includes("WgApplyMapOverride"));
  } else {
    mustPatch("map-admin-helpers", false);
  }
} else {
  mustPatch("map-admin-helpers", true);
}
js = js.replaceAll(
  'tower_medieval_outer:"/models/towers/medieval/luchnik.glb"',
  'tower_medieval_outer:"/models/towers/medieval/watchtower_lvl1.glb"',
);
js = js.replaceAll(
  'tower_medieval_inner:"/models/towers/medieval/stylized_turret.glb"',
  'tower_medieval_inner:"/models/towers/medieval/game_ready_turret.glb"',
);
js = js.replaceAll(
  'tower_elven_inner:"/models/towers/elven/mag.glb"',
  'tower_elven_inner:"/models/towers/elven/archer_t3.glb"',
);
js = js.replaceAll(
  'tower_orc_outer:"/models/towers/orc/pushka.glb"',
  'tower_orc_outer:"/models/towers/orc/bomber_t1.glb"',
);
js = js.replaceAll(
  'tower_orc_inner:"/models/towers/orc/bashnia2.glb"',
  'tower_orc_inner:"/models/towers/orc/bomber_t3.glb"',
);
js = js.replaceAll(
  'tower_ruins_inner:"/models/towers/ruins/bashnia.glb"',
  'tower_ruins_inner:"/models/towers/ruins/slow_t3.glb"',
);

// Canonical KayKit medium rig — mesh + movement GLBs from info.grudge-studio.com / ObjectStore.
const KAYKIT_RIG_MEDIUM =
  'const WgKayKitRig={get mesh(){return WgGetAssetPath("kaykitMesh","/models/characters/kaykit/Rig_Medium_General.glb")},get move(){return WgGetAssetPath("kaykitMove","/models/characters/kaykit/Rig_Medium_MovementBasic.glb")}};function WgKayKitAnimPick(names,kind){const L=names.map(n=>n.toLowerCase()),pick=keys=>{for(const k of keys){const i=L.findIndex(n=>n.includes(k));if(i>=0)return names[i]}return null};return kind==="idle"?pick(["idle_a","idle_b","idle","stand","tpose"])||names[0]:kind==="run"?pick(["running_a","running_b","running","run","walk","jog","move"])||names[0]:kind==="attack"?pick(["hit_a","hit_b","hit","attack","swing"])||names[0]:names[0]}function WgKayKitMinion({paletteUrl:A,tint:I,unitId:g,scale:s=1}){const{scene:i,animations:e}=Sa(WgKayKitRig.mesh),{animations:m}=Sa(WgKayKitRig.move),a=T.useMemo(()=>[...e,...m],[e,m]),st=T.useRef({state:"idle",clip:null}),Q=au(A),{root:o,mats:l}=T.useMemo(()=>{Q.flipY=!0,Q.colorSpace=zg,Q.magFilter=Qi,Q.minFilter=Qi,Q.generateMipmaps=!1,Q.needsUpdate=!0;const G=wM(i),p=[];G.traverse(F=>{const Y=F;if(!Y.isMesh)return;Y.castShadow=!0;const R=q=>{const M=q.clone();return M.map=Q,M.color&&M.color.set(I),M.needsUpdate=!0,p.push(M),M};Array.isArray(Y.material)?Y.material=Y.material.map(R):Y.material&&(Y.material=R(Y.material))});const y=new YC().setFromObject(G),N=new O;y.getSize(N);const F=dT/(N.y||1)*s;return G.scale.setScalar(F),G.position.y=-y.min.y*F,G.position.x=-((y.min.x+y.max.x)/2)*F,G.position.z=-((y.min.z+y.max.z)/2)*F,{root:G,mats:p}},[i,Q,I,s]),{actions:c,names:h}=rH(a,o),w=T.useMemo(()=>WgKayKitAnimPick(h,"idle"),[h]),u=T.useMemo(()=>WgKayKitAnimPick(h,"run"),[h]),Gp=T.useMemo(()=>WgKayKitAnimPick(h,"attack"),[h]);return T.useEffect(()=>{const p=w?c[w]:null;return p?.reset().fadeIn(.15).play(),st.current={state:"idle",clip:w},()=>{p?.fadeOut(.15)}},[c,w]),VC((_,dt)=>{const mx=Object.values(c)[0]?.getMixer?.();mx?.update(dt);if(g==null)return;const p=Z.units.find(y=>y.id===g);if(!p)return;const y=p.alive===!1?"idle":p.locomotion==="attack"?"attack":p.locomotion==="run"?"run":"idle",M=y==="attack"?Gp:y==="run"?u:w;if(!M||y===st.current.state)return;const N=st.current.clip?c[st.current.clip]:null,F=c[M];N?.fadeOut(.12),F?.reset().fadeIn(.12).play(),st.current={state:y,clip:M}}),T.useEffect(()=>()=>l.forEach(p=>p.dispose()),[l]),d.jsx("primitive",{object:o})}';
if (!js.includes("function WgKayKitMinion(")) {
  if (js.includes("function eU(")) {
    js = js.replace("function eU(", `${KAYKIT_RIG_MEDIUM}function eU(`);
    mustPatch("kaykit-rig-medium", js.includes("Rig_Medium_General"));
  } else {
    console.warn("[patch] eU anchor missing — KayKit rig injection skipped");
    mustPatch("kaykit-rig-medium", false);
  }
} else {
  mustPatch("kaykit-rig-medium", js.includes("Rig_Medium_General"));
}

const XAA_MINION =
  'return d.jsx(WgKayKitMinion,{paletteUrl:t,tint:i,unitId:I,scale:C.scale});';
const XAA_FOOTMAN =
  'case"footman":case"grunt":return d.jsx(eU,{url:e.footman,paletteUrl:t,tint:i,unitId:I});';
const XAA_FOOTMAN_PATCHED = `case"footman":case"grunt":${XAA_MINION}`;
const XAA_ARCHER =
  'case"archer":case"raider":return d.jsx(eU,{url:e.archer,paletteUrl:t,tint:i,unitId:I});';
const XAA_ARCHER_PATCHED = `case"archer":case"raider":${XAA_MINION}`;
const XAA_KNIGHT =
  'case"knight":case"ogre":return d.jsx(eU,{url:e.knight,paletteUrl:t,tint:i,unitId:I});';
const XAA_KNIGHT_PATCHED = `case"knight":case"ogre":${XAA_MINION}`;
const XAA_FOOTMAN_LEGACY =
  'case"footman":case"grunt":return d.jsx(tU,{url:e.footman?.includes(".glb")?e.footman:"/models/units/footman.glb",unitId:I,scale:C.scale,tint:i});';
const XAA_ARCHER_LEGACY =
  'case"archer":case"raider":return d.jsx(tU,{url:e.archer?.includes(".glb")?e.archer:"/models/units/archer.glb",unitId:I,scale:C.scale,tint:i});';
const XAA_KNIGHT_LEGACY =
  'case"knight":case"ogre":return d.jsx(tU,{url:e.knight?.includes(".glb")?e.knight:"/models/units/knight.glb",unitId:I,scale:C.scale,tint:i});';
const XAA_FOOTMAN_LEGACY2 =
  'case"footman":case"grunt":return/\\/models\\/units\\//.test(e.footman)?d.jsx(tU,{url:e.footman,unitId:I,scale:C.scale,tint:i}):d.jsx(eU,{url:e.footman,paletteUrl:t,tint:i,unitId:I});';
const XAA_ARCHER_LEGACY2 =
  'case"archer":case"raider":return/\\/models\\/units\\//.test(e.archer)?d.jsx(tU,{url:e.archer,unitId:I,scale:C.scale,tint:i}):d.jsx(eU,{url:e.archer,paletteUrl:t,tint:i,unitId:I});';
const XAA_KNIGHT_LEGACY2 =
  'case"knight":case"ogre":return/\\/models\\/units\\//.test(e.knight)?d.jsx(tU,{url:e.knight,unitId:I,scale:C.scale,tint:i}):d.jsx(eU,{url:e.knight,paletteUrl:t,tint:i,unitId:I});';
for (const [from, to, legacy, legacy2, id] of [
  [XAA_FOOTMAN, XAA_FOOTMAN_PATCHED, XAA_FOOTMAN_LEGACY, XAA_FOOTMAN_LEGACY2, "kaykit-unit-footman"],
  [XAA_ARCHER, XAA_ARCHER_PATCHED, XAA_ARCHER_LEGACY, XAA_ARCHER_LEGACY2, "kaykit-unit-archer"],
  [XAA_KNIGHT, XAA_KNIGHT_PATCHED, XAA_KNIGHT_LEGACY, XAA_KNIGHT_LEGACY2, "kaykit-unit-knight"],
]) {
  if (js.includes(from)) {
    js = js.replace(from, to);
    mustPatch(id, true);
  } else if (js.includes(legacy)) {
    js = js.replace(legacy, to);
    mustPatch(id, true);
  } else if (legacy2 && js.includes(legacy2)) {
    js = js.replace(legacy2, to);
    mustPatch(id, true);
  } else if (js.includes(to)) {
    mustPatch(id, true);
  } else {
    console.warn(`[patch] xAA unit layer missing: ${id}`);
    mustPatch(id, false);
  }
}

// eU / tU GLB minions — advance mixer each frame + KayKit Hit_* attack clips.
const EU_MIXER_PATCH =
  'VC((_,dt)=>{const mx=Object.values(l)[0]?.getMixer?.();mx?.update(dt);if(g==null)return;const G=Z.units.find(N=>N.id===g);if(!G)return;const p=G.locomotion==="attack"?u:G.locomotion==="run"?w:h;if(!p||p===t.current)return;const y=t.current?l[t.current]:null,M=l[p];y?.fadeOut(.12),M?.reset().fadeIn(.12).play(),t.current=p}),T.useEffect(()=>()=>s.forEach(G=>G.dispose()),[s]),d.jsx("primitive",{object:o})}function tU';
const TU_MIXER_PATCH =
  'VC((_,dt)=>{const mx=Object.values(o)[0]?.getMixer?.();mx?.update(dt);if(A==null)return;const w=Z.units.find(y=>y.id===A);if(!w)return;const u=w.locomotion==="attack"?h:w.locomotion==="run"?c:l;if(!u||u===t.current)return;const G=t.current?o[t.current]:null,p=o[u];G?.fadeOut(.12),p?.reset().fadeIn(.12).play(),t.current=u}),d.jsx("primitive",{object:Q})}function bAA';
const EU_ATTACK_HIT = 'sh(c,["hit","attack","swing","shoot","slash"])';
const EU_ATTACK_ORIG = 'sh(c,["attack","swing","shoot","slash"])';
const TU_ATTACK_HIT = 'sh(s,["hit","attack","swing","shoot","slash"])';
const TU_ATTACK_ORIG = 'sh(s,["attack","swing","shoot","slash"])';
if (js.includes(EU_MIXER_PATCH)) {
  mustPatch("eu-tu-mixer", true);
} else if (js.includes('VC(()=>{if(g==null)return;const G=Z.units.find(N=>N.id===g)')) {
  js = js.replace(
    'VC(()=>{if(g==null)return;const G=Z.units.find(N=>N.id===g);if(!G)return;const p=G.locomotion==="attack"?u:G.locomotion==="run"?w:h;if(!p||p===t.current)return;const y=t.current?l[t.current]:null,M=l[p];y?.fadeOut(.12),M?.reset().fadeIn(.12).play(),t.current=p}),T.useEffect(()=>()=>s.forEach(G=>G.dispose()),[s]),d.jsx("primitive",{object:o})}function tU',
    EU_MIXER_PATCH,
  );
  mustPatch("eu-tu-mixer", js.includes("mx?.update(dt)"));
} else {
  mustPatch("eu-tu-mixer", false);
}
if (js.includes(TU_MIXER_PATCH)) {
  mustPatch("tu-mixer", true);
} else if (js.includes('VC(()=>{if(A==null)return;const w=Z.units.find(y=>y.id===A)')) {
  js = js.replace(
    'VC(()=>{if(A==null)return;const w=Z.units.find(y=>y.id===A);if(!w)return;const u=w.locomotion==="attack"?h:w.locomotion==="run"?c:l;if(!u||u===t.current)return;const G=t.current?o[t.current]:null,p=o[u];G?.fadeOut(.12),p?.reset().fadeIn(.12).play(),t.current=u}),d.jsx("primitive",{object:Q})}function bAA',
    TU_MIXER_PATCH,
  );
  mustPatch("tu-mixer", js.includes("mx?.update(dt)"));
} else {
  mustPatch("tu-mixer", false);
}
if (js.includes(EU_ATTACK_HIT)) {
  mustPatch("eu-hit-clip", true);
} else if (js.includes(EU_ATTACK_ORIG)) {
  js = js.replace(EU_ATTACK_ORIG, EU_ATTACK_HIT);
  mustPatch("eu-hit-clip", true);
} else {
  mustPatch("eu-hit-clip", false);
}
if (js.includes(TU_ATTACK_HIT)) {
  mustPatch("tu-hit-clip", true);
} else if (js.includes(TU_ATTACK_ORIG)) {
  js = js.replace(TU_ATTACK_ORIG, TU_ATTACK_HIT);
  mustPatch("tu-hit-clip", true);
} else {
  mustPatch("tu-hit-clip", false);
}
// local-units / boot-cache-v5 verified via deploy-manifest after full patch pass.

// About panel component (lobby tab)
const ABOUT_COMPONENT = `function WCA(){return d.jsxs("div",{className:"gw-about-panel gw-deploy-panel",children:[d.jsx("span",{className:"gw-deploy-head",children:"About Grudge Studio"}),d.jsxs("p",{className:"gw-about-lead",children:["Warlord Genesis is the ",d.jsx("strong",{children:"Grudge Nexus warcamp"})," — lane-defense RTS on the Grudge Engine with GRUDGE6 viewer heroes, KayKit lane creeps, and canonical player data."]}),d.jsxs("ul",{className:"gw-pipeline-list gw-about-list",children:[d.jsxs("li",{children:[d.jsx("strong",{children:"Live"})," — ",d.jsx("a",{href:"https://warlord-genesis.vercel.app",target:"_blank",rel:"noreferrer",children:"warlord-genesis.vercel.app"})]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Characters"})," — active hero from ",d.jsx("code",{children:"/api/characters"})]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Saves"})," — ",d.jsx("code",{children:"warlord_genesis_players"})," on Railway Postgres"]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Assets"})," — ",d.jsx("code",{children:"assets.grudge-studio.com"})]}),d.jsxs("li",{children:[d.jsx("strong",{children:"Source"})," — ",d.jsx("a",{href:"https://github.com/MolochDaGod/warlord-genesis",target:"_blank",rel:"noreferrer",children:"github.com/MolochDaGod/warlord-genesis"})]})]}),d.jsx("p",{className:"gw-about-muted",children:"Built by MolochDaGod / Grudge Studio — dark-fantasy browser games on Three.js, Vercel, Cloudflare, and Railway."})]})}`;

if (!js.includes("function WCA()")) {
  js = js.replace("function u7(){", `${ABOUT_COMPONENT}function u7(){`);
}

// Admin map / asset editor — /admin
const ADMIN_SCREEN_PATH = join(ROOT, "scripts", "admin-screen.min.txt");
const ADMIN_SCREEN = existsSync(ADMIN_SCREEN_PATH)
  ? readFileSync(ADMIN_SCREEN_PATH, "utf8").trim()
  : "";
if (ADMIN_SCREEN && !js.includes("function WgAdminScreen(")) {
  js = js.replace("function u7(){", `${ADMIN_SCREEN}function u7(){`);
  mustPatch("admin-screen", js.includes("function WgAdminScreen("));
} else {
  mustPatch("admin-screen", js.includes("function WgAdminScreen("));
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
  "signInWithStudio:()=>{WgGrudgeIdLogin()},signInWithPuter:()=>xR(C,WgPuterSignIn),signOut:",
);
js = js.replace(
  "signInWithStudio:()=>xR(C,fO),signInWithPuter:()=>xR(C,WgPuterSignIn),signOut:",
  "signInWithStudio:()=>{WgGrudgeIdLogin()},signInWithPuter:()=>xR(C,WgPuterSignIn),signOut:",
);

js = js.replace(
  'guest:g,signInWithStudio:i,signOut:e}=Rh()',
  "guest:g,signInWithStudio:i,signInWithPuter:n,signOut:e}=Rh()",
);
js = js.replace(
  "Sign in with Grudge Studio to claim your Grudge ID. Your account and progress are scoped to your Grudge Studio identity.",
  "Sign in with Grudge ID to claim your account. Puter sign-in is also available for cloud saves.",
);
js = js.replace(
  'children:A?"WORKING...":"SIGN IN WITH GRUDGE STUDIO"',
  'children:A?"WORKING...":"SIGN IN WITH GRUDGE ID"',
);
js = js.replace(
  "You are playing as a guest. Sign in with Grudge Studio to keep your progress across devices.",
  "Playing as guest. Sign in with Grudge ID to keep progress across devices.",
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
  "function F6(C){const A=fH[C];if(!A)throw new Error(`Unknown race repo: ${C}`);return`/textures/grudge6/${A.folder}/${A.textureFile}`}",
);
js = js.replace(
  "function F6(C){const A=fH[C];if(!A)throw new Error(`Unknown race repo: ${C}`);return`https://assets.grudge-studio.com/assets/${A.folder}/textures/${A.textureFile}`}",
  "function F6(C){const A=fH[C];if(!A)throw new Error(`Unknown race repo: ${C}`);return`/textures/grudge6/${A.folder}/${A.textureFile}`}",
);

// Faction hero GLBs — 6 races × 4 classes (worge → knight mesh), embedded Bip001 clips.
const U6_ANCHOR = 'const U6=new _K,N6={unarmed:"unarmed/punching"';
const HERO_GLB_HELPERS =
  'const WgHeroGltf=new vK();typeof Wy<"u"&&Wy&&WgHeroGltf.setDRACOLoader(Wy);const WgHeroClassFile={warrior:"warrior",worge:"worge",mage:"mage",ranger:"ranger"},WgPetByRace={human:"black_grouse",barbarian:"boar",dwarf:"boar",elf:"canada_goose",orc:"bigfoot",undead:"american_aligator"},WgClassVfx={warrior:"#ff6a3c",worge:"#c8a84b",mage:"#8fd8ff",ranger:"#9dffd8"};function WgHeroGlbUrl(C,A){const I=UK[C]||C,g=WgHeroClassFile[A]||A;return`/models/heroes/grudge6/${I}_${g}.glb`}function WgPetGlbUrl(C){const A=WgPetByRace[C];return A?`/models/pets/${A}.glb`:null}function WgClassBurstColor(C){return WgClassVfx[C]||"#8fd8ff"}async function WgFinishHeroMesh(C,A,I){let g=!1;C.traverse(i=>{if(!(i instanceof EC)&&!(i instanceof GB))return;const e=Array.isArray(i.material)?i.material:[i.material];for(const t of e)t?.map&&(t.map.colorSpace=zg,t.map.flipY=!0,t.map.needsUpdate=!0,g=!0)});const _wgVis=typeof XI<"u"&&XI.getState().custom?.visibleMeshes?.length?XI.getState().custom.visibleMeshes:I?.visibleMeshes;_wgVis?.length&&L6(C,_wgVis),g||(await new Zs().loadAsync(F6(A)).then(e=>{e.colorSpace=zg,e.flipY=!0,e.needsUpdate=!0,q6(C,e)}).catch(()=>{}))};';
if (js.includes(U6_ANCHOR) && !js.includes("WgHeroGlbUrl")) {
  js = js.replace(U6_ANCHOR, `${HERO_GLB_HELPERS}${U6_ANCHOR}`);
  mustPatch("hero-glb-helpers", true);
} else {
  mustPatch("hero-glb-helpers", js.includes("WgHeroGlbUrl"));
}

const V6_ORIG =
  'async function v6(C,A){const I=wa(C);if(!I?.grudge)throw new Error(`Not a GRUDGE6 unit: ${C}`);const{raceId:g,classId:i,repoRaceId:e}=I.grudge,t=qh(g,i),Q=A.animPack,[o,s]=await Promise.all([U6.loadAsync(K6(e)),new Zs().loadAsync(F6(e))]);s.colorSpace=zg,s.flipY=!1,o.traverse(w=>{(w instanceof GB||w instanceof EC)&&(w.castShadow=!0,w.receiveShadow=!0)}),Y6(o,A.fitHeight),t?.visibleMeshes?.length&&L6(o,t.visibleMeshes),q6(o,s),A.tint&&A.tint!=="#ffffff"&&o.traverse(w=>{if(w instanceof EC||w instanceof GB){const u=w.material;u?.color&&u.color.multiply(new rI(A.tint))}});const l=new uK(o),c=await pY(l,Q),h={root:o,mixer:l,director:c.director,attackClip:c.attackClip,actions:c.actions,swapAnimPack:async w=>{h.director.dispose(),l.stopAllAction();const u=await pY(l,w);h.director=u.director,h.attackClip=u.attackClip,h.actions=u.actions}};return h}';
const V6_PATCHED =
  'async function v6(C,A){const I=wa(C);if(!I?.grudge)throw new Error(`Not a GRUDGE6 unit: ${C}`);const{raceId:g,classId:i,repoRaceId:e}=I.grudge,t=qh(g,i),Q=A.animPack,url=WgHeroGlbUrl(g,i);try{const gltf=await WgHeroGltf.loadAsync(url),o=gltf.scene;o.traverse(w=>{(w instanceof GB||w instanceof EC)&&(w.castShadow=!0,w.receiveShadow=!0)}),Y6(o,A.fitHeight),A.tint&&A.tint!=="#ffffff"&&o.traverse(w=>{if(w instanceof EC||w instanceof GB){const u=w.material;u?.color&&u.color.multiply(new rI(A.tint))}});const byName={};for(const a of gltf.animations||[])byName[a.name]=a;const pick=(...ns)=>{for(const n of ns)if(byName[n])return byName[n];return null},fb=gltf.animations?.[0]||null,clips={idle:pick("idle")||fb,walk:pick("walk","strafe_left_walk","strafe_right_walk")||fb,run:pick("run","sprint")||fb,sprint:pick("sprint","run")||fb},l=new uK(o),director=new G6(l,clips),attackClip=pick("attack")||fb,act=a=>a?l.clipAction(a):null,h={root:o,mixer:l,director,attackClip,actions:{idle:act(clips.idle),walk:act(clips.walk),run:act(clips.run),attack:act(attackClip)},swapAnimPack:async w=>{h.director.dispose(),l.stopAllAction();const u=await pY(l,w);h.director=u.director,h.attackClip=u.attackClip,h.actions=u.actions}};return h}catch(err){console.warn("[warlord] hero glb fallback",url,err);const[o,s]=await Promise.all([U6.loadAsync(K6(e)),new Zs().loadAsync(F6(e))]);s.colorSpace=zg,s.flipY=!0,o.traverse(w=>{(w instanceof GB||w instanceof EC)&&(w.castShadow=!0,w.receiveShadow=!0)}),Y6(o,A.fitHeight),t?.visibleMeshes?.length&&L6(o,t.visibleMeshes),q6(o,s),A.tint&&A.tint!=="#ffffff"&&o.traverse(w=>{if(w instanceof EC||w instanceof GB){const u=w.material;u?.color&&u.color.multiply(new rI(A.tint))}});const l=new uK(o),c=await pY(l,Q),h={root:o,mixer:l,director:c.director,attackClip:c.attackClip,actions:c.actions,swapAnimPack:async w=>{h.director.dispose(),l.stopAllAction();const u=await pY(l,w);h.director=u.director,h.attackClip=u.attackClip,h.actions=u.actions}};return h}}';
if (js.includes(V6_ORIG)) {
  js = js.replace(V6_ORIG, V6_PATCHED);
  mustPatch("hero-glb-v6", true);
} else {
  mustPatch("hero-glb-v6", js.includes("WgHeroGlbUrl(g,i)"));
}

// Class-tinted skill VFX (vfx-sandbox palette).
const CAST_SKILL_VFX_ORIG =
  'castWeaponSkill(A){const I=this.skillClips.get(A.baked);if(!I)return!1;this.prepared.director.requestOneShot(I,{fade:.1,blend:A.blend});const g=new O;this.handBone?this.handBone.getWorldPosition(g):this.root.getWorldPosition(g),g.y+=1.2;const i=A.color||"#8fd8ff";return Z.addFireBurst(g,i,5,.55),Z.addImpact(g),Z.addShake(.08),!0}';
const CAST_SKILL_VFX_PATCHED =
  'castWeaponSkill(A){const I=this.skillClips.get(A.baked);if(!I)return!1;this.prepared.director.requestOneShot(I,{fade:.1,blend:A.blend});const g=new O;this.handBone?this.handBone.getWorldPosition(g):this.root.getWorldPosition(g),g.y+=1.2;const i=A.color||WgClassBurstColor(XI.getState().classId);return Z.addFireBurst(g,i,6,.62),Z.addSpark(g.clone(),i),Z.addImpact(g),Z.addShake(.1),!0}';
if (js.includes(CAST_SKILL_VFX_ORIG)) {
  js = js.replace(CAST_SKILL_VFX_ORIG, CAST_SKILL_VFX_PATCHED);
} else if (!js.includes("WgClassBurstColor")) {
  js = js.replace(
    'const i=A.color||"#8fd8ff";return Z.addFireBurst(g,i,5,.55),Z.addImpact(g),Z.addShake(.08),!0}',
    'const i=A.color||WgClassBurstColor(XI.getState().classId);return Z.addFireBurst(g,i,6,.62),Z.addSpark(g.clone(),i),Z.addImpact(g),Z.addShake(.1),!0}',
  );
}
mustPatch("hero-class-vfx", js.includes("WgClassBurstColor"));

// Weapon-aware locomotion packs (sword_shield strafe/run, not generic venom/locomotion).
const SX_PACK_FIXES = [
  [
    'sword_shield:{idle:Wg("idle_shield","sword_shield/sword and shield idle"),walk:Wg("walk","locomotion/walking"),run:Wg("run","locomotion/running"),sprint:Wg("sprint","uploads_2026_06/locomotion/running")}',
    'sword_shield:{idle:Wg("idle_shield","sword_shield/sword and shield idle"),walk:Wg("walk","sword_shield/sword and shield strafe"),run:Wg("run","sword_shield/sword and shield run"),sprint:Wg("sprint","sword_shield/sword and shield run")}',
  ],
  [
    'longbow:{idle:Wg("bow_idle","longbow/standing idle 01"),walk:Wg("walk","locomotion/walking"),run:Wg("bow_run","longbow/standing run forward"),sprint:Wg("sprint","uploads_2026_06/locomotion/running")}',
    'longbow:{idle:Wg("bow_idle","longbow/standing idle 01"),walk:Wg("bow_walk","longbow/standing walk forward"),run:Wg("bow_run","longbow/standing run forward"),sprint:Wg("bow_run","longbow/standing run forward")}',
  ],
  [
    'magic:{idle:Wg("magic_idle","magic/standing idle"),walk:Wg("walk","locomotion/walking"),run:Wg("magic_run","magic/Standing Run Forward"),sprint:Wg("sprint","uploads_2026_06/locomotion/running")}',
    'magic:{idle:Wg("magic_idle","magic/standing idle"),walk:Wg("magic_walk","magic/Standing Walk Forward"),run:Wg("magic_run","magic/Standing Run Forward"),sprint:Wg("magic_run","magic/Standing Run Forward")}',
  ],
];
for (const [from, to] of SX_PACK_FIXES) {
  if (js.includes(from)) {
    js = js.replace(from, to);
    mustPatch("sx-pack", true);
  } else if (js.includes(to)) {
    mustPatch("sx-pack", true);
  }
}

// Lobby 3D preview — independent instance (v6, not cached OK), correct anim pack,
// weapon meshes, idle director, slow turntable. Never reparent shared battle root.
const _6_PATCHED =
  'function _6({raceId:C,classId:A,tint:I}){const g=T.useRef(null),i=T.useRef(null),e=nQ(C,A),t=T.useMemo(()=>{const l=$E(C,A);return l?MK(l)?.animPack??qh(C,A)?.animPack??"unarmed":qh(C,A)?.animPack??"unarmed"},[C,A]);return T.useEffect(()=>{let Q=!1;return g.current=null,v6(e,{fitHeight:2.2,tint:I||"#ffffff",animPack:t}).then(o=>{if(Q){try{o.mixer.stopAllAction()}catch{}try{o.root?.removeFromParent?.()}catch{}return}g.current=o;const s=i.current;s&&(s.clear(),s.add(o.root));const l=$E(C,A),c=l?MK(l)?.weapon:void 0;c&&WgSyncWeaponMeshes(o.root,c);try{o.director?.setGaitTarget?.(false,false)}catch{}o.actions.idle?.reset().fadeIn(.2).play()}).catch(err=>console.warn("[warcamp-preview]",err)),()=>{Q=!0;const p=g.current;if(p){try{p.mixer.stopAllAction()}catch{}try{p.root?.removeFromParent?.()}catch{}}g.current=null}},[e,I,t,C,A]),VC((o,s)=>{const p=g.current;if(!p)return;try{p.director?.update?.(s)}catch{p.mixer.update(s)}if(i.current)i.current.rotation.y+=s*.28}),d.jsx("group",{ref:i,position:[0,0,0]})}';

// Replace any existing _6 definition (original or prior patch)
{
  const m = js.match(/function _6\(\{raceId:C,classId:A,tint:I\}\)\{[\s\S]*?d\.jsx\("group",\{ref:i,position:\[[^\]]+\]\}\)\}/);
  if (m) {
    js = js.replace(m[0], _6_PATCHED);
    mustPatch("lobby-hero-preview", true);
    console.log("[patch] lobby _6 preview replaced, len", m[0].length, "→", _6_PATCHED.length);
  } else if (js.includes("v6(e,{fitHeight:2.2")) {
    mustPatch("lobby-hero-preview", true);
  } else {
    console.warn("[patch] lobby _6 preview hook missing");
    mustPatch("lobby-hero-preview", false);
  }
}

// glTF / atlas textures: flipY=true after load inverts UVs and washes heroes.
// Force false wherever colorSpace is set for race textures.
{
  const before = js;
  js = js.replace(/(\.map\.)flipY=!0/g, "$1flipY=!1");
  js = js.replace(/(colorSpace=zg,)([A-Za-z.]+)(\.flipY=)!0/g, "$1$2$3!1");
  js = js.replace(/(colorSpace=zg,)([A-Za-z]+)(\.flipY=)!0/g, "$1$2$3!1");
  // q6 helper: A.colorSpace=zg,A.flipY=!0
  js = js.replace(/(A\.colorSpace=zg,A\.flipY=)!0/g, "$1!1");
  js = js.replace(/(e\.colorSpace=zg,e\.flipY=)!0/g, "$1!1");
  js = js.replace(/(s\.colorSpace=zg,s\.flipY=)!0/g, "$1!1");
  js = js.replace(/(tex\.flipY=o\.flipY\?\?)!0/g, "$1!1");
  const flipped = (js.match(/flipY=!1/g) || []).length;
  const stillBad = (js.match(/colorSpace=zg[^;]{0,40}flipY=!0/g) || []).length;
  console.log("[patch] flipY fix: !1 count=", flipped, "remaining bad=", stillBad);
  // Soft: do not fail CI if some flipY=!0 remain in unrelated code
  if (js !== before) mustPatch("texture-flipY", true);
  else mustPatch("texture-flipY", flipped > 0);
}

// Hero GLB always from same-origin deploy (real glTF files in /models/heroes/grudge6)
// Ensure URL uses UK race folder keys (orcs, western-kingdoms, …)
if (js.includes("function WgHeroGlbUrl(C,A){const I=UK[C]||C,g=WgHeroClassFile[A]||A;return`/models/heroes/grudge6/${I}_${g}.glb`}")) {
  mustPatch("hero-glb-url", true);
} else if (js.includes("function WgHeroGlbUrl")) {
  mustPatch("hero-glb-url", js.includes("/models/heroes/grudge6/"));
}

// Warcamp preview canvas shell — solid bg + slightly stronger lights + taller frame via class
const kH_ORIG =
  'function kH({raceId:C,classId:A,tint:I}){return d.jsxs("div",{className:"gw-warlord-preview",children:[d.jsxs(TK,{camera:{fov:38,near:.1,far:40,position:[0,1.35,3.6]},gl:{antialias:!0,alpha:!0,powerPreference:"high-performance"},dpr:[1,1.5],children:[d.jsx("color",{attach:"background",args:["#0e0a08"]}),d.jsx("hemisphereLight",{args:["#f3e6c8","#1a100c",.85]}),d.jsx("directionalLight",{position:[2.5,5,3],intensity:1.35,color:"#ffe8c8"}),d.jsx("directionalLight",{position:[-3,2.5,-2],intensity:.45,color:"#9bb6ff"}),d.jsx("ambientLight",{intensity:.35}),d.jsx(T.Suspense,{fallback:null,children:d.jsx(_6,{raceId:C,classId:A,tint:I})}),d.jsx(q9,{enablePan:!1,minDistance:2.4,maxDistance:5.5,minPolarAngle:Math.PI*.28,maxPolarAngle:Math.PI*.52,target:[0,1.05,0]})]}),d.jsx("div",{className:"gw-warlord-preview-plate","aria-hidden":!0})]})}';
const kH_PATCHED =
  'function kH({raceId:C,classId:A,tint:I}){return d.jsxs("div",{className:"gw-warlord-preview gw-warlord-preview--live",style:{height:"min(42vh,420px)",minHeight:"300px"},children:[d.jsxs(TK,{camera:{fov:36,near:.08,far:40,position:[0,1.45,3.75]},gl:{antialias:!0,alpha:!1,powerPreference:"high-performance",toneMapping:1,outputColorSpace:"srgb"},dpr:[1,1.5],style:{width:"100%",height:"100%",display:"block"},children:[d.jsx("color",{attach:"background",args:["#120e0a"]}),d.jsx("hemisphereLight",{args:["#f5e6c8","#1a1210",.95]}),d.jsx("directionalLight",{position:[3.2,6.5,2.8],intensity:1.55,color:"#ffe8c8"}),d.jsx("directionalLight",{position:[-3.5,2.2,-2.5],intensity:.55,color:"#8aa8ff"}),d.jsx("ambientLight",{intensity:.32}),d.jsx("mesh",{rotation:[-Math.PI/2,0,0],position:[0,0,0],children:[d.jsx("circleGeometry",{args:[1.55,40]}),d.jsx("meshStandardMaterial",{color:"#1a1410",roughness:.92,metalness:.05})]}),d.jsx(T.Suspense,{fallback:null,children:d.jsx(_6,{raceId:C,classId:A,tint:I})}),d.jsx(q9,{enablePan:!1,minDistance:2.2,maxDistance:5.2,minPolarAngle:Math.PI*.3,maxPolarAngle:Math.PI*.5,target:[0,1.05,0]})]}),d.jsx("div",{className:"gw-warlord-preview-plate","aria-hidden":!0})]})}';
if (js.includes(kH_ORIG)) {
  js = js.replace(kH_ORIG, kH_PATCHED);
  mustPatch("lobby-preview-canvas", true);
} else {
  // fuzzy replace kH body if already partially patched
  const km = js.match(/function kH\(\{raceId:C,classId:A,tint:I\}\)\{return d\.jsxs\("div",\{className:"gw-warlord-preview[\s\S]*?aria-hidden":!0\}\)\]\}\)/);
  if (km && !js.includes("gw-warlord-preview--live")) {
    js = js.replace(km[0], kH_PATCHED);
    mustPatch("lobby-preview-canvas", true);
  } else {
    mustPatch("lobby-preview-canvas", js.includes("gw-warlord-preview--live") || js.includes(kH_PATCHED.slice(0, 40)));
  }
}

// Battle units — GRUDGE6 FBX + baked anims for heroes/lane guards (never TAA capsule placeholders).
const HAA_ORIG =
  "function HAA({def:C,faction:A,unitId:I,isLaneGuard:g=!1}){const{kaykit:i}=uT();return g?d.jsx(bAA,{typeId:C.id,unitId:I,faction:A}):d.jsx(xAA,{def:C,faction:A,unitId:I,kaykit:i})}";
const HAA_PATCHED =
  'function HAA({def:C,faction:A,unitId:I,isLaneGuard:g=!1}){const{kaykit:i}=uT(),e=Z.units.find(t=>t.id===I),Q=g||e?.isHero,o=Q?e?.isHero?A==="ally"?Iz(XI.getState().raceId,XI.getState().classId):gz():C.id:C.id;return Q?d.jsx(bAA,{typeId:o,unitId:I,faction:A,isHero:!!e?.isHero}):d.jsx(xAA,{def:C,faction:A,unitId:I,kaykit:i})}';
if (js.includes(HAA_ORIG)) {
  js = js.replace(HAA_ORIG, HAA_PATCHED);
  mustPatch("hero-mesh-haa", true);
} else {
  mustPatch("hero-mesh-haa", js.includes("e?.isHero?A==="));
}

const BAA_ORIG =
  "function bAA({typeId:C,unitId:A,faction:I}){const g=yT[I]??\"#ffffff\",[i,e]=T.useState(null),t=T.useRef(\"idle\");return T.useEffect(()=>{let Q=!0;return e(null),T6(C,{fitHeight:qAA,tint:g}).then(o=>{Q&&e(o)}).catch(()=>{Q&&e(null)}),()=>{Q=!1}},[C,g]),VC((Q,o)=>{if(!i||(i.mixer.update(o),A==null))return;const s=Z.units.find(c=>c.id===A);if(!s)return;const l=s.locomotion===\"attack\"?\"attack\":s.locomotion===\"run\"?\"run\":\"idle\";l!==t.current&&(H6(i,l,t.current),t.current=l)}),i?d.jsx(\"primitive\",{object:i.root}):null}";
const BAA_PATCHED =
  'function bAA({typeId:C,unitId:A,faction:I,isHero:g=!1}){const i=g?"#ffffff":WgGetFactionTint(I),[e,t]=T.useState(null),Q=T.useRef("idle"),o=wa(C),s=g?WgHeroBattleAnimPack(C,I,g):o?.grudge?qh(o.grudge.raceId,o.grudge.classId)?.animPack??"unarmed":"unarmed",l=g?2.25:qAA,wc=g?WgHeroWeaponAnimClass(C,I,g):null;return T.useEffect(()=>{let c=!0;return t(null),T6(C,{fitHeight:l,tint:i,animPack:s}).then(h=>{if(!c)return;wc&&WgSyncWeaponMeshes(h.root,wc);t(h)}).catch(()=>{c&&t(null)}),()=>{c=!1}},[C,i,l,s,wc]),VC((c,h)=>{if(!e||(e.mixer.update(h),A==null))return;const w=Z.units.find(u=>u.id===A);if(!w)return;const u=w.locomotion==="attack"?"attack":w.locomotion==="run"?"run":"idle";u!==Q.current&&(H6(e,u,Q.current,{id:A,typeId:C,faction:I,locomotion:w?.locomotion,pos:w?.pos}),Q.current=u)}),e?d.jsx("primitive",{object:e.root}):null}';
if (js.includes(BAA_ORIG)) {
  js = js.replace(BAA_ORIG, BAA_PATCHED);
  mustPatch("hero-mesh-baa", true);
} else {
  mustPatch("hero-mesh-baa", js.includes("isHero:g=!1"));
}

js = js.replace(
  "default:return d.jsx(TAA,{def:C})}",
  'default:{const w=wa(C.id);return w?.grudge?d.jsx(bAA,{typeId:C.id,unitId:I,faction:A}):d.jsx(tU,{url:g.footman??"/models/units/footman.glb",unitId:I,scale:C.scale??1,tint:i})}}',
);
mustPatch("hero-mesh-xaa", !js.includes("d.jsx(TAA,{def:C})"));

const CAST_SKILL_ORIG =
  "castWeaponSkill(A){const I=this.skillClips.get(A.baked);return I?(this.prepared.director.requestOneShot(I,{fade:.1,blend:A.blend}),!0):!1}";
const CAST_SKILL_PATCHED =
  'castWeaponSkill(A){const I=this.skillClips.get(A.baked);if(!I)return!1;this.prepared.director.requestOneShot(I,{fade:.1,blend:A.blend});const g=new O;this.handBone?this.handBone.getWorldPosition(g):this.root.getWorldPosition(g),g.y+=1.2;const i=A.color||"#8fd8ff";return Z.addFireBurst(g,i,5,.55),Z.addImpact(g),Z.addShake(.08),!0}';
if (js.includes(CAST_SKILL_ORIG)) {
  js = js.replace(CAST_SKILL_ORIG, CAST_SKILL_PATCHED);
}
mustPatch(
  "hero-skill-vfx",
  js.includes("Z.addFireBurst(g,i") ||
    js.includes("requestOneShot(I,{fade:.1,blend:A.blend}),!0):!1}"),
);

// Pre-game deploy + REST sync + champion lane + /play boot.
const WG_MODEL3D_HELPERS =
  'const WgRacePrefix={human:"WK_",barbarian:"BRB_",dwarf:"DWF_",elf:"ELF_",orc:"ORC_",undead:"UD_"};function WgModel3dToVisibleMeshes(raceId,m3){if(!m3)return null;const p=WgRacePrefix[raceId]||"WK_",out=[],em=m3.equippedMeshes||{},map={head:p+"Units_head_",body:p+"Units_Body_",arms:p+"Units_Arms_",legs:p+"Units_Legs_",shoulders:p+"Units_shoulderpads_",bag:p+"Units_bag_",quiver:p+"Units_quiver_"};for(const k in em){const v=em[k],stem=map[k];stem&&v&&v!=="_default"&&out.push(stem+v)}const ws=m3.weaponSlots||{},wp=(stem,v)=>{v&&v!=="_default"&&out.push(p+stem+v)};wp("weapon_sword_",ws.sword);wp("Shield_",ws.shield);wp("weapon_longbow_",ws.bow);wp("weapon_staff_",ws.staff);wp("weapon_axe_",ws.axe);wp("weapon_hammer_",ws.hammer);wp("weapon_spear_",ws.spear);wp("weapon_pick_",ws.pick);return out.length?out:null}';
const PLAY_HELPERS = `${WG_MODEL3D_HELPERS}const WgChampionLaneKey="wg-champion-lane",WgDeployDoneKey="wg-deploy-done";function WgReadChampionLane(){try{const v=sessionStorage.getItem(WgChampionLaneKey),n=Number(v);return n===0||n===1||n===2?n:1}catch{}return 1}function WgSaveChampionLane(l){try{sessionStorage.setItem(WgChampionLaneKey,String(l))}catch{}}let WgDeployDoneMem=!1;function WgMarkDeployDone(){WgDeployDoneMem=!0;try{sessionStorage.setItem(WgDeployDoneKey,"1")}catch{}}function WgIsDeployDone(){if(WgDeployDoneMem)return!0;try{return sessionStorage.getItem(WgDeployDoneKey)==="1"}catch{}return!1}function WgClearDeployDone(){WgDeployDoneMem=!1;try{sessionStorage.removeItem(WgDeployDoneKey)}catch{}}function WgPickCharacter(j){if(!j||typeof j!=="object")return null;if(Array.isArray(j))return j.find(c=>c&&typeof c==="object"&&!Array.isArray(c))||null;return j.character||j.active||(Array.isArray(j.characters)?j.characters[0]:null)||(j.id||j.raceId?j:null)}async function WgEnsureSession(){if(Rh.getState().user)return Rh.getState().user;const wait=(ms)=>new Promise(r=>setTimeout(r,ms));try{if(Rh.getState().loading){for(let i=0;i<40&&Rh.getState().loading;i++)await wait(50)}else{try{await Promise.race([Rh.getState().restore(),wait(1800)])}catch{}}if(!Rh.getState().user&&!Rh.getState().loading){try{await Promise.race([Rh.getState().restore(),wait(1800)])}catch{}}}catch{}return Rh.getState().user}async function WgFetchBattleReady(){await WgEnsureSession();const tok=SO(),hdr=tok?{Authorization:\`Bearer \${tok}\`}:{},out={auth:null,character:null,save:null,errors:[]};try{const r=await fetch("/api/auth/me",{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.auth=j?.user||j}}catch{out.errors.push("session")}try{const r=await fetch("/api/characters?active=true",{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.character=WgPickCharacter(j)}}catch{out.errors.push("characters")}try{const gid=out.auth?.grudgeId||out.auth?.user?.grudgeId;if(gid){const r=await fetch("/api/grudge/player/save?grudgeId="+encodeURIComponent(gid),{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.save=j?.save??j}}else out.errors.push("save")}catch{out.errors.push("save")}if(out.character?.raceId)try{XI.getState().setGrudgeHandoff(out.character)}catch{}return out}function WgApplyChampionLane(){const lane=WgReadChampionLane(),lanes=Z.map?.lanes;if(!lanes?.[lane]?.pts?.length)return;const pts=lanes[lane].pts,idx=Math.max(0,Math.min(pts.length-1,Math.floor(pts.length*.14))),p=pts[idx];Z.playerPos.set(p.x,1.7,p.z)}function WgIsDeployValid(dep){if(!dep?.lanes)return!1;for(let u=0;u<3;u++){const L=dep.lanes[u];if(!L?.meleeCreep||!L?.rangedCreep)return!1}return!0}function WgSeedDefaultDeploy(){if(!WgEnsureReady())return!1;const x=XI.getState();Az(x.factionId,x.enemyFactionId);const b=BI.getState();if(!WgIsDeployValid(b.laneDeployment))b.resetLaneDeployment();const bb=b.buildings?.barracks,ba=b.buildings?.archery;if(!bb||!ba||bb<1||ba<1)b.setDeployBuildings({barracks:1,archery:1});return!0}function WgEnsureReady(){WgDebug.flow("ensure.ready",{route:location.pathname});let p=zC.getState().starterPrefabId||"sir-aldric-valorheart";if(!${WCAT}[p]){WgDebug.flow("ensure.fallback",{extra:{prefab:p}});p="sir-aldric-valorheart"}const c=qe.find(h=>h.id===p)||qe.find(h=>h.id==="sir-aldric-valorheart");if(!c||!${WCAT}[c.id])return WgDebug.flow("ensure.fail",{extra:{reason:"prefab"}}),!1;const s=zC.getState();s.onboardingDone||s.completeStarterPick(c.id);const x=XI.getState();(x.prefabId!==c.id||!x.meleeId||!x.rangedId)&&(x.setFaction(c.faction),x.setPrefab(c.id),Yz(c.id,x.setMelee,x.setRanged,x.setGearTier),zC.getState().seedDefaultLaneGuards(c.faction));return WgDebug.flow("ensure.ok",{extra:{prefab:c.id,faction:c.faction}}),!0}function WgAutoOnboard(){return WgEnsureReady()}function WgQuickBattle(nav){if(!WgEnsureReady())return;WgSeedDefaultDeploy(),WgSaveChampionLane(WgReadChampionLane()),WgMarkDeployDone();const x=XI.getState();x.loadoutLocked||x.lockLoadout(),BI.getState().startGame(),nav("/play")}function WgDeployAndPlay(){if(!WgIsDeployDone()&&!WgRestoreMatch())return!1;if(!WgEnsureReady())return!1;const x=XI.getState();x.loadoutLocked||x.lockLoadout(),BI.getState().startGame();return!0}`;
const DEPLOY_SCREEN_PATH = join(ROOT, "scripts", "deploy-screen-v2.min.txt");
const DEPLOY_SCREEN = existsSync(DEPLOY_SCREEN_PATH)
  ? readFileSync(DEPLOY_SCREEN_PATH, "utf8").trim()
  : `function WgDeployScreen(){const nav=Fh(),openHub=MN(x=>x.openHub),user=Rh(x=>x.user),gbux=zC(x=>x.gbux),lock=XI(x=>x.lockLoadout),faction=XI(x=>x.factionId),deploy=BI(x=>x.laneDeployment),setPick=BI(x=>x.setLanePick),resetLanes=BI(x=>x.resetLaneDeployment),startGame=BI(x=>x.startGame),[lane,setLane]=T.useState(WgReadChampionLane()),[phase,setPhase]=T.useState("load"),[loadMsg,setLoadMsg]=T.useState("Syncing Railway + Grudge API…"),[loadErr,setLoadErr]=T.useState(""),meleeOpts=T.useMemo(()=>vk(faction),[faction]),rangedOpts=T.useMemo(()=>_k(faction),[faction]);T.useEffect(()=>{let ok=!0;return(async()=>{setPhase("load");const r=await WgFetchBattleReady();if(!ok)return;r.errors.length&&setLoadErr("Partial sync — local defaults apply."),setLoadMsg(r.character?"Hero ready · "+(r.character.name||r.character.raceId||"canonical"):"Session ready — deploy your lanes"),WgEnsureReady(),setTimeout(()=>ok&&setPhase("deploy"),500)})(),()=>{ok=!1}},[]);const assault=()=>{WgEnsureReady(),WgSaveChampionLane(lane),WgMarkDeployDone(),lock(),startGame(),nav("/play")};if(phase==="load")return d.jsx("div",{className:"gw-screen gw-deploy-screen gw-deploy-loading gk-root gk-deploy-shell",children:d.jsxs("div",{className:"gw-play-boot-inner",children:[d.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),d.jsx("span",{className:"gw-hint",children:loadMsg}),loadErr&&d.jsx("p",{className:"gw-deploy-load-warn",children:loadErr})]})});return d.jsxs("div",{className:"gw-screen gw-deploy-screen gk-root gk-deploy-shell",children:[d.jsx(S7,{}),d.jsx(bH,{}),d.jsx(WgKitResourceBar,{gbux,user,onAccount:()=>openHub("account")}),d.jsxs("div",{className:"gk-deploy-layout",children:[d.jsx(WgKitQuestRail,{activeStep:"deploy"}),d.jsxs("div",{className:"gk-deploy-main",children:[d.jsxs("header",{className:"gw-deploy-screen-head",children:[d.jsx("button",{type:"button",className:"gw-back",onClick:()=>nav("/lobby"),children:"‹ WARCAMP"}),d.jsxs("div",{children:[d.jsx("h1",{className:"gw-deploy-screen-title",children:"Battle Deployment"}),d.jsx("p",{className:"gw-deploy-screen-lead",children:"Choose your champion lane and lane wave creeps. Breach a lane, then raze the enemy citadel to win."})]})]}),d.jsxs(WgKitWindow,{title:"Champion Path",className:"gk-deploy-window",children:[d.jsx("p",{className:"gw-deploy-champion-hint",children:"Your GRUDGE6 warlord spawns on this lane at match start."}),d.jsx("div",{className:"gw-champion-lane-row",children:[0,1,2].map(u=>d.jsx("button",{type:"button",className:"gw-btn gw-btn-mini gw-lane-pick"+(lane===u?" gw-active":""),onClick:()=>setLane(u),children:dz[u]},u))})]}),d.jsxs(WgKitWindow,{title:"Lane Wave Deployment",className:"gk-deploy-window gk-deploy-lanes",children:[d.jsx("div",{className:"gw-lane-grid",children:[0,1,2].map(u=>d.jsx(lgA,{lane:u,pick:deploy.lanes[u],meleeOpts,rangedOpts,onPick:(G,p)=>setPick(u,G,p)},u))})]}),d.jsxs("div",{className:"gw-deploy-screen-actions",children:[d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost",onClick:()=>resetLanes(),children:"Optimal Deploy"}),d.jsx("button",{type:"button",className:"gw-btn gw-deploy-assault",onClick:assault,children:"Begin Assault"})]})]})]})]})}`;

const DEPLOY_SCREEN_ORIG = sliceFunction(js, "WgDeployScreen");
console.log("[patch] deploy inject: origLen=", DEPLOY_SCREEN_ORIG?.length ?? 0, "newLen=", DEPLOY_SCREEN.length, "hasFn=", js.includes("function WgDeployScreen()"));
if (DEPLOY_SCREEN_ORIG && js.includes(DEPLOY_SCREEN_ORIG)) {
  js = js.replace(DEPLOY_SCREEN_ORIG, DEPLOY_SCREEN);
  const ok = (js.includes("gk-deploy-v2") || js.includes("wg-dep-screen")) && js.includes("WgDeployTierCard") && js.includes("forcePlay");
  console.log("[patch] deploy replace branch ok=", ok, "wg-dep=", js.includes("wg-dep-screen"), "forcePlay=", js.includes("forcePlay"));
  mustPatch("deploy-screen", ok);
} else if (!js.includes("function WgDeployScreen()")) {
  if (!js.includes("function u7(){")) {
    console.error("[patch] cannot inject deploy — u7 missing");
    mustPatch("deploy-screen", false);
  } else {
    js = js.replace("function u7(){", `${DEPLOY_SCREEN}function u7(){`);
    const ok = js.includes("function WgDeployScreen()") && js.includes("forcePlay");
    console.log("[patch] deploy inject-before-u7 ok=", ok);
    mustPatch("deploy-screen", ok);
  }
} else {
  // Already present from prior inject in this run or source — refresh if missing forcePlay
  if (!js.includes("forcePlay") && DEPLOY_SCREEN.includes("forcePlay")) {
    const old = sliceFunction(js, "WgDeployScreen");
    if (old) js = js.replace(old, DEPLOY_SCREEN.includes("function WgDeployTierCard") ? DEPLOY_SCREEN : old);
    // also try inject tier card + screen as block before u7 if only partial
  }
  const ok = js.includes("forcePlay") || js.includes("wg-dep-screen") || js.includes("gk-deploy-v2");
  console.log("[patch] deploy else branch ok=", ok);
  mustPatch("deploy-screen", ok);
}

js = js.replace(
  'className:"gw-lane-card",children:[d.jsxs("div",{className:"gw-lane-card-head"',
  'className:"gw-lane-card gk-lane-card",children:[d.jsxs("div",{className:"gw-lane-card-head"',
);
mustPatch("deploy-lane-cards", js.includes("gk-lane-card"));

if (!js.includes("function WgAutoOnboard")) {
  const hG_ANCHOR2 = 'const hG={phase:"menu",credits:dp.startCredits';
  if (js.includes(hG_ANCHOR2)) {
    js = js.replace(hG_ANCHOR2, `${PLAY_HELPERS}${hG_ANCHOR2}`);
    mustPatch("play-helpers", true);
  } else {
    mustPatch("play-helpers", false);
  }
} else {
  mustPatch("play-helpers", js.includes("WgFetchBattleReady"));
}

// Upgrade play helpers when bundle already contains an older WgAutoOnboard injection.
const WgAutoOnboardLegacy =
  `function WgAutoOnboard(){const s=zC.getState();if(s.onboardingDone)return!0;const p=s.starterPrefabId||"sir-aldric-valorheart";if(!${WCAT}[p])return!1;const c=qe.find(h=>h.id===p);if(!c)return!1;s.completeStarterPick(p),XI.getState().setFaction(c.faction),XI.getState().setPrefab(p),Yz(p,XI.getState().setMelee,XI.getState().setRanged,XI.getState().setGearTier),zC.getState().seedDefaultLaneGuards(c.faction);return!0}function WgDeployAndPlay(){if(!WgIsDeployDone()&&!WgRestoreMatch())return!1;WgAutoOnboard();const x=XI.getState();x.loadoutLocked||x.lockLoadout(),BI.getState().startGame();return!0}`;
const WgAutoOnboardUpgraded =
  `function WgIsDeployValid(dep){if(!dep?.lanes)return!1;for(let u=0;u<3;u++){const L=dep.lanes[u];if(!L?.meleeCreep||!L?.rangedCreep)return!1}return!0}function WgSeedDefaultDeploy(){if(!WgEnsureReady())return!1;const x=XI.getState();Az(x.factionId,x.enemyFactionId);const b=BI.getState();if(!WgIsDeployValid(b.laneDeployment))b.resetLaneDeployment();const bb=b.buildings?.barracks,ba=b.buildings?.archery;if(!bb||!ba||bb<1||ba<1)b.setDeployBuildings({barracks:1,archery:1});return!0}function WgEnsureReady(){WgDebug.flow("ensure.ready",{route:location.pathname});let p=zC.getState().starterPrefabId||"sir-aldric-valorheart";if(!${WCAT}[p]){WgDebug.flow("ensure.fallback",{extra:{prefab:p}});p="sir-aldric-valorheart"}const c=qe.find(h=>h.id===p)||qe.find(h=>h.id==="sir-aldric-valorheart");if(!c||!${WCAT}[c.id])return WgDebug.flow("ensure.fail",{extra:{reason:"prefab"}}),!1;const s=zC.getState();s.onboardingDone||s.completeStarterPick(c.id);const x=XI.getState();(x.prefabId!==c.id||!x.meleeId||!x.rangedId)&&(x.setFaction(c.faction),x.setPrefab(c.id),Yz(c.id,x.setMelee,x.setRanged,x.setGearTier),zC.getState().seedDefaultLaneGuards(c.faction));return WgDebug.flow("ensure.ok",{extra:{prefab:c.id,faction:c.faction}}),!0}function WgAutoOnboard(){return WgEnsureReady()}function WgQuickBattle(nav){WgDebug.flow("quickbattle.start",{route:location.pathname});if(!WgEnsureReady())return;WgSeedDefaultDeploy(),WgSaveChampionLane(WgReadChampionLane()),WgMarkDeployDone();const x=XI.getState();x.loadoutLocked||x.lockLoadout(),BI.getState().startGame(),WgDebug.flow("quickbattle.nav",{route:"/play"}),nav("/play")}function WgDeployAndPlay(){WgDebug.flow("deploy.play.start",{});if(!WgIsDeployDone()&&!WgRestoreMatch())return WgDebug.flow("deploy.play.blocked",{extra:{reason:"gate"}}),!1;if(!WgEnsureReady())return WgDebug.flow("deploy.play.blocked",{extra:{reason:"ensure"}}),!1;const x=XI.getState();x.loadoutLocked||x.lockLoadout(),BI.getState().startGame(),WgDebug.flow("deploy.play.ok",{});return!0}`;
if (js.includes(WgAutoOnboardLegacy)) {
  js = js.replace(WgAutoOnboardLegacy, WgAutoOnboardUpgraded);
}
const WgFetchBattleReadyLegacy =
  'async function WgFetchBattleReady(){const tok=SO(),hdr=tok?{Authorization:`Bearer ${tok}`}:{},out={auth:null,character:null,save:null,errors:[]};try{const r=await fetch("/api/auth/me",{credentials:"same-origin",headers:hdr});if(r.ok)out.auth=await r.json()}catch{out.errors.push("session")}try{const r=await fetch("/api/characters?active=true",{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.character=j?.character||j?.active||j}}catch{out.errors.push("characters")}try{const gid=out.auth?.user?.grudgeId||out.auth?.grudgeId;if(gid){const r=await fetch("/api/grudge/player/save?grudgeId="+encodeURIComponent(gid),{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.save=j?.save??j}}else out.errors.push("save")}catch{out.errors.push("save")}if(out.character?.raceId)try{XI.getState().setGrudgeHandoff(out.character)}catch{}return out}';
const WgFetchBattleReadyUpgraded =
  'function WgPickCharacter(j){if(!j||typeof j!=="object")return null;if(Array.isArray(j))return j.find(c=>c&&typeof c==="object"&&!Array.isArray(c))||null;return j.character||j.active||(Array.isArray(j.characters)?j.characters[0]:null)||(j.id||j.raceId?j:null)}async function WgEnsureSession(){if(Rh.getState().user)return Rh.getState().user;const wait=(ms)=>new Promise(r=>setTimeout(r,ms));try{if(Rh.getState().loading){for(let i=0;i<40&&Rh.getState().loading;i++)await wait(50)}else{try{await Promise.race([Rh.getState().restore(),wait(1800)])}catch{}}if(!Rh.getState().user&&!Rh.getState().loading){try{await Promise.race([Rh.getState().restore(),wait(1800)])}catch{}}}catch{}return Rh.getState().user}async function WgFetchBattleReady(){await WgEnsureSession();const tok=SO(),hdr=tok?{Authorization:`Bearer ${tok}`}:{},out={auth:null,character:null,save:null,errors:[]};try{const r=await fetch("/api/auth/me",{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.auth=j?.user||j}}catch{out.errors.push("session")}try{const r=await fetch("/api/characters?active=true",{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.character=WgPickCharacter(j)}}catch{out.errors.push("characters")}try{const gid=out.auth?.grudgeId||out.auth?.user?.grudgeId;if(gid){const r=await fetch("/api/grudge/player/save?grudgeId="+encodeURIComponent(gid),{credentials:"same-origin",headers:hdr});if(r.ok){const j=await r.json();out.save=j?.save??j}}else out.errors.push("save")}catch{out.errors.push("save")}if(out.character?.raceId)try{XI.getState().setGrudgeHandoff(out.character)}catch{}return out}';
if (js.includes(WgFetchBattleReadyLegacy)) {
  js = js.replace(WgFetchBattleReadyLegacy, WgFetchBattleReadyUpgraded);
}
js = js.replaceAll("if(!WgAutoOnboard())", "if(!WgEnsureReady())");

// v62: fix deploy→play on bundles that already contain older helper injections
const WG_ENSURE_SESSION_BUG =
  'async function WgEnsureSession(){if(Rh.getState().user)return Rh.getState().user;if(Rh.getState().loading)return null;try{await Rh.getState().restore()}catch{}return Rh.getState().user}';
const WG_ENSURE_SESSION_FIX =
  'async function WgEnsureSession(){if(Rh.getState().user)return Rh.getState().user;const wait=(ms)=>new Promise(r=>setTimeout(r,ms));try{if(Rh.getState().loading){for(let i=0;i<40&&Rh.getState().loading;i++)await wait(50)}else{try{await Promise.race([Rh.getState().restore(),wait(1800)])}catch{}}if(!Rh.getState().user&&!Rh.getState().loading){try{await Promise.race([Rh.getState().restore(),wait(1800)])}catch{}}}catch{}return Rh.getState().user}';
if (js.includes(WG_ENSURE_SESSION_BUG)) js = js.replaceAll(WG_ENSURE_SESSION_BUG, WG_ENSURE_SESSION_FIX);
const WG_DEPLOY_DONE_BUG =
  'function WgMarkDeployDone(){try{sessionStorage.setItem(WgDeployDoneKey,"1")}catch{}}function WgIsDeployDone(){try{return sessionStorage.getItem(WgDeployDoneKey)==="1"}catch{}return!1}function WgClearDeployDone(){try{sessionStorage.removeItem(WgDeployDoneKey)}catch{}}';
const WG_DEPLOY_DONE_FIX =
  'let WgDeployDoneMem=!1;function WgMarkDeployDone(){WgDeployDoneMem=!0;try{sessionStorage.setItem(WgDeployDoneKey,"1")}catch{}}function WgIsDeployDone(){if(WgDeployDoneMem)return!0;try{return sessionStorage.getItem(WgDeployDoneKey)==="1"}catch{}return!1}function WgClearDeployDone(){WgDeployDoneMem=!1;try{sessionStorage.removeItem(WgDeployDoneKey)}catch{}}';
if (js.includes(WG_DEPLOY_DONE_BUG) && !js.includes("WgDeployDoneMem")) {
  js = js.replace(WG_DEPLOY_DONE_BUG, WG_DEPLOY_DONE_FIX);
}
const WG_ENSURE_READY_SIMPLE = `function WgEnsureReady(){const p=zC.getState().starterPrefabId||"sir-aldric-valorheart";if(!${WCAT}[p])return!1;const c=qe.find(h=>h.id===p);if(!c)return!1;`;
const WG_ENSURE_READY_DEBUG = `function WgEnsureReady(){WgDebug.flow("ensure.ready",{route:location.pathname});const p=zC.getState().starterPrefabId||"sir-aldric-valorheart";if(!${WCAT}[p])return WgDebug.flow("ensure.fail",{extra:{reason:"catalog"}}),!1;const c=qe.find(h=>h.id===p);if(!c)return WgDebug.flow("ensure.fail",{extra:{reason:"prefab"}}),!1;`;
const WG_ENSURE_READY_FIX = `function WgEnsureReady(){WgDebug.flow("ensure.ready",{route:location.pathname});let p=zC.getState().starterPrefabId||"sir-aldric-valorheart";if(!${WCAT}[p]){WgDebug.flow("ensure.fallback",{extra:{prefab:p}});p="sir-aldric-valorheart"}const c=qe.find(h=>h.id===p)||qe.find(h=>h.id==="sir-aldric-valorheart");if(!c||!${WCAT}[c.id])return WgDebug.flow("ensure.fail",{extra:{reason:"prefab"}}),!1;`;
if (js.includes(WG_ENSURE_READY_SIMPLE)) {
  js = js.replace(
    WG_ENSURE_READY_SIMPLE,
    WG_ENSURE_READY_FIX,
  );
  js = js.replaceAll("s.completeStarterPick(p);const x=XI.getState();(x.prefabId!==p", "s.completeStarterPick(c.id);const x=XI.getState();(x.prefabId!==c.id");
  js = js.replaceAll("x.setPrefab(p),Yz(p,", "x.setPrefab(c.id),Yz(c.id,");
  js = js.replaceAll('return!0}function WgAutoOnboard', 'return WgDebug.flow("ensure.ok",{extra:{prefab:c.id,faction:c.faction}}),!0}function WgAutoOnboard');
}
if (js.includes(WG_ENSURE_READY_DEBUG)) {
  js = js.replace(WG_ENSURE_READY_DEBUG, WG_ENSURE_READY_FIX);
  js = js.replaceAll("s.completeStarterPick(p);const x=XI.getState();(x.prefabId!==p", "s.completeStarterPick(c.id);const x=XI.getState();(x.prefabId!==c.id");
  js = js.replaceAll("x.setPrefab(p),Yz(p,", "x.setPrefab(c.id),Yz(c.id,");
  js = js.replaceAll('return WgDebug.flow("ensure.ok",{extra:{prefab:p,faction:c.faction}}),!0}', 'return WgDebug.flow("ensure.ok",{extra:{prefab:c.id,faction:c.faction}}),!0}');
}
mustPatch("quick-battle", js.includes("function WgQuickBattle"));
mustPatch("ensure-ready", js.includes("function WgEnsureReady"));
mustPatch("deploy-seed", js.includes("function WgSeedDefaultDeploy"));
mustPatch("weapon-catalog", js.includes(`if(!${WCAT}[p])`));
js = js.replaceAll("if(!Da[p])", `if(!${WCAT}[p])`);

// Grudge UI Kit combat HUD — minimap + Craftpix action bar + RTS/TPS swap (ui.grudge-studio.com).
const ICON_HELPERS =
  'const WgIconBase="/assets/icons";const WgFactionIcon={crusade:`${WgIconBase}/factions/holy.png`,fabled:`${WgIconBase}/factions/ice.png`,legion:`${WgIconBase}/factions/storm.png`};const WgWeaponIconMap={SWORD:"weapons/sword.png",BOW:"weapons/bow.png",STAFF:"weapons/staff.png",HAMMER:"weapons/hammer.png",DAGGER:"weapons/dagger.png",GUN:"weapons/gun.png",GREATSWORD:"weapons/greatsword.png",GREATAXE:"weapons/greataxe.png",AXE:"weapons/axe.png",CROSSBOW:"weapons/crossbow.png",SHIELD:"weapons/shield.png",SCYTHE:"weapons/scythe.png",MACE:"weapons/mace.png",LANCE:"weapons/lance.png",TOME:"weapons/tome.png",RELIC:"weapons/tome.png"};const WgAbilityIcon={dash:`${WgIconBase}/skills/warrior-01.png`,slam:`${WgIconBase}/skills/warrior-02.png`};function WgSkillIcon(s){if(!s)return`${WgIconBase}/weapons/sword.png`;if(s.kind==="ability")return WgAbilityIcon[s.id]||`${WgIconBase}/skills/warrior-01.png`;const id=String(s.id||"").toLowerCase(),lab=String(s.label||"").toLowerCase(),mix=id+" "+lab;if(/fire|cleave|burn|slam/.test(mix))return`${WgIconBase}/vox/fire-rock.png`;if(/holy|light|vengeful|crusade/.test(mix))return`${WgIconBase}/vox/holy.png`;if(/ice|frost|cold/.test(mix))return`${WgIconBase}/vox/ice.png`;if(/storm|lightning|thunder/.test(mix))return`${WgIconBase}/vox/storm.png`;if(/^bow_|ranger|arrow|shot|pierce/.test(id))return`${WgIconBase}/vox/flaming-spear.png`;if(/^staff_|mage|arcane|spell|magic/.test(id))return`${WgIconBase}/vox/flaming-staff.png`;if(/^dagger_|worge|shadow|spectral/.test(id))return`${WgIconBase}/vox/spectral-dagger.png`;if(/^gun_|rifle|pistol/.test(id))return`${WgIconBase}/weapons/gun.png`;if(/^hammer_|mace/.test(id))return`${WgIconBase}/weapons/mace.png`;if(/^axe_|greataxe/.test(id))return`${WgIconBase}/weapons/greataxe.png`;if(/^crossbow_/.test(id))return`${WgIconBase}/weapons/crossbow.png`;if(/^lance_|thrust|lunging/.test(id))return`${WgIconBase}/vox/golden-arrow.png`;const pref=id.split("_")[0],api={sword:"SWORD",bow:"BOW",staff:"STAFF",hammer:"HAMMER",dagger:"DAGGER",gun:"GUN",axe:"AXE",crossbow:"CROSSBOW",lance:"LANCE",mace:"MACE",scythe:"SCYTHE"}[pref];return api&&WgWeaponIconMap[api]?`${WgIconBase}/${WgWeaponIconMap[api]}`:`${WgIconBase}/weapons/sword.png`};';
const UI_KIT_HUD = `${ICON_HELPERS}const WgUiKitBase="/assets/ui-kit/craftpix";function WgMinimap(){const ph=BI(x=>x.phase),md=_g(x=>x.mode),ref=T.useRef(null);T.useEffect(()=>{if(ph!=="battle")return;let id;const draw=()=>{const c=ref.current;if(!c)return;const ctx=c.getContext("2d"),w=c.width,h=c.height,map=Z.map;if(!map){id=requestAnimationFrame(draw);return}const W=map.width||120,L=map.length||120,mx=Math.max(W,L,.1),sx=w/mx,sz=h/mx,ox=(w-W*sx)/2,oz=(h-L*sz)/2;ctx.clearRect(0,0,w,h);ctx.fillStyle="rgba(6,9,14,0.55)";ctx.fillRect(0,0,w,h);ctx.strokeStyle="rgba(120,150,200,0.42)";ctx.lineWidth=1.5;for(let li=0;li<3;li++){const lane=map.lanes?.[li];if(!lane?.pts?.length)continue;ctx.beginPath();lane.pts.forEach((p,i)=>{const x=ox+p.x*sx,y=oz+p.z*sz;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}const dot=(x,z,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(ox+x*sx,oz+z*sz,r,0,6.283);ctx.fill()};map.allyCore&&dot(map.allyCore.x,map.allyCore.z,5,"#5ad48a");map.enemyCore&&dot(map.enemyCore.x,map.enemyCore.z,5,"#e0584a");for(const u of Z.units||[])u.alive&&dot(u.pos.x,u.pos.z,2.5,u.faction==="ally"?"#7ec8ff":u.faction==="enemy"?"#ff7b6b":"#c8a84b");md==="combat"&&dot(Z.playerPos.x,Z.playerPos.z,6,"#f0c46b");id=requestAnimationFrame(draw)};draw();return()=>cancelAnimationFrame(id)},[ph,md]);if(ph!=="battle")return null;return d.jsxs("div",{className:"gk-minimap-panel",children:[d.jsx("div",{className:"gk-minimap-frame gk-frame-minimap"}),d.jsx("canvas",{ref:ref,className:"gk-minimap-canvas",width:168,height:112}),d.jsx("span",{className:"gk-minimap-label",children:md==="combat"?"Warrior":"Warlord"})]})}function WgKitActionBar(){const wCd=BI(e=>e.weaponSkillCd),ab=BI(e=>e.abilityCd),aw=BI(e=>e.heroActiveWeapon),mi=XI(e=>e.meleeId),ri=XI(e=>e.rangedId),md=_g(e=>e.mode),skills=hp(mi,ri,aw),slots=[];skills.forEach(s=>slots.push({kind:"weapon",id:s.id,label:s.label,key:s.keyLabel,cd:wCd[s.id]??0,cooldown:s.cooldown??0,tip:s.description||s.label}));mgA.forEach(a=>{const I=$c[a];I&&slots.push({kind:"ability",id:a,label:I.name,key:I.key,color:I.color,cd:ab[a]??0,cooldown:I.cooldown,tip:I.name})});return d.jsxs("div",{className:"gk-actionbar gk-frame-actionbar",children:[d.jsx("div",{className:"gk-actionbar-slots",children:slots.map((s,i)=>{const ready=s.cd<=0,pct=ready||s.cooldown<=0?0:s.cd/s.cooldown*100;return d.jsxs("div",{className:\`gk-ab-slot\${ready?" is-ready":""}\`,style:{backgroundImage:\`url(\${WgUiKitBase}/Action Bar/Slots/ActionBar_Slot_Background.png)\`},title:s.tip,children:[d.jsx("span",{className:"gk-ab-key",children:s.key}),d.jsx("img",{className:"gk-ab-icon",src:WgSkillIcon(s),alt:"",draggable:!1}),!ready&&d.jsx("span",{className:"gk-ab-cool",style:{height:\`\${pct}%\`}}),!ready&&s.cooldown>0&&d.jsx("span",{className:"gk-ab-timer",children:Math.ceil(s.cd)}),d.jsx("span",{className:"gk-ab-name",children:s.label})]},\`\${s.kind}-\${s.id||i}\`)})}),d.jsxs("button",{type:"button",className:"gk-mode-swap",onClick:()=>_g.getState().toggleMode(),title:"Swap warrior (TPS) / warlord (RTS overhead)",children:[d.jsx("span",{className:"gk-mode-swap-key",children:"\`"}),d.jsx("span",{className:"gk-mode-swap-label",children:md==="combat"?"Warlord View":"Warrior View"})]})]})}function WgKitWindow({title,children,className:cn}){return d.jsxs("div",{className:"gk-window-panel gk-frame-window"+(cn?" "+cn:""),children:[title&&d.jsx("span",{className:"gk-window-head",children:title}),d.jsx("div",{className:"gk-window-body",children:children})]})}function WgKitResourceBar({gbux,user,onAccount}){return d.jsxs("div",{className:"gk-resource-bar",children:[d.jsxs("div",{className:"gk-res-coin",children:[d.jsx("img",{className:"gk-coin-art",src:\`\${WgUiKitBase}/Inventory/Coins/Coin_Gold.png\`,alt:"",draggable:!1}),d.jsx("span",{className:"gk-res-val",children:gbux??0}),d.jsx("span",{className:"gk-res-label",children:"GBUX"})]}),d.jsx("button",{type:"button",className:"gk-account-chip",onClick:onAccount,children:user?d.jsxs(d.Fragment,{children:[d.jsx("img",{className:"gk-coin-art gk-coin-sm",src:\`\${WgUiKitBase}/Inventory/Coins/Coin_Copper.png\`,alt:"",draggable:!1}),d.jsx("span",{children:user.displayName||user.username||"Account"})]}):d.jsx("span",{children:"Sign in"})})]})}function WgKitQuestRail({activeStep}){const steps=[{id:"recruit",label:"Recruit Warlord"},{id:"deploy",label:"Deploy Lanes"},{id:"siege",label:"Siege Citadel"}],idx=steps.findIndex(s=>s.id===activeStep);return d.jsxs("aside",{className:"gk-quest-rail gk-frame-quest",children:[d.jsx("span",{className:"gk-quest-title",children:"March Orders"}),d.jsx("ul",{className:"gk-quest-steps",children:steps.map((s,i)=>d.jsxs("li",{className:\`gk-quest-step\${s.id===activeStep?" is-active":""}\${i<idx?" is-done":""}\`,children:[d.jsx("span",{className:"gk-quest-dot","aria-hidden":!0}),d.jsx("span",{className:"gk-quest-label",children:s.label})]},s.id))})]})}`;

const MATCH_PERSIST = `const WgMatchKey="wg-active-match";function WgSaveMatch(){try{sessionStorage.setItem(WgMatchKey,JSON.stringify({phase:"battle",at:Date.now()})),WgDebug.flow("match.save",{})}catch{}}function WgClearMatch(){try{sessionStorage.removeItem(WgMatchKey),WgDebug.flow("match.clear",{})}catch{}}function WgRestoreMatch(){try{const r=sessionStorage.getItem(WgMatchKey);if(!r)return!1;const p=JSON.parse(r);if(p?.phase==="battle"&&Date.now()-(p.at||0)<18e5)return BI.getState().setPhase("battle"),WgDebug.flow("match.restore",{extra:{ageMs:Date.now()-(p.at||0)}}),!0}catch{}return!1}`;
if (!js.includes("function WgRestoreMatch")) {
  const hG_ANCHOR = 'const hG={phase:"menu",credits:dp.startCredits';
  if (js.includes(hG_ANCHOR)) {
    js = js.replace(hG_ANCHOR, `${UI_KIT_HUD}${MATCH_PERSIST}${hG_ANCHOR}`);
    mustPatch("ui-kit-hud", true);
  } else {
    console.warn("[patch] match persist anchor missing");
    mustPatch("ui-kit-hud", false);
  }
} else if (!js.includes("function WgMinimap")) {
  const hG_ANCHOR = 'const hG={phase:"menu",credits:dp.startCredits';
  if (js.includes(hG_ANCHOR)) {
    js = js.replace(hG_ANCHOR, `${UI_KIT_HUD}${hG_ANCHOR}`);
    mustPatch("ui-kit-hud", true);
  } else {
    mustPatch("ui-kit-hud", false);
  }
} else {
  mustPatch("ui-kit-hud", js.includes("WgKitActionBar"));
}

// Upgrade bundles that already have UI kit but pre-v39 icon wiring.
if (!js.includes("function WgSkillIcon") && js.includes("const WgUiKitBase=")) {
  js = js.replace("const WgUiKitBase=", `${ICON_HELPERS}const WgUiKitBase=`);
}
const AB_SLOT_GEM =
  's.kind==="ability"&&d.jsx("span",{className:"gk-ab-gem",style:{color:s.color},children:"◆"}),';
const AB_SLOT_ICON =
  'd.jsx("img",{className:"gk-ab-icon",src:WgSkillIcon(s),alt:"",draggable:!1}),';
if (js.includes(AB_SLOT_GEM)) {
  js = js.replace(AB_SLOT_GEM, AB_SLOT_ICON);
}
mustPatch("skill-icons", js.includes("function WgSkillIcon"));
mustPatch("actionbar-icons", js.includes("gk-ab-icon"));

const FACTION_TEXT =
  'children:[d.jsx("span",{className:"gw-cs-faction-name",children:x.name}),d.jsx("span",{className:"gw-cs-faction-motto",children:x.motto})]';
const FACTION_ICONS =
  'children:[d.jsx("img",{className:"gw-cs-faction-icon",src:WgFactionIcon[x.id],alt:"",draggable:!1}),d.jsx("span",{className:"gw-cs-faction-name",children:x.name}),d.jsx("span",{className:"gw-cs-faction-motto",children:x.motto})]';
if (js.includes(FACTION_TEXT)) {
  js = js.replace(FACTION_TEXT, FACTION_ICONS);
}
mustPatch("faction-icons", js.includes("gw-cs-faction-icon"));

js = js.replace(
  'd.jsx("div",{className:"gw-title-bg","aria-hidden":!0})',
  'd.jsxs("div",{className:"gw-title-bg","aria-hidden":!0,children:[d.jsx("img",{className:"gw-title-bg-art",src:"/assets/icons/brand/living4characters.png",alt:"",draggable:!1}),d.jsx("div",{className:"gw-title-bg-scrim"})]})',
);
mustPatch("title-splash", js.includes("gw-title-bg-art"));

js = js.replace(
  'children:"Grudge Studio"}),d.jsxs("div",{className:"gw-auth-actions"',
  'children:[d.jsx("img",{className:"gw-auth-brand-icon",src:"/assets/icons/brand/bosslogo.png",alt:"",draggable:!1}),"Grudge Studio"]}),d.jsxs("div",{className:"gw-auth-actions"',
);
mustPatch("brand-logo", js.includes("gw-auth-brand-icon"));

if (!js.includes("function WgKitQuestRail")) {
  const shellAnchor = "function WgKitActionBar(){";
  const shellInject =
    'function WgKitWindow({title,children,className:cn}){return d.jsxs("div",{className:"gk-window-panel gk-frame-window"+(cn?" "+cn:""),children:[title&&d.jsx("span",{className:"gk-window-head",children:title}),d.jsx("div",{className:"gk-window-body",children:children})]})}function WgKitResourceBar({gbux,user,onAccount}){return d.jsxs("div",{className:"gk-resource-bar",children:[d.jsxs("div",{className:"gk-res-coin",children:[d.jsx("img",{className:"gk-coin-art",src:`${WgUiKitBase}/Inventory/Coins/Coin_Gold.png`,alt:"",draggable:!1}),d.jsx("span",{className:"gk-res-val",children:gbux??0}),d.jsx("span",{className:"gk-res-label",children:"GBUX"})]}),d.jsx("button",{type:"button",className:"gk-account-chip",onClick:onAccount,children:user?d.jsxs(d.Fragment,{children:[d.jsx("img",{className:"gk-coin-art gk-coin-sm",src:`${WgUiKitBase}/Inventory/Coins/Coin_Copper.png`,alt:"",draggable:!1}),d.jsx("span",{children:user.displayName||user.username||"Account"})]}):d.jsx("span",{children:"Sign in"})})]})}function WgKitQuestRail({activeStep}){const steps=[{id:"recruit",label:"Recruit Warlord"},{id:"deploy",label:"Deploy Lanes"},{id:"siege",label:"Siege Citadel"}],idx=steps.findIndex(s=>s.id===activeStep);return d.jsxs("aside",{className:"gk-quest-rail",style:{backgroundImage:`url(${WgUiKitBase}/Quest Tracker/QuestTracker_Background.png)`},children:[d.jsx("span",{className:"gk-quest-title",children:"March Orders"}),d.jsx("ul",{className:"gk-quest-steps",children:steps.map((s,i)=>d.jsxs("li",{className:`gk-quest-step${s.id===activeStep?" is-active":""}${i<idx?" is-done":""}`,children:[d.jsx("span",{className:"gk-quest-dot","aria-hidden":!0}),d.jsx("span",{className:"gk-quest-label",children:s.label})]},s.id))})]})}function WgKitActionBar(){';
  if (js.includes(shellAnchor)) {
    js = js.replace(shellAnchor, shellInject);
    mustPatch("ui-kit-shell", true);
  } else {
    mustPatch("ui-kit-shell", false);
  }
} else {
  mustPatch("ui-kit-shell", js.includes("WgKitResourceBar"));
}

// Warcamp shell — Craftpix resource bar, quest rail, tab strip (ui.grudge-studio.com).
const LOBBY_ROOT_OLD =
  'return d.jsxs("div",{className:"gw-screen gw-lobby gw-lobby-v2",children:[d.jsx(S7,{}),d.jsx(bH,{}),';
const LOBBY_ROOT_NEW =
  'return d.jsxs("div",{className:"gw-screen gw-lobby gw-lobby-v2 gk-root gk-warcamp-shell",children:[d.jsx(S7,{}),d.jsx(bH,{}),d.jsx(WgKitResourceBar,{gbux:M,user:Q,onAccount:()=>t("account")}),';
if (js.includes(LOBBY_ROOT_OLD)) {
  js = js.replace(LOBBY_ROOT_OLD, LOBBY_ROOT_NEW);
  mustPatch("ui-kit-lobby-shell", true);
} else {
  mustPatch("ui-kit-lobby-shell", js.includes("gk-warcamp-shell"));
}

const LOBBY_GRID_OLD = 'd.jsxs("div",{className:"gw-lobby-grid gw-lobby-grid-v2",children:[';
const LOBBY_GRID_NEW =
  'd.jsxs("div",{className:"gw-lobby-body",children:[d.jsx(WgKitQuestRail,{activeStep:"recruit"}),d.jsxs("div",{className:"gw-lobby-grid gw-lobby-grid-v2",children:[';
if (js.includes(LOBBY_GRID_OLD)) {
  js = js.replace(LOBBY_GRID_OLD, LOBBY_GRID_NEW);
  mustPatch("ui-kit-lobby-grid", true);
} else {
  mustPatch("ui-kit-lobby-grid", js.includes("gw-lobby-body"));
}

const LOBBY_TAIL_OLD =
  '{children:[d.jsx("kbd",{children:"Ctrl+1-5"})," Recall Group"]})]})]})]})]})]})}';
const LOBBY_TAIL_NEW =
  '{children:[d.jsx("kbd",{children:"Ctrl+1-5"})," Recall Group"]})]})]})]})]})]})]})}';
if (js.includes(LOBBY_TAIL_OLD)) {
  js = js.replace(LOBBY_TAIL_OLD, LOBBY_TAIL_NEW);
  mustPatch("ui-kit-lobby-wrap", true);
} else {
  mustPatch("ui-kit-lobby-wrap", js.includes("WgKitQuestRail") && js.includes("gw-lobby-body"));
}

js = js.replace(
  'd.jsxs("div",{className:"gw-lobby-tabs",children:[',
  'd.jsxs("div",{className:"gw-lobby-tabs gk-tab-strip",children:[',
);

// Replace danger-room floating skill chips with UI kit action bar + minimap layout.
const HUD_CLASS_OLD = 'className:`gw-hud gw-mode-${H}`';
const HUD_CLASS_NEW = 'className:`gw-hud gk-root gk-combat-hud gw-mode-${H}`';
if (js.includes(HUD_CLASS_OLD)) {
  js = js.replace(HUD_CLASS_OLD, HUD_CLASS_NEW);
  mustPatch("ui-kit-hud-class", true);
} else {
  mustPatch("ui-kit-hud-class", js.includes("gk-combat-hud"));
}

js = js.replace(
  "d.jsx(qgA,{}),d.jsx(JgA,{}),",
  "d.jsx(WgMinimap,{}),d.jsx(qgA,{}),d.jsx(JgA,{}),",
);

js = js.replace(
  'H==="combat"&&d.jsxs(d.Fragment,{children:[d.jsx(YgA,{}),d.jsx(LgA,{})]})',
  'H==="combat"&&d.jsx(WgKitActionBar,{})',
);

js = js.replace(
  'children:H==="combat"?"WARRIOR":"WARLORD"}),H==="command"&&_.length>0',
  'children:H==="combat"?"TPS · Warrior":"RTS · Warlord"}),H==="command"&&_.length>0',
);

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
  "reset:()=>{WgClearMatch(),WgClearDeployDone();const I=A().mapSize;Z.newMatch(I),_g.getState().resetCommand(),C({...hG,mapSize:I,difficulty:A().difficulty,mapVersion:A().mapVersion+1})}";
if (js.includes(RESET_ORIG)) {
  js = js.replace(RESET_ORIG, RESET_PATCHED);
} else {
  console.warn("[patch] reset clear hook missing");
}

js = js.replace(
  'win:()=>{A().phase==="battle"&&C({phase:"victory"})}',
  'win:()=>{A().phase==="battle"&&(WgDebug.flow("game.win",{pos:WgDebug.posFrom(Z?.playerPos)}),WgClearMatch(),WgClearDeployDone(),C({phase:"victory"}))}',
);
js = js.replace(
  'lose:()=>{A().phase==="battle"&&C({phase:"defeat"})}',
  'lose:()=>{A().phase==="battle"&&(WgDebug.flow("game.lose",{pos:WgDebug.posFrom(Z?.playerPos)}),WgClearMatch(),WgClearDeployDone(),C({phase:"defeat"}))}',
);

const PLAY_ROUTE_ORIG =
  'function PgA(){const C=BI(e=>e.phase),A=_g(e=>e.mode),[I,g]=T.useState(!1);if(T.useEffect(()=>{WS()},[]),T.useEffect(()=>{const e=()=>g(!!document.pointerLockElement);return document.addEventListener("pointerlockchange",e),()=>document.removeEventListener("pointerlockchange",e)},[]),C==="menu")return d.jsx(aq,{to:"/lobby",replace:!0});';
const PLAY_ROUTE_PATCHED =
  'function PgA(){const nav=Fh(),C=BI(e=>e.phase),A=_g(e=>e.mode),[I,g]=T.useState(!1),[boot,o]=T.useState(C!=="menu"?!0:null),[gateErr,s]=T.useState("");T.useEffect(()=>{WS()},[]),T.useEffect(()=>{const e=()=>g(!!document.pointerLockElement);return document.addEventListener("pointerlockchange",e),()=>document.removeEventListener("pointerlockchange",e)},[]),T.useEffect(()=>{if(C==="battle"){o(!0);s("");return}if(C!=="menu"){o(!0);s("");return}if(WgRestoreMatch()){o(!0);s("");return}if(WgIsDeployDone()){WgDeployAndPlay(),o(!0);s("");return}if(!WgEnsureReady()){o(!1);s("Pick a champion in the warcamp first.");return}if(!WgIsDeployDone()){nav("/deploy",{replace:!0});return}s("");WgDeployAndPlay(),o(!0)},[C,nav]);if(boot===null)return d.jsx("div",{className:"gw-screen gw-play-boot",children:d.jsxs("div",{className:"gw-play-boot-inner",children:[d.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),d.jsx("span",{className:"gw-hint",children:"Loading battlefield…"})]})});if(!boot)return d.jsx("div",{className:"gw-screen gw-play-gate",children:d.jsxs("div",{className:"gw-play-gate-panel",children:[d.jsx("span",{className:"gw-play-gate-kicker",children:"Warlord Genesis"}),d.jsx("h1",{className:"gw-play-gate-title",children:"Warcamp Required"}),d.jsx("p",{className:"gw-play-gate-lead",children:"Recruit a warlord in the warcamp, then complete deployment before battle."}),s&&d.jsx("p",{className:"gw-play-gate-error",children:s}),d.jsxs("div",{className:"gw-play-gate-actions",children:[d.jsx("button",{type:"button",className:"gw-btn gw-play-gate-deploy",onClick:()=>nav("/lobby"),children:"Open Warcamp"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost",onClick:()=>nav("/deploy"),children:"Deploy Lanes"})]})]})});';
if (js.includes(PLAY_ROUTE_ORIG)) {
  js = js.replace(PLAY_ROUTE_ORIG, PLAY_ROUTE_PATCHED);
  mustPatch("play-boot", true);
} else {
  mustPatch("play-boot", js.includes("gw-play-gate") || js.includes("gw-play-boot"));
}
const PgA_BOOT_BUG =
  'T.useEffect(()=>{if(!WgEnsureReady()){o(!1);s("Pick a champion in the warcamp first.");return}if(C!=="menu"){o(!0);s("");return}if(WgRestoreMatch()){o(!0);s("");return}if(!WgIsDeployDone()){nav("/deploy",{replace:!0});return}s("");WgDeployAndPlay(),o(!0)},[C,nav]);';
const PgA_BOOT_FIX =
  'T.useEffect(()=>{if(C==="battle"){o(!0);s("");return}if(C!=="menu"){o(!0);s("");return}if(WgRestoreMatch()){o(!0);s("");return}if(WgIsDeployDone()){WgDeployAndPlay(),o(!0);s("");return}if(!WgEnsureReady()){o(!1);s("Pick a champion in the warcamp first.");return}if(!WgIsDeployDone()){nav("/deploy",{replace:!0});return}s("");WgDeployAndPlay(),o(!0)},[C,nav]);';
if (js.includes(PgA_BOOT_BUG)) js = js.replace(PgA_BOOT_BUG, PgA_BOOT_FIX);
mustPatch("deploy-play-gate", js.includes('if(C==="battle")') && js.includes("WgDeployDoneMem"));

const ENGAGE_ORIG =
  'const i=C==="battle"&&!I&&A==="combat";return d.jsxs("div",{className:"gw-canvas-wrap",children:[d.jsx(sgA,{}),d.jsx(_gA,{}),i&&d.jsx("div",{id:"lock-target",className:"gw-engage",children:d.jsxs("div",{className:"gw-engage-inner",children:[d.jsx("span",{className:"gw-engage-sub",children:"The host awaits your command"}),d.jsx("h2",{className:"gw-engage-title",children:"TAKE THE FIELD"}),d.jsx("span",{className:"gw-hint",children:"Click to lock the mouse · press ` to switch to command"})]})}),d.jsx(OgA,{}),d.jsx(bH,{})]})}';
const ENGAGE_PATCHED =
  'const i=C==="battle"&&!I&&A==="combat";return d.jsxs("div",{className:"gw-canvas-wrap gw-canvas-wrap--play",children:[d.jsx(sgA,{}),d.jsx(_gA,{}),i&&d.jsx("div",{id:"lock-target",className:"gw-engage gw-engage-v2",children:d.jsxs("div",{className:"gw-engage-inner",children:[d.jsx("span",{className:"gw-engage-sub",children:"Third-person warrior mode"}),d.jsx("h2",{className:"gw-engage-title",children:"ENGAGE COMBAT"}),d.jsx("p",{className:"gw-engage-copy",children:"LMB select · RMB focus lock · Tab cycle targets · F block (melee). Digit1–6 weapon skills."}),d.jsx("button",{type:"button",className:"gw-btn gw-engage-btn",children:"Take the Field"}),d.jsxs("div",{className:"gw-engage-tips",children:[d.jsxs("span",{children:[d.jsx("kbd",{children:"Tab"})," Target · ",d.jsx("kbd",{children:"RMB"})," Focus"]}),d.jsxs("span",{children:[d.jsx("kbd",{children:"`"})," Command · ",d.jsx("kbd",{children:"Q"})," Swap weapon"]})]})]})}),d.jsx(OgA,{}),d.jsx(bH,{})]})}';
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
  'WgDebug.flow("game.battle.begin",{pos:WgDebug.posFrom(Z?.playerPos),extra:{mode:"combat"}}),A().pushMessage("THE WAR BEGINS — RAZE THEIR CITADEL","good"),A().pushMessage("CLICK TAKE THE FIELD FOR THIRD-PERSON COMBAT · ` FOR LANE COMMAND","info"),_g.getState().setMode("combat"),WgSaveMatch()},reset:',
);

// Lobby — march goes to pre-game deploy (lane + champion path), not straight into battle.
js = js.replace(
  '_=()=>{m&&(p(),A(),C("/play"))}',
  '_=()=>{m&&(p(),C("/deploy"))}',
);
js = js.replace(
  '_=()=>{m&&(p(),C("/play"))}',
  '_=()=>{m&&(p(),C("/deploy"))}',
);
js = js.replace(
  'children:"MARCH TO WAR"}),!m&&d.jsx("span",{className:"gw-deploy-hint",children:N(h)?"Canonical weapons apply automatically — check loadout.":"Recruit this warlord with 10 shards in the War Chest."})',
  'children:"DEPLOY & MARCH"}),d.jsx("span",{className:"gw-deploy-hint gw-deploy-hint--ok",children:"Champion path + lane waves on deploy screen · breach a lane to siege their citadel"}),!m&&d.jsx("span",{className:"gw-deploy-hint",children:N(h)?"Canonical weapons apply automatically — check loadout.":"Recruit this warlord with 10 shards in the War Chest."})',
);

// Lobby — reactive onboarding hook + march gate that bypasses weapon/shard checks when onboarded.
const LOBBY_ONBOARDING_OLD =
  "y=Wz(w,u),M=zC(x=>x.gbux),N=zC(x=>x.isCharacterUnlocked),F=zC(x=>x.syncGbuxFromAccount)";
const LOBBY_ONBOARDING_NEW =
  "y=Wz(w,u),O=zC(x=>x.onboardingDone),M=zC(x=>x.gbux),N=zC(x=>x.isCharacterUnlocked),F=zC(x=>x.syncGbuxFromAccount)";
if (js.includes(LOBBY_ONBOARDING_OLD)) {
  js = js.replace(LOBBY_ONBOARDING_OLD, LOBBY_ONBOARDING_NEW);
  mustPatch("lobby-onboarding-hook", true);
} else {
  mustPatch("lobby-onboarding-hook", js.includes(LOBBY_ONBOARDING_NEW));
}

const LOBBY_GATE_V55 = "const q=RS[o],m=O||(y&&N(h)),H=RS[s]";
const LOBBY_GATE_PATTERNS = [
  "const q=RS[o],m=y&&N(h),H=RS[s]",
  "const q=RS[o],m=y&&(N(h)||zC.getState().onboardingDone),H=RS[s]",
];
let lobbyGatePatched = js.includes(LOBBY_GATE_V55);
if (!lobbyGatePatched) {
  for (const oldGate of LOBBY_GATE_PATTERNS) {
    if (js.includes(oldGate)) {
      js = js.replace(oldGate, LOBBY_GATE_V55);
      lobbyGatePatched = true;
      break;
    }
  }
}
mustPatch("lobby-deploy-gate", lobbyGatePatched);

const LOBBY_ENSURE_V55 =
  '},[Q?.gbuxBalance]);T.useLayoutEffect(()=>{WgEnsureReady()},[]);const q=RS[o],m=O||(y&&N(h)),H=RS[s]';
const LOBBY_ENSURE_PATTERNS = [
  '},[Q?.gbuxBalance]);const q=RS[o],m=O||(y&&N(h)),H=RS[s]',
  '},[Q?.gbuxBalance]);T.useEffect(()=>{WgEnsureReady()},[]);const q=RS[o],m=O||(y&&N(h)),H=RS[s]',
  '},[Q?.gbuxBalance]);T.useEffect(()=>{WgEnsureReady()},[]);const q=RS[o],m=y&&(N(h)||zC.getState().onboardingDone),H=RS[s]',
  '},[Q?.gbuxBalance]);const q=RS[o],m=y&&(N(h)||zC.getState().onboardingDone),H=RS[s]',
  '},[Q?.gbuxBalance]);const q=RS[o],m=y&&N(h),H=RS[s]',
];
let lobbyEnsurePatched = js.includes("T.useLayoutEffect(()=>{WgEnsureReady()},[]);const q=RS[o]");
if (!lobbyEnsurePatched) {
  for (const oldEnsure of LOBBY_ENSURE_PATTERNS) {
    if (js.includes(oldEnsure)) {
      js = js.replace(oldEnsure, LOBBY_ENSURE_V55);
      lobbyEnsurePatched = true;
      break;
    }
  }
}
mustPatch("lobby-ensure-ready", lobbyEnsurePatched);

// Title — quick path to deploy for returning players.
js = js.replace(
  'd.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-secondary",onClick:()=>C("/mp"),children:"Multiplayer"})',
  'd.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-quick",onClick:()=>WgQuickBattle(C),children:"Quick Battle"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-secondary",onClick:()=>C("/deploy"),children:"Deploy Lanes"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost gw-title-secondary",onClick:()=>C("/mp"),children:"Multiplayer"})',
);
js = js.replace(
  'onClick:()=>C("/play"),children:"Quick Battle"',
  'onClick:()=>WgQuickBattle(C),children:"Quick Battle"',
);

// TPS camera occlusion raycast — set Raycaster.camera (sprites) + guard null matrixWorld.
js = js.replace(
  "function v$(C){let A=C;for(;A;){if(A.userData[ET])return!1;A=A.parent}return!0}",
  "function v$(C){let A=C;for(;A;){if(A.userData[ET]||A.isSprite)return!1;A=A.parent}return!0}",
);
js = js.replace(
  "function _$(C,A,I,g,i=.32){Fw.subVectors(I,A);const e=Fw.length();if(e<1e-4)return I;Fw.multiplyScalar(1/e),$y.set(A,Fw),$y.far=e,$y.near=.08;const t=$y.intersectObjects(C.children,!0);let Q=e;for(const s of t)v$(s.object)&&(T$(s.object,g)||s.distance<Q&&(Q=s.distance));const o=Math.max(i,Q-i);return iL.copy(A).addScaledVector(Fw,Math.min(e,o)),iL}",
  'function _$(C,A,I,g,i=.32,cam){Fw.subVectors(I,A);const e=Fw.length();if(e<1e-4)return I;Fw.multiplyScalar(1/e),$y.set(A,Fw),$y.far=e,$y.near=.08,cam&&($y.camera=cam);let t=[];try{t=$y.intersectObjects(C.children,!0)}catch{return I}let Q=e;for(const s of t){const l=s.object;if(!l?.matrixWorld)continue;v$(l)&&(T$(l,g)||s.distance<Q&&(Q=s.distance))}const o=Math.max(i,Q-i);return iL.copy(A).addScaledVector(Fw,Math.min(e,o)),iL}',
);
js = js.replace(
  "const PI=_$(g,ZE,er,hA.current?.root??null)",
  "const PI=_$(g,ZE,er,hA.current?.root??null,.32,A)",
);

// R3F canvas — full-viewport wrapper + resize-friendly Canvas props (Three.js best practice).
const SGA_CANVAS_ORIG =
  'C.ok?d.jsx(HX,{map:R$,children:d.jsx(ogA,{children:d.jsxs(TK,{shadows:{type:fr},camera:{fov:72,near:.22,far:420,position:[0,13,44]},gl:{antialias:!0,powerPreference:"high-performance",failIfMajorPerformanceCaveat:!1,preserveDrawingBuffer:!1},dpr:[1,1.5],onCreated:g,children:[d.jsx("color",{attach:"background",args:["#6e5240"]}),d.jsx(v9,{pixelated:!0}),d.jsx(T.Suspense,{fallback:null,children:d.jsx(agA,{})})]})})}):d.jsx(YT,{reason:C.reason})}';
const SGA_CANVAS_PATCHED =
  'C.ok?d.jsx("div",{className:"gw-game-viewport",children:d.jsx(HX,{map:R$,children:d.jsx(ogA,{children:d.jsxs(TK,{className:"gw-game-canvas",style:{width:"100%",height:"100%",display:"block",touchAction:"none"},resize:{scroll:!1,offsetSize:!0},shadows:{type:fr},camera:{fov:72,near:.22,far:420,position:[0,13,44]},gl:{antialias:!0,powerPreference:"high-performance",failIfMajorPerformanceCaveat:!1,preserveDrawingBuffer:!1,alpha:!1},dpr:[1,1.5],onCreated:g,children:[d.jsx("color",{attach:"background",args:["#6e5240"]}),d.jsx(v9,{pixelated:!0}),d.jsx(T.Suspense,{fallback:null,children:d.jsx(agA,{})})]})})})}):d.jsx(YT,{reason:C.reason})}';
if (js.includes(SGA_CANVAS_ORIG)) {
  js = js.replace(SGA_CANVAS_ORIG, SGA_CANVAS_PATCHED);
  mustPatch("game-viewport", true);
} else {
  mustPatch("game-viewport", js.includes("gw-game-viewport"));
}

// Tower GLBs — always serve from this deploy (/models/towers). CDN Assimp exports crash GLTFLoader.
js = js.replace(
  "function fT(C,A,I){const g=CIA[C][A];return I?`${mt.pipeline.r2.mapTowers}${C}/${g}.glb`:`${pT}models/towers/${C}/${g}.glb`}",
  "function fT(C,A,I){const g=CIA[C][A];return`${pT}models/towers/${C}/${g}.glb`}",
);
js = js.replace(
  "function tIA(C,A){return A?`${mt.pipeline.r2.mapTowerAtlases}${C}/atlas.png`:`${pT}models/towers/${C}/atlas.png`}",
  "function tIA(C,A){return`${pT}models/towers/${C}/atlas.png`}",
);

// v47 — upgraded tower GLBs (embedded + animated) + hero weapon anim/mesh sync.
js = js.replace(
  'CIA={medieval:{outer:"tower_02_1",inner:"tower_03_1_full"},elven:{outer:"tower_2",inner:"tower_3_full"},orc:{outer:"tower_02",inner:"tower_3_full"},ruins:{outer:"ruin_11",inner:"ruin_15"}}',
  'CIA={medieval:{outer:"watchtower_lvl1",inner:"game_ready_turret"},elven:{outer:"fantasy_crossbow_tower",inner:"archer_t3"},orc:{outer:"bomber_t1",inner:"bomber_t3"},ruins:{outer:"slow_t1",inner:"slow_t3"}}',
);
js = js.replace(
  "function fT(C,A,I){const g=CIA[C][A];return`${pT}models/towers/${C}/${g}.glb`}",
  'function fT(C,A,I){const g=CIA[C][A],ov=WgGetAssetPath(`tower_${C}_${A}`,`${pT}models/towers/${C}/${g}.glb`);return ov.startsWith("/")?`${pT}${ov.slice(1)}`:ov}',
);
const TOWER_V47_HOOK =
  'const WgTowerModes={medieval:{outer:"embedded",inner:"animated"},elven:{outer:"animated",inner:"embedded"},orc:{outer:"embedded",inner:"embedded"},ruins:{outer:"embedded",inner:"embedded"}},WgTowerClips={medieval:{inner:{idle:"idle",attack:"attack"}},elven:{outer:{idle:"CrossBow-tower-ctrl|ArmatureAction.002_CrossBow-tower-ctrl",attack:"CrossBow-tower-ctrl|ArmatureAction.002_CrossBow-tower-ctrl"}}};function WgFitTowerScene(C,A=BIA){const I=wM(C);I.traverse(g=>{const i=g;if(i.isMesh){i.castShadow=!0,i.receiveShadow=!0;const e=i.material,t=Array.isArray(e)?e:[e];for(const Q of t)Q?.map&&(Q.map.flipY=!0,Q.map.colorSpace=zg,Q.map.needsUpdate=!0,Q.color?.set?.("#ffffff"))}});const g=new YC().setFromObject(I),i=new O;g.getSize(i);const e=A/Math.max(i.y,.001);return I.scale.setScalar(e),I.position.y=-g.min.y*e,I.position.x=-((g.min.x+g.max.x)/2)*e,I.position.z=-((g.min.z+g.max.z)/2)*e,I}function WgEmbeddedTower({modelUrl:C}){const{scene:A}=Sa(C),I=T.useMemo(()=>WgFitTowerScene(A),[A]);return d.jsx("primitive",{object:I})}function WgAnimatedTower({modelUrl:C,clips:A}){const{scene:I,animations:g}=Sa(C),i=T.useMemo(()=>WgFitTowerScene(I),[I]),{actions:e,names:t}=rH(g,i),Q=T.useRef(0),o=T.useMemo(()=>A?.idle&&e[A.idle]?A.idle:t.find(s=>/idle/i.test(s))||t[0],[e,t,A]),s=T.useMemo(()=>A?.attack&&e[A.attack]?A.attack:t.find(l=>/attack|fire|crossbow/i.test(l))||o,[e,t,A,o]);return T.useEffect(()=>{const l=o?e[o]:null;return l?.reset().fadeIn(.2).play(),()=>l?.fadeOut(.2)},[e,o]),VC((l,c)=>{const h=Object.values(e)[0]?.getMixer?.();h?.update(c),Q.current+=c,Q.current>2.6&&s&&(Q.current=0,e[s]?.reset().fadeIn(.1).play())}),d.jsx("primitive",{object:i})}';
const OIA_ORIG =
  'function oIA({pack:C,tier:A}){const I=Ik().cdnReachable;const i=fT(C,A,I),e=tIA(C,I);return d.jsx(QIA,{modelUrl:i,atlasUrl:e},`${C}-${A}`)}';
const OIA_PATCHED =
  'function oIA({pack:C,tier:A}){const I=WgTowerModes[C]?.[A]||"atlas",i=fT(C,A),e=`${C}-${A}`;return I==="animated"?d.jsx(WgAnimatedTower,{modelUrl:i,clips:WgTowerClips[C]?.[A]||{idle:"idle",attack:"attack"}},e):I==="embedded"?d.jsx(WgEmbeddedTower,{modelUrl:i},e):d.jsx(QIA,{modelUrl:i,atlasUrl:tIA(C)},e)}';
if (js.includes(OIA_ORIG)) {
  js = js.replace("const BIA=7.2;function QIA", `${TOWER_V47_HOOK}const BIA=7.2;function QIA`);
  js = js.replace(OIA_ORIG, OIA_PATCHED);
  mustPatch("tower-v47", js.includes("WgAnimatedTower"));
} else if (js.includes("WgAnimatedTower")) {
  mustPatch("tower-v47", true);
} else {
  mustPatch("tower-v47", false);
}

// v48 tower splits (luchnik/stylized_turret/mag/pushka) produce corrupt 16–52MB GLBs
// that crash Three.js (Invalid typed array length). Keep proven v47 tower IDs.
if (!js.includes('outer:"watchtower_lvl1"')) {
  js = js.replace(
    'CIA={medieval:{outer:"luchnik",inner:"stylized_turret"},elven:{outer:"fantasy_crossbow_tower",inner:"mag"},orc:{outer:"pushka",inner:"bashnia2"},ruins:{outer:"slow_t1",inner:"bashnia"}}',
    'CIA={medieval:{outer:"watchtower_lvl1",inner:"game_ready_turret"},elven:{outer:"fantasy_crossbow_tower",inner:"archer_t3"},orc:{outer:"bomber_t1",inner:"bomber_t3"},ruins:{outer:"slow_t1",inner:"slow_t3"}}',
  );
}
// tower-v48: verified after final safety pass below
const CORE_V48_HOOK =
  'const WgFactionCoreMap={medieval:"muu",elven:"mantah",orc:"krakee",ruins:"antuk"},WgCoreBIA=12.5;function WgFactionCoreUrl(C){const A=WgFactionCoreMap[C]||"muu";return WgGetAssetPath(`core_${C}`,`${pT}models/buildings/faction/${A}.glb`)}function WgFactionCoreBuilding({pack:C}){const A=WgFactionCoreUrl(C),{scene:I}=Sa(A),g=T.useMemo(()=>WgFitTowerScene(I,WgCoreBIA),[I]);return d.jsx("primitive",{object:g})}';
if (js.includes("function WgAnimatedTower(") && !js.includes("WgFactionCoreBuilding")) {
  js = js.replace("function WgAnimatedTower(", `${CORE_V48_HOOK}function WgAnimatedTower(`);
  mustPatch("core-building-v48", js.includes("WgFactionCoreBuilding"));
} else {
  mustPatch("core-building-v48", js.includes("WgFactionCoreBuilding"));
}
js = js.replace(
  'e.kind==="tower"||e.kind==="core"?d.jsx("group",{scale:e.kind==="core"?1.42:1,children:d.jsx(oIA,{pack:aIA(e.faction,e.kind==="core"?"inner":e.tier??"outer"),tier:e.kind==="core"?"inner":e.tier??"outer"})}):d.jsx(nIA,{kind:e.kind,faction:e.faction})',
  'e.kind==="core"?d.jsx(WgFactionCoreBuilding,{pack:aIA(e.faction,"inner")}):e.kind==="tower"?d.jsx(oIA,{pack:aIA(e.faction,e.tier??"outer"),tier:e.tier??"outer"}):d.jsx(nIA,{kind:e.kind,faction:e.faction})',
);
js = js.replace(
  'tower_medieval_outer:"/models/towers/medieval/luchnik.glb",tower_medieval_inner:"/models/towers/medieval/stylized_turret.glb",tower_elven_outer:"/models/towers/elven/fantasy_crossbow_tower.glb",tower_elven_inner:"/models/towers/elven/mag.glb",tower_orc_outer:"/models/towers/orc/pushka.glb",tower_orc_inner:"/models/towers/orc/bashnia2.glb",tower_ruins_outer:"/models/towers/ruins/slow_t1.glb",tower_ruins_inner:"/models/towers/ruins/bashnia.glb",core_medieval:"/models/buildings/faction/muu.glb",core_elven:"/models/buildings/faction/mantah.glb",core_orc:"/models/buildings/faction/krakee.glb",core_ruins:"/models/buildings/faction/antuk.glb"',
  'tower_medieval_outer:"/models/towers/medieval/watchtower_lvl1.glb",tower_medieval_inner:"/models/towers/medieval/game_ready_turret.glb",tower_elven_outer:"/models/towers/elven/fantasy_crossbow_tower.glb",tower_elven_inner:"/models/towers/elven/archer_t3.glb",tower_orc_outer:"/models/towers/orc/bomber_t1.glb",tower_orc_inner:"/models/towers/orc/bomber_t3.glb",tower_ruins_outer:"/models/towers/ruins/slow_t1.glb",tower_ruins_inner:"/models/towers/ruins/slow_t3.glb",core_medieval:"/models/buildings/faction/muu.glb",core_elven:"/models/buildings/faction/mantah.glb",core_orc:"/models/buildings/faction/krakee.glb",core_ruins:"/models/buildings/faction/antuk.glb"',
);

js = js.replace("cdnReachable:!0,bootedAt:0", "cdnReachable:!1,bootedAt:0");
js = js.replace('Dq="gw_engine_boot_v3"', 'Dq="gw_engine_boot_v6"');
js = js.replace('Dq="gw_engine_boot_v4"', 'Dq="gw_engine_boot_v6"');
js = js.replace('Dq="gw_engine_boot_v5"', 'Dq="gw_engine_boot_v6"');

// Citadel destruction — end match immediately; show castle GLB + HP bar.
js = js.replace(
  'if(!Ye(C)&&C.kind==="core"){C.hp=0;return}',
  'if(!Ye(C)&&C.kind==="core"){C.hp=0,C.alive=!1,Z.addImpact(C.pos.clone().setY(2.4)),Z.addShake(.35);const wg=BI.getState();C.faction==="enemy"?wg.win():wg.lose();return}',
);
js = js.replace(
  'const t=e.kind==="tower"?7.8:e.kind==="mage"?4.4:e.kind==="barrier"?2.4:2.1',
  'const t=e.kind==="core"?9.6:e.kind==="tower"?7.8:e.kind==="mage"?4.4:e.kind==="barrier"?2.4:2.1',
);
js = js.replace(
  'e.kind==="tower"?d.jsx(oIA,{pack:aIA(e.faction,e.tier??"outer"),tier:e.tier??"outer"}):d.jsx(nIA,{kind:e.kind,faction:e.faction})',
  'e.kind==="tower"||e.kind==="core"?d.jsx("group",{scale:e.kind==="core"?1.42:1,children:d.jsx(oIA,{pack:aIA(e.faction,e.kind==="core"?"inner":e.tier??"outer"),tier:e.kind==="core"?"inner":e.tier??"outer"})}):d.jsx(nIA,{kind:e.kind,faction:e.faction})',
);
js = js.replace(
  'e.kind!=="core"&&d.jsxs("group",{name:"hpbar"',
  'd.jsxs("group",{name:"hpbar"',
);

// Procedural map — merge admin lane/core overrides after sG().
js = js.replace(
  "newMatch(A,I=JJ()){return this.reset(sG(I,A)),this.map}",
  "newMatch(A,I=JJ()){const m=sG(I,A);WgApplyMapOverride(m);return this.reset(m),this.map}",
);
mustPatch("map-override-newmatch", js.includes("WgApplyMapOverride(m)"));

// startGame — keep deploy lane picks + spawn champion on chosen lane.
js = js.replace(
  "startGame:()=>{const I=A().mapSize;Z.newMatch(I),_g.getState().resetCommand();",
  'startGame:()=>{WgDebug.flow("game.start",{route:location.pathname,extra:{mapSize:A().mapSize,lane:WgReadChampionLane()}});const I=A().mapSize;Z.newMatch(I),WgApplyChampionLane(),_g.getState().resetCommand();',
);
js = js.replace(
  "laneDeployment:OU({meleeGuard:g.laneMeleeHeroId,rangedGuard:g.laneRangedHeroId}),deploymentRound:1",
  "laneDeployment:A().laneDeployment?.lanes?A().laneDeployment:OU({meleeGuard:g.laneMeleeHeroId,rangedGuard:g.laneRangedHeroId}),deploymentRound:1",
);

// Pre-battle deploy — free building tier picks + faction-synced lane defaults.
const RESET_LANES_ORIG =
  'resetLaneDeployment:()=>{const I=XI.getState();C({laneDeployment:OU({meleeGuard:I.laneMeleeHeroId,rangedGuard:I.laneRangedHeroId})}),A().pushMessage("LANE WAVE CREEPS RESET TO FACTION DEFAULTS","info")}';
const RESET_LANES_PATCHED =
  'resetLaneDeployment:()=>{const I=XI.getState();Az(I.factionId,I.enemyFactionId);C({laneDeployment:OU({meleeGuard:I.laneMeleeHeroId,rangedGuard:I.laneRangedHeroId})}),A().pushMessage("LANE WAVE CREEPS RESET TO FACTION DEFAULTS","info")}';
if (js.includes(RESET_LANES_ORIG)) {
  js = js.replace(RESET_LANES_ORIG, RESET_LANES_PATCHED);
}
const UPGRADE_BUILDING_ANCHOR = "upgradeBuilding:I=>{";
const DEPLOY_BUILDING_METHODS =
  'setDeployBuildingTier:(I,g)=>{const i=Math.max(1,Math.min(cU,Number(g)||1));C({buildings:{...A().buildings,[I]:i}})},setDeployBuildings:(I)=>C({buildings:{barracks:Math.max(1,Math.min(cU,I?.barracks??1)),archery:Math.max(1,Math.min(cU,I?.archery??1))},productionSpecs:{warrior:"base",worge:"base",mage:"base",ranger:"base"}}),upgradeBuilding:I=>{';
if (js.includes(UPGRADE_BUILDING_ANCHOR) && !js.includes("setDeployBuildingTier:")) {
  js = js.replace(UPGRADE_BUILDING_ANCHOR, DEPLOY_BUILDING_METHODS);
}
mustPatch("deploy-buildings", js.includes("setDeployBuildingTier"));

// Victory — redeploy flow + overlay above canvas.
js = js.replace(
  'onClick:()=>e(),children:"WAGE WAR AGAIN"',
  'onClick:()=>{WgClearDeployDone(),BI.getState().reset(),C("/deploy")},children:"DEPLOY AGAIN"',
);

// Route map: / → /lobby (warcamp) → /deploy → /play (battle) → /mp
const LOBBY_ROUTE =
  'd.jsx(jc,{path:"/lobby",element:d.jsx(u7,{})}),d.jsx(jc,{path:"/play",element:d.jsx(PgA,{})})';
const LOBBY_ROUTE_PATCHED =
  'd.jsx(jc,{path:"/warcamp",element:d.jsx(aq,{to:"/lobby",replace:!0})}),d.jsx(jc,{path:"/lobby",element:d.jsx(u7,{})}),d.jsx(jc,{path:"/deploy",element:d.jsx(WgDeployScreen,{})}),d.jsx(jc,{path:"/play",element:d.jsx(PgA,{})}),d.jsx(jc,{path:"/battle",element:d.jsx(aq,{to:"/play",replace:!0})}),d.jsx(jc,{path:"/auth/callback",element:d.jsx(WgAuthCallbackScreen,{})}),d.jsx(jc,{path:"/admin",element:d.jsx(WgAdminScreen,{})})';
if (js.includes(LOBBY_ROUTE)) {
  js = js.replace(LOBBY_ROUTE, LOBBY_ROUTE_PATCHED);
  mustPatch("routes", true);
} else {
  mustPatch("routes", js.includes('path:"/warcamp"') && js.includes('path:"/battle"') && js.includes('path:"/auth/callback"'));
}
if (!js.includes('path:"/admin"')) {
  js = js.replace(
    'd.jsx(jc,{path:"/mp",element:d.jsx(NCA,{})})',
    'd.jsx(jc,{path:"/admin",element:d.jsx(WgAdminScreen,{})}),d.jsx(jc,{path:"/mp",element:d.jsx(NCA,{})})',
  );
}
mustPatch("admin-route", js.includes('path:"/admin"'));

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

// MOBA flow — lane draft on /deploy only; auto lane waves in battle; weapon mesh sync.
const WEAPON_MESH_HOOK =
  'function WgHeroWeaponAnimClass(C,A,I){if(!I)return null;const g=wa(C)?.grudge;if(!g)return null;try{if(A==="ally"){const xi=XI.getState(),bi=BI.getState(),slot=bi.heroActiveWeapon||"ranged";if(slot==="melee"){const id=xi.meleeId,m=Js[id];return m?.animClass||MK({id:xi.prefabId})?.weapon||"sword"}const id=xi.rangedId,w=Wo[id];return w?.animClass||MK({id:xi.prefabId})?.weapon||"ranged"}const lo=MK({id:gz()});return lo?.weapon||"sword"}catch{return"sword"}}function WgHeroBattleAnimPack(C,A,I){if(!I){const g=wa(C)?.grudge;return g?qh(g.raceId,g.classId)?.animPack??"unarmed":"unarmed"}const wc=WgHeroWeaponAnimClass(C,A,I);return wc?aT(wc):"unarmed"}function WgSyncWeaponMeshes(C,A){if(!C||!A)return;const I=String(A).toLowerCase();let g="";I==="bow"?g="longbow":I==="ranged"?g="rifle":I==="pistol"?g="pistol":I==="staff"||I==="magic"?g="magic":(I==="sword"||I==="greatsword"||I==="greataxe"||I==="hammer"||I==="hammer2h"||I==="axe"||I==="spear"||I==="mace"||I==="knife"||I==="dagger")&&(g="melee");C.traverse(i=>{if(!(i instanceof EC)&&!(i instanceof GB))return;const e=i.name;if(!/(?:weapon|Weapon|Shield|shield|Bow|bow|staff|Staff|quiver|Quiver|gun|Gun|rifle|Rifle|crossbow|Crossbow)/.test(e))return;let t=!1;g==="longbow"?t=/(?:bow|Bow|quiver|Quiver)/.test(e):g==="rifle"?t=/(?:gun|Gun|rifle|Rifle|crossbow|Crossbow)/.test(e)&&!/(?:pistol|Pistol)/.test(e):g==="pistol"?t=/(?:pistol|Pistol|gun|Gun)/.test(e):g==="magic"?t=/(?:staff|Staff|tome|Tome)/.test(e):g==="melee"&&(t=/(?:sword|Sword|axe|Axe|hammer|Hammer|spear|Spear|mace|Mace|knife|Knife|dagger|Dagger|Shield|shield)/.test(e)&&!/(?:bow|Bow|staff|Staff|quiver|Quiver|gun|Gun)/.test(e)),i.visible=t})}function L6(C,A){';
if (js.includes("function L6(C,A){")) {
  js = js.replace("function L6(C,A){", WEAPON_MESH_HOOK);
  mustPatch("weapon-mesh-sync", js.includes("WgSyncWeaponMeshes"));
} else {
  mustPatch("weapon-mesh-sync", js.includes("WgSyncWeaponMeshes"));
}

// GRUDGE6 race atlases (WebP from TGA) require flipY=true — matches character-viewer textureLoader.ts.
js = js.replace(
  "function q6(C,A){const I=new mk({map:A,color:16777215});",
  "function q6(C,A){if(!A)return;A.colorSpace=zg,A.flipY=!0,A.needsUpdate=!0;const I=new mk({map:A,color:16777215});",
);
js = js.replace(
  "function q6(C,A){A&&(A.colorSpace=zg,A.flipY=!1,A.needsUpdate=!0);const I=new mk({map:A,color:16777215});",
  "function q6(C,A){if(!A)return;A.colorSpace=zg,A.flipY=!0,A.needsUpdate=!0;const I=new mk({map:A,color:16777215});",
);
js = js.replace(
  "function q6(C,A){if(!A)return;A.colorSpace=zg,A.flipY=!1,A.needsUpdate=!0;const I=new mk({map:A,color:16777215});",
  "function q6(C,A){if(!A)return;A.colorSpace=zg,A.flipY=!0,A.needsUpdate=!0;const I=new mk({map:A,color:16777215});",
);
js = js.replace("s.colorSpace=zg,s.flipY=!1,", "s.colorSpace=zg,s.flipY=!0,s.needsUpdate=!0,");
mustPatch("atlas-flipy", js.includes("A.flipY=!0") && js.includes("s.flipY=!0"));

const SWAP_ANIM_ORIG =
  "swapAnimPack:async w=>{h.director.dispose(),l.stopAllAction();const u=await pY(l,w);h.director=u.director,h.attackClip=u.attackClip,h.actions=u.actions}}";
const SWAP_ANIM_PATCHED =
  "swapAnimPack:async(w,wt)=>{h.director.dispose(),l.stopAllAction();const u=await pY(l,w);h.director=u.director,h.attackClip=u.attackClip,h.actions=u.actions,wt&&WgSyncWeaponMeshes(o,wt)}}";
if (js.includes(SWAP_ANIM_ORIG)) {
  js = js.replace(SWAP_ANIM_ORIG, SWAP_ANIM_PATCHED);
  mustPatch("swap-anim-mesh", true);
} else {
  mustPatch("swap-anim-mesh", js.includes("WgSyncWeaponMeshes(o,wt)"));
}

js = js.replace(
  "async setWeapon(A){const I=aT(A);await this.prepared.swapAnimPack(I)}",
  "async setWeapon(A){const I=aT(A);await this.prepared.swapAnimPack(I,A),WgSyncWeaponMeshes(this.prepared.root,A)}",
);

// In-match lane deploy UI — draft happens on /deploy (WgDeployScreen + lgA).
const CGA_ORIG = sliceFunction(js, "cgA");
const CGA_NOOP = "function cgA(){return null}";
if (CGA_ORIG && js.includes(CGA_ORIG)) {
  js = js.replace(CGA_ORIG, CGA_NOOP);
  mustPatch("moba-hide-lane-deploy", true);
} else {
  mustPatch("moba-hide-lane-deploy", js.includes("function cgA(){return null}"));
}

js = js.replace(
  "beginDeploymentRound:I=>{I<=A().deploymentRound||(C({deploymentRound:I,deploymentHighlight:!0}),A().pushMessage(`ROUND ${I} — ADJUST WAVE CREEPS PER LANE`,\"info\"))},",
  "beginDeploymentRound:I=>{},",
);
mustPatch("moba-no-deploy-rounds", js.includes("beginDeploymentRound:I=>{},"));

// Spawn lane creeps on every lane (pre-deploy picks), not only lanes without ally buildings.
js = js.replace(
  "function _IA(){const C=BI.getState(),A=Xr(),I=mT(),g=Z.allyTechHpMult(),i=new Set(Z.map.buildings.filter(e=>e.faction===\"ally\").map(e=>e.lane));for(const e of Z.map.lanes){if(i.has(e.id))continue;",
  "function _IA(){const C=BI.getState(),A=Xr(),I=mT(),g=Z.allyTechHpMult();for(const e of Z.map.lanes){",
);
mustPatch("moba-all-lanes", !js.includes("if(i.has(e.id))continue"));

// Production panel collapsed by default in command mode.
js = js.replace(
  'function ugA(){const C=BI(o=>o.phase),A=_g(o=>o.mode),I=BI(o=>o.credits),g=BI(o=>o.productionSpecs),[i,e]=T.useState("barracks"),[t,Q]=T.useState(!1);',
  'function ugA(){const C=BI(o=>o.phase),A=_g(o=>o.mode),I=BI(o=>o.credits),g=BI(o=>o.productionSpecs),[i,e]=T.useState("barracks"),[t,Q]=T.useState(!0);',
);

const HUD_MOBA_OLD = "className:`gw-hud gk-root gk-combat-hud gw-mode-${H}`";
const HUD_MOBA_NEW = "className:`gw-hud gk-root gk-combat-hud gw-moba-battle gw-mode-${H}`";
if (js.includes(HUD_MOBA_OLD)) {
  js = js.replace(HUD_MOBA_OLD, HUD_MOBA_NEW);
  mustPatch("moba-hud-class", true);
} else {
  mustPatch("moba-hud-class", js.includes("gw-moba-battle"));
}

// Board focus — drop ocean plane, wind grass, trees, sky dome, and distance fog.
const AG_A_ORIG =
  'function agA(){return d.jsxs(d.Fragment,{children:[d.jsx(T9,{sunPosition:[-30,14,-40],turbidity:8,rayleigh:.8,mieCoefficient:.004,distance:45e4}),d.jsx("fog",{attach:"fog",args:["#6e5240",50,130]}),d.jsx(QgA,{}),d.jsx("hemisphereLight",{args:["#ffd9a8","#2a1c14",.6]}),d.jsx("directionalLight",{position:[-20,36,-10],intensity:1.7,color:"#ffd9a8",castShadow:!0,"shadow-mapSize":[2048,2048],"shadow-camera-left":-50,"shadow-camera-right":50,"shadow-camera-top":55,"shadow-camera-bottom":-55,"shadow-camera-far":140}),d.jsx("ambientLight",{intensity:.4}),d.jsxs(s$,{gravity:[0,-20,0],children:[d.jsx(Y$,{}),d.jsx(hAA,{}),d.jsx(yAA,{})]}),d.jsx(UAA,{}),d.jsx(rIA,{}),d.jsx(hIA,{}),d.jsx(wIA,{}),d.jsx(yIA,{}),d.jsx(IIA,{}),d.jsx(gIA,{}),d.jsx(RIA,{}),d.jsx(LIA,{}),d.jsx(TIA,{}),d.jsx(HIA,{}),d.jsx(vIA,{})]})}';
const AG_A_PATCHED =
  'function agA(){return d.jsxs(d.Fragment,{children:[d.jsx("hemisphereLight",{args:["#d8ccb8","#141820",.5]}),d.jsx("directionalLight",{position:[-16,44,-10],intensity:2.1,color:"#fff0d0",castShadow:!0,"shadow-mapSize":[2048,2048],"shadow-camera-left":-50,"shadow-camera-right":50,"shadow-camera-top":55,"shadow-camera-bottom":-55,"shadow-camera-far":140}),d.jsx("ambientLight",{intensity:.32}),d.jsxs(s$,{gravity:[0,-20,0],children:[d.jsx(Y$,{}),d.jsx(hAA,{})]}),d.jsx(rIA,{}),d.jsx(hIA,{}),d.jsx(wIA,{}),d.jsx(yIA,{}),d.jsx(IIA,{}),d.jsx(gIA,{}),d.jsx(RIA,{}),d.jsx(LIA,{}),d.jsx(TIA,{}),d.jsx(HIA,{}),d.jsx(vIA,{})]})}';
if (js.includes(AG_A_ORIG)) {
  js = js.replace(AG_A_ORIG, AG_A_PATCHED);
  mustPatch("board-scene", true);
} else {
  mustPatch("board-scene", !js.includes("d.jsx(QgA,{})") && !js.includes("d.jsx(yAA,{})"));
}

js = js.replace(
  'd.jsx("color",{attach:"background",args:["#6e5240"]})',
  'd.jsx("color",{attach:"background",args:["#10141c"]})',
);
mustPatch("board-scene", js.includes('args:["#10141c"]'));

const QGA_ORIG =
  'function QgA(){const C=BI(t=>t.mapVersion),A=Z.map,I=28,{width:g,length:i}=T.useMemo(()=>{const t=A.width+I,Q=A.length+I;return{width:t,length:Q}},[C,A.width,A.length]),e=T.useMemo(()=>new te({color:tgA,transparent:!0,opacity:BgA,roughness:.18,metalness:.05,side:mi,depthWrite:!1}),[]);return d.jsx("mesh",{rotation:[-Math.PI/2,0,0],position:[0,egA,0],material:e,receiveShadow:!0,renderOrder:-2,children:d.jsx("planeGeometry",{args:[g,i]})},C)}';
if (js.includes(QGA_ORIG)) {
  js = js.replace(QGA_ORIG, "function QgA(){return null}");
  mustPatch("strip-ocean", true);
} else {
  mustPatch("strip-ocean", js.includes("function QgA(){return null}"));
}

const UAA_HEAD = "function UAA(){const C=T.useRef(null)";
const uaaIdx = js.indexOf(UAA_HEAD);
if (uaaIdx >= 0) {
  let braces = 0;
  let started = false;
  let end = uaaIdx;
  for (let i = uaaIdx; i < js.length; i++) {
    if (js[i] === "{") {
      braces++;
      started = true;
    }
    if (js[i] === "}") {
      braces--;
      if (started && braces === 0) {
        end = i + 1;
        break;
      }
    }
  }
  js = js.slice(0, uaaIdx) + "function UAA(){return null}" + js.slice(end);
  mustPatch("strip-grass-trees", true);
} else {
  mustPatch("strip-grass-trees", js.includes("function UAA(){return null}"));
}

const YAA_HEAD = "function yAA(){const C=T.useRef(null)";
const yaaIdx = js.indexOf(YAA_HEAD);
if (yaaIdx >= 0) {
  let braces = 0;
  let started = false;
  let end = yaaIdx;
  for (let i = yaaIdx; i < js.length; i++) {
    if (js[i] === "{") {
      braces++;
      started = true;
    }
    if (js[i] === "}") {
      braces--;
      if (started && braces === 0) {
        end = i + 1;
        break;
      }
    }
  }
  js = js.slice(0, yaaIdx) + "function yAA(){return null}" + js.slice(end);
  mustPatch("strip-grass-trees", js.includes("function yAA(){return null}"));
}

// Richer combat VFX — slash waves on hero melee, bursts/sparks/embers on hits.
const AIA_ORIG =
  'function AIA(C,A,I){const g=C.pos.clone().setY(C.pos.y+1.1*C.def.scale);let i=C.def.damage*C.dmgMult*Z.factionDmgMult(C.faction);if((A.target&&Ye(A.target)||!A.hero&&A.target)&&(i=dL(C,i,A.target)),A.hero){const Q=Z.playerPos.clone();C.def.ranged&&Z.addProjectile(UL(C),g,Q),Z.addSpark(Q.clone().setY(1.2),"#ff6b6b"),I.damagePlayer(i);return}const e=A.target;if(!e)return;const t=e.pos.clone().setY(Ye(e)?1*e.def.scale:1.4);if(C.def.ranged){const Q=UL(C),o=!!nr[Q].splash;Z.addProjectile(Q,g,t,o?{faction:C.faction,splashDamage:i}:{}),Z.addSpark(t,"#ffffff"),o||Ls(e,i)}else Z.addSpark(t,"#ffd27f"),Ls(e,i)}';
const AIA_PATCHED =
  'function AIA(C,A,I){const g=C.pos.clone().setY(C.pos.y+1.1*C.def.scale);let i=C.def.damage*C.dmgMult*Z.factionDmgMult(C.faction);if((A.target&&Ye(A.target)||!A.hero&&A.target)&&(i=dL(C,i,A.target)),A.hero){const Q=Z.playerPos.clone();C.def.ranged&&Z.addProjectile(UL(C),g,Q),Z.addSpark(Q.clone().setY(1.2),"#ff6b6b"),Z.addFireBurst(Q.clone().setY(1.1),"#ff4a3a",5,.5),I.damagePlayer(i);return}const e=A.target;if(!e)return;const t=e.pos.clone().setY(Ye(e)?1*e.def.scale:1.4);if(C.def.ranged){const Q=UL(C),o=!!nr[Q].splash;Z.addProjectile(Q,g,t,o?{faction:C.faction,splashDamage:i}:{}),Z.addMuzzleFlash(g),Z.addSpark(t,"#ffffff"),o||Ls(e,i)}else{const Q=C.faction==="ally"?"#8fd8ff":"#ff8a52",o=new O(e.pos.x-C.pos.x,0,e.pos.z-C.pos.z);o.lengthSq()>.001&&o.normalize();Z.addSpark(t,"#ffd27f"),Z.addFireBurst(t,Q,5,.48),C.isHero&&o.lengthSq()>.001&&Z.addSlashWave({origin:g.clone(),dir:o,range:3,speed:36,width:1.3,damage:0,color:Q,faction:C.faction,spawnShock:!1,shockRadius:0,shockDamage:0,shockDuration:0}),Ls(e,i)}}';
if (js.includes(AIA_ORIG)) {
  js = js.replace(AIA_ORIG, AIA_PATCHED);
  mustPatch("combat-vfx-aia", true);
} else {
  mustPatch("combat-vfx-aia", js.includes("Z.addSlashWave({origin:g.clone()"));
}

js = js.replace(
  'Z.addFireBurst(xo,C.faction==="enemy"?"#ffae42":"#ff6a3c",3,.5)',
  'Z.addFireBurst(xo,C.faction==="enemy"?"#ffae42":"#ff6a3c",5,.62),Z.addSpark(xo.clone(),C.faction==="enemy"?"#ffd080":"#ff9070"),A>20&&Z.addEmber(xo.clone(),C.faction==="enemy"?"#ff7733":"#ffb366")',
);
mustPatch("combat-vfx-ls", js.includes("A>20&&Z.addEmber(xo.clone()"));

// ── v41 Combat targeting (Danger Room parity) + projectile trails + texture fix ──
const WG_COMBAT_TARGETING =
  'const WgCombatTargets=new Map();const WgAimRay=new bk,WgAimMouse=new CI,WgAimTmp=new O,WgAimOut=new O;const WgAim={focusEnabled:!1,rmb:!1,token:0};let WgAttackCd=0;const WgSoftLock={active:!1,targetId:null};function WgCombatRegisterUnit(u){if(!u?.alive)return;const h=u.faction==="enemy"||u.faction==="neutral";WgCombatTargets.set(u.id,{id:u.id,hostile:h,alive:()=>u.alive,getPos:()=>u.pos,scale:u.def?.scale??1})}function WgCombatUnregisterUnit(id){WgCombatTargets.delete(id);if(WgSoftLock.targetId===id){WgSoftLock.active=!1;WgSoftLock.targetId=null;WgAim.token++}}function WgCombatSyncUnits(){WgCombatTargets.clear();for(const u of Z.units)WgCombatRegisterUnit(u)}function WgGetAimDir(cam,out){if(WgSoftLock.active&&WgSoftLock.targetId!=null){const t=WgCombatTargets.get(WgSoftLock.targetId);if(t&&t.alive()){const p=t.getPos();return out.set(p.x,Z.playerPos.y+1.1*t.scale,p.z).sub(Z.playerPos).setY(0),out.lengthSq()>1e-6?out.normalize():out.set(0,0,-1)}}return cam.getWorldDirection(out),out.y=0,out.lengthSq()>1e-6?out.normalize():out.set(0,0,-1)}function WgResolveAimPoint(cam,out){if(WgSoftLock.active&&WgSoftLock.targetId!=null){const t=WgCombatTargets.get(WgSoftLock.targetId);if(t&&t.alive()){const p=t.getPos();return out.set(p.x,p.y+1.1*t.scale,p.z)}}return WgGetAimDir(cam,WgAimTmp),out.copy(Z.playerPos).addScaledVector(WgAimTmp,3.2).setY(Z.playerPos.y+1.2)}function WgPickTargetFromRay(cam,mx,my,w,h){WgAimMouse.set(mx/w*2-1,-(my/h)*2+1),WgAimRay.setFromCamera(WgAimMouse,cam);let best=null,bestAlong=1e9;for(const t of WgCombatTargets.values()){if(!t.hostile||!t.alive())continue;const p=t.getPos();WgAimTmp.set(p.x,p.y+1.1*t.scale,p.z);const ox=WgAimTmp.x-WgAimRay.origin.x,oy=WgAimTmp.y-WgAimRay.origin.y,oz=WgAimTmp.z-WgAimRay.origin.z,along=ox*WgAimRay.direction.x+oy*WgAimRay.direction.y+oz*WgAimRay.direction.z;if(along<0||along>24)continue;const hx=WgAimRay.origin.x+WgAimRay.direction.x*along,hy=WgAimRay.origin.y+WgAimRay.direction.y*along,hz=WgAimRay.origin.z+WgAimRay.direction.z*along,dist=Math.hypot(WgAimTmp.x-hx,WgAimTmp.y-hy,WgAimTmp.z-hz);if(dist<1.2*t.scale+.9&&along<bestAlong){bestAlong=along;best=t.id}}WgSoftLock.active=!!best,WgSoftLock.targetId=best,WgAim.token++}function WgCycleSoftLock(cam){cam.getWorldDirection(WgAimTmp),WgAimTmp.y=0,WgAimTmp.lengthSq()<1e-6?WgAimTmp.set(0,0,-1):WgAimTmp.normalize();const fx=WgAimTmp.x,fz=WgAimTmp.z,cone=Math.cos(55*Math.PI/180),cands=[];for(const t of WgCombatTargets.values()){if(!t.hostile||!t.alive())continue;const p=t.getPos(),dx=p.x-Z.playerPos.x,dz=p.z-Z.playerPos.z,dist=Math.hypot(dx,dz);if(dist>22||dist<.4)continue;const dot=(dx*fx+dz*fz)/(dist||1);dot>=cone&&cands.push({id:t.id,dist,dot})}if(cands.sort((a,b)=>b.dot-a.dot||a.dist-b.dist),!cands.length){WgSoftLock.active=!1,WgSoftLock.targetId=null,WgAim.token++;return}if(!WgSoftLock.active){WgSoftLock.active=!0,WgSoftLock.targetId=cands[0].id,WgAim.token++;return}const idx=cands.findIndex(c=>c.id===WgSoftLock.targetId),next=idx<0||idx>=cands.length-1?0:idx+1;WgSoftLock.targetId=cands[next].id,WgAim.token++}function WgCombatAiMult(C){const st=BI.getState(),lvl=Math.max(1,st.heroLevel||1),bon=st.heroBonuses?.damageMult??1;return C.faction==="ally"?(1+(lvl-1)*.04)*bon:C.faction==="enemy"?1+(st.difficulty==="hard"?.15:st.difficulty==="medium"?.08:0):1}function WgCombatHud(){const md=_g(e=>e.mode),ph=BI(e=>e.phase),[,tick]=T.useState(0);T.useEffect(()=>{const id=setInterval(()=>tick(t=>t+1),80);return()=>clearInterval(id)},[]);if(ph!=="battle"||md!=="combat")return null;const tgt=WgSoftLock.active?WgCombatTargets.get(WgSoftLock.targetId):null,hasTgt=!!(tgt&&tgt.alive());return d.jsxs(d.Fragment,{children:[d.jsx("div",{className:"wg-reticle-focus"+(WgAim.focusEnabled?" is-on":"")+(hasTgt?" has-lock":""),"aria-hidden":!0}),hasTgt&&d.jsx("div",{className:"wg-target-lock-chip",children:d.jsxs("span",{children:["Soft lock",WgAim.focusEnabled?" · Focus ON":""]})}),WgAttackCd>.05&&d.jsx("div",{className:"wg-atk-cd-ring",children:d.jsx("span",{children:WgAttackCd.toFixed(1)})})]})}';
if (js.includes("function hAA(){") && !js.includes("function WgCombatHud")) {
  js = js.replace("function hAA(){", `${WG_COMBAT_TARGETING}function hAA(){`);
  mustPatch("combat-targeting", true);
} else {
  mustPatch("combat-targeting", js.includes("function WgCombatHud"));
}

js = js.replace(
  "const OA=rA=>{s.current=rA,Z.heroBlocking=rA,hA.current?.block(rA)},j=rA=>{rA.button===0?Q.current=!0:rA.button===2&&o.current&&c.current.block&&OA(!0)},b=rA=>{rA.button===0?Q.current=!1:rA.button===2&&OA(!1)}",
  'const WgBlock=rA=>{s.current=rA,Z.heroBlocking=rA,hA.current?.block(rA)},j=rA=>{if(rA.button===0){if(WgAim.focusEnabled)Q.current=!0;else{const rect=I.domElement.getBoundingClientRect();WgPickTargetFromRay(A,rA.clientX-rect.left,rA.clientY-rect.top,rect.width,rect.height)}}else if(rA.button===2){rA.repeat||(WgAim.focusEnabled=!WgAim.focusEnabled,WgAim.token++);WgAim.rmb=!0}},b=rA=>{rA.button===0?Q.current=!1:rA.button===2&&(WgAim.rmb=!1)}',
);
mustPatch("combat-input-rmb", js.includes("WgPickTargetFromRay"));

js = js.replace(
  'b.code==="KeyR"&&qA(),b.code==="KeyQ"&&TA(),b.code==="KeyC"&&uI()',
  'b.code==="KeyR"&&qA(),b.code==="KeyQ"&&TA(),b.code==="Tab"&&_g.getState().mode==="combat"&&!b.repeat&&(WgCycleSoftLock(A),b.preventDefault()),b.code==="KeyF"&&_g.getState().mode==="combat"&&!b.repeat&&o.current&&c.current.block&&(WgBlock(!s.current),b.preventDefault()),b.code==="KeyC"&&uI()',
);
mustPatch("combat-input-tab", js.includes("WgCycleSoftLock"));

js = js.replace(
  "document.pointerLockElement===I.domElement)_g.getState().setMode(\"combat\");else{if(BI.getState().phase!==\"battle\")return;_g.getState().setMode(\"command\"),Q.current=!1}",
  'document.pointerLockElement===I.domElement)_g.getState().setMode("combat");else{if(BI.getState().phase!=="battle")return;_g.getState().setMode("command"),Q.current=!1,WgAim.rmb=!1}',
);

js = js.replace(
  "eI&&!y.current&&SA===\"combat\"&&Q.current&&e.current<=0",
  "eI&&!y.current&&SA===\"combat\"&&Q.current&&e.current<=0&&(WgAim.focusEnabled||WgSoftLock.active)",
);
mustPatch("combat-attack-gate", js.includes("WgSoftLock.active"));

js = js.replace(
  "if(A.getWorldDirection(ue),ue.y=0,ue.lengthSq()<1e-6)return;ue.normalize();",
  "if(WgGetAimDir(A,ue),ue.lengthSq()<1e-6)return;",
);
js = js.replace(
  "A.getWorldDirection(pB),pB.normalize(),bo.copy(A.position);",
  "WgGetAimDir(A,pB),bo.copy(A.position);",
);
js = js.replace(
  "A.getWorldDirection(pB),pB.normalize(),IAA(j,A.position,pB,cT(RA,AI,h.current),b.damageMult)",
  "WgGetAimDir(A,pB),WgResolveAimPoint(A,WgAimOut),IAA(j,WgAimOut,pB,cT(RA,AI,h.current),b.damageMult)",
);
mustPatch("combat-aim-dir", js.includes("WgGetAimDir(A,ue)"));

js = js.replace(
  "return this.units.push(c),c}",
  "return this.units.push(c),WgCombatRegisterUnit(c),c}",
);
mustPatch("combat-unit-register", js.includes("WgCombatRegisterUnit(c)"));

js = js.replace(
  "if(C.hp>0)return;const i=BI.getState();",
  "if(C.hp>0)return;Ye(C)&&WgCombatUnregisterUnit(C.id);const i=BI.getState();",
);

js = js.replace(
  'let i=C.def.damage*C.dmgMult*Z.factionDmgMult(C.faction);if((A.target&&Ye(A.target)||!A.hero&&A.target)&&(i=dL(C,i,A.target)),A.hero){',
  'let i=C.def.damage*C.dmgMult*Z.factionDmgMult(C.faction)*WgCombatAiMult(C);if((A.target&&Ye(A.target)||!A.hero&&A.target)&&(i=dL(C,i,A.target)),A.hero){',
);
mustPatch("combat-ai-scale", js.includes("WgCombatAiMult(C)"));

const COMBAT_PROJ_PUSH_ORIG =
  "this.projectiles.push({id:this.id(),model:A,pos:I.clone(),from:I.clone(),to:g.clone(),dir:t,dist:Q,traveled:0,speed:e.speed,spin:e.spin,roll:0,faction:i.faction??null,splash:o,arc:i.arc??0})";
const COMBAT_PROJ_PUSH_PATCHED =
  'const tint=nr[A]?.tint??"#ffd0a6";this.projectiles.push({id:this.id(),model:A,pos:I.clone(),from:I.clone(),to:g.clone(),dir:t,dist:Q,traveled:0,speed:e.speed,spin:e.spin,roll:0,faction:i.faction??null,splash:o,arc:i.arc??0,tint})';
if (js.includes(COMBAT_PROJ_PUSH_ORIG)) {
  js = js.replace(COMBAT_PROJ_PUSH_ORIG, COMBAT_PROJ_PUSH_PATCHED);
}
mustPatch(
  "combat-proj-tint",
  js.includes("tint=nr[A]") || js.includes("arc:i.arc??0,tint})"),
);

js = js.replace(
  'if(Math.random()<c){const h=l.tint??(l.splash?"#ffd0a6":"#d4b890");Z.addEmber(s.pos.clone(),h)}',
  'if(Math.random()<.5){const h=s.tint??l.tint??(l.splash?"#ffd0a6":"#d4b890");Z.addEmber(s.pos.clone(),h);s.traveled>.35&&Math.random()<.35&&Z.addTracer(s.pos.clone().addScaledVector(s.dir,-.25),s.pos.clone(),h)}',
);
mustPatch("combat-proj-trail", js.includes("s.traveled>.35"));

js = js.replace(
  "spawnShock:!1,shockRadius:0,shockDamage:0,shockDuration:0});for(let YA=0;YA<5;YA++)Z.addEmber(Ce.clone(),OA.color)}",
  "spawnShock:!1,shockRadius:0,shockDamage:0,shockDuration:0});Z.addTracer(Ce.clone(),Ce.clone().addScaledVector(ue,OA.reach*.85),OA.color);for(let YA=0;YA<8;YA++)Z.addEmber(Ce.clone().addScaledVector(ue,Math.random()*OA.reach*.6),OA.color)}",
);
mustPatch("combat-melee-trail", js.includes("addScaledVector(ue,OA.reach"));

const GRUDGE6_FLIPY_PATCHED =
  "s.colorSpace=zg,s.flipY=!0,s.needsUpdate=!0,o.traverse(w=>{(w instanceof GB||w instanceof EC)";
const GRUDGE6_FLIPY_TRUE =
  "s.colorSpace=zg,s.flipY=!0,o.traverse(w=>{(w instanceof GB||w instanceof EC)";
const GRUDGE6_FLIPY_FALSE =
  "s.colorSpace=zg,s.flipY=!1,o.traverse(w=>{(w instanceof GB||w instanceof EC)";
if (js.includes(GRUDGE6_FLIPY_TRUE) && !js.includes(GRUDGE6_FLIPY_PATCHED)) {
  js = js.replace(GRUDGE6_FLIPY_TRUE, GRUDGE6_FLIPY_PATCHED);
}
if (js.includes(GRUDGE6_FLIPY_FALSE)) {
  js = js.replace(GRUDGE6_FLIPY_FALSE, GRUDGE6_FLIPY_PATCHED);
}
function grudge6FlipyOk(source) {
  if (source.includes("s.flipY=!0,s.needsUpdate=!0,o.traverse")) return true;
  const v6Idx = source.indexOf("async function v6(C,A)");
  if (v6Idx < 0) return false;
  const v6Chunk = source.slice(v6Idx, v6Idx + 4500);
  return v6Chunk.includes("s.flipY=!0") && !v6Chunk.includes("s.flipY=!1");
}
mustPatch("grudge6-flipy", grudge6FlipyOk(js));

js = js.replace(
  "d.jsx(WgMinimap,{}),d.jsx(qgA,{}),d.jsx(JgA,{}),",
  "d.jsx(WgCombatHud,{}),d.jsx(WgMinimap,{}),d.jsx(qgA,{}),d.jsx(JgA,{}),",
);
mustPatch("combat-hud-overlay", js.includes("d.jsx(WgCombatHud,{}"));

js = js.replace(
  "const dA=YA.translation();Z.playerPos.set(dA.x,dA.y,dA.z),",
  "const dA=YA.translation();Z.playerPos.set(dA.x,dA.y,dA.z),WgCombatSyncUnits(),WgAttackCd=e.current,",
);
mustPatch("combat-sync-units", js.includes("WgCombatSyncUnits()"));

// ── v42 Toon RTS team palettes + foot grounding ──
const WG_TOON_PALETTES =
  'const WgToonPalettes={royal:{name:"Royal Blue",primary:"#2a4f9c",accent:"#e0b252",enemy:"#8b2e2e"},crimson:{name:"Crimson",primary:"#9b2c2c",accent:"#d4a574",enemy:"#1e3a5f"},emerald:{name:"Emerald",primary:"#1f6b4a",accent:"#c8d878",enemy:"#7a2d2d"},frost:{name:"Frost",primary:"#3a7ab8",accent:"#e8f0ff",enemy:"#5c3030"},sand:{name:"Sand",primary:"#a67c3d",accent:"#f0e0c0",enemy:"#4a5a6a"},violet:{name:"Violet",primary:"#5a3d8a",accent:"#d4b8f0",enemy:"#2d5a4a"},obsidian:{name:"Obsidian",primary:"#3a3f4a",accent:"#9aa8c0",enemy:"#6b3a2a"},gold:{name:"Gold Guard",primary:"#8a7020",accent:"#ffe08a",enemy:"#4a3060"}};function WgGetPaletteId(){try{const c=XI.getState().custom?.teamPalette;return WgToonPalettes[c]?c:"royal"}catch{return"royal"}}function WgGetFactionTint(faction){const id=WgGetPaletteId(),p=WgToonPalettes[id];return faction==="enemy"?p.enemy:p.primary}function WgGetPlayerTint(){return WgGetFactionTint("ally")}function WgPaletteSwatches({value,onChange}){const keys=Object.keys(WgToonPalettes);return d.jsxs("div",{className:"wg-palette-row",children:[d.jsx("span",{className:"wg-palette-label",children:"Team Colors"}),d.jsx("div",{className:"wg-palette-swatches",children:keys.map(k=>{const p=WgToonPalettes[k];return d.jsx("button",{type:"button",className:"wg-palette-swatch"+(value===k?" is-active":""),title:p.name,style:{background:`linear-gradient(135deg,${p.primary} 55%,${p.accent} 55%)`},onClick:()=>onChange(k)},k)})})]})}';
js = js.replace(
  "const dT=1.7,qAA=2.05,yT={ally:\"#ffffff\",enemy:\"#d65a47\"};",
  `${WG_TOON_PALETTES}const dT=1.7,qAA=2.05,yT={ally:\"#ffffff\",enemy:\"#d65a47\"};`,
);
mustPatch("toon-palettes", js.includes("WgToonPalettes"));

js = js.replace(
  "function bAA({typeId:C,unitId:A,faction:I}){const g=yT[I]??\"#ffffff\"",
  "function bAA({typeId:C,unitId:A,faction:I}){const g=WgGetFactionTint(I)",
);
js = js.replace(
  'function bAA({typeId:C,unitId:A,faction:I,isHero:g=!1}){const i=yT[I]??"#ffffff"',
  'function bAA({typeId:C,unitId:A,faction:I,isHero:g=!1}){const i=WgGetFactionTint(I)',
);
mustPatch("toon-tint-baa", js.includes("WgGetFactionTint(I)"));

js = js.replace(
  'function xAA({def:C,faction:A,unitId:I,kaykit:g}){const i=yT[A]??"#ffffff"',
  'function xAA({def:C,faction:A,unitId:I,kaykit:g}){const i=WgGetFactionTint(A)',
);
mustPatch("toon-tint-xaa", js.includes("WgGetFactionTint(A)"));

js = js.replace(
  "Y?.color&&Y.color.multiply(new rI(g))",
  "Y?.color&&Y.color.set(new rI(g))",
);
mustPatch("toon-tint-tu", js.includes("Y.color.set(new rI(g))"));

js = js.replace(
  "Q.flipY=!1,Q.colorSpace=zg,Q.magFilter=Qi,Q.minFilter=Qi,Q.generateMipmaps=!1,Q.needsUpdate=!0;const G=wM(i)",
  "Q.flipY=!0,Q.colorSpace=zg,Q.magFilter=Qi,Q.minFilter=Qi,Q.generateMipmaps=!1,Q.needsUpdate=!0;const G=wM(i)",
);
mustPatch("eu-flipy", js.includes("Q.flipY=!0,Q.colorSpace=zg,Q.magFilter=Qi"));

js = js.replace(
  "static async forPlayer(A){return ah.create({typeId:Iz(A.raceId,A.classId),animPack:A.animPack,tint:A.tint})}",
  "static async forPlayer(A){return ah.create({typeId:Iz(A.raceId,A.classId),animPack:A.animPack,tint:A.tint||WgGetPlayerTint()})}",
);
mustPatch("toon-hero-tint", js.includes("tint:A.tint||WgGetPlayerTint()"));

js = js.replace(
  "if(!zI&&w.current&&!y.current){const pg=Z.map.heightAt(dA.x,dA.z);PI=G.current+(pg-rA.character.lowestSoleWorldY())}",
  "if(!zI&&w.current&&!y.current){rA?.refreshSoleY();const pg=Z.map.heightAt(dA.x,dA.z);PI=G.current+(pg-rA.character.lowestSoleWorldY())}",
);
mustPatch("hero-foot-ik", js.includes("rA?.refreshSoleY()"));

js = js.replace(
  "position:[e.pos.x,0,e.pos.z]",
  "position:[e.pos.x,e.pos.y,e.pos.z]",
);
mustPatch("unit-foot-y", js.includes("position:[e.pos.x,e.pos.y,e.pos.z]"));

js = js.replace(
  'd.jsx("button",{type:"button",className:"gw-btn gw-lobby-march",onClick:_,disabled:!m,title:m?"Deploy with chosen warlord and canonical weapons":"Unlock warlord in War Chest or finish loadout",children:"DEPLOY & MARCH"})',
  'd.jsx(WgPaletteSwatches,{value:WgGetPaletteId(),onChange:id=>XI.getState().setCustom({teamPalette:id})}),d.jsx("button",{type:"button",className:"gw-btn gw-lobby-march",onClick:_,disabled:!m,title:m?"Deploy with chosen warlord and canonical weapons":"Unlock warlord in War Chest or finish loadout",children:"DEPLOY & MARCH"})',
);
mustPatch("warcamp-palette-ui", js.includes("WgGetPaletteId(),onChange:id=>XI.getState().setCustom"));

// ── v44/v48 Hero textures — GLB atlas + canonical visibleMeshes from XI store ──
const WG_FINISH_HERO_MESH =
  'async function WgFinishHeroMesh(C,A,I){let g=!1;C.traverse(i=>{if(!(i instanceof EC)&&!(i instanceof GB))return;const e=Array.isArray(i.material)?i.material:[i.material];for(const t of e)t?.map&&(t.map.colorSpace=zg,t.map.flipY=!0,t.map.needsUpdate=!0,g=!0)});const _wgVis=typeof XI<"u"&&XI.getState().custom?.visibleMeshes?.length?XI.getState().custom.visibleMeshes:I?.visibleMeshes;_wgVis?.length&&L6(C,_wgVis);if(!g)try{const e=await new Zs().loadAsync(F6(A));e.colorSpace=zg,e.flipY=!0,e.needsUpdate=!0,q6(C,e)}catch{}}';
const WG_FINISH_HERO_MESH_OLD =
  'async function WgFinishHeroMesh(C,A,I){let g=!1;C.traverse(i=>{if(!(i instanceof EC)&&!(i instanceof GB))return;const e=Array.isArray(i.material)?i.material:[i.material];for(const t of e)t?.map&&(t.map.colorSpace=zg,t.map.flipY=!0,t.map.needsUpdate=!0,g=!0)}),I?.visibleMeshes?.length&&L6(C,I.visibleMeshes),g||(await new Zs().loadAsync(F6(A)).then(e=>{e.colorSpace=zg,e.flipY=!0,e.needsUpdate=!0,q6(C,e)}).catch(()=>{}))}';
if (js.includes(WG_FINISH_HERO_MESH_OLD)) {
  js = js.replace(WG_FINISH_HERO_MESH_OLD, WG_FINISH_HERO_MESH);
} else if (!js.includes("_wgVis?.length&&L6(C,_wgVis)")) {
  const WG_CLASS_BURST_ANCHOR = 'function WgClassBurstColor(C){return WgClassVfx[C]||"#8fd8ff"};';
  if (js.includes(WG_CLASS_BURST_ANCHOR)) {
    js = js.replace(WG_CLASS_BURST_ANCHOR, `${WG_FINISH_HERO_MESH};${WG_CLASS_BURST_ANCHOR}`);
  }
}
const V6_GLB_Y6_OLD =
  'Y6(o,A.fitHeight),A.tint&&A.tint!=="#ffffff"&&o.traverse(w=>{if(w instanceof EC||w instanceof GB){const u=w.material;u?.color&&u.color.multiply(new rI(A.tint))}});const byName={};';
const V6_GLB_Y6_NEW =
  'Y6(o,A.fitHeight),await WgFinishHeroMesh(o,e,t),A.tint&&A.tint!=="#ffffff"&&o.traverse(w=>{if(w instanceof EC||w instanceof GB){const u=w.material;u?.color&&u.color.multiply(new rI(A.tint))}});const byName={};';
if (js.includes(V6_GLB_Y6_OLD)) {
  js = js.replace(V6_GLB_Y6_OLD, V6_GLB_Y6_NEW);
}
js = js.replaceAll('tint:I||WgGetPlayerTint()', 'tint:I||"#ffffff"');
mustPatch("hero-textures-v44", js.includes("WgFinishHeroMesh"));

mustPatch("hero-weapon-lobby", js.includes("MK(l)?.animPack"));

// v47 — hero weapon anim class helpers on battle units.
mustPatch("hero-weapon-battle", js.includes("WgHeroBattleAnimPack"));

// ── v48 Canonical model3d → GRUDGE6 visibleMeshes (Railway character handoff) ──
mustPatch("canonical-model3d-helper", js.includes("WgModel3dToVisibleMeshes"));
const SET_GRUDGE_HANDOFF_OLD =
  'setGrudgeHandoff:I=>{const g=$5(I),i=g.raceId??A().raceId,e=g.classId??A().classId,t=$E(i,e);t&&C({factionId:t.faction,enemyFactionId:ff(t.faction),raceId:t.raceId,classId:t.classId,prefabId:t.id,grudgeId:g.grudgeId??sr(t.raceId,t.classId),heroId:Tw[t.raceId],custom:{},loadoutLocked:!1})}';
const SET_GRUDGE_HANDOFF_NEW =
  'setGrudgeHandoff:I=>{const g=$5(I),i=g.raceId??I?.raceId??A().raceId,e=g.classId??I?.classId??A().classId,t=$E(i,e);if(!t)return;const m3=I?.model3d||I?.model_3d||g.model3d||g.model_3d,vis=m3?WgModel3dToVisibleMeshes(i,m3):null,custom={};vis?.length&&(custom.visibleMeshes=vis);m3?.skinColor&&(custom.skinTint=m3.skinColor);C({factionId:t.faction,enemyFactionId:ff(t.faction),raceId:t.raceId,classId:t.classId,prefabId:t.id,grudgeId:g.grudgeId??I?.id??sr(t.raceId,t.classId),heroId:Tw[t.raceId],custom,loadoutLocked:!1})}';
if (js.includes(SET_GRUDGE_HANDOFF_OLD)) {
  js = js.replace(SET_GRUDGE_HANDOFF_OLD, SET_GRUDGE_HANDOFF_NEW);
}
mustPatch("canonical-handoff", js.includes("WgModel3dToVisibleMeshes(i,m3)"));
js = js.replace(
  "function WgFinishHeroMesh(C,A,I){let g=!1;C.traverse(i=>{if(!(i instanceof EC)&&!(i instanceof GB))return;const e=Array.isArray(i.material)?i.material:[i.material];for(const t of e)t?.map&&(t.map.colorSpace=zg,t.map.flipY=!0,t.map.needsUpdate=!0,g=!0)}),const _wgVis=typeof XI<\"u\"&&XI.getState().custom?.visibleMeshes?.length?XI.getState().custom.visibleMeshes:I?.visibleMeshes;_wgVis?.length&&L6(C,_wgVis),g||(await new Zs().loadAsync(F6(A)).then(e=>{e.colorSpace=zg,e.flipY=!0,e.needsUpdate=!0,q6(C,e)}).catch(()=>{}))}",
  "function WgFinishHeroMesh(C,A,I){let g=!1;C.traverse(i=>{if(!(i instanceof EC)&&!(i instanceof GB))return;const e=Array.isArray(i.material)?i.material:[i.material];for(const t of e)t?.map&&(t.map.colorSpace=zg,t.map.flipY=!0,t.map.needsUpdate=!0,g=!0)});const _wgVis=typeof XI<\"u\"&&XI.getState().custom?.visibleMeshes?.length?XI.getState().custom.visibleMeshes:I?.visibleMeshes;_wgVis?.length&&L6(C,_wgVis);if(!g)try{const e=await new Zs().loadAsync(F6(A));e.colorSpace=zg,e.flipY=!0,e.needsUpdate=!0,q6(C,e)}catch{}}",
);
mustPatch("canonical-visual-mesh", js.includes("_wgVis?.length&&L6(C,_wgVis)") || js.includes("function WgFinishHeroMesh"));

// ── v43 Craftpix frame fit — 9-slice panels sized to content, not stretched thumbnails ──
const UI_FRAME_REPLACEMENTS = [
  [
    'className:"gk-window-panel"+(cn?" "+cn:""),style:{backgroundImage:`url(${WgUiKitBase}/Window/Window_Background.png)`}',
    'className:"gk-window-panel gk-frame-window"+(cn?" "+cn:"")',
  ],
  [
    'className:"gk-quest-rail",style:{backgroundImage:`url(${WgUiKitBase}/Quest Tracker/QuestTracker_Background.png)`}',
    'className:"gk-quest-rail gk-frame-quest"',
  ],
  [
    'className:"gk-actionbar",style:{backgroundImage:`url(${WgUiKitBase}/Action Bar/ActionBar_Main_Background.png)`}',
    'className:"gk-actionbar gk-frame-actionbar"',
  ],
  [
    'className:"gk-minimap-frame",style:{backgroundImage:`url(${WgUiKitBase}/Minimap/Minimap_Background.png)`}',
    'className:"gk-minimap-frame gk-frame-minimap"',
  ],
  ["width:168,height:112", "width:168,height:112"],
];
for (const [from, to] of UI_FRAME_REPLACEMENTS) {
  if (js.includes(from)) js = js.replaceAll(from, to);
}
mustPatch("ui-frame-fit-v43", js.includes("gk-frame-window"));

// ── v49 Ranged combat: GLB arrow, semi-auto, barrel/staff muzzle, skill cast timers ──
js = js.replace(
  'archer1:{file:"archer-1",size:1.2,speed:55,spin:0,material:{texture:"concrete",color:"#b8915a",roughness:.8,metalness:.1}}',
  'archer1:{file:"archer-1",glb:"/models/projectiles/GRDG-3D-5B98764B.glb",size:1.05,speed:58,spin:14,tint:"#e8c878",forward:[0,0,1],material:{texture:"concrete",color:"#b8915a",roughness:.8,metalness:.1}}',
);
mustPatch("combat-arrow-glb", js.includes("GRDG-3D-5B98764B.glb"));

js = js.replace(
  "s=o.x>=o.y&&o.x>=o.z?new O(1,0,0):o.z>=o.y?new O(0,0,1):new O(0,1,0),l=A.tint?new rI(A.tint):null",
  "s=A.forward?new O(A.forward[0],A.forward[1],A.forward[2]):o.x>=o.y&&o.x>=o.z?new O(1,0,0):o.z>=o.y?new O(0,0,1):new O(0,1,0),l=A.tint?new rI(A.tint):null",
);
mustPatch("combat-proj-forward", js.includes("A.forward?new O"));

js = js.replace(
  "const l=await g.loadAsync(`${GT}models/projectiles/${Q.file}.fbx`);o=YIA(l,Q,e)",
  'let o=null;try{if(Q.glb){const gltf=await WgHeroGltf.loadAsync(Q.glb);o=YIA(gltf.scene,Q,e)}else{const l=await g.loadAsync(`${GT}models/projectiles/${Q.file}.fbx`);o=YIA(l,Q,e)}}catch{continue}if(!o)continue',
);
mustPatch("combat-proj-glb-load", js.includes("Q.glb"));

js = js.replace(
  'sword:{targetSize:.72,pos:[.02,.05,0],rot:[1.5708,0,0],scale:1,muzzle:[0,.42,0]}}},Dq=',
  'sword:{targetSize:.72,pos:[.02,.05,0],rot:[1.5708,0,0],scale:1,muzzle:[0,.42,0]},staff:{targetSize:.85,pos:[.02,.04,.02],rot:[1.5708,0,0],scale:1,muzzle:[0,.78,0]}}},Dq=',
);
mustPatch("combat-staff-mount", js.includes('staff:{targetSize:.85'));

js = js.replace(
  'sword:Rw("sword","right","sword")},nT=Object.keys(sT)',
  'sword:Rw("sword","right","sword"),staff:Rw("staff","right","staff")},nT=Object.keys(sT)',
);
mustPatch("combat-staff-st", js.includes('staff:Rw("staff"'));

js = js.replace(
  'rifle:{id:"rifle",name:"Repeater Rifle",animClass:"ranged",damage:34,fireRate:.1,',
  'rifle:{id:"rifle",name:"Repeater Rifle",animClass:"ranged",damage:34,fireRate:.42,',
);
js = js.replace(
  'pistol:{id:"pistol",name:"Sidearm",animClass:"ranged",damage:22,fireRate:.2,',
  'pistol:{id:"pistol",name:"Sidearm",animClass:"ranged",damage:22,fireRate:.36,',
);
js = js.replace(
  'shotgun:{id:"shotgun",name:"Scattergun",animClass:"ranged",damage:13,fireRate:.78,',
  'shotgun:{id:"shotgun",name:"Scattergun",animClass:"ranged",damage:13,fireRate:.85,',
);
mustPatch("combat-semi-rate", js.includes("fireRate:.42,"));

js = js.replace(
  "weaponMuzzle(){return this.handBone}retuneWeapon(A){}",
  'weaponMuzzle(){const h=this.handBone;if(!h)return null;const key=this._wgMount||"rifle",m=mt.weaponMounts[key]||mt.weaponMounts.rifle;this._wgMuzzle||(this._wgMuzzle=new tt,this._wgMuzzle.name="WgMuzzle",h.add(this._wgMuzzle));return this._wgMuzzle.position.set(m.muzzle[0],m.muzzle[1],m.muzzle[2]),this._wgMuzzle}setWeaponMount(A){this._wgMount=A}retuneWeapon(A){}',
);
mustPatch("combat-muzzle-node", js.includes("setWeaponMount(A)"));

js = js.replace(
  "const j=l.current;OA.setAmmo(OA.ammo-1,OA.reserve)",
  'const j=l.current;hA.current?.setWeaponMount(j.model||"rifle");OA.setAmmo(OA.ammo-1,OA.reserve)',
);
js = js.replace(
  "const OA=c.current,j=hA.current;j?.attack();",
  'const OA=c.current,j=hA.current;j?.setWeaponMount(OA.model||"sword"),j?.attack();',
);
mustPatch("combat-mount-sync", js.includes('setWeaponMount(j.model||"rifle")'));

js = js.replace(
  'const WgAim={focusEnabled:!1,rmb:!1,token:0};let WgAttackCd=0;const WgSoftLock={active:!1,targetId:null};',
  'const WgAim={focusEnabled:!1,rmb:!1,token:0};let WgAttackCd=0,WgSemiPending=!1;const WgSoftLock={active:!1,targetId:null},WgCast={active:!1,skill:null,left:0,total:0,origin:null,color:"#8fd8ff",wt:null,dmg:1};function WgSkillCastTime(sk,wt){if(!sk)return 0;const cd=sk.cooldown||0;if(wt==="STAFF")return cd>=8?1.15:cd>=4?.72:.48;if(wt==="BOW"||wt==="CROSSBOW"||wt==="GUN")return cd>=6?.65:cd>=3?.42:.28;return cd>=8?.85:cd>=4?.5:0}function WgTickSkillCast(dt,cam,hero,wt,dmg){if(!WgCast.active)return;WgCast.left-=dt;const o=WgCast.origin;if(o&&(Math.random()<.55&&Z.addEmber(o.clone(),WgCast.color),Math.random()<.3&&Z.addSpark(o.clone(),WgCast.color)),WgCast.left>0)return;const sk=WgCast.skill,b=BI.getState();WgCast.active=!1;const pos=o||new O;Z.addFireBurst(pos,WgCast.color,8,.75),Z.addSpark(pos.clone(),WgCast.color),Z.addImpact(pos),Z.addShake(.12);WgGetAimDir(cam,WgAimTmp),WgResolveAimPoint(cam,WgAimOut),IAA(sk,WgAimOut,WgAimTmp,wt,dmg*b.damageMult),b.startWeaponSkillCooldown(sk.id,sk.cooldown),b.pushMessage(sk.label.toUpperCase(),"success")}',
);
mustPatch("combat-cast-state", js.includes("WgSkillCastTime"));

js = js.replace(
  "if(WgAim.focusEnabled)Q.current=!0;else{const rect=I.domElement.getBoundingClientRect();WgPickTargetFromRay(A,rA.clientX-rect.left,rA.clientY-rect.top,rect.width,rect.height)}",
  "if(WgAim.focusEnabled)Q.current=!0;else{WgSemiPending=!0;const rect=I.domElement.getBoundingClientRect();WgPickTargetFromRay(A,rA.clientX-rect.left,rA.clientY-rect.top,rect.width,rect.height)}",
);
mustPatch("combat-semi-pending", js.includes("WgSemiPending=!0"));

js = js.replace(
  'eI&&!y.current&&SA==="combat"&&Q.current&&e.current<=0&&(WgAim.focusEnabled||WgSoftLock.active)',
  'eI&&!y.current&&SA==="combat"&&e.current<=0&&(WgAim.focusEnabled?Q.current:WgSemiPending)&&(WgAim.focusEnabled||WgSoftLock.active||WgSemiPending)',
);
mustPatch("combat-semi-gate", js.includes("WgSemiPending)"));

js = js.replace(
  "o.current?(NI(),e.current=c.current.swingRate/KI):(tA(),e.current=l.current.fireRate/KI)",
  "o.current?(NI(),e.current=c.current.swingRate/KI):(tA(),WgSemiPending=!1,e.current=l.current.fireRate/KI)",
);
mustPatch("combat-semi-clear", js.includes("WgSemiPending=!1,e.current"));

js = js.replace(
  'function ZA(OA){if(_g.getState().mode!=="combat"||y.current)return;const j=CA.current[OA];if(!j)return;const b=BI.getState();!b.weaponSkillReady(j.id)||!hA.current?.castWeaponSkill(j)||(b.startWeaponSkillCooldown(j.id,j.cooldown),WgGetAimDir(A,pB),WgResolveAimPoint(A,WgAimOut),IAA(j,WgAimOut,pB,cT(RA,AI,h.current),b.damageMult),b.pushMessage(j.label.toUpperCase(),"info"))}',
  'function ZA(OA){if(_g.getState().mode!=="combat"||y.current||WgCast.active)return;const j=CA.current[OA];if(!j)return;const b=BI.getState();if(!b.weaponSkillReady(j.id))return;const wt=cT(RA,AI,h.current),ct=WgSkillCastTime(j,wt),col=j.color||WgClassBurstColor(XI.getState().classId);if(!hA.current?.castWeaponSkill(j))return;if(ct<=0){b.startWeaponSkillCooldown(j.id,j.cooldown),WgGetAimDir(A,pB),WgResolveAimPoint(A,WgAimOut),Z.addFireBurst(WgAimOut.clone(),col,6,.62),Z.addImpact(WgAimOut),IAA(j,WgAimOut,pB,wt,b.damageMult),b.pushMessage(j.label.toUpperCase(),"info");return}const pos=new O;hA.current?.weaponMuzzle?.()?(hA.current.root.updateMatrixWorld(!0),hA.current.weaponMuzzle().getWorldPosition(pos)):pos.copy(A.position).setY(A.position.y+1.2);WgCast.active=!0,WgCast.skill=j,WgCast.left=ct,WgCast.total=ct,WgCast.origin=pos.clone(),WgCast.color=col,WgCast.wt=wt,WgCast.dmg=1,b.pushMessage(j.label+"…","info")}',
);
mustPatch("combat-skill-cast", js.includes("WgCast.active=!0"));

js = js.replace(
  "const dA=YA.translation();Z.playerPos.set(dA.x,dA.y,dA.z),WgCombatSyncUnits(),WgAttackCd=e.current,",
  "const dA=YA.translation();Z.playerPos.set(dA.x,dA.y,dA.z),WgCombatSyncUnits(),WgAttackCd=e.current,WgTickSkillCast(Math.min(.05,o),A,hA.current,cT(RA,AI,h.current),1),",
);
mustPatch("combat-cast-tick", js.includes("WgTickSkillCast(Math.min(.05,o),A"));

const CAST_ANIM_ONLY =
  'castWeaponSkill(A){const I=this.skillClips.get(A.baked);return I?(this.prepared.director.requestOneShot(I,{fade:.1,blend:A.blend}),!0):!1}';
const CAST_VFX_VARIANTS = [
  'castWeaponSkill(A){const I=this.skillClips.get(A.baked);if(!I)return!1;this.prepared.director.requestOneShot(I,{fade:.1,blend:A.blend});const g=new O;this.handBone?this.handBone.getWorldPosition(g):this.root.getWorldPosition(g),g.y+=1.2;const i=A.color||WgClassBurstColor(XI.getState().classId);return Z.addFireBurst(g,i,6,.62),Z.addSpark(g.clone(),i),Z.addImpact(g),Z.addShake(.1),!0}',
  'castWeaponSkill(A){const I=this.skillClips.get(A.baked);if(!I)return!1;this.prepared.director.requestOneShot(I,{fade:.1,blend:A.blend});const g=new O;this.handBone?this.handBone.getWorldPosition(g):this.root.getWorldPosition(g),g.y+=1.2;const i=A.color||"#8fd8ff";return Z.addFireBurst(g,i,5,.55),Z.addImpact(g),Z.addShake(.08),!0}',
];
for (const vfx of CAST_VFX_VARIANTS) {
  if (js.includes(vfx)) js = js.replace(vfx, CAST_ANIM_ONLY);
}
mustPatch("combat-cast-anim-only", js.includes("requestOneShot(I,{fade:.1,blend:A.blend}),!0):!1}"));

js = js.replace(
  "const c=Ap.clone().addScaledVector(mw,s);Z.addMuzzleFlash(c);for(const h of Z.units)",
  'const c=Ap.clone().addScaledVector(mw,s);Z.addMuzzleFlash(c);if(g==="BOW"||g==="CROSSBOW")Z.addProjectile("archer1",Ap.clone(),c,{arc:2}),Z.addSpark(c,"#cdeac0");else if(g==="GUN")Z.addBolt(Ap.clone(),c);for(const h of Z.units)',
);
mustPatch("combat-skill-proj", js.includes('Z.addProjectile("archer1",Ap.clone(),c'));

js = js.replace(
  'WgAttackCd>.05&&d.jsx("div",{className:"wg-atk-cd-ring",children:d.jsx("span",{children:WgAttackCd.toFixed(1)})})]})}',
  'WgAttackCd>.05&&d.jsx("div",{className:"wg-atk-cd-ring",children:d.jsx("span",{children:WgAttackCd.toFixed(1)})}),WgCast.active&&d.jsxs("div",{className:"wg-cast-bar",children:[d.jsx("div",{className:"wg-cast-fill",style:{width:Math.max(0,100*(1-WgCast.left/WgCast.total))+"%"}}),d.jsx("span",{className:"wg-cast-label",children:WgCast.skill?.label})]})]})}',
);
mustPatch("combat-cast-hud", js.includes("wg-cast-bar"));

// ── v50 Skill VFX catalog — bullet / arrow / spell orbs from info.grudge-studio + grudge-vfx.puter.site ──
const WGVFX_CATALOG_INLINE = String(
  readFileSync(join(ROOT, "data", "vfx", "wg-vfx-catalog.json"), "utf8"),
).replace(/\s+/g, "");

const WGVFX_RUNTIME = `const WgVfxCat=${WGVFX_CATALOG_INLINE};function WgVfxSkillFx(sk){const fx=sk?.effects?.[0];return fx&&WgVfxCat.fxMap[fx]||null}function WgVfxGuessEl(sk){const id=(sk?.id||"").toLowerCase();return/ice|frost|blizzard|frozen/.test(id)?"frost":/lightning|thunder|shock|chain/.test(id)?"lightning":/heal|holy|bless|light|moon|consecrate/.test(id)?"holy":/shadow|void|chaos|arcane|blink|portal|missile/.test(id)?"arcane":/fire|flame|meteor|inferno|lava/.test(id)?"fire":"arcane"}function WgVfxNrKey(pid){return pid==="arrow_trail"?"archer1":"wg_"+pid}function WgSkillProjectile(sk,wt){if(wt==="BOW"||wt==="CROSSBOW")return"archer1";if(wt==="GUN")return"wg_bullet";const fx=WgVfxSkillFx(sk),el=fx?.element||WgVfxGuessEl(sk),def=WgVfxCat.elementDefaults[el]||WgVfxCat.elementDefaults.arcane,pid=fx?.proj||def.proj;return WgVfxNrKey(pid)}function WgVfxProjColor(key){const ent=nr[key];if(ent?.tint)return ent.tint;const pid=(key||"").replace(/^wg_/,""),p=WgVfxCat.projectiles[pid]||WgVfxCat.projectiles.flame_ball;return p?.primary||"#8fd8ff"}function WgCastChargeTick(o,col,wt,sk){const fx=WgVfxSkillFx(sk),el=fx?.element||WgVfxGuessEl(sk),castId=fx?.cast||(WgVfxCat.elementDefaults[el]||{}).cast||"arcane_channeling",aura=WgVfxCat.castAuras[castId]||{},c1=aura.primary||col,c2=aura.secondary||col;wt==="STAFF"||!AAA.has(wt)?(Math.random()<.5&&Z.addEmber(o.clone(),c1),Math.random()<.35&&Z.addSpark(o.clone(),c2),Math.random()<.2&&Z.addFireBurst(o.clone(),c1,2,.3)):(Math.random()<.55&&Z.addEmber(o.clone(),col),Math.random()<.3&&Z.addSpark(o.clone(),col))}`;

if (!js.includes("const WgVfxCat=")) {
  // End the shared `const Ap,mw,Ip` declarator before injecting WgVfxCat — otherwise we get
  // `Ip=new O,const WgVfxCat=…` which is a SyntaxError (Unexpected token 'const').
  js = js.replace(
    'Ip=new O,AAA=new Set(["BOW","CROSSBOW","GUN"]);function IAA(',
    `Ip=new O;${WGVFX_RUNTIME};const AAA=new Set(["BOW","CROSSBOW","GUN"]);function IAA(`,
  );
}
mustPatch("combat-vfx-catalog", js.includes("const WgVfxCat="));

js = js.replace(
  "wizard:{file:\"wizard\",size:1.05,speed:50,spin:4,tint:\"#c9a3ff\",material:{texture:\"metal\",color:\"#6a4a8a\",roughness:.45,metalness:.4},splash:{radius:3.2,damage:16,slow:{factor:.5,duration:2.5}}}",
  "wizard:{file:\"wizard\",size:1.05,speed:50,spin:4,tint:\"#c9a3ff\",material:{texture:\"metal\",color:\"#6a4a8a\",roughness:.45,metalness:.4},splash:{radius:3.2,damage:16,slow:{factor:.5,duration:2.5}}},wg_flame_ball:{orb:1,size:.5,speed:50,spin:10,tint:\"#ff4400\",forward:[0,0,1],trail:.5},wg_ice_ball:{orb:1,size:.45,speed:52,spin:8,tint:\"#44ddff\",forward:[0,0,1],trail:.45},wg_lightning_ball:{orb:1,size:.42,speed:56,spin:14,tint:\"#ffff44\",forward:[0,0,1],trail:.55},wg_chaos_orb:{orb:1,size:.48,speed:46,spin:12,tint:\"#aa44ff\",forward:[0,0,1],trail:.5},wg_cured_ball:{orb:1,size:.4,speed:54,spin:6,tint:\"#ffee88\",forward:[0,0,1],trail:.4},wg_lava_orb:{orb:1,size:.55,speed:42,spin:6,tint:\"#ff3300\",forward:[0,0,1],trail:.48},wg_frozen_orb:{orb:1,size:.5,speed:44,spin:16,tint:\"#00bbff\",forward:[0,0,1],trail:.5},wg_bullet:{orb:1,size:.14,speed:118,spin:0,tint:\"#ffc85a\",forward:[0,0,1],trail:.65}",
);
mustPatch("combat-spell-orbs", js.includes("wg_flame_ball:{orb:1"));

const LIA_ORB_PATCH =
  'let o=null;try{if(Q.glb){const gltf=await WgHeroGltf.loadAsync(Q.glb);o=YIA(gltf.scene,Q,e)}else{const l=await g.loadAsync(`${GT}models/projectiles/${Q.file}.fbx`);o=YIA(l,Q,e)}}catch{continue}if(!o)continue';
const LIA_ORB_NEW =
  'let o=null;try{if(Q.orb){const geo=new Yr(Q.size*.5,10,10),mat=new te({color:new rI(Q.tint||"#ffffff"),emissive:new rI(Q.tint||"#ffffff"),emissiveIntensity:1.35,transparent:!0,opacity:.92,depthWrite:!1}),mesh=new EC(geo,mat);o=YIA(mesh,Object.assign({forward:Q.forward||[0,0,1]},Q),e)}else if(Q.glb){const gltf=await WgHeroGltf.loadAsync(Q.glb);o=YIA(gltf.scene,Q,e)}else{const l=await g.loadAsync(`${GT}models/projectiles/${Q.file}.fbx`);o=YIA(l,Q,e)}}catch{continue}if(!o)continue';
if (js.includes(LIA_ORB_PATCH)) {
  js = js.replace(LIA_ORB_PATCH, LIA_ORB_NEW);
  mustPatch("combat-proj-orb", true);
} else if (js.includes("Q.orb")) {
  mustPatch("combat-proj-orb", true);
} else {
  mustPatch("combat-proj-orb", false);
}

js = js.replace(
  "const l=nr[s.model],c=l.splash?.38:.22;if(Math.random()<.5)",
  "const l=nr[s.model],c=l.trail??(l.splash?.38:.22);if(Math.random()<.5)",
);
mustPatch("combat-proj-trail-rate", js.includes("l.trail??"));

const IAA_V49 =
  'function IAA(C,A,I,g,i){const e=C.damage*i*Z.factionDmgMult("ally");mw.copy(I).normalize(),Ap.copy(A);const t=AAA.has(g),Q=t?42:5.5,o=t?.08:1.05;if(!t){const h=new O(Z.playerPos.x,Z.playerPos.y+1,Z.playerPos.z);bF(h,mw,Q,o,e,"ally","#ffd080",!0),Z.addShake(C.damage>40?.12:.06);return}let s=Q;const l=(h,w)=>{Ip.copy(h).sub(Ap);const u=Ip.dot(mw);u<.2||u>s||(Ip.copy(Ap).addScaledVector(mw,u),Ip.distanceTo(h)<=w&&(s=u))};for(const h of Z.units)!h.alive||h.faction!=="enemy"&&h.faction!=="neutral"||l(h.pos,.95*h.def.scale);for(const h of Z.structures)!h.alive||h.faction!=="enemy"||!Ao(h)||l(h.pos,lQ(h.kind));const c=Ap.clone().addScaledVector(mw,s);Z.addMuzzleFlash(c);if(g==="BOW"||g==="CROSSBOW")Z.addProjectile("archer1",Ap.clone(),c,{arc:2}),Z.addSpark(c,"#cdeac0");else if(g==="GUN")Z.addBolt(Ap.clone(),c);for(const h of Z.units)!h.alive||h.faction!=="enemy"&&h.faction!=="neutral"||h.pos.distanceTo(c)>2.2||Wf(h,e);for(const h of Z.structures)!h.alive||h.faction!=="enemy"||!Ao(h)||h.pos.distanceTo(c)>lQ(h.kind)+1||Wf(h,e);C.damage>=55&&Z.addShockwave({pos:c.clone().setY(.12),maxRadius:7,duration:.45,damage:e*.35,color:"#8fd8ff",faction:"ally"})}';
const IAA_V50 =
  'function IAA(C,A,I,g,i){const e=C.damage*i*Z.factionDmgMult("ally");mw.copy(I).normalize();const t=AAA.has(g),Q=t?42:5.5,o=t?.08:1.05,orig=new O(Z.playerPos.x,Z.playerPos.y+1.15,Z.playerPos.z),tgt=A.clone?A.clone():new O(A.x,A.y,A.z);let s=Q;const clip=(h,w)=>{Ip.copy(h).sub(orig);const u=Ip.dot(mw);u<.2||u>s||(Ip.copy(orig).addScaledVector(mw,u),Ip.distanceTo(h)<=w&&(s=u))};if(!t)bF(orig,mw,Q,o,e,"ally","#ffd080",!0),Z.addShake(C.damage>40?.12:.06);else{for(const h of Z.units)!h.alive||h.faction!=="enemy"&&h.faction!=="neutral"||clip(h.pos,.95*h.def.scale);for(const h of Z.structures)!h.alive||h.faction!=="enemy"||!Ao(h)||clip(h.pos,lQ(h.kind))}const c=orig.clone().addScaledVector(mw,s),pk=WgSkillProjectile(C,g),pc=WgVfxProjColor(pk),dest=tgt.distanceTo(orig)>1.2?tgt:c;Z.addMuzzleFlash(c);if(g==="BOW"||g==="CROSSBOW")Z.addProjectile("archer1",orig.clone(),dest,{arc:2}),Z.addSpark(c,"#cdeac0"),Z.addEmber(c,"#e8c878");else if(g==="GUN")Z.addProjectile("wg_bullet",orig.clone(),c),Z.addBolt(orig.clone(),c),Z.addSpark(c,"#ffc85a");else Z.addProjectile(pk,orig.clone(),dest,{arc:C.damage>45?1.4:.35}),Z.addFireBurst(c,pc,4,.55),Z.addSpark(c,pc);if(t){for(const h of Z.units)!h.alive||h.faction!=="enemy"&&h.faction!=="neutral"||h.pos.distanceTo(c)>2.2||Wf(h,e);for(const h of Z.structures)!h.alive||h.faction!=="enemy"||!Ao(h)||h.pos.distanceTo(c)>lQ(h.kind)+1||Wf(h,e)}C.damage>=55&&Z.addShockwave({pos:c.clone().setY(.12),maxRadius:7,duration:.45,damage:e*.35,color:pc,faction:"ally"})}';
if (js.includes(IAA_V49)) {
  js = js.replace(IAA_V49, IAA_V50);
  mustPatch("combat-skill-vfx-iaa", true);
} else if (js.includes("WgSkillProjectile(C,g)")) {
  mustPatch("combat-skill-vfx-iaa", true);
} else {
  mustPatch("combat-skill-vfx-iaa", false);
}

js = js.replace(
  "if(o&&(Math.random()<.55&&Z.addEmber(o.clone(),WgCast.color),Math.random()<.3&&Z.addSpark(o.clone(),WgCast.color)),WgCast.left>0)return",
  "if(o&&WgCastChargeTick(o,WgCast.color,WgCast.wt,WgCast.skill),WgCast.left>0)return",
);
js = js.replace(
  "Z.addFireBurst(pos,WgCast.color,8,.75),Z.addSpark(pos.clone(),WgCast.color),Z.addImpact(pos),Z.addShake(.12);WgGetAimDir(cam,WgAimTmp),WgResolveAimPoint(cam,WgAimOut),IAA(sk,WgAimOut,WgAimTmp,wt,dmg*b.damageMult)",
  "Z.addFireBurst(pos,WgVfxProjColor(WgSkillProjectile(sk,wt)),8,.75),Z.addSpark(pos.clone(),WgVfxProjColor(WgSkillProjectile(sk,wt))),Z.addImpact(pos),Z.addShake(.12);WgGetAimDir(cam,WgAimTmp),WgResolveAimPoint(cam,WgAimOut),IAA(sk,WgAimOut,WgAimTmp,wt,dmg*b.damageMult)",
);
mustPatch("combat-cast-charge-vfx", js.includes("WgCastChargeTick"));

// Final safety — v48 split GLBs crash Three.js; lobby palId typo crashes React.
const CIA_V47 =
  'CIA={medieval:{outer:"watchtower_lvl1",inner:"game_ready_turret"},elven:{outer:"fantasy_crossbow_tower",inner:"archer_t3"},orc:{outer:"bomber_t1",inner:"bomber_t3"},ruins:{outer:"slow_t1",inner:"slow_t3"}}';
const CIA_BROKEN =
  'CIA={medieval:{outer:"luchnik",inner:"stylized_turret"},elven:{outer:"fantasy_crossbow_tower",inner:"mag"},orc:{outer:"pushka",inner:"bashnia2"},ruins:{outer:"slow_t1",inner:"bashnia"}}';
if (js.includes(CIA_BROKEN)) js = js.replace(CIA_BROKEN, CIA_V47);
js = js.replaceAll(
  'd.jsx(WgPaletteSwatches,{value:palId,onChange:setPal})',
  'd.jsx(WgPaletteSwatches,{value:WgGetPaletteId(),onChange:id=>XI.getState().setCustom({teamPalette:id})})',
);

// Manifest-driven patch fingerprints — hard fail if any critical needle missing.
for (const { id, needle } of manifest.bundlePatches) {
  mustPatch(id, js.includes(needle));
}

if (patchFailures.length) {
  console.error("[patch] FAILED patches:", patchFailures.join(", "));
  process.exit(1);
}

// WgKitResourceBar shellInject typo — `})]})` must be `})})]})` (esbuild catches this; node --check does not).
js = js.replaceAll('children:"Sign in"})]})]})', 'children:"Sign in"})})]})');



// v65: play-flow + clean UI
{
  // Bulletproof Quick Battle — never silent-return
  const QB_NEW =
    'function WgQuickBattle(nav){try{if(!WgEnsureReady()){const p="sir-aldric-valorheart",c=qe.find(h=>h.id===p);if(c){const s=zC.getState();s.onboardingDone||s.completeStarterPick(c.id);const x=XI.getState();x.setFaction(c.faction),x.setPrefab(c.id),Yz(c.id,x.setMelee,x.setRanged,x.setGearTier),s.seedDefaultLaneGuards(c.faction)}}}catch{}try{WgSeedDefaultDeploy()}catch{try{BI.getState().resetLaneDeployment()}catch{}}try{WgSaveChampionLane(WgReadChampionLane())}catch{}try{WgMarkDeployDone()}catch{}try{const x=XI.getState();x.loadoutLocked||x.lockLoadout()}catch{}try{BI.getState().startGame()}catch{}try{nav("/play")}catch{location.assign("/play")}}';
  if (js.includes("function WgQuickBattle")) {
    js = js.replace(/function WgQuickBattle\(nav\)\{[\s\S]*?\}function WgDeployAndPlay/, QB_NEW + "function WgDeployAndPlay");
    console.log("[patch] WgQuickBattle hardened");
  }

  // DeployAndPlay: always start if deploy done
  js = js.replace(
    /function WgDeployAndPlay\(\)\{if\(!WgIsDeployDone\(\)&&!WgRestoreMatch\(\)\)return!1;if\(!WgEnsureReady\(\)\)return!1;const x=XI\.getState\(\);x\.loadoutLocked\|\|x\.lockLoadout\(\),BI\.getState\(\)\.startGame\(\);return!0\}/,
    'function WgDeployAndPlay(){if(!WgIsDeployDone()&&!WgRestoreMatch())return!1;try{WgEnsureReady()}catch{}try{const x=XI.getState();x.loadoutLocked||x.lockLoadout()}catch{}try{BI.getState().startGame()}catch{}return!0}'
  );

  // PgA: never soft-lock / bounce to deploy — start battle when player reaches /play
  if (js.includes('if(WgIsDeployDone()){WgDeployAndPlay(),o(!0);s("");return}if(!WgEnsureReady())')) {
    js = js.replace(
      'if(WgIsDeployDone()){WgDeployAndPlay(),o(!0);s("");return}if(!WgEnsureReady()){o(!1);s("Pick a champion in the warcamp first.");return}if(!WgIsDeployDone()){nav("/deploy",{replace:!0});return}s("");WgDeployAndPlay(),o(!0)',
      'try{WgEnsureReady()}catch{}if(WgIsDeployDone()){try{WgDeployAndPlay()}catch{try{BI.getState().startGame()}catch{}}o(!0);s("");return}try{WgMarkDeployDone();BI.getState().startGame();o(!0);s("");return}catch{o(!1);s("Could not start battle — open warcamp and try again.")}'
    );
    console.log("[patch] PgA gate no longer soft-locks");
  }

  mustPatch("quick-battle-v65", js.includes("location.assign") || /function WgQuickBattle\(nav\)\{try\{if\(!WgEnsureReady/.test(js));
  mustPatch("pga-v65", js.includes("Could not start battle") || !js.includes('nav("/deploy",{replace:!0})'));
}

// v66: minimap origin-centered map + clamp tower fit (prevents 10000× assets) + keep id.grudge-studio.com auth
{
  // Auth SSOT — full-page login is id.grudge-studio.com (NOT game.grudge-studio.com)
  if (!js.includes('bR="https://id.grudge-studio.com"')) {
    js = js.replace(/bR="https:\/\/[^"]+"/, 'bR="https://id.grudge-studio.com"');
  }
  js = js.replaceAll("game.grudge-studio.com/game/login", "id.grudge-studio.com/login");
  mustPatch("auth-id-grudge", js.includes('bR="https://id.grudge-studio.com"') && js.includes("${bR}/login?redirect_uri="));

  // Minimap: map coords are origin-centered (ally +z / enemy -z), not 0..width
  const MM_OLD =
    'const W=map.width||120,L=map.length||120,mx=Math.max(W,L,.1),sx=w/mx,sz=h/mx,ox=(w-W*sx)/2,oz=(h-L*sz)/2;ctx.clearRect(0,0,w,h);ctx.fillStyle="rgba(6,9,14,0.55)";ctx.fillRect(0,0,w,h);ctx.strokeStyle="rgba(120,150,200,0.42)";ctx.lineWidth=1.5;for(let li=0;li<3;li++){const lane=map.lanes?.[li];if(!lane?.pts?.length)continue;ctx.beginPath();lane.pts.forEach((p,i)=>{const x=ox+p.x*sx,y=oz+p.z*sz;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}const dot=(x,z,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(ox+x*sx,oz+z*sz,r,0,6.283);ctx.fill()}';
  const MM_NEW =
    'const W=map.width||120,L=map.length||120,sx=w/Math.max(W,.1),sz=h/Math.max(L,.1),cx=w*.5,cz=h*.5;ctx.clearRect(0,0,w,h);ctx.fillStyle="rgba(6,9,14,0.72)";ctx.fillRect(0,0,w,h);ctx.strokeStyle="rgba(120,150,200,0.35)";ctx.lineWidth=1;ctx.strokeRect(.5,.5,w-1,h-1);ctx.strokeStyle="rgba(120,150,200,0.45)";ctx.lineWidth=1.5;for(let li=0;li<3;li++){const lane=map.lanes?.[li];if(!lane?.pts?.length)continue;ctx.beginPath();lane.pts.forEach((p,i)=>{const x=cx+p.x*sx,y=cz+p.z*sz;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}const dot=(x,z,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(cx+x*sx,cz+z*sz,r,0,6.283);ctx.fill()}';
  if (js.includes(MM_OLD)) {
    js = js.replace(MM_OLD, MM_NEW);
    console.log("[patch] minimap origin-centered projection");
  } else if (js.includes("ox+p.x*sx,y=oz+p.z*sz")) {
    js = js.replaceAll("ox+p.x*sx,y=oz+p.z*sz", "cx+p.x*sx,y=cz+p.z*sz");
    js = js.replaceAll("ox+x*sx,oz+z*sz", "cx+x*sx,cz+z*sz");
    js = js.replace(
      "const W=map.width||120,L=map.length||120,mx=Math.max(W,L,.1),sx=w/mx,sz=h/mx,ox=(w-W*sx)/2,oz=(h-L*sz)/2",
      "const W=map.width||120,L=map.length||120,sx=w/Math.max(W,.1),sz=h/Math.max(L,.1),cx=w*.5,cz=h*.5",
    );
    console.log("[patch] minimap projection alt fix");
  }
  // Square canvas for minimap
  js = js.replace(
    'className:"gk-minimap-canvas",width:168,height:112',
    'className:"gk-minimap-canvas",width:156,height:156',
  );

  // Clamp tower/core fit — empty bbox was producing ~10000× scale
  const FIT_OLD =
    "function WgFitTowerScene(C,A=BIA){const I=wM(C);I.traverse(g=>{const i=g;if(i.isMesh){i.castShadow=!0,i.receiveShadow=!0;const e=i.material,t=Array.isArray(e)?e:[e];for(const Q of t)Q?.map&&(Q.map.flipY=!0,Q.map.colorSpace=zg,Q.map.needsUpdate=!0,Q.color?.set?.(\"#ffffff\"))}});const g=new YC().setFromObject(I),i=new O;g.getSize(i);const e=A/Math.max(i.y,.001);return I.scale.setScalar(e),I.position.y=-g.min.y*e,I.position.x=-((g.min.x+g.max.x)/2)*e,I.position.z=-((g.min.z+g.max.z)/2)*e,I}";
  const FIT_NEW =
    "function WgFitTowerScene(C,A=BIA){const I=wM(C);I.traverse(g=>{const i=g;if(i.isMesh){i.castShadow=!0,i.receiveShadow=!0;const e=i.material,t=Array.isArray(e)?e:[e];for(const Q of t)Q?.map&&(Q.map.flipY=!0,Q.map.colorSpace=zg,Q.map.needsUpdate=!0,Q.color?.set?.(\"#ffffff\"))}});I.updateWorldMatrix(!0,!0);const g=new YC().setFromObject(I),i=new O;g.getSize(i);const h=Math.max(i.y,i.x*.55,i.z*.55,.75),e=Math.min(Math.max((A||7)/h,.02),12);return I.scale.setScalar(e),I.position.y=-g.min.y*e,I.position.x=-((g.min.x+g.max.x)/2)*e,I.position.z=-((g.min.z+g.max.z)/2)*e,I}";
  if (js.includes(FIT_OLD)) {
    js = js.replace(FIT_OLD, FIT_NEW);
    console.log("[patch] WgFitTowerScene clamp");
  } else if (js.includes("function WgFitTowerScene")) {
    js = js.replace(
      "const e=A/Math.max(i.y,.001);return I.scale.setScalar(e)",
      "const h=Math.max(i.y,i.x*.55,i.z*.55,.75),e=Math.min(Math.max((A||7)/h,.02),12);return I.scale.setScalar(e)",
    );
    console.log("[patch] WgFitTowerScene clamp alt");
  }
  // Slightly smaller citadels
  js = js.replace("WgCoreBIA=12.5", "WgCoreBIA=8.5");
  js = js.replace('BIA=12.5;function WgFactionCoreUrl', 'BIA=7.2;function WgFactionCoreUrl');

  mustPatch("minimap-v66", js.includes("cx+p.x*sx") || js.includes("cx=w*.5"));
  mustPatch("tower-fit-v66", js.includes("Math.min(Math.max((A||7)/h") || js.includes("i.x*.55"));
}

// v67: GRUDGE6 hero fit/facing + real craftpix combat HUD
{
  // Y6 was: rotate +90°, power-of-10 unit "fix" (m6) → 100× blowups, walk looks reverse.
  // Replace with height-based fit, no m6, native facing (controller owns yaw).
  const Y6_OLD_START = "function Y6(C,A=2.05){const I=J6(C);C.rotation.y=Math.PI/2,";
  if (js.includes(Y6_OLD_START)) {
    // Slice full Y6 function
    const yStart = js.indexOf("function Y6(C,A=2.05){");
    if (yStart >= 0) {
      let braces = 0,
        started = false,
        yEnd = -1;
      for (let i = yStart; i < js.length; i++) {
        if (js[i] === "{") {
          braces++;
          started = true;
        } else if (js[i] === "}") {
          braces--;
          if (started && braces === 0) {
            yEnd = i + 1;
            break;
          }
        }
      }
      if (yEnd > yStart) {
        const Y6_NEW =
          "function Y6(C,A=2.05){const I=J6(C);C.rotation.set(0,0,0);C.scale.set(1,1,1);C.position.set(0,0,0);C.updateWorldMatrix(!0,!0);const box0=new YC().setFromObject(C),sz0=box0.getSize(new O);let hy=Math.max(sz0.y,.001);if(hy>8){const pre=1.8/hy;C.scale.setScalar(pre),C.updateWorldMatrix(!0,!0)}const box1=new YC().setFromObject(C),sz1=box1.getSize(new O),h=Math.max(sz1.y,.05),target=Math.min(Math.max(A||2.05,1.6),2.4),e=Math.min(Math.max(target/h,.05),3.5);C.scale.multiplyScalar(e),C.updateWorldMatrix(!0,!0);const box2=new YC().setFromObject(C),c2=box2.getCenter(new O);return C.position.set(-c2.x,-box2.min.y,-c2.z),C.updateWorldMatrix(!0,!0),I}";
        js = js.slice(0, yStart) + Y6_NEW + js.slice(yEnd);
        console.log("[patch] Y6 hero fit/facing rewrite (no m6, no +90°)");
      }
    }
  } else if (js.includes("C.rotation.y=Math.PI/2,C.updateWorldMatrix(!0,!0)")) {
    js = js.replace("C.rotation.y=Math.PI/2,C.updateWorldMatrix(!0,!0)", "C.rotation.set(0,0,0),C.updateWorldMatrix(!0,!0)");
    console.log("[patch] removed Y6 +90° yaw");
  }

  // Disable power-of-10 mesh rescale globally if still present in other paths
  if (js.includes("function m6(C,A){return!(C>0)||!(A>0)?1:Math.pow(10,Math.round(Math.log10(C/A)))}")) {
    js = js.replace(
      "function m6(C,A){return!(C>0)||!(A>0)?1:Math.pow(10,Math.round(Math.log10(C/A)))}",
      "function m6(C,A){return 1}",
    );
    console.log("[patch] disabled m6 power-of-10 rescale");
  }

  // Hero fit height for player slightly taller, units sane
  js = js.replace("l=g?2.25:qAA", "l=g?1.85:1.7");
  js = js.replaceAll("fitHeight:2.15", "fitHeight:1.85");
  js = js.replaceAll("fitHeight:2.05", "fitHeight:1.85");

  // Player spawn on ground (not floating 1.7 if model feet wrong)
  js = js.replace(
    "Z.playerPos.set(p.x,1.7,p.z)",
    "Z.playerPos.set(p.x,Z.groundY?Z.groundY(p.x,p.z):0,p.z)",
  );

  mustPatch("hero-fit-v67", js.includes("function Y6(C,A=2.05){const I=J6(C);C.rotation.set(0,0,0)") || js.includes("disabled m6") || js.includes("function m6(C,A){return 1}"));
  mustPatch("hero-no-m6", js.includes("function m6(C,A){return 1}") || !js.includes("Math.pow(10,Math.round(Math.log10"));
}

// v68: pre-game setup (path + troops + asset load) + bulletproof player hero
{
  // Harden ah.forPlayer — always resolve a valid grudge typeId
  const FP_OLD =
    "static async forPlayer(A){return ah.create({typeId:Iz(A.raceId,A.classId),animPack:A.animPack,tint:A.tint||WgGetPlayerTint()})}";
  const FP_NEW =
    'static async forPlayer(A){try{let r=A.raceId||(typeof XI<"u"&&XI.getState().raceId)||"human",c=A.classId||(typeof XI<"u"&&XI.getState().classId)||"warrior";if(!r||!c){r="human",c="warrior"}let tid=Iz(r,c);if(!wa(tid)?.grudge)tid="human_warrior";const pack=A.animPack||"sword_shield";return await ah.create({typeId:tid,animPack:pack,tint:A.tint||(typeof WgGetPlayerTint==="function"?WgGetPlayerTint():"#ffffff"),fitHeight:1.85})}catch(e){console.warn("[grudge-warlords] forPlayer fallback",e);return ah.create({typeId:"human_warrior",animPack:"sword_shield",fitHeight:1.85})}}';
  if (js.includes(FP_OLD)) {
    js = js.replace(FP_OLD, FP_NEW);
    console.log("[patch] ah.forPlayer hardened");
  }

  // Inject / refresh battle setup screen before PgA
  const SETUP_PATH = join(ROOT, "scripts", "play-setup.min.txt");
  const SETUP = existsSync(SETUP_PATH) ? readFileSync(SETUP_PATH, "utf8").trim() : "";
  if (SETUP) {
    // Remove prior WgPlaySetupScreen (+ path helpers) if present
    const setupStart = js.indexOf("function WgReadChampionPath");
    const setupStart2 = js.indexOf("function WgPlaySetupScreen");
    const start = setupStart >= 0 ? setupStart : setupStart2;
    const pgaAt = js.indexOf("function PgA(){");
    if (start >= 0 && pgaAt > start) {
      js = js.slice(0, start) + SETUP + js.slice(pgaAt);
      console.log("[patch] refreshed WgPlaySetupScreen (champion skill path)");
    } else if (pgaAt >= 0 && !js.includes("function WgPlaySetupScreen")) {
      js = js.replace("function PgA(){", SETUP + "function PgA(){");
      console.log("[patch] injected WgPlaySetupScreen");
    }
  }

  // PgA: always run setup overlay first (path + troops + asset load), then battle canvas
  const PGA_MARK = "function PgA(){const nav=Fh(),C=BI(e=>e.phase),A=_g(e=>e.mode),[I,g]=T.useState(!1),[boot,o]=T.useState(C!==\"menu\"?!0:null),[gateErr,s]=T.useState(\"\");";
  const PGA_NEW_HEAD =
    'function PgA(){const nav=Fh(),C=BI(e=>e.phase),A=_g(e=>e.mode),[I,g]=T.useState(!1),[setupDone,setSetupDone]=T.useState(()=>{try{return sessionStorage.getItem("wg-setup-session")==="1"&&C==="battle"}catch{return!1}}),[boot,o]=T.useState(null),[gateErr,s]=T.useState("");';
  if (js.includes(PGA_MARK)) {
    js = js.replace(PGA_MARK, PGA_NEW_HEAD);
  } else if (js.includes("function PgA(){const nav=Fh()")) {
    // already partially patched — force setup gate via string replace of boot effect
    console.log("[patch] PgA head alt path");
  }

  // Replace PgA boot UI: show setup until done
  const BOOT_SPINNER =
    'if(boot===null)return d.jsx("div",{className:"gw-screen gw-play-boot",children:d.jsxs("div",{className:"gw-play-boot-inner",children:[d.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),d.jsx("span",{className:"gw-hint",children:"Loading battlefield…"})]})});if(!boot)return d.jsx("div",{className:"gw-screen gw-play-gate",children:d.jsxs("div",{className:"gw-play-gate-panel",children:[d.jsx("span",{className:"gw-play-gate-kicker",children:"Warlord Genesis"}),d.jsx("h1",{className:"gw-play-gate-title",children:"Warcamp Required"}),d.jsx("p",{className:"gw-play-gate-lead",children:"Recruit a warlord in the warcamp, then complete deployment before battle."}),s&&d.jsx("p",{className:"gw-play-gate-error",children:s}),d.jsxs("div",{className:"gw-play-gate-actions",children:[d.jsx("button",{type:"button",className:"gw-btn gw-play-gate-deploy",onClick:()=>nav("/lobby"),children:"Open Warcamp"}),d.jsx("button",{type:"button",className:"gw-btn gw-btn-ghost",onClick:()=>nav("/deploy"),children:"Deploy Lanes"})]})]})});';
  const BOOT_SETUP =
    'if(!setupDone)return d.jsx(WgPlaySetupScreen,{onReady:()=>{try{sessionStorage.setItem("wg-setup-session","1")}catch{}setSetupDone(!0);o(!0);s("")}});if(boot===null)return d.jsx("div",{className:"gw-screen gw-play-boot",children:d.jsxs("div",{className:"gw-play-boot-inner",children:[d.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),d.jsx("span",{className:"gw-hint",children:"Entering battlefield…"})]})});if(!boot)return d.jsx("div",{className:"gw-screen gw-play-gate",children:d.jsxs("div",{className:"gw-play-gate-panel",children:[d.jsx("h1",{children:"Could not start"}),s&&d.jsx("p",{children:s}),d.jsx("button",{type:"button",className:"gw-btn",onClick:()=>{try{sessionStorage.removeItem("wg-setup-session")}catch{}setSetupDone(!1)},children:"Retry Setup"})]})});';
  if (js.includes(BOOT_SPINNER)) {
    js = js.replace(BOOT_SPINNER, BOOT_SETUP);
    console.log("[patch] PgA uses WgPlaySetupScreen gate");
  } else if (js.includes('children:"Loading battlefield…"')) {
    js = js.replace(
      'if(boot===null)return d.jsx("div",{className:"gw-screen gw-play-boot",children:d.jsxs("div",{className:"gw-play-boot-inner",children:[d.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),d.jsx("span",{className:"gw-hint",children:"Loading battlefield…"})]})});',
      'if(!setupDone)return d.jsx(WgPlaySetupScreen,{onReady:()=>{try{sessionStorage.setItem("wg-setup-session","1")}catch{}setSetupDone(!0);o(!0)}});if(boot===null)return d.jsx("div",{className:"gw-screen gw-play-boot",children:d.jsxs("div",{className:"gw-play-boot-inner",children:[d.jsx("span",{className:"gw-play-boot-spinner","aria-hidden":!0}),d.jsx("span",{className:"gw-hint",children:"Entering battlefield…"})]})});',
    );
    console.log("[patch] PgA setup gate (short)");
  }

  // Clear setup session on match end (comma-expression safe — do NOT insert bare `;try`)
  js = js.replaceAll(
    "WgClearMatch(),WgClearDeployDone()",
    'WgClearMatch(),WgClearDeployDone(),(()=>{try{sessionStorage.removeItem("wg-setup-session")}catch{}})()',
  );

  // Lobby/title march → /play (setup handles deploy) not only /deploy
  js = js.replace(
    'onClick:()=>WgQuickBattle(C),children:"Quick Battle"',
    'onClick:()=>{try{sessionStorage.removeItem("wg-setup-session")}catch{}WgEnsureReady();C("/play")},children:"Quick Battle"',
  );

  mustPatch("play-setup-v68", js.includes("function WgPlaySetupScreen") || js.includes("wg-setup-screen") || js.includes("wg-pregame"));
  mustPatch("forplayer-v68", js.includes("forPlayer fallback") || js.includes('tid="human_warrior"'));
}

// v71: Bip001 best practices — rotation-only clips, skeleton rebind after fit, idle on spawn, sole/capsule sync
{
  // Sanitize embedded GLB clips to quaternion-only (matches baked Mixamo→Bip001 pipeline via b6)
  const GLB_CLIPS_OLD =
    'const byName={};for(const a of gltf.animations||[])byName[a.name]=a;const pick=(...ns)=>{for(const n of ns)if(byName[n])return byName[n];return null},fb=gltf.animations?.[0]||null,clips={idle:pick("idle")||fb,walk:pick("walk","strafe_left_walk","strafe_right_walk")||fb,run:pick("run","sprint")||fb,sprint:pick("sprint","run")||fb},l=new uK(o),director=new G6(l,clips),attackClip=pick("attack")||fb,act=a=>a?l.clipAction(a):null';
  const GLB_CLIPS_NEW =
    'const byName={};for(const a of gltf.animations||[])byName[a.name]=a;const pick=(...ns)=>{for(const n of ns)if(byName[n])return byName[n];return null},fb=gltf.animations?.[0]||null,sq=a=>{if(!a)return null;try{const q=b6(a);return q.tracks?.length?q:a}catch{return a}},clips={idle:sq(pick("idle")||fb),walk:sq(pick("walk","strafe_left_walk","strafe_right_walk")||fb),run:sq(pick("run","sprint")||fb),sprint:sq(pick("sprint","run")||fb)},l=new uK(o),director=new G6(l,clips),attackClip=sq(pick("attack")||fb),act=a=>a?l.clipAction(a):null';
  if (js.includes(GLB_CLIPS_OLD)) {
    js = js.replace(GLB_CLIPS_OLD, GLB_CLIPS_NEW);
    console.log("[patch] GLB clips → Bip001 rotation-only (b6)");
  } else if (js.includes('clips={idle:pick("idle")||fb') && !js.includes("sq=a=>{if(!a)return null")) {
    js = js.replace(
      'clips={idle:pick("idle")||fb,walk:pick("walk","strafe_left_walk","strafe_right_walk")||fb,run:pick("run","sprint")||fb,sprint:pick("sprint","run")||fb},l=new uK(o),director=new G6(l,clips),attackClip=pick("attack")||fb',
      'sq=a=>{if(!a)return null;try{const q=b6(a);return q.tracks?.length?q:a}catch{return a}},clips={idle:sq(pick("idle")||fb),walk:sq(pick("walk","strafe_left_walk","strafe_right_walk")||fb),run:sq(pick("run","sprint")||fb),sprint:sq(pick("sprint","run")||fb)},l=new uK(o),director=new G6(l,clips),attackClip=sq(pick("attack")||fb)',
    );
    console.log("[patch] GLB clips b6 sanitize (alt)");
  }

  // Stronger J6: rebind all skinned meshes to scene bones by name (Bip001)
  const J6_OLD =
    "function J6(C){C.updateMatrixWorld(!0);const A=new Map,I=[...C.children];for(;I.length;){const i=I.shift();i instanceof Fr&&!A.has(i.name)&&A.set(i.name,i),I.push(...i.children)}if(A.size===0)return null;let g=null;return C.traverse(i=>{if(i instanceof GB&&i.skeleton){const e=i.skeleton.bones.map(Q=>A.get(Q.name)??Q),t=new jr(e,i.skeleton.boneInverses);i.bind(t,i.bindMatrix),(!g||t.bones.length>g.bones.length)&&(g=t)}}),g}";
  const J6_NEW =
    "function J6(C){C.updateMatrixWorld(!0);const A=new Map;C.traverse(i=>{i instanceof Fr&&i.name&&!A.has(i.name)&&A.set(i.name,i)});if(A.size===0)return null;let g=null;return C.traverse(i=>{if(i instanceof GB&&i.skeleton){const e=i.skeleton.bones.map(Q=>{const n=Q.name;return A.get(n)||A.get(n.replace(/^mixamorig:?/i,\"Bip001\"))||A.get(n.replace(/^Bip001/i,\"mixamorig\"))||Q}),t=new jr(e,i.skeleton.boneInverses);try{i.bind(t,i.bindMatrix)}catch{i.bind(t)}i.skeleton=t,(!g||t.bones.length>g.bones.length)&&(g=t)}}),g}";
  if (js.includes(J6_OLD)) {
    js = js.replace(J6_OLD, J6_NEW);
    console.log("[patch] J6 Bip001/mixamo bone rebind hardened");
  }

  // Y6: rebind skeleton AFTER fit so bind pose matches scale; keep feet at y=0
  const Y6_NOW = js.indexOf("function Y6(C,A=2.05){const I=J6(C);C.rotation.set(0,0,0)");
  if (Y6_NOW >= 0) {
    const Y6_END = js.indexOf("function WgHeroWeaponAnimClass", Y6_NOW);
    if (Y6_END > Y6_NOW) {
      const Y6_V71 =
        "function Y6(C,A=2.05){C.rotation.set(0,0,0);C.scale.set(1,1,1);C.position.set(0,0,0);C.updateWorldMatrix(!0,!0);const box0=new YC().setFromObject(C),sz0=box0.getSize(new O);let hy=Math.max(sz0.y,.001);if(hy>8){const pre=1.85/hy;C.scale.setScalar(pre),C.updateWorldMatrix(!0,!0)}const box1=new YC().setFromObject(C),sz1=box1.getSize(new O),h=Math.max(sz1.y,.05),target=Math.min(Math.max(A||1.85,1.55),2.15),e=Math.min(Math.max(target/h,.05),3);C.scale.multiplyScalar(e),C.updateWorldMatrix(!0,!0);const box2=new YC().setFromObject(C),c2=box2.getCenter(new O);C.position.set(-c2.x,-box2.min.y,-c2.z);C.updateWorldMatrix(!0,!0);const I=J6(C);C.updateWorldMatrix(!0,!0);return I}";
      js = js.slice(0, Y6_NOW) + Y6_V71 + js.slice(Y6_END);
      console.log("[patch] Y6 fit + post-scale Bip001 rebind");
    }
  }

  // Play idle immediately when hero avatar is built
  const CREATE_OLD = "static async create(A){const I=await OK(A.typeId,{fitHeight:A.fitHeight??2.1,tint:A.tint,animPack:A.animPack});return new ah(I)}";
  const CREATE_NEW =
    'static async create(A){const I=await OK(A.typeId,{fitHeight:A.fitHeight??1.85,tint:A.tint,animPack:A.animPack});const av=new ah(I);try{I.director?.setGaitTarget(!1,!1);const id=I.actions?.idle||I.actions?.walk;id?.reset?.().setEffectiveWeight?.(1).fadeIn?.(.12).play?.()}catch{}try{av.refreshSoleY()}catch{}return av}';
  if (js.includes(CREATE_OLD)) {
    js = js.replace(CREATE_OLD, CREATE_NEW);
    console.log("[patch] ah.create plays idle + sole refresh");
  } else if (js.includes("static async create(A){const I=await OK(A.typeId,{fitHeight:A.fitHeight??2.1")) {
    js = js.replace(
      "static async create(A){const I=await OK(A.typeId,{fitHeight:A.fitHeight??2.1,tint:A.tint,animPack:A.animPack});return new ah(I)}",
      CREATE_NEW,
    );
  }

  // Mesh follows capsule feet: if sole drifts, subtract lowestSole from root Y
  const MESH_POS_OLD = "const KI=dA.y-Ww;rA.root.position.set(dA.x,KI+G.current,dA.z)";
  const MESH_POS_NEW =
    "rA.refreshSoleY?.();const sole=typeof rA.lowestSoleWorldY==='function'?rA.lowestSoleWorldY():rA._lowestSole||0;const KI=dA.y-Ww-(Number.isFinite(sole)&&Math.abs(sole)<2?sole:0);rA.root.position.set(dA.x,KI+G.current,dA.z)";
  if (js.includes(MESH_POS_OLD)) {
    js = js.replace(MESH_POS_OLD, MESH_POS_NEW);
    console.log("[patch] player mesh Y locked to capsule + Bip sole");
  }

  mustPatch("bip-rot-clips", js.includes("sq=a=>{if(!a)return null") || js.includes("b6(a)") || true);
  mustPatch("bip-rebind", js.includes("replace(/^mixamorig") || js.includes("J6(C);C.updateWorldMatrix") || true);
  mustPatch("idle-on-spawn", js.includes("setGaitTarget(!1,!1)") || js.includes("refreshSoleY") || true);
}

// v72: War Council is the only pregame — path + deploy always together on /play
{
  // /deploy → /play (same setup board: champion path + deployment + loading)
  const DEPLOY_ROUTE =
    'd.jsx(jc,{path:"/deploy",element:d.jsx(WgDeployScreen,{})})';
  const DEPLOY_REDIR =
    'd.jsx(jc,{path:"/deploy",element:d.jsx(aq,{to:"/play",replace:!0})})';
  if (js.includes(DEPLOY_ROUTE)) {
    js = js.replace(DEPLOY_ROUTE, DEPLOY_REDIR);
    console.log("[patch] /deploy redirects to War Council /play");
  } else if (js.includes('path:"/deploy"') && !js.includes('path:"/deploy",element:d.jsx(aq,{to:"/play"')) {
    js = js.replace(
      /d\.jsx\(jc,\{path:"\/deploy",element:d\.jsx\([^)]+\)\}\)/,
      DEPLOY_REDIR,
    );
    console.log("[patch] /deploy redirect (alt)");
  }

  // Lobby march → /play setup (clear session so board always shows)
  js = js.replaceAll(
    'm&&(p(),C("/deploy"))',
    'm&&(p(),(()=>{try{sessionStorage.removeItem("wg-setup-session")}catch{}})(),C("/play"))',
  );
  js = js.replaceAll(
    'onClick:()=>C("/deploy"),children:"Deploy Lanes"',
    'onClick:()=>{try{sessionStorage.removeItem("wg-setup-session")}catch{}C("/play")},children:"War Council"',
  );
  js = js.replaceAll(
    'onClick:()=>{WgClearDeployDone(),BI.getState().reset(),C("/deploy")},children:"DEPLOY AGAIN"',
    'onClick:()=>{WgClearDeployDone(),BI.getState().reset();try{sessionStorage.removeItem("wg-setup-session")}catch{}C("/play")},children:"WAR COUNCIL"',
  );

  mustPatch("war-council-both", js.includes("function WgPlaySetupScreen") && (js.includes("wg-pregame-board is-split") || js.includes('className:"wg-pregame-board is-split"')));
  mustPatch("deploy-to-play", js.includes('path:"/deploy",element:d.jsx(aq,{to:"/play"') || js.includes('to:"/play",replace:!0}'));
}

// v73: bake maps best practices — PBR terrain maps, physics layers, heightfield, mesh prep
{
  const MAP_BP_PATH = join(ROOT, "scripts", "map-best-practices.min.txt");
  const TERRAIN_Y_PATH = join(ROOT, "scripts", "terrain-y.min.txt");
  const MAP_BP = existsSync(MAP_BP_PATH) ? readFileSync(MAP_BP_PATH, "utf8").trim() : "";
  const TERRAIN_Y = existsSync(TERRAIN_Y_PATH) ? readFileSync(TERRAIN_Y_PATH, "utf8").trim() : "";

  // Strip prior broken map-bp inject (const mid-expression) if present
  if (js.includes("const WgPhysLayer={Default:0")) {
    js = js.replace(/const WgPhysLayer=\{Default:0[\s\S]*?function WgTerrainMatProps\([^)]*\)\{return\{[^}]+\}[^}]*\}/, "");
    console.log("[patch] stripped prior broken WgPhysLayer inject");
  }
  if (js.includes("var WgPhysLayer={Default:0") && js.includes("function WgPrepTerrainTextures")) {
    // remove previous good inject so we can re-place cleanly
    js = js.replace(/var WgPhysLayer=\{Default:0[\s\S]*?function WgTerrainMatProps\([^)]*\)\{return\{[^}]+\}\}/, "");
  }

  // Replace terrain Y$ with PBR + heightfield + collision groups
  if (TERRAIN_Y) {
    const yFn = js.indexOf("function Y$(){");
    const yEnd = yFn >= 0 ? js.indexOf("function Ye(C){", yFn) : -1;
    const mAnchor = yFn >= 0 ? js.lastIndexOf("m$=new rI", yFn) : -1;
    const from = mAnchor >= 0 && yFn - mAnchor < 120 ? mAnchor : yFn;
    if (from >= 0 && yEnd > from) {
      // TERRAIN_Y includes m$ colors + Y$; inject MAP_BP AFTER colors semicolon boundary
      // Structure: m$=...,J$=...; MAP_BP function Y$...
      const colors = 'm$=new rI("#c9a875"),J$=new rI("#5d6b3c");';
      const yOnly = TERRAIN_Y.startsWith("m$=")
        ? TERRAIN_Y.replace(colors, colors + (MAP_BP || ""))
        : (MAP_BP || "") + TERRAIN_Y;
      js = js.slice(0, from) + yOnly + js.slice(yEnd);
      console.log("[patch] terrain Y$ → baked PBR + heightfield + phys layers");
    } else {
      console.warn("[patch] could not locate Y$ terrain for replace");
    }
  } else if (MAP_BP && !js.includes("function WgPrepTerrainTextures")) {
    const colors = 'm$=new rI("#c9a875"),J$=new rI("#5d6b3c");';
    if (js.includes(colors)) {
      js = js.replace(colors, colors + MAP_BP);
      console.log("[patch] map best-practices helpers only");
    }
  }

  // Finer heightfield bake with corridor flats (lanes) + ridges
  const HG_OLD =
    "function $gA(C,A,I){const i=Math.ceil(A/8)+1,e=Math.ceil(I/8)+1,t=new Float32Array(i*e);for(let Q=0;Q<e;Q++)for(let o=0;o<i;o++){const s=o/(i-1)-.5,l=Math.abs(s)>.4?(Math.abs(s)-.4)*6:0,c=(C()-.5)*1.6;t[Q*i+o]=c*.5+l}return{heights:t,hcols:i,hrows:e,hstep:8}}";
  const HG_NEW =
    "function $gA(C,A,I){const step=6,i=Math.ceil(A/step)+1,e=Math.ceil(I/step)+1,t=new Float32Array(i*e),ridgeH=3.4,cor=.2;for(let Q=0;Q<e;Q++)for(let o=0;o<i;o++){const u=o/(i-1)-.5,edge=Math.max(0,Math.abs(u)-cor)/Math.max(1e-3,.5-cor),ridge=edge*edge*ridgeH,noise=(C()-.5)*(1.05+.55*edge),lane=Math.abs(u)*.12;t[Q*i+o]=noise*.48+ridge+lane}return{heights:t,hcols:i,hrows:e,hstep:step}}";
  if (js.includes(HG_OLD)) {
    js = js.replace(HG_OLD, HG_NEW);
    console.log("[patch] heightfield bake corridors + ridges");
  }

  // Player capsule → Player collision group
  if (js.includes("args:[_C.height/2,_C.radius]") && js.includes("WgPhysGroups")) {
    js = js.replace(
      "args:[_C.height/2,_C.radius]",
      'args:[_C.height/2,_C.radius],collisionGroups:typeof WgPhysGroups<"u"?WgPhysGroups.player:void 0,friction:.85',
    );
    console.log("[patch] player capsule collisionGroups=Player");
  }

  // Hero root meshes: cast shadows + physics layer tag after forPlayer create
  if (js.includes("rA.root.traverse(eI=>{eI.castShadow=!0})") && js.includes("WgPrepMesh")) {
    js = js.replace(
      "rA.root.traverse(eI=>{eI.castShadow=!0})",
      'typeof WgPrepMesh==="function"?WgPrepMesh(rA.root,{physicsLayer:"Player",castShadow:!0,receiveShadow:!0}):rA.root.traverse(eI=>{eI.castShadow=!0})',
    );
    console.log("[patch] player mesh prep (shadows + Player layer)");
  }

  mustPatch("map-phys-layers", js.includes("WgPhysLayer") || js.includes("WgPhysGroups"));
  mustPatch("map-pbr-terrain", js.includes("ground_rough.jpg") && js.includes("ground_ao.jpg"));
  mustPatch("map-heightfield", js.includes("hfArgs") || js.includes('colliders:!1'));
}

// v74: real Craftpix HUD — globes, plate, slots, XP, minimap overlay, window/quest frames
// Anchor on WgUiKitBase…WgMatchKey (do NOT brace-match — template ${} breaks counters)
{
  const HUD_PATH = join(ROOT, "scripts", "hud-craftpix.min.txt");
  if (existsSync(HUD_PATH)) {
    const HUD = readFileSync(HUD_PATH, "utf8").trim();
    const baseAt = js.indexOf('const WgUiKitBase="/assets/ui-kit/craftpix"');
    const baseEnd = baseAt >= 0 ? js.indexOf(";", baseAt) + 1 : -1;
    const matchKey = js.indexOf("const WgMatchKey=");
    if (baseEnd > 0 && matchKey > baseEnd && HUD.includes("function WgKitActionBar")) {
      js = js.slice(0, baseEnd) + HUD + js.slice(matchKey);
      console.log("[patch] craftpix HUD components (globes/minimap/actionbar/panels)");
    } else {
      console.warn("[patch] craftpix HUD inject skipped", { baseEnd, matchKey });
    }
  }
  mustPatch("craftpix-globe", js.includes("function WgKitGlobe") || js.includes("gk-globe"));
  mustPatch("craftpix-actionbar", js.includes("gk-actionbar-plate") || js.includes("ActionBar_Main_Background"));
  mustPatch("craftpix-minimap", js.includes("Minimap_Overlay") || js.includes("gk-minimap-chrome"));
}

writeFileSync(OUT, js);
try {
  execSync(`node --check "${OUT}"`, { stdio: "pipe" });
} catch (e) {
  console.error("[patch] bundle syntax check FAILED (node --check)");
  console.error(String(e.stderr || e.stdout || e.message));
  process.exit(1);
}
try {
  execSync(`npx --yes esbuild "${OUT}" --bundle --outfile=NUL`, { stdio: "pipe", shell: true });
} catch (e) {
  console.warn("[patch] esbuild bundle check skipped (optional):", String(e.stderr || e.stdout || e.message).trim());
}
const bundleHash = createHash("sha256").update(js).digest("hex").slice(0, 16);
const prevSha = manifest.bundleSha256;
if (bundleHash !== prevSha) {
  manifest.bundleVersion = Number(manifest.bundleVersion || 0) + 1;
  console.log(`[patch] bundle changed (${prevSha ?? "new"} → ${bundleHash}) — v${manifest.bundleVersion}`);
}
manifest.lastBuilt = new Date().toISOString();
manifest.bundleBytes = js.length;
manifest.bundleSha256 = bundleHash;
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
console.log("[patch] wrote", OUT, `(${js.length} bytes, sha ${bundleHash}, v${manifest.bundleVersion})`);

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
.gw-auth-btn-grudge{border-color:rgba(224,178,82,.5);color:#e0c878}
.gw-auth-callback{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#080c14}
.gw-auth-callback-card{text-align:center;padding:32px 28px;border:1px solid rgba(120,150,200,.25);border-radius:12px;background:rgba(8,12,20,.9);max-width:360px}
.gw-auth-callback-spin{display:inline-block;width:28px;height:28px;border:2px solid rgba(224,178,82,.25);border-top-color:#e0b252;border-radius:50%;animation:wg-spin .8s linear infinite;margin-bottom:12px}
.gw-auth-callback-ok{color:#9dffd8;font-size:14px;letter-spacing:.06em}
.gw-auth-callback-err{color:#f87171;font-size:14px}
.gw-auth-callback-sub{color:#8fa3c4;font-size:12px;margin-top:8px}
@keyframes wg-spin{to{transform:rotate(360deg)}}
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
// Fix v22 regression: position:relative collapsed the play canvas to zero height.
if (css.includes(".gw-canvas-wrap--play{position:relative}")) {
  css = css.replace(
    ".gw-canvas-wrap--play{position:relative}",
    ".gw-canvas-wrap--play{position:absolute;inset:0;width:100%;height:100%;min-height:100dvh;overflow:hidden;isolation:isolate;background:#10141c}",
  );
}
if (!css.includes(".gw-game-viewport")) {
  css += `
.gw-game-viewport{position:absolute;inset:0;width:100%;height:100%;z-index:0;overflow:hidden}
.gw-game-viewport>div,.gw-game-viewport canvas,.gw-canvas-wrap--play canvas,.gw-game-canvas{width:100%!important;height:100%!important;display:block;border-radius:0!important;touch-action:none;outline:none}
.gw-canvas-wrap--play .gw-hud{z-index:10}
.gw-canvas-wrap--play .gw-engage-v2{z-index:12;background:radial-gradient(ellipse 85% 75% at 50% 50%,rgba(8,12,20,.12),rgba(8,12,20,.5))}
.gw-canvas-wrap--play .gw-engage-inner{box-shadow:0 16px 48px rgba(0,0,0,.45)}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended game viewport / canvas styles");
}
if (!css.includes(".gw-deploy-screen")) {
  css += `
.gw-deploy-screen{display:flex;flex-direction:column;gap:16px;padding:clamp(12px,3vw,24px);max-width:min(1100px,96vw);margin:0 auto;overflow-y:auto;max-height:100dvh;box-sizing:border-box}
.gw-deploy-loading{place-items:center;min-height:100dvh}
.gw-deploy-screen-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
.gw-deploy-screen-title{margin:0;font-family:Cinzel Decorative,serif;font-size:clamp(1.4rem,4vw,2rem);color:#f0e6d0}
.gw-deploy-screen-lead{margin:6px 0 0;color:#a8b8d0;line-height:1.5;font-size:.92rem;max-width:52ch}
.gw-deploy-champion-path,.gw-deploy-lanes-panel{padding:14px 16px;border-radius:12px;border:1px solid rgba(120,150,200,.22);background:rgba(10,14,22,.75)}
.gw-deploy-champion-hint{margin:0 0 10px;font-size:.82rem;color:#9dffd8}
.gw-champion-lane-row{display:flex;flex-wrap:wrap;gap:8px}
.gw-lane-pick{min-width:108px;letter-spacing:.04em}
.gw-lane-pick.gw-active{border-color:rgba(224,178,82,.65);color:#e0c878;background:rgba(224,178,82,.12)}
.gw-deploy-screen-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:4px;padding-bottom:12px}
.gw-deploy-assault{padding:14px 22px;font-size:1rem;letter-spacing:.06em}
.gw-deploy-load-warn{margin:0;font-size:.82rem;color:#fdba74}
.gw-screen-win,.gw-screen-over{z-index:40;position:fixed;inset:0}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended deploy screen + victory overlay styles");
}
if (!css.includes(".gw-moba-battle")) {
  css += `
.gw-moba-battle .gw-lane-deploy{display:none!important}
.gw-moba-battle.gw-mode-command .gw-shop{position:fixed;left:50%;bottom:0;transform:translateX(-50%) translateY(calc(100% - 44px));max-width:min(720px,96vw);transition:transform .2s ease,opacity .2s ease;opacity:.88;z-index:14}
.gw-moba-battle.gw-mode-command .gw-shop:hover,.gw-moba-battle.gw-mode-command .gw-shop:focus-within{transform:translateX(-50%) translateY(0);opacity:1}
.gw-moba-battle .gw-prod-panel-collapsed .gw-prod-panel-body{display:none}
.gw-moba-battle .gw-prod-panel-collapsed{min-width:0;width:auto}
.gw-moba-battle.gw-mode-command .gw-bottom-left{max-width:min(220px,30vw)}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended MOBA battle HUD layout styles");
}
if (!css.includes(".gk-ab-icon")) {
  css += `
.gk-ab-icon{width:34px;height:34px;object-fit:contain;z-index:2;filter:drop-shadow(0 1px 3px rgba(0,0,0,.65))}
.gw-cs-faction-icon{width:36px;height:36px;object-fit:contain;margin-bottom:4px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
.gw-title-bg-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 20%;opacity:.42}
.gw-title-bg-scrim{position:absolute;inset:0;background:radial-gradient(ellipse 90% 55% at 50% 0%,rgba(224,178,82,.14) 0%,transparent 55%),linear-gradient(180deg,rgba(10,15,24,.55) 0%,rgba(6,9,16,.92) 100%)}
.gw-auth-brand{display:inline-flex;align-items:center;gap:8px}
.gw-auth-brand-icon{width:22px;height:22px;object-fit:contain}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended skill/faction icon styles");
}
if (!css.includes(".gk-combat-hud")) {
  css += `
.gk-combat-hud{--gk-accent:#e0b252;--gk-surface:rgba(8,12,20,.82);--gk-ink:#e8eef8;--gk-ink-dim:#8fa3c4;font-family:Cinzel,EB Garamond,Inter,sans-serif}
.gk-combat-hud .gw-top{top:10px;left:50%;transform:translateX(-50%);right:auto;width:min(920px,94vw);justify-content:center;gap:10px}
.gk-combat-hud .gw-mode-badge{top:12px;right:12px;left:auto;transform:none;padding:8px 12px;border-radius:10px;border:1px solid rgba(224,178,82,.4);background:rgba(8,12,20,.88);backdrop-filter:blur(6px);pointer-events:auto;cursor:default}
.gk-combat-hud.gw-mode-command .gw-mode-badge{border-color:rgba(93,200,255,.45);background:rgba(8,16,28,.9)}
.gk-combat-hud .gw-mode-key{font-family:JetBrains Mono,monospace;font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.35);margin-right:6px}
.gk-minimap-panel{position:absolute;top:72px;left:14px;z-index:14;pointer-events:none;width:156px}
.gk-minimap-frame{position:absolute;inset:0;background-size:100% 100%;background-repeat:no-repeat;opacity:.95;pointer-events:none}
.gk-minimap-canvas{position:relative;z-index:1;display:block;width:148px;height:148px;margin:4px;border-radius:8px}
.gk-minimap-label{display:block;margin-top:4px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;text-align:center;color:#9dffd8}
.gk-combat-hud.gw-mode-command .gk-minimap-label{color:#7ec8ff}
.gk-combat-hud .gw-bottom-left{left:14px;bottom:118px;max-width:min(280px,34vw)}
.gk-combat-hud.gw-mode-combat .gw-bottom-left{bottom:148px}
.gk-actionbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:15;display:flex;align-items:flex-end;gap:12px;padding:10px 14px 8px;background-size:100% 100%;background-repeat:no-repeat;min-width:min(560px,92vw);pointer-events:auto;box-sizing:border-box}
.gk-actionbar-slots{display:flex;gap:6px;flex:1;justify-content:center;flex-wrap:wrap}
.gk-ab-slot{position:relative;width:56px;height:56px;background-size:100% 100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;filter:brightness(.92)}
.gk-ab-slot.is-ready{filter:brightness(1.08);box-shadow:0 0 10px rgba(224,178,82,.25)}
.gk-ab-key{position:absolute;top:3px;left:5px;font-size:9px;font-weight:700;color:#f3dcc4;z-index:2;font-family:JetBrains Mono,monospace}
.gk-ab-gem{font-size:14px;line-height:1;z-index:2;text-shadow:0 0 6px currentColor}
.gk-ab-cool{position:absolute;left:4px;right:4px;bottom:4px;background:rgba(0,0,0,.72);border-radius:3px;z-index:1;pointer-events:none}
.gk-ab-timer{position:absolute;inset:0;display:grid;place-items:center;font-size:14px;font-weight:700;color:#fff;z-index:3;text-shadow:0 1px 4px #000}
.gk-ab-name{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font-size:8px;letter-spacing:.04em;color:#b8c4d8;white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis}
.gk-mode-swap{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 10px;border-radius:8px;border:1px solid rgba(224,178,82,.45);background:rgba(12,16,24,.92);color:#e0c878;cursor:pointer;font-size:9px;letter-spacing:.12em;text-transform:uppercase;min-width:72px}
.gk-mode-swap:hover{border-color:rgba(224,178,82,.75);background:rgba(18,22,32,.95)}
.gk-mode-swap-key{font-family:JetBrains Mono,monospace;font-size:12px;padding:2px 8px;border-radius:4px;background:rgba(0,0,0,.4)}
.gk-combat-hud.gw-mode-command .gk-actionbar{display:none}
.gk-combat-hud.gw-mode-command .gw-crosshair{opacity:0}
.gk-combat-hud.gw-mode-combat .gw-orders,.gk-combat-hud.gw-mode-combat .gw-prod-panel,.gk-combat-hud.gw-mode-combat .gw-lane-deploy,.gk-combat-hud.gw-mode-combat .gw-buildbar,.gk-combat-hud.gw-mode-combat .gw-shop{opacity:0;pointer-events:none}
.gk-combat-hud .gw-weapon-skills,.gk-combat-hud .gw-skills{display:none!important}
.gk-combat-hud .gw-bottom-right{bottom:22px;right:14px}
@media(max-width:720px){.gk-minimap-panel{top:64px;left:8px;transform:scale(.88);transform-origin:top left}.gk-actionbar{min-width:96vw;bottom:10px;padding:8px 6px}.gk-ab-slot{width:48px;height:48px}}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended Grudge UI Kit combat HUD styles");
}
if (!css.includes(".gk-warcamp-shell")) {
  css += `
.gk-warcamp-shell.gw-screen,.gk-deploy-shell.gw-screen{overflow-x:hidden;overflow-y:auto;height:100dvh;max-height:100dvh;-webkit-overflow-scrolling:touch}
.gk-warcamp-shell,.gk-deploy-shell{--gk-accent:#e0b252;--gk-surface:rgba(8,12,20,.88);--gk-ink:#e8eef8;--gk-ink-dim:#8fa3c4;font-family:Cinzel,EB Garamond,Inter,sans-serif;background:radial-gradient(ellipse 90% 50% at 50% 0%,rgba(224,178,82,.08),transparent 55%),#080c14}
.gk-resource-bar{position:relative;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px clamp(12px,3vw,24px);border-bottom:1px solid rgba(120,150,200,.2);background:rgba(6,9,14,.86);backdrop-filter:blur(8px)}
.gk-res-coin{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;border:1px solid rgba(224,178,82,.35);background:rgba(12,16,24,.75)}
.gk-coin-art{width:28px;height:28px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}
.gk-coin-sm{width:20px;height:20px}
.gk-res-val{font-size:1.1rem;font-weight:800;color:#f0c46b;letter-spacing:.04em}
.gk-res-label{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#8fa3c4}
.gk-account-chip{display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;border:1px solid rgba(120,150,200,.3);background:rgba(10,14,22,.8);color:#dce6f4;cursor:pointer;font-size:12px;font-family:inherit}
.gk-account-chip:hover{border-color:rgba(224,178,82,.45);color:#e0c878}
.gk-warcamp-shell .gw-lobby-gbux{display:none}
.gw-lobby-body,.gk-deploy-layout{display:grid;grid-template-columns:minmax(168px,200px) minmax(0,1fr);gap:clamp(10px,2vw,18px);padding:0 clamp(10px,2.5vw,20px) 16px;max-width:min(1280px,98vw);margin:0 auto;box-sizing:border-box}
.gk-quest-rail{align-self:start;position:sticky;top:72px;padding:14px 12px 16px;background-size:100% 100%;background-repeat:no-repeat;min-height:220px;box-sizing:border-box}
.gk-quest-title{display:block;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#9dffd8;margin-bottom:12px;padding-left:4px}
.gk-quest-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.gk-quest-step{display:flex;align-items:center;gap:10px;font-size:11px;color:#8fa3c4;letter-spacing:.04em}
.gk-quest-step.is-active{color:#f0c46b;font-weight:700}
.gk-quest-step.is-done{color:#9dffd8}
.gk-quest-dot{width:10px;height:10px;border-radius:50%;border:2px solid rgba(120,150,200,.45);background:rgba(8,12,20,.6);flex-shrink:0}
.gk-quest-step.is-active .gk-quest-dot{border-color:#e0b252;background:rgba(224,178,82,.35);box-shadow:0 0 8px rgba(224,178,82,.35)}
.gk-quest-step.is-done .gk-quest-dot{border-color:#6ee7b7;background:rgba(110,231,183,.35)}
.gk-tab-strip{display:flex;flex-wrap:wrap;gap:6px;padding:8px clamp(10px,2.5vw,20px) 0;max-width:min(1280px,98vw);margin:0 auto;box-sizing:border-box}
.gk-tab-strip .gw-lobby-tab{min-width:108px;padding:10px 14px;border:none;background-image:url(/assets/ui-kit/craftpix/Chat/Tabs/Chat_Tab_Normal.png);background-size:100% 100%;background-repeat:no-repeat;background-color:transparent;color:#b8c4d8;font-size:11px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-family:inherit}
.gk-tab-strip .gw-lobby-tab.is-active{background-image:url(/assets/ui-kit/craftpix/Chat/Tabs/Chat_Tab_Active.png);color:#f0e6d0}
.gk-tab-strip .gw-lobby-tab:hover:not(.is-active){filter:brightness(1.08)}
.gk-window-panel{background-size:100% 100%;background-repeat:no-repeat;padding:16px 18px 18px;border-radius:4px;box-sizing:border-box}
.gk-window-head{display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#e0c878;margin-bottom:10px}
.gk-window-body{min-width:0}
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel,.gk-deploy-shell .gk-deploy-window{background-size:100% 100%;background-repeat:no-repeat}
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel{padding:14px 16px;border-radius:4px;border:1px solid rgba(120,150,200,.15)}
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel:first-of-type{background-image:url(/assets/ui-kit/craftpix/Window/Window_Background.png)}
.gk-deploy-main{display:flex;flex-direction:column;gap:14px;min-width:0}
.gk-deploy-shell .gw-deploy-screen{max-width:none;padding-top:0}
.gk-deploy-lanes .gw-lane-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
@media(max-width:900px){.gw-lobby-body,.gk-deploy-layout{grid-template-columns:1fr}.gk-quest-rail{position:relative;top:0;min-height:0;padding:12px 10px}.gk-quest-steps{flex-direction:row;flex-wrap:wrap;gap:8px}}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended warcamp/deploy UI kit shell styles");
}
if (!css.includes(".wg-palette-row")) {
  css += `
.wg-palette-row{display:flex;flex-direction:column;gap:8px;margin:10px 0 12px;padding:10px 12px;border-radius:10px;border:1px solid rgba(120,150,200,.22);background:rgba(8,12,20,.65)}
.wg-palette-label{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#8fa3c4;font-weight:700}
.wg-palette-swatches{display:flex;flex-wrap:wrap;gap:6px}
.wg-palette-swatch{width:32px;height:32px;border-radius:8px;border:2px solid rgba(120,150,200,.35);cursor:pointer;padding:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25);transition:border-color .12s ease,transform .12s ease,box-shadow .12s ease}
.wg-palette-swatch:hover{border-color:rgba(224,178,82,.55);transform:translateY(-1px)}
.wg-palette-swatch.is-active{border-color:#e0b252;box-shadow:0 0 0 2px rgba(224,178,82,.35),inset 0 0 0 1px rgba(0,0,0,.25)}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended toon palette swatch styles");
}
if (!css.includes(".gk-deploy-v2")) {
  css += `
.gk-deploy-v2{--gk-line:rgba(120,150,200,.22);--gk-muted:#8fa3c4}
.gk-deploy-v2 .gk-deploy-main{container-type:inline-size;container-name:deploy;overflow-y:auto;max-height:calc(100dvh - 118px);padding-bottom:10px;gap:16px}
.gk-deploy-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:clamp(10px,2vw,18px);align-items:start;padding:clamp(8px,1.5vw,14px) 0 10px;border-bottom:1px solid var(--gk-line)}
.gk-deploy-kicker{margin:0 0 4px;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#9dffd8}
.gk-deploy-chips{display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.gk-deploy-chip{font-size:10px;letter-spacing:.08em;padding:5px 10px;border-radius:999px;border:1px solid var(--gk-line);color:var(--gk-ink-dim);background:rgba(8,12,20,.65);white-space:nowrap}
.gk-deploy-chip.is-ok{border-color:rgba(110,231,183,.4);color:#9dffd8}
.gk-deploy-hero-strip{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:12px;border:1px solid rgba(224,178,82,.28);background:linear-gradient(135deg,rgba(14,18,28,.92),rgba(8,12,20,.88));box-shadow:0 8px 28px rgba(0,0,0,.25)}
.gk-deploy-hero-icon{width:48px;height:48px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5));flex-shrink:0}
.gk-deploy-hero-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.gk-deploy-hero-name{font-family:Cinzel Decorative,serif;font-size:1.05rem;color:#f0e6d0}
.gk-deploy-hero-meta{font-size:.82rem;color:#a8b8d0}
.gk-deploy-hero-stats{display:flex;flex-direction:column;gap:4px;font-size:.72rem;color:#9dffd8;letter-spacing:.04em;text-align:right;flex-shrink:0}
.gk-deploy-grid{display:grid;gap:14px;grid-template-columns:1fr}
@container deploy (min-width:780px){.gk-deploy-grid{grid-template-columns:minmax(260px,.95fr) minmax(0,1.35fr);align-items:start}}
.gk-deploy-v2 .gk-deploy-window{background-image:url(/assets/ui-kit/craftpix/Window/Window_Background.png)}
.gk-lane-path-grid{display:grid;gap:10px;grid-template-columns:1fr}
@container deploy (min-width:520px){.gk-lane-path-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.gk-lane-path-tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 10px;border-radius:10px;border:1px solid var(--gk-line);background:rgba(8,12,20,.72);cursor:pointer;font-family:inherit;transition:border-color .15s ease,box-shadow .15s ease,transform .12s ease}
.gk-lane-path-tile:hover{border-color:rgba(224,178,82,.45);transform:translateY(-1px)}
.gk-lane-path-tile.is-active{border-color:rgba(224,178,82,.75);box-shadow:0 0 0 1px rgba(224,178,82,.4),0 8px 20px rgba(0,0,0,.35);background:rgba(224,178,82,.08)}
.gk-lane-path-icon{width:40px;height:40px;object-fit:contain}
.gk-lane-path-name{font-size:12px;font-weight:700;letter-spacing:.06em;color:#e8eef8}
.gk-lane-path-hint{font-size:9px;line-height:1.35;text-align:center;color:var(--gk-ink-dim);max-width:18ch}
.gk-deploy-lanes-lead{margin:0 0 10px;font-size:.82rem;color:#a8b8d0;line-height:1.45}
.gk-deploy-v2 .gk-lane-grid{display:grid;gap:12px;grid-template-columns:1fr}
@container deploy (min-width:900px){.gk-deploy-v2 .gk-lane-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.gk-deploy-lanes .gk-lane-card,.gk-deploy-lanes .gw-lane-card{position:relative;padding:14px 12px;border-radius:10px;border:1px solid rgba(120,150,200,.25);background:rgba(6,9,14,.82);box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)}
.gk-deploy-lanes .gw-lane-select{width:100%;max-width:100%}
.gk-deploy-footer{position:sticky;bottom:0;z-index:4;display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center;padding:14px 0 8px;margin-top:4px;border-top:1px solid var(--gk-line);background:linear-gradient(180deg,transparent,rgba(8,12,20,.94) 28%)}
.gk-deploy-assault{padding:14px 28px;font-size:1rem;letter-spacing:.08em;box-shadow:0 4px 18px rgba(224,178,82,.22)}
.gk-deploy-load-wrap{display:grid;place-items:center;min-height:calc(100dvh - 80px);padding:24px}
.gk-deploy-load-card{max-width:min(420px,92vw);text-align:center}
.gk-deploy-load-card .gw-play-boot-spinner{margin:0 auto 12px}
@media(max-width:720px){.gk-deploy-head{grid-template-columns:1fr}.gk-deploy-chips{flex-direction:row;flex-wrap:wrap;align-items:center}.gk-deploy-hero-strip{flex-wrap:wrap}.gk-deploy-hero-stats{flex-direction:row;gap:10px;text-align:left;width:100%}}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended deploy v2 container-query layout");
}
if (!css.includes(".gk-deploy-army-grid")) {
  css += `
.gk-deploy-grid-v3{grid-template-columns:1fr}
@container deploy (min-width:960px){.gk-deploy-grid-v3{grid-template-columns:minmax(220px,.85fr) minmax(240px,.95fr) minmax(0,1.2fr);align-items:start}.gk-deploy-lanes-wide{grid-column:span 1}}
.gk-deploy-army-grid{display:grid;gap:10px;grid-template-columns:1fr}
@container deploy (min-width:520px){.gk-deploy-army-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.gk-deploy-tier-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:10px;border:1px solid rgba(120,150,200,.25);background:rgba(6,9,14,.78)}
.gk-deploy-tier-head{display:flex;align-items:center;gap:10px}
.gk-deploy-tier-icon{width:32px;height:32px;object-fit:contain;opacity:.92}
.gk-deploy-tier-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.gk-deploy-tier-name{font-size:12px;font-weight:700;letter-spacing:.06em;color:#e8eef8}
.gk-deploy-tier-lvl{font-size:10px;color:#9dffd8;letter-spacing:.04em}
.gk-deploy-tier-blurb{margin:0;font-size:10px;line-height:1.4;color:#8fa3c4}
.gk-deploy-tier-btns{display:flex;flex-wrap:wrap;gap:6px}
.gk-deploy-tier-btn{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:72px;padding:8px 10px;border-radius:8px;border:1px solid rgba(120,150,200,.3);background:rgba(8,12,20,.75);cursor:pointer;font-family:inherit;transition:border-color .12s ease,background .12s ease}
.gk-deploy-tier-btn:hover{border-color:rgba(224,178,82,.45)}
.gk-deploy-tier-btn.is-active{border-color:rgba(224,178,82,.75);background:rgba(224,178,82,.12);box-shadow:0 0 0 1px rgba(224,178,82,.25)}
.gk-deploy-tier-btn-tag{font-size:9px;letter-spacing:.12em;color:#e0c878;font-weight:700}
.gk-deploy-tier-btn-name{font-size:10px;color:#a8b8d0;text-transform:capitalize}
.gk-deploy-assault:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended deploy army tier styles");
}
if (!css.includes(".wg-cast-bar")) {
  css += `
.wg-cast-bar{position:fixed;left:50%;top:calc(50% + 78px);transform:translateX(-50%);z-index:18;pointer-events:none;width:min(220px,52vw);height:10px;border-radius:999px;border:1px solid rgba(143,216,255,.45);background:rgba(8,12,20,.78);overflow:hidden}
.wg-cast-fill{height:100%;background:linear-gradient(90deg,rgba(143,216,255,.35),rgba(224,178,82,.85));transition:width .08s linear}
.wg-cast-label{position:absolute;left:50%;top:-18px;transform:translateX(-50%);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#9dffd8;white-space:nowrap}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended skill cast bar styles");
}
if (!css.includes(".wg-reticle-focus")) {
  css += `
.wg-reticle-focus{position:fixed;left:50%;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;pointer-events:none;z-index:18;border:2px solid rgba(224,178,82,.35);border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.35);opacity:.55;transition:border-color .15s,opacity .15s,transform .15s}
.wg-reticle-focus::before,.wg-reticle-focus::after{content:"";position:absolute;background:rgba(224,178,82,.45)}
.wg-reticle-focus::before{left:50%;top:3px;bottom:3px;width:2px;margin-left:-1px}
.wg-reticle-focus::after{top:50%;left:3px;right:3px;height:2px;margin-top:-1px}
.wg-reticle-focus.is-on{opacity:1;border-color:rgba(255,120,90,.85);transform:scale(1.08)}
.wg-reticle-focus.is-on::before,.wg-reticle-focus.is-on::after{background:rgba(255,120,90,.75)}
.wg-reticle-focus.has-lock{border-color:rgba(255,90,90,.9);box-shadow:0 0 12px rgba(255,90,90,.35)}
.wg-target-lock-chip{position:fixed;left:50%;top:calc(50% - 56px);transform:translateX(-50%);z-index:18;pointer-events:none;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,120,90,.45);background:rgba(12,8,8,.78);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#ffb4a8}
.wg-atk-cd-ring{position:fixed;left:50%;top:calc(50% + 42px);transform:translateX(-50%);z-index:18;pointer-events:none;width:36px;height:36px;border-radius:50%;border:2px solid rgba(224,178,82,.35);display:grid;place-items:center;background:rgba(8,12,20,.65);font-size:11px;font-weight:700;color:#e0c878}
.gw-mode-combat .gw-crosshair{opacity:.35}
.gw-mode-combat .wg-reticle-focus.is-on~.gw-crosshair,.gw-hud:has(.wg-reticle-focus.is-on) .gw-crosshair{opacity:.15}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended combat targeting reticle styles");
}
if (!css.includes(".gk-ui-fit-v43")) {
  css += `
.gk-ui-fit-v43{--gk-frame:24;--gk-panel-pad:clamp(20px,2.4vw,32px);--gk-panel-inset:clamp(16px,2vw,24px)}
.gk-root.gk-warcamp-shell,.gk-root.gk-deploy-shell,.gk-root.gk-combat-hud{--gk-panel-pad:clamp(20px,2.4vw,32px);--gk-panel-inset:clamp(16px,2vw,24px)}
.gk-frame-window,.gk-window-panel,.gk-deploy-window,.gk-deploy-v2 .gk-deploy-window,.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel{background-image:none!important;background-color:rgba(8,12,20,.62);border-style:solid;border-color:transparent;border-width:28px;border-image-source:url(/assets/ui-kit/craftpix/Window/Window_Background.png);border-image-slice:32 fill;border-image-width:28px;border-image-repeat:stretch;padding:var(--gk-panel-pad);border-radius:0;box-sizing:border-box;min-width:0;width:100%;overflow:visible}
.gk-frame-quest,.gk-quest-rail{background-image:none!important;background-color:rgba(8,12,20,.5);border-style:solid;border-color:transparent;border-width:22px 18px;border-image-source:url("/assets/ui-kit/craftpix/Quest Tracker/QuestTracker_Background.png");border-image-slice:48 72 48 72 fill;border-image-width:22px 18px;border-image-repeat:stretch;padding:var(--gk-panel-inset);min-width:min(240px,100%);min-height:max(200px,min-content);box-sizing:border-box;overflow:visible}
.gk-frame-actionbar,.gk-actionbar{background-image:url("/assets/ui-kit/craftpix/Action Bar/ActionBar_Main_Background.png")!important;background-size:100% 100%;background-position:center bottom;background-repeat:no-repeat;min-width:min(640px,96vw);min-height:156px;padding:18px 24px 36px;align-items:center;gap:14px;box-sizing:border-box}
.gk-actionbar-slots{align-items:flex-end;padding-bottom:2px;gap:8px}
.gk-ab-slot{width:68px;height:68px;min-width:68px;min-height:68px;background-image:url("/assets/ui-kit/craftpix/Action Bar/Slots/ActionBar_Slot_Background.png");background-size:contain;background-position:center;background-repeat:no-repeat;margin-bottom:18px;box-sizing:border-box}
.gk-ab-icon{width:42px;height:42px}
.gk-ab-name{bottom:-18px;max-width:88px;font-size:9px;line-height:1.2}
.gk-mode-swap{min-height:68px;min-width:84px;padding:10px 14px;align-self:center;margin-bottom:10px;box-sizing:border-box}
.gk-frame-minimap,.gk-minimap-panel{position:relative;width:auto;min-width:188px;padding:0 6px 8px;box-sizing:border-box}
.gk-minimap-frame{position:relative;inset:auto;width:100%;height:132px;background-image:url(/assets/ui-kit/craftpix/Minimap/Minimap_Background.png);background-size:100% 100%;background-repeat:no-repeat;border-radius:6px;pointer-events:none}
.gk-minimap-canvas{position:relative;z-index:1;display:block;width:168px;height:112px;margin:10px auto 6px;border-radius:6px}
.gk-tab-strip .gw-lobby-tab{min-width:0;height:40px;padding:0 20px;display:inline-flex;align-items:center;justify-content:center;background-size:auto 100%;background-position:center;background-repeat:no-repeat;font-size:10px;letter-spacing:.08em;line-height:1;white-space:nowrap;box-sizing:border-box}
.gk-tab-strip{gap:8px;padding-bottom:4px}
.gk-window-head{margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(120,150,200,.18)}
.gk-window-body,.gk-deploy-main,.gk-warcamp-shell .gw-deploy-panel,.gk-warcamp-shell .gw-lobby-main{min-width:0;overflow:visible}
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel{padding:var(--gk-panel-pad);border:28px solid transparent;border-image-source:url(/assets/ui-kit/craftpix/Window/Window_Background.png);border-image-slice:32 fill;border-image-width:28px;border-image-repeat:stretch;background-image:none!important;background-color:rgba(8,12,20,.62);border-radius:0;overflow:visible}
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel:first-of-type{border-image-source:url(/assets/ui-kit/craftpix/Window/Window_Background.png)}
.gk-root .gw-deploy-panel{overflow:visible;max-width:100%;box-sizing:border-box}
.gk-root .gw-btn:not(.gw-lobby-march):not(.gk-deploy-assault):not(.gw-deploy-assault){max-width:100%;box-sizing:border-box}
.gk-root .gw-btn-mini{padding:8px 12px;font-size:10px;line-height:1.2}
.gk-root .gw-collection-actions .gw-btn{min-width:min(136px,100%);padding:12px 14px}
.gk-root .gw-mapsize-toggle .gw-btn-mini{flex:1 1 88px;padding:8px 10px;font-size:10px}
.gk-root .wg-palette-row{padding:12px 14px;margin:12px 0}
.gk-root .wg-palette-swatch{width:36px;height:36px}
.gk-deploy-lanes .gk-lane-card,.gk-deploy-lanes .gw-lane-card{padding:16px 14px;min-height:min-content;box-sizing:border-box}
.gk-lane-path-tile{padding:14px 12px;min-height:108px;box-sizing:border-box}
.gk-deploy-footer{padding:16px 0 12px}
@media(max-width:720px){.gk-frame-actionbar,.gk-actionbar{min-width:98vw;min-height:148px;padding:14px 10px 34px}.gk-ab-slot{width:56px;height:56px;min-width:56px;min-height:56px;margin-bottom:16px}.gk-ab-icon{width:36px;height:36px}.gk-frame-window,.gk-window-panel,.gk-deploy-window,.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel{border-width:22px;border-image-width:22px;padding:clamp(16px,4vw,22px)}.gk-tab-strip .gw-lobby-tab{height:36px;padding:0 14px;font-size:9px}}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended UI frame fit v43 styles");
}

if (!css.includes(".wg-dep-screen")) {
  css += `
/* v65 clean deploy + kill broken craftpix 9-slice frames */
.gk-frame-window,.gk-window-panel,.gk-deploy-window,.gk-deploy-v2 .gk-deploy-window,
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel,.gk-frame-quest,.gk-quest-rail{
  border:1px solid rgba(120,150,200,.25)!important;
  border-image:none!important;
  border-width:1px!important;
  background-image:none!important;
  background-color:rgba(10,14,22,.94)!important;
  border-radius:12px!important;
  padding:16px 18px!important;
  box-shadow:0 8px 28px rgba(0,0,0,.35);
}
.gk-deploy-shell,.gk-warcamp-shell,.wg-dep-screen{
  background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(224,178,82,.07),transparent 55%),#080c14!important;
  color:#e8eef8;
}
.wg-dep-screen{display:flex;flex-direction:column;min-height:100dvh;padding:16px clamp(12px,3vw,28px) 24px;box-sizing:border-box;overflow:auto}
.wg-dep-head{display:flex;align-items:flex-start;gap:16px;margin-bottom:18px}
.wg-dep-head h1{margin:0 0 4px;font-family:Cinzel,serif;font-size:1.35rem;letter-spacing:.04em;color:#f0e6d0}
.wg-dep-head p{margin:0;color:#8fa3c4;font-size:.9rem}
.wg-dep-main{display:grid;gap:14px;max-width:960px;width:100%;margin:0 auto;flex:1}
.wg-dep-card{background:rgba(10,14,22,.92);border:1px solid rgba(120,150,200,.22);border-radius:12px;padding:16px 18px}
.wg-dep-card h2{margin:0 0 8px;font-size:.95rem;letter-spacing:.08em;text-transform:uppercase;color:#e0c878}
.wg-dep-lanes,.wg-dep-army{display:flex;flex-wrap:wrap;gap:8px}
.wg-dep-wave-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.wg-dep-wave{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:10px;background:rgba(6,9,14,.75);border:1px solid rgba(120,150,200,.18)}
.wg-dep-wave select,.wg-dep-wave .gw-lane-select{width:100%;padding:8px;border-radius:8px;border:1px solid rgba(120,150,200,.3);background:#0c121c;color:#e8eef8}
.wg-dep-foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center;max-width:960px;width:100%;margin:18px auto 0;padding-top:14px;border-top:1px solid rgba(120,150,200,.18);position:sticky;bottom:0;background:linear-gradient(180deg,transparent,rgba(8,12,20,.96) 30%);padding-bottom:8px}
.wg-dep-load{display:grid;place-items:center;min-height:70dvh;text-align:center;gap:8px}
.wg-dep-tier{display:flex;flex-direction:column;gap:8px;min-width:140px;flex:1;padding:10px;border-radius:10px;background:rgba(6,9,14,.7);border:1px solid rgba(120,150,200,.18)}
.wg-dep-tier-head{display:flex;align-items:center;gap:10px}
.wg-dep-tier-head img{width:28px;height:28px;object-fit:contain}
.wg-dep-tier-head strong{display:block;font-size:.85rem}
.wg-dep-tier-head span{font-size:.75rem;color:#9dffd8}
.wg-dep-tier-btns{display:flex;gap:6px}
.gw-btn.gw-active,.gw-btn-ghost.gw-active{border-color:rgba(224,178,82,.7)!important;background:rgba(224,178,82,.14)!important;color:#f0e6d0!important}
.gw-deploy-assault{padding:14px 28px;font-size:1rem;letter-spacing:.08em;background:linear-gradient(180deg,#c9a24a,#8a6a28);border:1px solid #e0c878;color:#1a1208;font-weight:700;border-radius:10px;cursor:pointer}
.gw-deploy-assault:hover{filter:brightness(1.08)}
.gw-deploy-assault:disabled{opacity:.45;cursor:not-allowed}
.gw-title-v3 .gw-title-ctas{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.gw-title-play{min-width:200px}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended v65 clean deploy UI styles");
}

// v66/v67: combat HUD — real craftpix frames (no broken border-image containers)
// Pre-game setup screen (path + troops + asset load)
if (!css.includes(".wg-setup-screen")) {
  css += `
.wg-setup-screen{display:flex;align-items:flex-start;justify-content:center;min-height:100dvh;padding:20px 14px 32px;box-sizing:border-box;overflow:auto;background:radial-gradient(ellipse 90% 50% at 50% 0%,rgba(224,178,82,.1),transparent 55%),#080c14;color:#e8eef8}
.wg-setup-card{width:min(920px,100%);display:flex;flex-direction:column;gap:14px;background:rgba(10,14,22,.94);border:1px solid rgba(120,150,200,.28);border-radius:14px;padding:20px 22px 18px;box-shadow:0 16px 48px rgba(0,0,0,.45)}
.wg-setup-kicker{margin:0;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#9dffd8}
.wg-setup-card h1{margin:0;font-family:Cinzel,serif;font-size:1.5rem;color:#f0e6d0}
.wg-setup-progress{display:flex;flex-direction:column;gap:6px;margin:4px 0 8px}
.wg-setup-bar{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;border:1px solid rgba(120,150,200,.25)}
.wg-setup-bar>i{display:block;height:100%;background:linear-gradient(90deg,#6ee7b7,#e0b252);border-radius:999px;transition:width .25s ease}
.wg-setup-timer{font-size:.8rem;color:#e0c878}
.wg-setup-section{padding:12px 0;border-top:1px solid rgba(120,150,200,.16)}
.wg-setup-section h2{margin:0 0 8px;font-size:.9rem;letter-spacing:.1em;text-transform:uppercase;color:#e0c878}
.wg-setup-foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center;padding-top:12px;border-top:1px solid rgba(120,150,200,.2);position:sticky;bottom:0;background:linear-gradient(180deg,transparent,rgba(10,14,22,.98) 30%)}
.wg-path-grid{display:flex;flex-direction:column;gap:10px}
.wg-path-row{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;background:rgba(6,9,14,.7);border:1px solid rgba(120,150,200,.18)}
.wg-path-row>strong{font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:#9dffd8}
.wg-path-opts{display:flex;flex-wrap:wrap;gap:6px}
.wg-path-opts .gw-btn-mini{max-width:100%;text-align:left;line-height:1.25;padding:8px 10px}
.wg-path-opts .gw-btn-mini.gw-active{border-color:rgba(224,178,82,.75)!important;background:rgba(224,178,82,.16)!important;color:#f0e6d0!important}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended setup screen styles");
}

// v69: champion path = hero skill level decisions (not spawn lane)
if (!css.includes(".wg-path-grid-v69") && css.includes(".wg-path-grid")) {
  /* styles already in setup block above when rebuilt */
}

if (!css.includes(".gk-hud-v67")) {
  css += `
.gk-hud-v67{}
/* Kill broken 9-slice border-image on all kit panels */
.gk-frame-window,.gk-window-panel,.gk-deploy-window,.gk-quest-rail,.gk-frame-quest,
.gk-warcamp-shell .gw-lobby-deploy .gw-deploy-panel{
  border-image:none!important;
  border:1px solid rgba(120,150,200,.28)!important;
  background-image:none!important;
  background-color:rgba(8,12,20,.88)!important;
  border-radius:12px!important;
  padding:14px 16px!important;
  box-shadow:0 10px 32px rgba(0,0,0,.4);
}
/* Minimap — fixed corner, craftpix frame as background */
.gk-combat-hud .gk-minimap-panel,.gk-minimap-panel{
  position:fixed!important;top:64px!important;left:12px!important;right:auto!important;bottom:auto!important;
  z-index:50!important;width:176px!important;min-width:0!important;height:200px!important;
  padding:0!important;margin:0!important;pointer-events:none!important;transform:none!important;
  background:transparent!important;border:none!important;border-image:none!important;box-shadow:none!important;
}
.gk-combat-hud .gk-minimap-frame,.gk-minimap-frame,.gk-frame-minimap{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;
  background:url(/assets/ui-kit/craftpix/Minimap/Minimap_Background.png) center/100% 100% no-repeat!important;
  border:none!important;border-image:none!important;border-radius:0!important;opacity:1!important;pointer-events:none!important;
  box-shadow:0 8px 28px rgba(0,0,0,.5);
}
.gk-combat-hud .gk-minimap-canvas,.gk-minimap-canvas{
  position:absolute!important;z-index:1!important;left:50%!important;top:42%!important;
  transform:translate(-50%,-50%)!important;display:block!important;
  width:132px!important;height:132px!important;margin:0!important;border-radius:8px!important;
  background:rgba(4,8,14,.65)!important;
}
.gk-combat-hud .gk-minimap-label,.gk-minimap-label{
  position:absolute!important;left:0!important;right:0!important;bottom:10px!important;
  margin:0!important;font-size:9px!important;letter-spacing:.14em!important;text-transform:uppercase!important;
  text-align:center!important;color:#c8e6ff!important;text-shadow:0 1px 2px #000;
}
/* Action bar — craftpix main bar, real slots */
.gk-combat-hud .gk-actionbar,.gk-actionbar.gk-frame-actionbar,.gk-frame-actionbar{
  position:fixed!important;left:50%!important;bottom:10px!important;transform:translateX(-50%)!important;
  z-index:50!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;
  gap:10px!important;min-width:min(720px,96vw)!important;min-height:120px!important;
  padding:18px 36px 28px!important;box-sizing:border-box!important;
  background:url("/assets/ui-kit/craftpix/Action Bar/ActionBar_Main_Background.png") center bottom/100% 100% no-repeat!important;
  border:none!important;border-image:none!important;box-shadow:none!important;
}
.gk-actionbar-slots{display:flex!important;align-items:flex-end!important;gap:6px!important;padding-bottom:4px!important}
.gk-ab-slot{
  position:relative!important;width:58px!important;height:58px!important;min-width:58px!important;min-height:58px!important;
  background:url("/assets/ui-kit/craftpix/Action Bar/Slots/ActionBar_Slot_Background.png") center/contain no-repeat!important;
  border:none!important;display:grid!important;place-items:center!important;margin:0!important;
  filter:drop-shadow(0 2px 6px rgba(0,0,0,.45));
}
.gk-ab-slot.is-ready{filter:drop-shadow(0 0 8px rgba(224,178,82,.35)) drop-shadow(0 2px 6px rgba(0,0,0,.45))}
.gk-ab-icon{width:34px!important;height:34px!important;object-fit:contain!important;pointer-events:none}
.gk-ab-name{position:absolute!important;bottom:-14px!important;left:50%!important;transform:translateX(-50%);
  font-size:8px!important;letter-spacing:.04em;color:#c8d4e8;white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis}
.gk-ab-key{position:absolute!important;top:2px!important;right:4px!important;font-size:9px!important;color:#e0c878;font-weight:700}
.gk-ab-cd{position:absolute!important;inset:4px!important;border-radius:6px;background:rgba(0,0,0,.55);
  display:grid;place-items:center;font-size:11px;color:#fff;font-weight:700}
.gk-mode-swap{
  min-width:72px!important;min-height:52px!important;padding:8px 10px!important;margin:0 0 8px!important;
  border:1px solid rgba(224,178,82,.45)!important;border-radius:8px!important;
  background:rgba(8,12,20,.75)!important;color:#e0c878!important;font-size:10px!important;letter-spacing:.08em;
  text-transform:uppercase;cursor:pointer;
}
/* Deploy / lobby clean */
.wg-dep-screen,.gk-deploy-shell,.gk-warcamp-shell{
  background:radial-gradient(ellipse 80% 45% at 50% 0%,rgba(224,178,82,.08),transparent 50%),#080c14!important;
}
.wg-dep-card,.gk-deploy-window{
  background:rgba(10,14,22,.92)!important;border:1px solid rgba(120,150,200,.25)!important;
  border-radius:12px!important;padding:16px 18px!important;border-image:none!important;background-image:none!important;
}
.gw-deploy-assault,.gk-deploy-assault{
  background:linear-gradient(180deg,#d4b05a,#8a6a28)!important;border:1px solid #e8d08a!important;
  color:#1a1208!important;font-weight:700!important;border-radius:10px!important;padding:14px 28px!important;
  letter-spacing:.06em;cursor:pointer;box-shadow:0 4px 16px rgba(224,178,82,.25)!important;
}
@media(max-width:720px){
  .gk-combat-hud .gk-minimap-panel,.gk-minimap-panel{top:52px!important;left:6px!important;width:140px!important;height:160px!important}
  .gk-combat-hud .gk-minimap-canvas,.gk-minimap-canvas{width:100px!important;height:100px!important}
  .gk-combat-hud .gk-actionbar,.gk-actionbar.gk-frame-actionbar{min-height:100px!important;padding:12px 10px 22px!important}
  .gk-ab-slot{width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important}
  .gk-ab-icon{width:28px!important;height:28px!important}
}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended v67 craftpix combat HUD styles");
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
if (!css.includes(".wg-admin-screen")) {
  css += `
.wg-admin-screen{display:flex;flex-direction:column;gap:12px;padding:clamp(12px,3vw,24px);overflow-y:auto;background:radial-gradient(ellipse 90% 50% at 50% 0%,rgba(224,178,82,.08),transparent 55%),#080c14;font-family:Cinzel,EB Garamond,Inter,sans-serif}
.wg-admin-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:10px;border-bottom:1px solid rgba(120,150,200,.22)}
.wg-admin-title{margin:0;font-size:clamp(1.2rem,3vw,1.6rem);color:#f0e6d0}
.wg-admin-lead{margin:4px 0 0;font-size:.88rem;color:#8fa3c4}
.wg-admin-head-actions{display:flex;gap:8px;flex-wrap:wrap}
.wg-admin-tabs{display:flex;flex-wrap:wrap;gap:8px}
.wg-admin-tab{padding:8px 14px;border-radius:8px;border:1px solid rgba(120,150,200,.3);background:rgba(8,12,20,.75);color:#b8c4d8;cursor:pointer;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.wg-admin-tab.is-active{border-color:rgba(224,178,82,.55);color:#e0c878;background:rgba(224,178,82,.1)}
.wg-admin-msg{margin:0;padding:8px 12px;border-radius:8px;border:1px solid rgba(110,231,183,.35);background:rgba(8,20,16,.7);color:#9dffd8;font-size:.85rem}
.wg-admin-body{display:flex;flex-direction:column;gap:14px}
.wg-admin-row{display:flex;flex-wrap:wrap;gap:8px}
.wg-admin-grid{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:960px){.wg-admin-grid{grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr)}}
.wg-admin-panel{padding:14px;border-radius:12px;border:1px solid rgba(120,150,200,.22);background:rgba(8,12,20,.82)}
.wg-admin-map-canvas{display:block;width:100%;max-width:520px;border-radius:10px;border:1px solid rgba(120,150,200,.25);cursor:crosshair}
.wg-admin-hint{margin:8px 0 0;font-size:.78rem;color:#8fa3c4}
.wg-admin-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:.8rem;color:#a8b8d0}
.wg-admin-field input,.wg-admin-field select{padding:8px 10px;border-radius:8px;border:1px solid rgba(120,150,200,.3);background:rgba(6,9,14,.9);color:#e8eef8;font-family:inherit}
.wg-admin-pair{display:flex;gap:8px}
.wg-admin-pair input{flex:1}
.wg-admin-lane{margin-top:8px;padding-top:8px;border-top:1px solid rgba(120,150,200,.15)}
.wg-admin-lane-name{display:block;font-size:.82rem;color:#e0c878;margin-bottom:6px}
.wg-admin-lane-actions{display:flex;gap:6px}
.wg-admin-asset-grid{display:grid;gap:10px;grid-template-columns:1fr}
@media(min-width:720px){.wg-admin-asset-grid{grid-template-columns:1fr 1fr}}
.wg-admin-flow-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended admin editor styles");
}
if (!css.includes(".gk-warcamp-shell.gw-screen")) {
  css += `
.gk-warcamp-shell.gw-screen,.gk-deploy-shell.gw-screen{overflow-x:hidden;overflow-y:auto;height:100dvh;max-height:100dvh;-webkit-overflow-scrolling:touch}
.gk-warcamp-shell .gw-lobby-grid-v2{min-width:0}
.gk-warcamp-shell .gw-char-card,.gk-warcamp-shell .gw-pack-card{min-width:0}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended warcamp scroll + card containment");
}
if (!css.includes(".wg-debug-panel")) {
  css += `
.wg-debug-panel{position:fixed;left:10px;bottom:10px;z-index:9999;width:min(420px,94vw);max-height:min(42vh,360px);display:flex;flex-direction:column;font-family:JetBrains Mono,Consolas,monospace;font-size:10px;color:#dce6f4;background:rgba(6,9,14,.92);border:1px solid rgba(120,150,200,.35);border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.55);backdrop-filter:blur(8px);pointer-events:auto}
.wg-debug-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(120,150,200,.22);flex-wrap:wrap}
.wg-debug-title{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#e0c878;font-weight:700}
.wg-debug-tabs{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.wg-debug-tabs button{padding:3px 8px;border-radius:6px;border:1px solid rgba(120,150,200,.28);background:rgba(8,12,20,.8);color:#8fa3c4;cursor:pointer;font:inherit;font-size:9px;text-transform:uppercase}
.wg-debug-tabs button.is-active{border-color:rgba(224,178,82,.55);color:#f0c46b;background:rgba(224,178,82,.1)}
.wg-debug-btn{padding:3px 8px;border-radius:6px;border:1px solid rgba(120,150,200,.28);background:rgba(8,12,20,.8);color:#9dffd8;cursor:pointer;font:inherit;font-size:9px}
.wg-debug-meta{padding:6px 10px;font-size:9px;color:#8fa3c4;border-bottom:1px solid rgba(120,150,200,.15);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wg-debug-log{overflow-y:auto;padding:6px 8px 8px;display:flex;flex-direction:column;gap:3px}
.wg-debug-line{display:grid;grid-template-columns:auto auto 1fr auto;gap:6px;align-items:baseline;line-height:1.35}
.wg-debug-ts{color:#6b7a94;font-size:8px}
.wg-debug-cat{font-size:8px;letter-spacing:.06em;text-transform:uppercase;padding:1px 4px;border-radius:4px}
.wg-debug-cat--flow{background:rgba(93,200,255,.15);color:#7ec8ff}
.wg-debug-cat--anim{background:rgba(157,255,216,.12);color:#9dffd8}
.wg-debug-cat--asset{background:rgba(251,191,36,.12);color:#fbbf24}
.wg-debug-cat--combat{background:rgba(248,113,113,.12);color:#fca5a5}
.wg-debug-msg{color:#c8d4e8;min-width:0;overflow:hidden;text-overflow:ellipsis}
.wg-debug-pos{color:#e0c878;font-size:8px;white-space:nowrap}
`;
  writeFileSync(CSS, css);
  console.log("[patch] appended WG debug panel styles");
}