/**
 * Shared glTF 2.0 scene prep. Environment kits use isolateMeshes() so we never
 * dump a whole Sketchfab cluster onto a lane pad.
 */
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export interface GltfFitOpts {
  height?: number;
  maxDim?: number;
  shadows?: boolean;
  keepMaterials?: boolean;
}

export interface IsolatedMesh {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  size: THREE.Vector3;
}

export function cloneGltfScene(scene: THREE.Object3D): THREE.Object3D {
  const root = cloneSkeleton(scene);
  root.parent = null;
  return root;
}

export function prepareGltfMaterials(root: THREE.Object3D, keep = true): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm) continue;
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.needsUpdate = true;
      }
      if (sm.emissiveMap) {
        sm.emissiveMap.colorSpace = THREE.SRGBColorSpace;
        sm.emissiveMap.needsUpdate = true;
      }
      if (sm.normalMap) sm.normalMap.colorSpace = THREE.NoColorSpace;
      if (sm.metalnessMap) sm.metalnessMap.colorSpace = THREE.NoColorSpace;
      if (sm.roughnessMap) sm.roughnessMap.colorSpace = THREE.NoColorSpace;
      if (sm.aoMap) sm.aoMap.colorSpace = THREE.NoColorSpace;
      if (!keep && "side" in sm) sm.side = THREE.FrontSide;
      sm.needsUpdate = true;
    }
  });
}

export function isolateMeshes(scene: THREE.Object3D, opts?: { minDim?: number }): IsolatedMesh[] {
  const out: IsolatedMesh[] = [];
  const minDim = opts?.minDim ?? 0.08;
  scene.updateWorldMatrix(true, true);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    if (!box) return;
    const size0 = box.getSize(new THREE.Vector3());
    if (Math.max(size0.x, size0.y, size0.z) < minDim) return;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    geo.translate(-cx, -box.min.y, -cz);
    geo.computeBoundingBox();
    geo.computeVertexNormals();
    const size = geo.boundingBox?.getSize(new THREE.Vector3()) ?? size0;
    const mats = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : (m.material as THREE.Material).clone();
    const probe = Array.isArray(mats) ? mats : [mats];
    for (const mat of probe) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.map) sm.map.colorSpace = THREE.SRGBColorSpace;
    }
    out.push({ name: m.name || `mesh_${out.length}`, geometry: geo, material: mats, size });
  });
  out.sort((a, b) => b.size.y * b.size.x - a.size.y * a.size.x);
  return out;
}

export function fitGltfRoot(root: THREE.Object3D, opts: GltfFitOpts = {}): void {
  const targetH = opts.height ?? 5.6;
  root.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let hy = Math.max(size.y, 0.001);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > (opts.maxDim ?? 40)) {
    root.scale.multiplyScalar(0.01);
    root.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(root);
    box.getSize(size);
    hy = Math.max(size.y, 0.001);
  }
  root.scale.multiplyScalar(THREE.MathUtils.clamp(targetH / hy, 0.002, 12));
  root.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(root);
  root.position.x -= (box.min.x + box.max.x) / 2;
  root.position.y -= box.min.y;
  root.position.z -= (box.min.z + box.max.z) / 2;
  if (opts.shadows !== false) prepareGltfMaterials(root, opts.keepMaterials !== false);
}

export function instantiateGltf(scene: THREE.Object3D, opts: GltfFitOpts = {}): THREE.Object3D {
  const root = cloneGltfScene(scene);
  fitGltfRoot(root, opts);
  return root;
}

export function pickClip(clips: THREE.AnimationClip[], prefer?: RegExp): THREE.AnimationClip | null {
  if (!clips?.length) return null;
  if (prefer) {
    const hit = clips.find((c) => prefer.test(c.name));
    if (hit) return hit;
  }
  return clips[0];
}
