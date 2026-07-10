#!/usr/bin/env node
/**
 * Bake battlefield PBR maps for Warlord Genesis.
 *
 * Outputs under /textures:
 *   ground_diff.jpg  – multi-octave dirt/grass/rock albedo (sRGB)
 *   ground_nor.jpg   – tangent-space normal from height (linear)
 *   ground_rough.jpg – roughness grayscale (linear)
 *   ground_ao.jpg    – ambient occlusion from height curvature (linear)
 *   concrete_diff.jpg, metal_diff.jpg, metal_nor.jpg
 *
 * Runtime (WgPrepTerrainTextures) sets colorSpace / wrap / anisotropy.
 * Use --force to overwrite existing files.
 */
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "textures");
const SIZE = 1024;
const FORCE = process.argv.includes("--force");

mkdirSync(OUT, { recursive: true });

function h2(x, y, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y, seed) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = h2(x0, y0, seed),
    b = h2(x0 + 1, y0, seed),
    c = h2(x0, y0 + 1, seed),
    d = h2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y, seed, oct = 5) {
  let amp = 0.5,
    freq = 1,
    sum = 0,
    norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * smoothNoise(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

function sample(u, v, seed, oct = 5) {
  const w1 = fbm(u * 3, v * 3, seed + 3, 3);
  const w2 = fbm(u * 3 + 5.2, v * 3 + 1.3, seed + 7, 3);
  return fbm(u * 4 + w1 * 0.35, v * 4 + w2 * 0.35, seed, oct);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const SAND = [201, 168, 117];
const DIRT = [120, 92, 62];
const GRASS = [93, 107, 60];
const ROCK = [88, 90, 86];
const MOSS = [70, 96, 58];

function bakeGroundAlbedo(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const n = sample(u, v, 1, 6);
      const ridge = sample(u * 1.7, v * 1.7, 9, 4);
      const moist = sample(u * 2.3 + 0.2, v * 2.3, 14, 3);
      let col = mix3(DIRT, SAND, clamp01((n - 0.35) * 2.2));
      col = mix3(col, GRASS, clamp01((moist - 0.42) * 2.4));
      col = mix3(col, ROCK, clamp01((ridge - 0.62) * 2.8));
      col = mix3(col, MOSS, clamp01((moist - 0.7) * 1.8) * (1 - ridge));
      const grain = (h2(x, y, 99) - 0.5) * 18;
      const i = (y * size + x) * 4;
      rgba[i] = clamp01((col[0] + grain) / 255) * 255;
      rgba[i + 1] = clamp01((col[1] + grain * 0.9) / 255) * 255;
      rgba[i + 2] = clamp01((col[2] + grain * 0.7) / 255) * 255;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function bakeHeight(size, seed = 1) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const base = sample(u, v, seed, 6);
      const detail = sample(u * 3.5, v * 3.5, seed + 21, 4);
      const rock = Math.pow(sample(u * 1.4, v * 1.4, seed + 8, 4), 1.6);
      h[y * size + x] = base * 0.55 + detail * 0.25 + rock * 0.35;
    }
  }
  return h;
}

function bakeNormal(height, size, strength = 2.4) {
  const rgba = Buffer.alloc(size * size * 4);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx,
        ny = -dy,
        nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      rgba[i] = (nx * 0.5 + 0.5) * 255;
      rgba[i + 1] = (ny * 0.5 + 0.5) * 255;
      rgba[i + 2] = (nz * 0.5 + 0.5) * 255;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function bakeRoughness(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const rock = sample(u * 1.4, v * 1.4, 9, 4);
      const moist = sample(u * 2.3, v * 2.3, 14, 3);
      const r = clamp01(0.88 - rock * 0.22 - moist * 0.08 + (h2(x, y, 3) - 0.5) * 0.06);
      const g8 = r * 255;
      const i = (y * size + x) * 4;
      rgba[i] = g8;
      rgba[i + 1] = g8;
      rgba[i + 2] = g8;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function bakeAO(height, size) {
  const rgba = Buffer.alloc(size * size * 4);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h0 = at(x, y);
      let acc = 0,
        w = 0;
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          if (!ox && !oy) continue;
          const d = Math.hypot(ox, oy);
          acc += Math.max(0, at(x + ox, y + oy) - h0) / d;
          w += 1 / d;
        }
      }
      const occ = clamp01(1 - (acc / (w || 1)) * 1.8);
      const g8 = (0.55 + occ * 0.45) * 255;
      const i = (y * size + x) * 4;
      rgba[i] = g8;
      rgba[i + 1] = g8;
      rgba[i + 2] = g8;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function bakeConcrete(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const n = sample(u, v, 40, 5);
      const crack = Math.pow(sample(u * 6, v * 6, 44, 3), 4);
      const base = 118 + n * 28 - crack * 40;
      const i = (y * size + x) * 4;
      rgba[i] = clamp01(base / 255) * 255;
      rgba[i + 1] = clamp01((base - 2) / 255) * 255;
      rgba[i + 2] = clamp01((base + 4) / 255) * 255;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function bakeMetalDiff(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      const n = sample(u * 2, v * 2, 60, 4);
      const scratch = sample(u * 12, v * 0.4, 66, 2);
      const base = 90 + n * 40 + scratch * 20;
      const i = (y * size + x) * 4;
      rgba[i] = clamp01(base / 255) * 255;
      rgba[i + 1] = clamp01((base + 6) / 255) * 255;
      rgba[i + 2] = clamp01((base + 12) / 255) * 255;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

function writePNG(path, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = deflateSync(raw, { level: 6 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const mkChunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crcBuf]);
  };
  writeFileSync(
    path,
    Buffer.concat([
      signature,
      mkChunk("IHDR", ihdr),
      mkChunk("IDAT", compressed),
      mkChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function writeJpegViaPS(path, width, height, rgba) {
  const tmpPng = path.replace(/\.jpe?g$/i, ".tmp.png");
  writePNG(tmpPng, width, height, rgba);
  const esc = (p) => p.replace(/\\/g, "\\\\");
  const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${esc(tmpPng)}')
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$enc = New-Object System.Drawing.Imaging.EncoderParameters(1)
$enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 88L)
$img.Save('${esc(path)}', $codec, $enc)
$img.Dispose()
Remove-Item -Force '${esc(tmpPng)}' -ErrorAction SilentlyContinue
`;
  const res = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  if (res.status !== 0 || !existsSync(path)) {
    try {
      unlinkSync(tmpPng);
    } catch {}
    writePNG(path.replace(/\.jpe?g$/i, ".png"), width, height, rgba);
    console.warn("[bake-map] JPEG failed for", path, "— wrote PNG fallback");
    return false;
  }
  return true;
}

function writeMap(name, rgba, size) {
  const path = join(OUT, name);
  if (existsSync(path) && !FORCE) {
    console.log(`[bake-map] skip existing ${name}`);
    return;
  }
  const ok = writeJpegViaPS(path, size, size, rgba);
  const sha = createHash("sha256").update(rgba).digest("hex").slice(0, 10);
  console.log(`[bake-map] ${name} ${size}×${size} sha=${sha} jpeg=${ok}`);
}

console.log("[bake-map] baking terrain PBR @", SIZE, FORCE ? "(force)" : "");
const albedo = bakeGroundAlbedo(SIZE);
const height = bakeHeight(SIZE);
writeMap("ground_diff.jpg", albedo, SIZE);
writeMap("ground_nor.jpg", bakeNormal(height, SIZE, 2.6), SIZE);
writeMap("ground_rough.jpg", bakeRoughness(SIZE), SIZE);
writeMap("ground_ao.jpg", bakeAO(height, SIZE), SIZE);

const S2 = 512;
writeMap("concrete_diff.jpg", bakeConcrete(S2), S2);
writeMap("metal_diff.jpg", bakeMetalDiff(S2), S2);
writeMap("metal_nor.jpg", bakeNormal(bakeHeight(S2, 60), S2, 1.8), S2);

const manifest = {
  version: 1,
  bakedAt: new Date().toISOString(),
  size: SIZE,
  maps: [
    "ground_diff.jpg",
    "ground_nor.jpg",
    "ground_rough.jpg",
    "ground_ao.jpg",
    "concrete_diff.jpg",
    "metal_diff.jpg",
    "metal_nor.jpg",
  ],
  colorSpace: {
    ground_diff: "srgb",
    ground_nor: "linear",
    ground_rough: "linear",
    ground_ao: "linear",
  },
  physics: {
    terrainLayer: "Terrain",
    collision: "heightfield + wall cuboids",
  },
};
writeFileSync(join(OUT, "map-bake-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("[bake-map] done → textures/map-bake-manifest.json");
