#!/usr/bin/env node
/**
 * Nuclear fix for THREE.Sprite raycast throw + force cache bust via new filename.
 *
 * Even if occlusion forgets raycaster.camera, Sprite.raycast will no-op instead
 * of throwing. New asset name defeats sticky ?v=91 browser/CDN caches.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "index-warlord-fix3.js");
const OUT_NAME = "index-warlord-fix95.js";
const OUT = join(ROOT, "assets", OUT_NAME);
const INDEX = join(ROOT, "index.html");

let js = readFileSync(SRC, "utf8");

// ── 1. Sprite.raycast: never throw ───────────────────────────────
// Original three.js:  A.camera===null&&PI('Sprite: "Raycaster.camera" needs to be set...')
const marker = 'Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.';
const msgIdx = js.indexOf(marker);
if (msgIdx < 0) {
  console.error("[nuclear] Sprite error string not found");
  process.exit(1);
}

// Walk back to the start of: A.camera===null&&PI(
let start = js.lastIndexOf("A.camera===null", msgIdx);
if (start < 0) {
  console.error("[nuclear] A.camera===null not found before message");
  process.exit(1);
}

// End is right before the next statement after PI(...),
// which is typically: ,Zc.setFromMatrixScale  OR  ;Zc.setFromMatrixScale
const afterMsg = msgIdx + marker.length;
// Find closing of PI('...')
let end = js.indexOf(")", afterMsg);
if (end < 0) {
  console.error("[nuclear] PI close not found");
  process.exit(1);
}
end += 1; // include )
// Optional trailing comma if it was used as expression statement with &&
// Pattern is:  A.camera===null&&PI('...'); next is Zc.set...
// Sometimes: A.camera===null&&PI('...'),Zc...
const peek = js.slice(end, end + 3);
if (peek.startsWith(",")) {
  // keep comma structure — replace with if-return so next token must be statement
  // We'll replace including comma and leave Zc as next statement
}

const old = js.slice(start, end);
console.log("[nuclear] old throw snippet:", old.slice(0, 100) + "…");

// Replace throw-expression with early return (raycast method body)
const neu = "if(A.camera===null)return/*gw-sprite-safe*/";
js = js.slice(0, start) + neu + js.slice(end);
console.log("[nuclear] Sprite.raycast no longer throws");

// ── 2. Occlusion camera (idempotent) ─────────────────────────────
const occOld =
  "function vCA(C,A,I,g,e=.32){Iu.subVectors(I,A);const i=Iu.length();if(i<1e-4)return I;Iu.multiplyScalar(1/i),Lp.set(A,Iu),Lp.far=i,Lp.near=.08;const t=Lp.intersectObjects(C.children,!0);";
const occNew =
  "function vCA(C,A,I,g,e=.32,cam){Iu.subVectors(I,A);const i=Iu.length();if(i<1e-4)return I;Iu.multiplyScalar(1/i),Lp.set(A,Iu),Lp.far=i,Lp.near=.08;cam&&(Lp.camera=cam);let t;try{t=Lp.intersectObjects(C.children,!0)}catch{return I};";
if (js.includes(occOld)) {
  js = js.replace(occOld, occNew);
  console.log("[nuclear] occlusion camera patched");
} else if (js.includes("cam&&(Lp.camera=cam)")) {
  console.log("[nuclear] occlusion already has camera");
} else {
  console.warn("[nuclear] WARN: occlusion signature not matched (may already differ)");
}

const callOld = "vCA(g,ls,Ur,hA.current?.root??null)";
const callNew = "vCA(g,ls,Ur,hA.current?.root??null,.32,A)";
if (js.includes(callOld) && !js.includes(callNew)) {
  js = js.replace(callOld, callNew);
  console.log("[nuclear] occlusion caller patched");
}

// ── 3. Write dual paths ──────────────────────────────────────────
writeFileSync(SRC, js);
writeFileSync(OUT, js);
copyFileSync(OUT, join(ROOT, OUT_NAME));
// Keep fix3 filename copy for any hard links
copyFileSync(OUT, join(ROOT, "index-warlord-fix3.js"));
console.log("[nuclear] wrote", OUT_NAME, js.length, "bytes");

// ── 4. index.html → new filename ─────────────────────────────────
let html = readFileSync(INDEX, "utf8");
// Replace any prior warlord script tag
html = html.replace(
  /src="\/assets\/index-warlord-[^"]+"/g,
  `src="/assets/${OUT_NAME}?v=95"`,
);
if (!html.includes(OUT_NAME)) {
  // Fallback: inject before </head>
  html = html.replace(
    "</head>",
    `    <script type="module" crossorigin src="/assets/${OUT_NAME}?v=95"></script>\n  </head>`,
  );
}
if (!html.includes('http-equiv="Cache-Control"')) {
  html = html.replace(
    '<meta charset="UTF-8" />',
    `<meta charset="UTF-8" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />`,
  );
}
writeFileSync(INDEX, html);
console.log("[nuclear] index.html →", (html.match(/index-warlord-[^"']+/) || [])[0]);

// Sanity
if (js.includes(marker) && js.includes("A.camera===null&&PI(")) {
  console.error("[nuclear] FAIL: throw still present");
  process.exit(1);
}
if (!js.includes("gw-sprite-safe")) {
  console.error("[nuclear] FAIL: safety marker missing");
  process.exit(1);
}
console.log("[nuclear] OK — hard-refresh will load a NEW filename browsers cannot confuse with v=91");
