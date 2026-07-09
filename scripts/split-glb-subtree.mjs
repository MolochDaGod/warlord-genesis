#!/usr/bin/env node
/**
 * Extract one named node subtree from a GLB (Khronos layout) without external deps.
 */
import fs from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [src, dst, keepNode] = process.argv.slice(2);
if (!src || !dst || !keepNode) {
  console.error("usage: node split-glb-subtree.mjs <in.glb> <out.glb> <NodeName>");
  process.exit(1);
}

function readGlb(path) {
  const buf = fs.readFileSync(path);
  if (buf.toString("utf8", 0, 4) !== "glTF") throw new Error("not glb: " + path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  let bin = null;
  let off = 20 + jsonLen;
  if (off + 8 <= buf.length && buf.slice(off + 4, off + 8).toString("utf8") === "BIN\u0000") {
    const binLen = buf.readUInt32LE(off);
    bin = buf.slice(off + 8, off + 8 + binLen);
  }
  return { json, bin };
}

function writeGlb(path, json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
  const binChunk = bin || Buffer.alloc(0);
  const binPad = (4 - (binChunk.length % 4)) % 4;
  const binPadded = Buffer.concat([binChunk, Buffer.alloc(binPad)]);
  const total = 12 + 8 + jsonChunk.length + (binPadded.length ? 8 + binPadded.length : 0);
  const out = Buffer.alloc(total);
  out.write("glTF", 0, "utf8");
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonChunk.length, 12);
  out.write("JSON", 16, "utf8");
  jsonChunk.copy(out, 20);
  let o = 20 + jsonChunk.length;
  if (binPadded.length) {
    out.writeUInt32LE(binPadded.length, o);
    out.write("BIN\u0000", o + 4, "utf8");
    binPadded.copy(out, o + 8);
  }
  mkdirSync(dirname(path), { recursive: true });
  fs.writeFileSync(path, out);
}

function collectSubtree(nodes, rootIdx) {
  const keep = new Set([rootIdx]);
  const q = [rootIdx];
  while (q.length) {
    const n = nodes[q.shift()];
    for (const c of n.children || []) {
      if (!keep.has(c)) {
        keep.add(c);
        q.push(c);
      }
    }
  }
  return keep;
}

function remapIndices(oldToNew, idx) {
  return idx == null ? idx : oldToNew.get(idx);
}

function remapList(oldToNew, list) {
  return list?.map((i) => oldToNew.get(i)).filter((i) => i != null);
}

const { json, bin } = readGlb(src);
const nodes = json.nodes || [];
const rootIdx = nodes.findIndex((n) => n.name === keepNode);
if (rootIdx < 0) throw new Error("Node not found: " + keepNode);

const keepNodes = collectSubtree(nodes, rootIdx);
const oldToNewNode = new Map();
const newNodes = [];
for (let i = 0; i < nodes.length; i++) {
  if (!keepNodes.has(i)) continue;
  oldToNewNode.set(i, newNodes.length);
  const n = { ...nodes[i] };
  if (n.children) n.children = n.children.filter((c) => keepNodes.has(c)).map((c) => oldToNewNode.get(c) ?? c);
  newNodes.push(n);
}

const usedMeshes = new Set(newNodes.map((n) => n.mesh).filter((m) => m != null));
const meshes = (json.meshes || []).filter((_, i) => usedMeshes.has(i));
const oldToNewMesh = new Map();
let mi = 0;
for (let i = 0; i < (json.meshes || []).length; i++) {
  if (usedMeshes.has(i)) oldToNewMesh.set(i, mi++);
}
for (const n of newNodes) n.mesh = remapIndices(oldToNewMesh, n.mesh);

const usedAccessors = new Set();
const usedMaterials = new Set();
for (const mesh of meshes) {
  for (const prim of mesh.primitives || []) {
    if (prim.attributes) Object.values(prim.attributes).forEach((a) => usedAccessors.add(a));
    if (prim.indices != null) usedAccessors.add(prim.indices);
    if (prim.material != null) usedMaterials.add(prim.material);
  }
}

const materials = (json.materials || []).filter((_, i) => usedMaterials.has(i));
const oldToNewMat = new Map();
let mai = 0;
for (let i = 0; i < (json.materials || []).length; i++) {
  if (usedMaterials.has(i)) oldToNewMat.set(i, mai++);
}
for (const mesh of meshes) {
  for (const prim of mesh.primitives || []) prim.material = remapIndices(oldToNewMat, prim.material);
}

