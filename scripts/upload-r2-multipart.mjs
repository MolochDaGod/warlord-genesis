#!/usr/bin/env node
/**
 * Multipart R2 upload via S3 API — for files that crash wrangler on Windows
 * (UV_HANDLE_CLOSING on large puts).
 *
 * Loads R2_* from GrudgeBuilder/.env (or env). Never prints secrets.
 *
 *   node scripts/upload-r2-multipart.mjs
 *   node scripts/upload-r2-multipart.mjs --only=smeltery
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// Prefer GrudgeBuilder's installed AWS SDK (has lib-storage)
const SDK_ROOTS = [
  "F:/GitHub/GrudgeBuilder/node_modules",
  "F:/GitHub/gameopen/node_modules",
  path.join(ROOT, "node_modules"),
];

function loadSdk() {
  for (const root of SDK_ROOTS) {
    try {
      const { S3Client } = require(path.join(root, "@aws-sdk/client-s3"));
      const { Upload } = require(path.join(root, "@aws-sdk/lib-storage"));
      return { S3Client, Upload, root };
    } catch {
      /* try next */
    }
  }
  throw new Error("Install @aws-sdk/client-s3 and @aws-sdk/lib-storage");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
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
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const fileEnv = {
  ...loadEnvFile("F:/GitHub/GrudgeBuilder/.env"),
  ...loadEnvFile(path.join(ROOT, ".env")),
};

const accountId =
  process.env.R2_ACCOUNT_ID ||
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  fileEnv.R2_ACCOUNT_ID ||
  fileEnv.CLOUDFLARE_ACCOUNT_ID ||
  "ee475864561b02d4588180b8b9acf694";
const accessKey =
  process.env.R2_ACCESS_KEY_ID || fileEnv.R2_ACCESS_KEY_ID;
const secretKey =
  process.env.R2_SECRET_ACCESS_KEY || fileEnv.R2_SECRET_ACCESS_KEY;
const bucket =
  process.env.R2_BUCKET || fileEnv.R2_BUCKET || "grudge-assets";

if (!accessKey || !secretKey) {
  console.error("Missing R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const { S3Client, Upload, root: sdkRoot } = loadSdk();
console.log(`SDK from ${sdkRoot}`);
console.log(`account=${accountId.slice(0, 6)}… bucket=${bucket}`);

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

/** Remaining fails + medium files that need reliable multipart */
const JOBS = [
  {
    key: "models/warlords-era/buildings/smeltery.glb",
    file: "models/warlords-era/buildings/smeltery.glb",
  },
  {
    key: "models/warlords-era/nature/rocks/stylised_rocks_pack.glb",
    file: "models/warlords-era/nature/rocks/stylised_rocks_pack.glb",
  },
  {
    key: "models/maps/arena3.glb",
    file: "models/maps/arena3.glb",
  },
  {
    key: "handoff/warlord-genesis/public/models/maps/arena3.glb",
    file: "_tmp_untracked/public/models/maps/arena3.glb",
  },
  {
    key: "handoff/warlord-genesis/public/models/warlords-era/buildings/smeltery.glb",
    file: "_tmp_untracked/public/models/warlords-era/buildings/smeltery.glb",
  },
  {
    key: "handoff/warlord-genesis/public/models/warlords-era/nature/rocks/stylised_rocks_pack.glb",
    file: "_tmp_untracked/public/models/warlords-era/nature/rocks/stylised_rocks_pack.glb",
  },
  {
    key: "handoff/warlord-genesis/public/models/warlords-era/nature/rocks/stylized_rocks_70.glb",
    file: "_tmp_untracked/public/models/warlords-era/nature/rocks/stylized_rocks_70.glb",
  },
  {
    key: "handoff/warlord-genesis/public/models/warlords-era/vehicles/steampunk_airship.glb",
    file: "_tmp_untracked/public/models/warlords-era/vehicles/steampunk_airship.glb",
  },
];

const only = (process.argv.find((a) => a.startsWith("--only=")) || "")
  .split("=")[1]
  ?.toLowerCase();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function putOnce(job) {
  const abs = path.join(ROOT, job.file);
  if (!fs.existsSync(abs)) {
    console.error(`MISSING ${job.file}`);
    return false;
  }
  const sizeMb = (fs.statSync(abs).size / 1024 / 1024).toFixed(1);
  console.log(`→ ${job.key} (${sizeMb} MB)`);
  const body = fs.createReadStream(abs);
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: job.key,
      Body: body,
      ContentType: "model/gltf-binary",
      CacheControl: "public, max-age=604800",
    },
    // Smaller parts + serial queue — more resilient to Windows SSL flakiness
    partSize: 8 * 1024 * 1024,
    queueSize: 1,
    leavePartsOnError: false,
  });
  upload.on("httpUploadProgress", (p) => {
    if (p.total) {
      const pct = ((100 * (p.loaded || 0)) / p.total).toFixed(0);
      process.stdout.write(`\r  ${pct}% ${job.key.slice(0, 60)}`);
    }
  });
  try {
    await upload.done();
    process.stdout.write("\n");
    console.log(`OK  ${job.key}`);
    return true;
  } catch (e) {
    process.stdout.write("\n");
    console.error(`FAIL ${job.key}: ${e.message}`);
    return false;
  }
}

async function putOne(job, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    if (await putOnce(job)) return true;
    const wait = 2000 * i;
    console.warn(`  retry ${i}/${attempts} in ${wait}ms…`);
    await sleep(wait);
  }
  return false;
}

const skipOk = process.argv.includes("--skip-known-ok");
const jobs = JOBS.filter((j) => !only || j.key.toLowerCase().includes(only)).filter(
  (j) =>
    !skipOk ||
    !j.key.endsWith("stylised_rocks_pack.glb") ||
    j.key.includes("handoff"),
);

let ok = 0;
let fail = 0;
for (const job of jobs) {
  // Skip canonical rocks pack if already live (first successful multipart)
  if (
    job.key === "models/warlords-era/nature/rocks/stylised_rocks_pack.glb" &&
    process.argv.includes("--resume")
  ) {
    console.log(`skip (resume) ${job.key}`);
    ok++;
    continue;
  }
  if (await putOne(job)) ok++;
  else fail++;
}
console.log(`\nDone ok=${ok} fail=${fail}`);
process.exit(fail ? 1 : 0);
