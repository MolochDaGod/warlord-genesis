/**
 * Sanctum Island turret GLB — sits in the empty deck holes (pad sockets).
 * Feet planted on local y=0 so parent structure.pos.y (deck sample) is correct.
 */
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { sanctumTurretUrl } from "../../engine/mapAssets";

/** Fit height so turrets fill pads without towering over the whole island. */
const TURRET_FIT_HEIGHT = 5.4;

function fitTurretOnPad(root: THREE.Object3D, targetH: number): void {
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.updateWorldMatrix(true, true);

  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let hy = Math.max(size.y, 0.001);
  // cm-scale exports
  if (hy > 20) {
    root.scale.setScalar(0.01);
    root.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(root);
    box.getSize(size);
    hy = Math.max(size.y, 0.001);
  }
  // Also shrink if XZ footprint is huge vs a pad (~4–6m)
  const xz = Math.max(size.x, size.z, 0.001);
  let s = targetH / hy;
  if (xz * s > 7) s *= 7 / (xz * s);
  root.scale.setScalar(s);
  root.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(root);
  // Feet on pad surface (parent provides world deck Y)
  root.position.y = -box.min.y;
  root.position.x = -((box.min.x + box.max.x) / 2);
  root.position.z = -((box.min.z + box.max.z) / 2);
}

export function SanctumTurret({ faction }: { faction: string }) {
  const url = sanctumTurretUrl();
  const { scene } = useGLTF(url);
  const root = useMemo(() => {
    const r = cloneSkeleton(scene);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      const next = mats.map((mat) => {
        const sm = (mat as THREE.MeshStandardMaterial).clone();
        if (sm.map) {
          sm.map.colorSpace = THREE.SRGBColorSpace;
          sm.map.needsUpdate = true;
        }
        if (sm.color) sm.color.set(0xffffff);
        if (!sm.map && faction === "enemy" && sm.color) {
          sm.color.lerp(new THREE.Color("#c0392b"), 0.22);
        } else if (!sm.map && faction === "ally" && sm.color) {
          sm.color.lerp(new THREE.Color("#e0b252"), 0.12);
        }
        sm.needsUpdate = true;
        return sm;
      });
      m.material = Array.isArray(m.material) ? next : next[0]!;
    });
    fitTurretOnPad(r, TURRET_FIT_HEIGHT);
    return r;
  }, [scene, faction]);

  return <primitive object={root} />;
}

try {
  useGLTF.preload(sanctumTurretUrl());
} catch {
  /* ignore */
}
