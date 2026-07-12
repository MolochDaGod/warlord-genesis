#!/usr/bin/env node
/** Replace FBX skip with procedural shells using known minified THREE symbols. */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = join(ROOT, "assets", "index-warlord-fix3.js");
const ROOT_COPY = join(ROOT, "index-warlord-fix3.js");
const INDEX = join(ROOT, "index.html");

let js = readFileSync(BUNDLE, "utf8");

// From prepareProto (JiA): _e=MeshStandardMaterial, EI=Color, li=Group
// From three freeze exports: Tg=Mesh, eD=SphereGeometry, Hs=CylinderGeometry, Ql=ConeGeometry
const checks = {
  _e: (js.match(/new _e\(/g) || []).length,
  EI: (js.match(/new EI\(/g) || []).length,
  Tg: (js.match(/new Tg\(/g) || []).length,
  eD: (js.match(/new eD\(/g) || []).length,
  Hs: (js.match(/new Hs\(/g) || []).length,
  Ql: (js.match(/new Ql\(/g) || []).length,
  li: (js.match(/new li\(/g) || []).length,
};
console.log("[proc] symbol usage counts", checks);
for (const [k, n] of Object.entries(checks)) {
  if (n === 0 && k !== "eD" && k !== "Hs" && k !== "Ql") {
    // eD/Hs/Ql may only appear in class defs not `new` if unused in app code yet
  }
}

const skip = "continue/*skip missing projectile fbx*/";
const already = "Q=JiA(__gwShell(B),B,i)";
if (js.includes(already)) {
  console.log("[proc] already using procedural shells");
  process.exit(0);
}
if (!js.includes(skip) && !js.includes("models/projectiles/${B.file}.fbx")) {
  console.error("[proc] no projectile load site to patch");
  process.exit(1);
}

const helperMarker = "/*__GW_PROC_SHELL__*/";
const helper =
  `${helperMarker}function __gwShell(def){const h=new li;` +
  `const col=new EI(def.material&&def.material.color||"#c0a878");` +
  `const m=new _e({color:col,roughness:(def.material&&def.material.roughness)||.55,metalness:(def.material&&def.material.metalness)||.35,emissive:def.tint?new EI(def.tint):new EI(0),emissiveIntensity:def.tint?.85:0});` +
  `if(def.splash)h.add(new Tg(new eD(.45,10,8),m));` +
  `else{const sh=new Tg(new Hs(.04,.05,.9,6),m);sh.rotation.z=Math.PI/2;` +
  `const tip=new Tg(new Ql(.09,.28,6),m);tip.rotation.z=-Math.PI/2;tip.position.x=.55;h.add(sh,tip)}` +
  `return h}`;

if (!js.includes(helperMarker)) {
  const anchor = "function LiA(){const C=b.useRef(null)";
  const idx = js.indexOf(anchor);
  if (idx < 0) {
    console.error("[proc] LiA anchor missing");
    process.exit(1);
  }
  js = js.slice(0, idx) + helper + js.slice(idx);
}

if (js.includes(skip)) {
  js = js.replace(skip, already);
} else {
  const projOld =
    "try{const r=await g.loadAsync(`${u_}models/projectiles/${B.file}.fbx`);Q=JiA(r,B,i)}catch{continue}";
  if (js.includes(projOld)) js = js.replace(projOld, already);
  else {
    console.error("[proc] could not replace projectile load");
    process.exit(1);
  }
}

writeFileSync(BUNDLE, js);
copyFileSync(BUNDLE, ROOT_COPY);

let html = readFileSync(INDEX, "utf8");
const cur = parseInt((html.match(/index-warlord-fix3\.js\?v=(\d+)/) || [])[1] || "92", 10);
html = html.replace(/index-warlord-fix3\.js\?v=\d+/g, `index-warlord-fix3.js?v=${cur + 1}`);
writeFileSync(INDEX, html);
console.log("[proc] procedural shells installed, cache v=" + (cur + 1));
