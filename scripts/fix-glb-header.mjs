#!/usr/bin/env node
/**
 * Normalize Assimp-exported GLBs for Three.js GLTFLoader.
 * 1) Strip optional 4-byte file-size prefix before magic.
 * 2) Re-wrap non-Khronos chunk layout into standard GLB v2 containers.
 */
import fs from "node:fs";
import path from "node:path";

function stripSizePrefix(buf) {
  if (buf.length >= 8 && buf.toString("utf8", 0, 4) !== "glTF" && buf.toString("utf8", 4, 8) === "glTF") {
    return buf.subarray(4);
  }
  return buf;
}

function isStandardGlb(buf) {
  if (buf.length < 20 || buf.toString("utf8", 0, 4) !== "glTF") return false;
  const jsonType = buf.slice(16, 20).toString("utf8");
  return jsonType === "JSON";
}

function convertAssimpGlb(buf) {
  buf = stripSizePrefix(buf);
  if (isStandardGlb(buf)) return { buf, changed: false };

  if (buf.toString("utf8", 0, 4) !== "glTF") {
    throw new Error("missing glTF magic");
  }

  const jsonMarker = buf.indexOf("JSON");
  if (jsonMarker < 0) throw new Error("JSON chunk marker not found");

  const jsonStart = jsonMarker + 4;
  const jsonText = buf.slice(jsonStart).toString("utf8");
  let depth = 0;
  let jsonEnd = -1;
  for (let i = 0; i < jsonText.length; i++) {
    const c = jsonText[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }
  if (jsonEnd < 0) throw new Error("could not parse JSON chunk");

  const jsonBytes = Buffer.from(jsonText.slice(0, jsonEnd), "utf8");
  JSON.parse(jsonBytes.toString("utf8"));

  const paddedLen = Math.ceil(jsonBytes.length / 4) * 4;
  const paddedJson = Buffer.alloc(paddedLen, 0x20);
  jsonBytes.copy(paddedJson);

  const binRegionStart = jsonStart + paddedLen;
  const binMarker = buf.indexOf("BIN\0", binRegionStart);
  if (binMarker < 0) throw new Error("BIN chunk marker not found");

  const binChunkLen = buf.readUInt32LE(binMarker - 4);
  const binChunk = buf.subarray(binMarker - 4, binMarker - 4 + 8 + binChunkLen);

  const totalLen = 12 + 8 + paddedLen + binChunk.length;
  const out = Buffer.alloc(totalLen);
  out.write("glTF", 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);
  out.writeUInt32LE(paddedLen, 12);
  out.write("JSON", 16);
  paddedJson.copy(out, 20);
  binChunk.copy(out, 20 + paddedLen);
  return { buf: out, changed: true };
}

function fixFile(filePath) {
  const original = fs.readFileSync(filePath);
  const { buf, changed } = convertAssimpGlb(original);
  if (!changed) return false;
  if (!isStandardGlb(buf)) throw new Error(`conversion failed: ${filePath}`);
  fs.writeFileSync(filePath, buf);
  return true;
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (ent.name.endsWith(".glb") && !ent.name.endsWith(".fixed.glb")) files.push(p);
  }
  return files;
}

const root = process.argv[2] ?? path.join(import.meta.dirname, "..", "models", "towers");
let fixed = 0;
for (const file of walk(root)) {
  if (fixFile(file)) {
    console.log("[fix-glb-header]", file);
    fixed++;
  }
}
console.log(`[fix-glb-header] normalized ${fixed} files under ${root}`);