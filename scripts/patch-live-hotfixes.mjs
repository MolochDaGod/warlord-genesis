#!/usr/bin/env node
/**
 * Surgical hotfixes on the shipped gw-core bundle (no full fix2 re-patch).
 *
 * 1. War Council deployOk — lanes is Record, not Array (deploy.lanes.every crash)
 * 2. DRC multi-host baked clips (same-origin → open → gameopen)
 * 3. sword_shield loco → Open DRC greatsword_samurai (no run-to-roll)
 * 4. Preload sword_shield clips during setup warm
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CORE = join(ROOT, "assets", "gw-core-20260713.js");
const FIX3 = join(ROOT, "assets", "index-warlord-fix3.js");
const FIX95 = join(ROOT, "assets", "index-warlord-fix95.js");
const INDEX = join(ROOT, "index.html");
const MANIFEST = join(ROOT, "deploy-manifest.json");
const CACHE_HASH = "b29";

if (!existsSync(CORE)) {
  console.error("[hotfix] missing", CORE);
  process.exit(1);
}

/** Safe replace — never interpret $ as replacement tokens. */
function safeReplace(src, from, to) {
  if (!src.includes(from)) return { src, ok: false };
  return { src: src.split(from).join(to), ok: true };
}

let js = readFileSync(CORE, "utf8");
const failures = [];
function must(id, ok) {
  if (!ok) {
    failures.push(id);
    console.error("[hotfix] FAIL", id);
  } else {
    console.log("[hotfix] OK", id);
  }
}

