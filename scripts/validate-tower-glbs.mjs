#!/usr/bin/env node
/** Fail predeploy if any bundled tower GLB is not Khronos-standard (JSON chunk @ offset 16). */
import fs from "node:fs";
import path from "node:path";

function isStandardGlb(buf) {
  return buf.length >= 20 && buf.toString("utf8", 0, 4) === "glTF" && buf.slice(16, 20).toString("utf8") === "JSON";
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith(".glb")) files.push(p);
  }
  return files;
}

const root = path.join(import.meta.dirname, "..", "models", "towers");
let bad = 0;
for (const file of walk(root)) {
  const buf = fs.readFileSync(file);
  if (!isStandardGlb(buf)) {
    console.error("[validate-glb] NOT standard:", file, "JSON@", buf.indexOf("JSON"));
    bad++;
  }
}
if (bad) {
  console.error(`[validate-glb] ${bad} tower GLB(s) need fix-glb-header — run: npm run assets:fix-glb`);
  process.exit(1);
}
console.log("[validate-glb] all tower GLBs are Khronos-standard");