/**
 * Strip absolute / external image URIs from GLB JSON chunks.
 * Warlord-genesis tower models ship with Assimp-exported Windows paths;
 * the game applies atlas.png at runtime — embedded refs only spam errors.
 */
import fs from "fs";
import path from "path";

function stripGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  const magic = buf.toString("utf8", 0, 4);
  if (magic !== "glTF") {
    throw new Error(`Not a GLB: ${filePath}`);
  }

  const jsonLen = buf.readUInt32LE(12);
  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLen;
  const json = JSON.parse(buf.slice(jsonStart, jsonEnd).toString("utf8"));

  let changed = false;
  if (Array.isArray(json.images) && json.images.length > 0) {
    const bad = json.images.filter(
      (img) =>
        img.uri &&
        (/^[A-Za-z]:\\/.test(img.uri) ||
          img.uri.includes("OneDrive") ||
          img.uri.includes("arnoldV") ||
          img.uri.includes("Military_facilities")),
    );
    if (bad.length > 0) {
      json.images = [];
      if (Array.isArray(json.textures)) json.textures = [];
      for (const mat of json.materials ?? []) {
        const pbr = mat.pbrMetallicRoughness;
        if (pbr?.baseColorTexture) delete pbr.baseColorTexture;
        if (mat.normalTexture) delete mat.normalTexture;
        if (mat.occlusionTexture) delete mat.occlusionTexture;
        if (mat.emissiveTexture) delete mat.emissiveTexture;
      }
      changed = true;
    }
  }

  if (!changed) {
    return { changed: false, filePath };
  }

  const newJson = Buffer.from(JSON.stringify(json));
  const paddedLen = Math.ceil(newJson.length / 4) * 4;
  const padded = Buffer.alloc(paddedLen, 0x20);
  newJson.copy(padded);

  const binChunk = buf.slice(jsonEnd);
  const totalLen = 12 + 8 + paddedLen + binChunk.length;
  const out = Buffer.alloc(totalLen);
  out.writeUInt32LE(totalLen, 0);
  out.write("glTF", 4);
  out.writeUInt32LE(2, 8);
  out.writeUInt32LE(paddedLen, 12);
  out.write("JSON", 16);
  padded.copy(out, 20);
  binChunk.copy(out, 20 + paddedLen);
  fs.writeFileSync(filePath, out);
  return { changed: true, filePath };
}

const root = process.argv[2] ?? ".";
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".glb")) files.push(p);
  }
}
walk(root);

let fixed = 0;
for (const f of files) {
  const r = stripGlb(f);
  if (r.changed) {
    fixed++;
    console.log("fixed:", f);
  }
}
console.log(`Done — ${fixed}/${files.length} GLBs patched`);