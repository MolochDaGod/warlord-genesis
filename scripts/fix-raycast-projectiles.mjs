#!/usr/bin/env node
/**
 * Hotfix production warlord bundle (assets/index-warlord-fix3.js):
 * 1. Raycaster.camera + mesh-only occlusion (stops THREE.Sprite throw spam)
 * 2. Procedural projectile shells (stops missing FBX 404 spam)
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = join(ROOT, "assets", "index-warlord-fix3.js");
const INDEX = join(ROOT, "index.html");
const ROOT_COPY = join(ROOT, "index-warlord-fix3.js");

let js = readFileSync(BUNDLE, "utf8");
const before = js.length;
let fixes = 0;

// ── 1. Camera occlusion ──────────────────────────────────────────
const occOld =
  "function vCA(C,A,I,g,e=.32){Iu.subVectors(I,A);const i=Iu.length();if(i<1e-4)return I;Iu.multiplyScalar(1/i),Lp.set(A,Iu),Lp.far=i,Lp.near=.08;const t=Lp.intersectObjects(C.children,!0);let B=i;for(const s of t)TCA(s.object)&&(HCA(s.object,g)||s.distance<B&&(B=s.distance));const Q=Math.max(e,B-e);return Uq.copy(A).addScaledVector(Iu,Math.min(i,Q)),Uq}";

const occNew =
  "function vCA(C,A,I,g,e=.32,cam){Iu.subVectors(I,A);const i=Iu.length();if(i<1e-4)return I;Iu.multiplyScalar(1/i),Lp.set(A,Iu),Lp.far=i,Lp.near=.08;cam&&(Lp.camera=cam);let t;try{t=Lp.intersectObjects(C.children,!0)}catch{return I}let B=i;for(const s of t){if(!s.object.isMesh||!TCA(s.object)||HCA(s.object,g))continue;s.distance<B&&(B=s.distance)}const Q=Math.max(e,B-e);return Uq.copy(A).addScaledVector(Iu,Math.min(i,Q)),Uq}";

if (js.includes(occOld)) {
  js = js.replace(occOld, occNew);
  fixes++;
  console.log("[fix] occlusion: camera + mesh-only + try/catch");
} else if (js.includes("cam&&(Lp.camera=cam)")) {
  console.log("[fix] occlusion already patched");
} else {
  console.error("[fix] FAIL: occlusion function not found");
  process.exit(1);
}

const callOld = "vCA(g,ls,Ur,hA.current?.root??null)";
const callNew = "vCA(g,ls,Ur,hA.current?.root??null,.32,A)";
if (js.includes(callOld)) {
  js = js.replace(callOld, callNew);
  fixes++;
  console.log("[fix] occlusion caller: pass camera");
} else if (js.includes(callNew)) {
  console.log("[fix] occlusion caller already patched");
} else {
  console.error("[fix] FAIL: occlusion call site not found");
  process.exit(1);
}

// ── 2. Projectiles ───────────────────────────────────────────────
const projOld =
  "try{const r=await g.loadAsync(`${u_}models/projectiles/${B.file}.fbx`);Q=JiA(r,B,i)}catch{continue}";

const helperMarker = "/*__GW_PROC_SHELL__*/";

function detectThreeNs(source) {
  const a = source.match(/([A-Za-z_$][\w$]*)\.MeshStandardMaterial/);
  if (a) return a[1];
  const b = source.match(/([A-Za-z_$][\w$]*)\.SphereGeometry/);
  if (b) return b[1];
  const c = source.match(/([A-Za-z_$][\w$]*)\.BoxGeometry/);
  if (c) return c[1];
  return null;
}

if (js.includes("Q=JiA(__gwShell(B),B,i)") || js.includes("/*skip missing projectile fbx*/")) {
  console.log("[fix] projectiles already patched");
} else if (!js.includes(projOld)) {
  console.error("[fix] FAIL: projectile loadAsync block not found");
  process.exit(1);
} else {
  const ns = detectThreeNs(js);
  console.log("[fix] THREE namespace:", ns || "(none)");

  if (!ns) {
    // No network requests — combat is hitscan; only visuals missing
    js = js.replace(projOld, "continue/*skip missing projectile fbx*/");
    fixes++;
    console.log("[fix] projectiles: skip FBX loads (no THREE ns)");
  } else {
    const liA = "function LiA(){const C=b.useRef(null)";
    const liAIdx = js.indexOf(liA);
    if (liAIdx < 0) {
      console.error("[fix] FAIL: Projectiles LiA not found");
      process.exit(1);
    }
    if (!js.includes(helperMarker)) {
      const helper =
        `${helperMarker}function __gwShell(def){const h=new li;` +
        `const col=new ${ns}.Color(def.material&&def.material.color||"#c0a878");` +
        `const m=new ${ns}.MeshStandardMaterial({color:col,roughness:(def.material&&def.material.roughness)||.55,metalness:(def.material&&def.material.metalness)||.35,emissive:def.tint?new ${ns}.Color(def.tint):new ${ns}.Color(0),emissiveIntensity:def.tint?.85:0});` +
        `if(def.splash)h.add(new ${ns}.Mesh(new ${ns}.SphereGeometry(.45,10,8),m));` +
        `else{const sh=new ${ns}.Mesh(new ${ns}.CylinderGeometry(.04,.05,.9,6),m);sh.rotation.z=Math.PI/2;` +
        `const tip=new ${ns}.Mesh(new ${ns}.ConeGeometry(.09,.28,6),m);tip.rotation.z=-Math.PI/2;tip.position.x=.55;h.add(sh,tip)}` +
        `return h}`;
      js = js.slice(0, liAIdx) + helper + js.slice(liAIdx);
    }
    js = js.replace(projOld, "Q=JiA(__gwShell(B),B,i)");
    fixes++;
    console.log("[fix] projectiles: procedural shells");
  }
}

writeFileSync(BUNDLE, js);
try {
  copyFileSync(BUNDLE, ROOT_COPY);
} catch {
  /* optional */
}

const hash = createHash("sha256").update(js).digest("hex").slice(0, 8);
console.log("[fix] bundle", before, "→", js.length, "sha", hash);

if (existsSync(INDEX)) {
  let html = readFileSync(INDEX, "utf8");
  const cur = parseInt((html.match(/index-warlord-fix3\.js\?v=(\d+)/) || [])[1] || "91", 10) || 91;
  const next = cur + 1;
  html = html.replace(/index-warlord-fix3\.js\?v=\d+/g, `index-warlord-fix3.js?v=${next}`);
  writeFileSync(INDEX, html);
  console.log("[fix] index.html cache buster v=" + next);
}

console.log("[fix] done,", fixes, "edits");