// Already-applied short-circuit
if (
  js.includes("[0,1,2].every(u=>deploy.lanes[u]") &&
  js.includes("open.grudge-studio.com/anims/baked") &&
  js.includes("greatsword_samurai/gs_samurai_idle_sword")
) {
  console.log("[hotfix] already applied — refreshing index/manifest only");
} else {
  // 1. deploy.lanes.every (Record crash)
  {
    const bad =
      "deployOk=!!(deploy?.lanes&&deploy.lanes.every(L=>L?.meleeCreep&&L?.rangedCreep))";
    const good =
      "deployOk=!!(deploy?.lanes&&[0,1,2].every(u=>deploy.lanes[u]?.meleeCreep&&deploy.lanes[u]?.rangedCreep))";
    const r = safeReplace(js, bad, good);
    if (r.ok) js = r.src;
    must("deploy-lanes-record", js.includes(good) && !js.includes(bad));
  }

  // 2. Multi-host R6
  {
    const from =
      'function R6(C){const A=C.split("/").map(I=>encodeURIComponent(I)).join("/");return`/anims/baked/${A}.json`}';
    const to =
      'function R6(C){const A=C.split("/").map(I=>encodeURIComponent(I)).join("/");return[`/anims/baked/${A}.json`,`https://open.grudge-studio.com/anims/baked/${A}.json`,`https://gameopen.vercel.app/anims/baked/${A}.json`]}';
    const r = safeReplace(js, from, to);
    if (r.ok) js = r.src;
    must("drc-r6-multi", js.includes("open.grudge-studio.com/anims/baked"));
  }

  // 3. Multi-host zc (for-loop, no continue quirks)
  {
    const from =
      'async function zc(C){const A=R6(C),I=await fetch(A);if(!I.ok){WgDebug.asset("clip.missing",{extra:{url:A,status:I.status}});return null}try{const g=await I.json();return b6(oa.parse(g))}catch(e){WgDebug.asset("clip.parse",{extra:{url:A,err:String(e)}});return null}}';
    const to =
      'async function zc(C){const u=R6(C),list=Array.isArray(u)?u:[u];for(let i=0;i<list.length;i++){try{const A=list[i],I=await fetch(A,{mode:"cors"});if(I.ok){const ct=I.headers.get("content-type")||"";if(ct.indexOf("text/html")<0){const g=await I.json();return b6(oa.parse(g))}}}catch(e){WgDebug.asset("clip.parse",{extra:{url:list[i],err:String(e)}})}}WgDebug.asset("clip.missing",{extra:{rel:C}});return null}';
    const r = safeReplace(js, from, to);
    if (r.ok) js = r.src;
    must(
      "drc-zc-multi",
      js.includes("for(let i=0;i<list.length;i++)") &&
        js.includes("Array.isArray(u)?u:[u]"),
    );
  }

  // 4. sword_shield → DRC samurai
  {
    const local =
      'sword_shield:{idle:Wg("idle_shield","sword_shield/sword and shield idle"),walk:Wg("walk","sword_shield/sword and shield strafe"),run:Wg("run","sword_shield/sword and shield run"),sprint:Wg("sprint","sword_shield/sword and shield run")}';
    const banned =
      'sword_shield:{idle:Wg("idle_shield","sword_shield/sword and shield idle"),walk:Wg("walk","locomotion/walking"),run:Wg("run","locomotion/running"),sprint:Wg("sprint","uploads_2026_06/locomotion/running")}';
    const drc =
      'sword_shield:{idle:Wg("samurai_idle_sword","greatsword_samurai/gs_samurai_idle_sword"),walk:Wg("samurai_walk_sword","greatsword_samurai/gs_samurai_walk_sword"),run:Wg("samurai_run_sword","greatsword_samurai/gs_samurai_run_sword"),sprint:Wg("samurai_run_sword","greatsword_samurai/gs_samurai_run_sword")}';
    let r = safeReplace(js, local, drc);
    if (!r.ok) r = safeReplace(js, banned, drc);
    if (r.ok) js = r.src;
    must("drc-sword-pack", js.includes("greatsword_samurai/gs_samurai_idle_sword"));
  }

  // 5. Setup warm sword_shield (same-origin exists)
  {
    const warmOld =
      '"/anims/baked/venom/idle.json","/anims/baked/venom/run-forward.json"';
    const warmNeu =
      '"/anims/baked/sword_shield/sword and shield idle.json","/anims/baked/sword_shield/sword and shield run.json","/anims/baked/venom/idle.json","/anims/baked/venom/run-forward.json"';
    if (js.includes(warmOld) && !js.includes("sword and shield idle.json")) {
      js = safeReplace(js, warmOld, warmNeu).src;
    }
    must(
      "setup-warm-sword",
      js.includes("sword and shield idle.json") ||
        js.includes("greatsword_samurai"),
    );
  }

  // Syntax gate
  const tmp = join(ROOT, "assets", "_gw-core-hotfix.tmp.js");
  writeFileSync(tmp, js);
  try {
    execSync(`node --check ${JSON.stringify(tmp)}`, { stdio: "pipe" });
    console.log("[hotfix] syntax OK");
  } catch (err) {
    console.error(
      "[hotfix] syntax FAILED",
      String(err.stderr || err.message).slice(0, 400),
    );
    process.exit(1);
  }

  writeFileSync(CORE, js);
  copyFileSync(CORE, FIX3);
  copyFileSync(CORE, FIX95);
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}

// Always refresh index + manifest from current core
js = readFileSync(CORE, "utf8");

// Open lobby handoff: live $5 only read `race`/`class`. Open sends raceId=western-kingdoms.
{
  const from =
    'function $5(C){const A=new URLSearchParams(C.startsWith("?")?C:`?${C}`),I=A.get("grudgeId")??void 0,g=A.get("race"),i=A.get("class"),e={};return I&&(e.grudgeId=I),g&&UK[g]&&(e.raceId=g),i&&yx.includes(i)&&(e.classId=i),e}';
  const to =
    'function $5(C){const A=new URLSearchParams(C.startsWith("?")?C:`?${C}`),I=A.get("grudgeId")??void 0,g=A.get("race")||A.get("raceId")||A.get("race_id"),i=A.get("class")||A.get("classId")||A.get("baseId"),e={},m={"western-kingdoms":"human","race-western-kingdoms":"human",wk:"human",barbarians:"barbarian","high-elves":"elf",elves:"elf",dwarves:"dwarf",orcs:"orc",undead:"undead"};const race=m[String(g||"").toLowerCase()]||g;const raw=String(i||"").toLowerCase();const cls=yx.includes(raw)?raw:raw.includes("mage")?"mage":raw.includes("ranger")||raw.includes("archer")?"ranger":raw.includes("worge")?"worge":raw.includes("warrior")||raw.includes("knight")||raw.includes("kingdom")?"warrior":void 0;return I&&(e.grudgeId=I),race&&UK[race]&&(e.raceId=race),cls&&yx.includes(cls)&&(e.classId=cls),e}';
  const r = safeReplace(js, from, to);
  if (r.ok) {
    js = r.src;
    console.log("[hotfix] OK open-handoff-$5");
  } else if (js.includes('A.get("raceId")')) {
    console.log("[hotfix] OK open-handoff-$5 (already)");
  } else {
    console.error("[hotfix] FAIL open-handoff-$5");
    failures.push("open-handoff-$5");
  }
}

