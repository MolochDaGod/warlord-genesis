import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HERO_PRESETS } from "../src/game/anim/presets.ts";
import { VoxelCharacter } from "../src/game/anim/rig.ts";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

THREE.ColorManagement.enabled = false;

// GLTFExporter (binary) converts its output Blob via FileReader, which Node lacks.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  error: unknown = null;
  onloadend: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((ab) => {
        this.result = ab;
        this.onloadend?.();
      })
      .catch((e) => {
        this.error = e;
        this.onerror?.(e);
      });
  }
  readAsDataURL(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((ab) => {
        const type = blob.type || "application/octet-stream";
        this.result = `data:${type};base64,${Buffer.from(ab).toString("base64")}`;
        this.onloadend?.();
      })
      .catch((e) => {
        this.error = e;
        this.onerror?.(e);
      });
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.resolve(here, "..");
const repoRoot = path.resolve(artifactRoot, "..", "..");
const fbxPath = path.join(
  artifactRoot,
  "public/anim/animations/bow/unarmed-idle-01.fbx",
);
const outDir = path.join(repoRoot, "attached_assets/tpose");
mkdirSync(outDir, { recursive: true });

function loadSkeletonSource(): THREE.Object3D {
  const buf = readFileSync(fbxPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new FBXLoader().parse(ab as ArrayBuffer, "");
}

/** Force a clean, symmetric T-pose by aiming the arm chain straight out (+/-X). */
function tPose(ch: VoxelCharacter): void {
  ch.root.updateMatrixWorld(true);
  const aim = (boneName: string, childName: string, targetDir: THREE.Vector3) => {
    const bone = ch.getBone(boneName);
    const child = ch.getBone(childName);
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    const head = bone.getWorldPosition(new THREE.Vector3());
    const tail = child.getWorldPosition(new THREE.Vector3());
    const cur = tail.sub(head).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(cur, targetDir);
    const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
    const newWorld = delta.multiply(worldQ);
    const parent = bone.parent;
    const parentWorldQ = parent
      ? parent.getWorldQuaternion(new THREE.Quaternion())
      : new THREE.Quaternion();
    bone.quaternion.copy(parentWorldQ.invert().multiply(newWorld));
    bone.updateMatrixWorld(true);
  };
  const L = new THREE.Vector3(1, 0, 0);
  const R = new THREE.Vector3(-1, 0, 0);
  aim("mixamorigLeftArm", "mixamorigLeftForeArm", L);
  aim("mixamorigLeftForeArm", "mixamorigLeftHand", L);
  aim("mixamorigRightArm", "mixamorigRightForeArm", R);
  aim("mixamorigRightForeArm", "mixamorigRightHand", R);
  ch.root.updateMatrixWorld(true);
}

function diagnose(ch: VoxelCharacter, label: string): void {
  ch.root.updateMatrixWorld(true);
  const g = (n: string) =>
    ch.getBone(n)?.getWorldPosition(new THREE.Vector3());
  const arm = g("mixamorigLeftArm");
  const fore = g("mixamorigLeftForeArm");
  const hand = g("mixamorigLeftHand");
  const f = (v?: THREE.Vector3) =>
    v ? `(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})` : "n/a";
  console.log(`  ${label}: arm${f(arm)} fore${f(fore)} hand${f(hand)}`);
}

/** Flatten the box rig into a single vertex-coloured T-pose mesh (no skeleton). */
function bake(ch: VoxelCharacter): THREE.Mesh {
  ch.root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  ch.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.geometry as THREE.BufferGeometry;
    const geo = src.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    for (const key of Object.keys(geo.attributes)) {
      if (key !== "position" && key !== "normal") geo.deleteAttribute(key);
    }
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const col = mat.color;
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(geo);
  });
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("merge failed");
  return new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0,
    }),
  );
}

async function exportGlb(scene: THREE.Object3D, out: string): Promise<void> {
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (r) => resolve(r as ArrayBuffer),
      (e) => reject(e),
      { binary: true, onlyVisible: true },
    );
  });
  writeFileSync(out, Buffer.from(result));
}

async function main(): Promise<void> {
  const source = loadSkeletonSource();
  console.log("Loaded skeleton FBX.");
  for (const preset of HERO_PRESETS) {
    const ch = new VoxelCharacter(source, preset.look, preset.height);
    diagnose(ch, `${preset.id} bind`);
    tPose(ch);
    diagnose(ch, `${preset.id} tpose`);
    const mesh = bake(ch);
    const scene = new THREE.Scene();
    scene.name = `${preset.name}_TPose`;
    mesh.name = `${preset.name}`;
    scene.add(mesh);
    const out = path.join(outDir, `grudge-${preset.id}-tpose.glb`);
    await exportGlb(scene, out);
    const tris = (mesh.geometry.attributes.position.count / 3) | 0;
    console.log(`  wrote ${path.relative(repoRoot, out)} (${tris} tris)`);
    ch.dispose();
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