for (const mat of materials) {
  const pbr = mat.pbrMetallicRoughness || {};
  if (pbr.baseColorTexture?.index != null) usedAccessors.add(pbr.baseColorTexture.index);
  if (mat.normalTexture?.index != null) usedAccessors.add(mat.normalTexture.index);
  if (mat.emissiveTexture?.index != null) usedAccessors.add(mat.emissiveTexture.index);
}

const accessors = (json.accessors || []).filter((_, i) => usedAccessors.has(i));
const oldToNewAcc = new Map();
let ai = 0;
for (let i = 0; i < (json.accessors || []).length; i++) {
  if (usedAccessors.has(i)) oldToNewAcc.set(i, ai++);
}

const usedBufferViews = new Set();
for (const acc of accessors) if (acc.bufferView != null) usedBufferViews.add(acc.bufferView);
for (const mat of materials) {
  const pbr = mat.pbrMetallicRoughness || {};
  const texIdx = [pbr.baseColorTexture?.index, mat.normalTexture?.index, mat.emissiveTexture?.index].filter((x) => x != null);
  for (const t of texIdx) {
    const img = json.textures?.[json.materials ? json.textures?.[t] : t];
  }
}

for (let i = 0; i < (json.accessors || []).length; i++) {
  if (!usedAccessors.has(i)) continue;
  const acc = json.accessors[i];
  if (acc.bufferView != null) usedBufferViews.add(acc.bufferView);
  if (acc.sparse) {
    if (acc.sparse.indices?.bufferView != null) usedBufferViews.add(acc.sparse.indices.bufferView);
    if (acc.sparse.values?.bufferView != null) usedBufferViews.add(acc.sparse.values.bufferView);
  }
}

const usedImages = new Set();
for (const mat of materials) {
  const remapTex = (tex) => {
    if (!tex || tex.index == null) return;
    const texture = json.textures?.[tex.index];
    if (texture?.source != null) usedImages.add(texture.source);
    tex.index = remapIndices(oldToNewTex, tex.index);
  };
};
const usedTextures = new Set();
for (let i = 0; i < (json.textures || []).length; i++) {
  const t = json.textures[i];
  if (t.source != null && usedImages.has(t.source)) usedTextures.add(i);
  if (t.extensions?.KHR_texture_basisu?.source != null && usedImages.has(t.extensions.KHR_texture_basisu.source)) usedTextures.add(i);
}
// textures from materials
for (let mi2 = 0; mi2 < (json.materials || []).length; mi2++) {
  if (!usedMaterials.has(mi2)) continue;
  const mat = json.materials[mi2];
  const pbr = mat.pbrMetallicRoughness || {};
  for (const key of ["baseColorTexture", "metallicRoughnessTexture"]) {
    const tex = pbr[key];
    if (tex?.index != null) usedTextures.add(tex.index);
  }
  if (mat.normalTexture?.index != null) usedTextures.add(mat.normalTexture.index);
  if (mat.emissiveTexture?.index != null) usedTextures.add(mat.emissiveTexture.index);
}
for (const ti of usedTextures) {
  const t = json.textures[ti];
  if (t?.source != null) usedImages.add(t.source);
  if (t?.extensions?.KHR_texture_basisu?.source != null) usedImages.add(t.extensions.KHR_texture_basisu.source);
}

for (const ti of usedTextures) {
  const t = json.textures[ti];
  if (t?.source != null && t.extensions?.KHR_texture_basisu?.source != null) {
    // both may share
  }
  if (t?.source != null) {
    const img = json.images?.[t.source];
    if (img?.bufferView != null) usedBufferViews.add(img.bufferView);
  }
  if (t?.extensions?.KHR_texture_basisu?.source != null) {
    const img = json.images?.[t.extensions.KHR_texture_basisu.source];
    if (img?.bufferView != null) usedBufferViews.add(img.bufferView);
  }
}

const bufferViews = (json.bufferViews || []).filter((_, i) => usedBufferViews.has(i));
const oldToNewBV = new Map();
let bvi = 0;
for (let i = 0; i < (json.bufferViews || []).length; i++) {
  if (usedBufferViews.has(i)) oldToNewBV.set(i, bvi++);
}

