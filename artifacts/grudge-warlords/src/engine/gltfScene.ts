/**
 * Shared glTF 2.0 scene prep for every new building / trap / shell pack.
 * Load binary .glb via drei useGLTF. Keep Sketchfab Y-up. Clone then fit.
 */
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export interface GltfFitOpts {
  height?: number;
  maxDim?: number;
  shadows?: boolean;
  keepMaterials?: boolean;
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
