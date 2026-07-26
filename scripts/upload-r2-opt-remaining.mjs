#!/usr/bin/env node
/** Upload Draco-optimized residual keys (small) via S3 multipart */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { S3Client } = require("F:/GitHub/GrudgeBuilder/node_modules/@aws-sdk/client-s3");
const { Upload } = require("F:/GitHub/GrudgeBuilder/node_modules/@aws-sdk/lib-storage");

function loadEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    let k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

const e = loadEnv("F:/GitHub/GrudgeBuilder/.env");
const accountId =
  e.CLOUDFLARE_ACCOUNT_ID || e.R2_ACCOUNT_ID || "ee475864561b02d4588180b8b9acf694";
const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: e.R2_ACCESS_KEY_ID,
    secretAccessKey: e.R2_SECRET_ACCESS_KEY,
  },
});

const JOBS = [
  {
    key: "models/warlords-era/buildings/smeltery.glb",
    file: path.join(ROOT, "_r2_opt/smeltery.glb"),
  },
  {
    key: "models/maps/arena3.glb",
    file: path.join(ROOT, "_r2_opt/arena3.glb"),
  },
];

async function put(job) {
  for (let a = 1; a <= 5; a++) {
    try {
      console.log(`→ ${job.key} (${(fs.statSync(job.file).size / 1e6).toFixed(1)} MB) attempt ${a}`);
      const upload = new Upload({
        client,
        params: {
          Bucket: "grudge-assets",
          Key: job.key,
          Body: fs.createReadStream(job.file),
          ContentType: "model/gltf-binary",
          CacheControl: "public, max-age=604800",
        },
        partSize: 5 * 1024 * 1024,
        queueSize: 1,
      });
      await upload.done();
      console.log(`OK  ${job.key}`);
      return true;
    } catch (err) {
      console.error(`  fail: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2500 * a));
    }
  }
  return false;
}

let ok = 0,
  fail = 0;
for (const j of JOBS) {
  if (await put(j)) ok++;
  else fail++;
}
console.log(`Done ok=${ok} fail=${fail}`);
process.exit(fail ? 1 : 0);