const newAccessors = (json.accessors || [])
  .map((acc, i) => {
    if (!usedAccessors.has(i)) return null;
    const a = { ...acc };
    a.bufferView = remapIndices(oldToNewBV, a.bufferView);
    if (a.sparse) {
      a.sparse = { ...a.sparse };
      if (a.sparse.indices) a.sparse.indices = { ...a.sparse.indices, bufferView: remapIndices(oldToNewBV, a.sparse.indices.bufferView) };
      if (a.sparse.values) a.sparse.values = { ...a.sparse.values, bufferView: remapIndices(oldToNewBV, a.sparse.values.bufferView) };
    }
    return a;
  })
  .filter(Boolean);

for (const mesh of meshes) {
  for (const prim of mesh.primitives || []) {
    if (prim.attributes) {
      const attrs = {};
      for (const [k, v] of Object.entries(prim.attributes)) attrs[k] = oldToNewAcc.get(v);
      prim.attributes = attrs;
    }
    if (prim.indices != null) prim.indices = oldToNewAcc.get(prim.indices);
  }
}

const oldToNewTex = new Map();
const textures = (json.textures || []).filter((_, i) => usedTextures.has(i));
let ti2 = 0;
for (let i = 0; i < (json.textures || []).length; i++) {
  if (usedTextures.has(i)) oldToNewTex.set(i, ti2++);
}
for (const mat of materials) {
  const pbr = mat.pbrMetallicRoughness || {};
  if (pbr.baseColorTexture) pbr.baseColorTexture.index = remapIndices(oldToNewTex, pbr.baseColorTexture.index);
  if (mat.normalTexture) mat.normalTexture.index = remapIndices(oldToNewTex, mat.normalTexture.index);
  if (mat.emissiveTexture) mat.emissiveTexture.index = remapIndices(oldToNewTex, mat.emissiveTexture.index);
}

const images = (json.images || []).filter((_, i) => usedImages.has(i));
const oldToNewImg = new Map();
let ii = 0;
for (let i = 0; i < (json.images || []).length; i++) {
  if (usedImages.has(i)) oldToNewImg.set(i, ii++);
}
for (const t of textures) {
  t.source = remapIndices(oldToNewImg, t.source);
  if (t.extensions?.KHR_texture_basisu) {
    t.extensions = { ...t.extensions, KHR_texture_basisu: { ...t.extensions.KHR_texture_basisu, source: remapIndices(oldToNewImg, t.extensions.KHR_texture_basisu.source) } };
  }
}
for (const img of images) img.bufferView = remapIndices(oldToNewBV, img.bufferView);

let newBin = null;
if (bin && bufferViews.length) {
  newBin = Buffer.alloc(bufferViews.reduce((s, bv) => s + bv.byteLength + ((4 - (bv.byteLength % 4)) % 4), 0));
  let dstOff = 0;
  const bvRemap = bufferViews.map((bv, newIdx) => {
    const oldIdx = [...oldToNewBV.entries()].find(([, v]) => v === newIdx)?.[0];
    const oldBv = json.bufferViews[oldIdx];
    const slice = bin.slice(oldBv.byteOffset, oldBv.byteOffset + oldBv.byteLength);
    slice.copy(newBin, dstOff);
    const out = { ...bv, byteOffset: dstOff, byteLength: slice.length };
    dstOff += slice.length;
    const pad = (4 - (slice.length % 4)) % 4;
    dstOff += pad;
    return out;
  });
  writeGlb(dst, {
    ...json,
    scenes: [{ nodes: [0] }],
    nodes: newNodes.map((n, idx) => (idx === 0 ? { ...n, children: n.children } : n)),
    meshes,
    materials,
    accessors: newAccessors,
    bufferViews: bvRemap,
    textures,
    images,
    buffers: [{ byteLength: newBin.length }],
  }, newBin);
} else {
  writeGlb(dst, {
    ...json,
    scenes: [{ nodes: [0] }],
    nodes: newNodes,
    meshes,
    materials,
    accessors: newAccessors,
    bufferViews,
    textures,
    images,
    buffers: json.buffers ? [{ byteLength: bin?.length || json.buffers[0]?.byteLength || 0 }] : undefined,
  }, bin);
}

console.log("[split-glb]", keepNode, "->", dst);