// Token aliases — bootstrap / fleet read sso_token as well as grudge_auth_token.
{
  const from = 'function cq(C){try{localStorage.setItem(UN,C)}catch{}}';
  const to =
    'function cq(C){try{localStorage.setItem(UN,C);localStorage.setItem("sso_token",C);localStorage.setItem("grudge_session_token",C)}catch{}}';
  const r = safeReplace(js, from, to);
  if (r.ok) js = r.src;
  if (js.includes('localStorage.setItem("sso_token",C)')) {
    console.log("[hotfix] OK token-aliases");
  } else {
    console.error("[hotfix] FAIL token-aliases");
    failures.push("token-aliases");
  }
}
{
  const from = 'function NN(){try{localStorage.removeItem(UN)}catch{}}';
  const to =
    'function NN(){try{localStorage.removeItem(UN);localStorage.removeItem("sso_token");localStorage.removeItem("grudge_session_token")}catch{}}';
  const r = safeReplace(js, from, to);
  if (r.ok) js = r.src;
}

{
  const from =
    '!g&&!I&&d.jsx("button",{type:"button",className:"gw-auth-btn",onClick:e,children:"Continue as guest"}),';
  const r = safeReplace(js, from, "");
  if (r.ok) js = r.src;
}
{
  const from =
    'd.jsx("button",{type:"button",className:"gw-auth-btn gw-auth-btn-puter",onClick:n,disabled:g,children:"Sign in with Puter"})';
  const r = safeReplace(js, from, "");
  if (r.ok) js = r.src;
}
{
  const from = 'I.role==="guest"?"Guest":"Account"';
  const to = '"Account"';
  const r = safeReplace(js, from, to);
  if (r.ok) js = r.src;
}
{
  const from =
    'd.jsx("button",{type:"button",className:"gw-btn gw-title-play",onClick:()=>C("/lobby"),children:g?"Preparing…":"Enter the Warcamp"})';
  const to =
    'd.jsx("button",{type:"button",className:"gw-btn gw-title-play",onClick:()=>I?C("/lobby"):t(),children:g?"Preparing…":I?"Enter the Warcamp":"Sign in · Grudge ID"})';
  const r = safeReplace(js, from, to);
  if (r.ok) js = r.src;
}
{
  const from = 'children:"Grudge ID · Puter · Railway saves"';
  const to = 'children:"Grudge ID · Railway roster"';
  const r = safeReplace(js, from, to);
  if (r.ok) js = r.src;
}
{
  const from = "guest:()=>xR(C,lO)";
  const to = "guest:()=>{WgGrudgeIdLogin()}";
  const r = safeReplace(js, from, to);
  if (r.ok) js = r.src;
}
{
  const from =
    'children:"Guest (local season)"';
  const r = safeReplace(js, from, 'children:"Sign in · Grudge ID"');
  if (r.ok) js = r.src;
}
if (
  !js.includes("Continue as guest") &&
  js.includes("Sign in · Grudge ID")
) {
  console.log("[hotfix] OK no-guest-ui");
} else if (!js.includes("Continue as guest")) {
  console.log("[hotfix] OK no-guest-ui (already)");
} else {
  console.error("[hotfix] FAIL no-guest-ui");
  failures.push("no-guest-ui");
}

