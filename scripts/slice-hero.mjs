#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const j = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "index-warlord-fix2.js"), "utf8");

function slice(name, len = 3500) {
  const i = j.indexOf(`function ${name}(`);
  if (i < 0) return console.log(name, "MISSING");
  let braces = 0,
    started = false;
  for (let k = i; k < j.length; k++) {
    if (j[k] === "{") {
      braces++;
      started = true;
    }
    if (j[k] === "}") {
      braces--;
      if (started && braces === 0) {
        const body = j.slice(i, k + 1);
        console.log(`\n=== ${name} (${body.length}) ===\n${body.slice(0, len)}`);
        if (body.length > len) console.log("\n...TAIL...\n", body.slice(-800));
        return;
      }
    }
  }
}

for (const n of ["HAA", "ah", "OK", "forPlayer"]) slice(n, 4000);

for (const n of [
  "v6",
  "L6",
  "_6",
  "xAA",
  "bAA",
  "K6",
  "OK",
  "T6",
  "IIA",
  "gIA",
  "RIA",
  "LIA",
  "TIA",
  "HIA",
  "vIA",
  "UAA",
  "hAA",
  "yAA",
]) slice(n, 2000);

const needles = ["CylinderGeometry", "new sQ(", "cylinder", "placeholder", "fallbackMesh", "gw-hero-proxy"];
for (const n of needles) {
  let idx = 0,
    c = 0;
  while ((idx = j.indexOf(n, idx)) >= 0 && c < 3) {
    console.log(`\n[${n}@${idx}]`, j.slice(idx - 60, idx + 120).replace(/\s+/g, " "));
    idx++;
    c++;
  }
}