// Source session.restore does not mint a guest. Live bundle did (lO auto).
{
  const from =
    "const I=await cO();if(I){C({user:I,loading:!1}),await WgFleetSync(I);return}const g=await lO();C({user:g,loading:!1}),await WgFleetSync(g)}catch(e){C({user:null,loading:!1,error:e instanceof Error?e.message:\"Could not start session\"})}}";
  const to =
    "const I=await cO();if(I){C({user:I,loading:!1}),await WgFleetSync(I);return}C({user:null,loading:!1})}catch(e){C({user:null,loading:!1,error:e instanceof Error?e.message:\"Could not start session\"})}}";
  const r = safeReplace(js, from, to);
  if (r.ok) js = r.src;
  if (!js.includes("const g=await lO();C({user:g")) {
    console.log("[hotfix] OK no-auto-guest-restore");
  } else {
    console.error("[hotfix] FAIL no-auto-guest-restore");
    failures.push("no-auto-guest-restore");
  }
}

// Prefer Toon RTS race GLB over 9.7MB whole-pack /models/heroes/grudge6 dump.
{
  const from =
    "function WgHeroGlbUrl(C,A){const I=UK[C]||C,g=WgHeroClassFile[A]||A;return`/models/heroes/grudge6/${I}_${g}.glb`}";
  const to =
    'function WgHeroGlbUrl(C,A){const fleet={human:"human",barbarian:"barbarian",elf:"elf",dwarf:"dwarf",orc:"orc",undead:"undead"};const f=fleet[C]||"human";return`https://assets.grudge-studio.com/asset-packs/toon-rts-characters/glb/characters/${f}.glb`}';
  const r = safeReplace(js, from, to);
  if (r.ok) {
    js = r.src;
    console.log("[hotfix] OK toon-hero-url");
  } else if (js.includes("toon-rts-characters/glb/characters/")) {
    console.log("[hotfix] OK toon-hero-url (already)");
  } else {
    console.error("[hotfix] FAIL toon-hero-url");
    failures.push("toon-hero-url");
  }
}

if (failures.length) {
  console.error("[hotfix] remaining", failures.join(", "));
  process.exit(1);
}

writeFileSync(CORE, js);
copyFileSync(CORE, FIX3);
copyFileSync(CORE, FIX95);

const sha = createHash("sha256").update(js).digest("hex").slice(0, 16);
const bytes = Buffer.byteLength(js);

if (existsSync(INDEX)) {
  let html = readFileSync(INDEX, "utf8");
  html = html.replace(
    /gw-core-20260713\.js\?h=[a-z0-9]+/g,
    `gw-core-20260713.js?h=${CACHE_HASH}`,
  );
  html = html.replace(
    /index-BNWYZMT1\.css\?h=[a-z0-9]+/g,
    `index-BNWYZMT1.css?h=${CACHE_HASH}`,
  );
  html = html.replace(
    /grudge-game-bootstrap\.js\?h=[a-z0-9]+/g,
    `grudge-game-bootstrap.js?h=${CACHE_HASH}`,
  );
  html = html.replace(
    /grudge-sdk\.js\?h=[a-z0-9]+/g,
    `grudge-sdk.js?h=${CACHE_HASH}`,
  );
  html = html.replace(
    'content="https://warstrat.grudge-studio.com"',
    'content="https://warlord-genesis.vercel.app"',
  );
  writeFileSync(INDEX, html);
  console.log("[hotfix] index.html h=", CACHE_HASH);
}

if (existsSync(MANIFEST)) {
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  m.bundleCacheHash = CACHE_HASH;
  m.bundleVersion = 20260803;
  m.bundleSha256 = sha;
  m.bundleBytes = bytes;
  m.lastBuilt = new Date().toISOString();
  m.sites = [
    "https://warlord-genesis.vercel.app",
    "https://warstrat.grudge-studio.com",
  ];
  const checks = m.bundleChecks || [];
  const ids = new Set(checks.map((c) => c.id));
  const add = (id, needle) => {
    if (!ids.has(id)) checks.push({ id, needle });
  };
  add("deploy-lanes-fix", "[0,1,2].every(u=>deploy.lanes[u]");
  add("drc-open-anims", "open.grudge-studio.com/anims/baked");
  add("drc-samurai-sword", "greatsword_samurai/gs_samurai_idle_sword");
  m.bundleChecks = checks;
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
  console.log("[hotfix] manifest sha=", sha, "bytes=", bytes);
}

if (failures.length) {
  console.error("[hotfix] incomplete:", failures.join(", "));
  process.exit(1);
}
console.log("[hotfix] done → assets/gw-core-20260713.js");
