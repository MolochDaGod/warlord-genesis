import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { deployKitUrl, type DeployKitId } from "../../engine/deployKits";

const FIT: Record<DeployKitId, number> = {
  defence_tower: 6.4,
  squire_cannon: 5.8,
  howitzer: 5.2,
  barrier: 2.4,
};

function fitKit(root: THREE.Object3D, targetH: number): void {
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let hy = Math.max(size.y, 0.001);
  if (hy > 40 || size.x > 40 || size.z > 40) {
    root.scale.setScalar(0.01);
    root.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(root);
    box.getSize(size);
    hy = Math.max(size.y, 0.001);
  }
  root.scale.setScalar(THREE.MathUtils.clamp(targetH / hy, 0.002, 8));
  root.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(root);
  root.position.y = -box.min.y;
  root.position.x = -((box.min.x + box.max.x) / 2);
  root.position.z = -((box.min.z + box.max.z) / 2);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.needsUpdate = true;
      }
    }
  });
}

function KitInner({ kitId }: { kitId: Exclude<DeployKitId, "barrier"> }) {
  const url = deployKitUrl(kitId)!;
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const r = cloneSkeleton(scene);
    r.parent = null;
    fitKit(r, FIT[kitId] ?? 5.6);
    return r;
  }, [scene, kitId]);
  return <primitive object={obj} />;
}

export function DeployKitMesh({ kitId }: { kitId: DeployKitId }) {
  if (kitId === "barrier") return null;
  return (
    <Suspense fallback={null}>
      <KitInner key={kitId} kitId={kitId} />
    </Suspense>
  );
}

try {
  const a = deployKitUrl("defence_tower");
  const b = deployKitUrl("squire_cannon");
  const c = deployKitUrl("howitzer");
  if (a) useGLTF.preload(a);
  if (b) useGLTF.preload(b);
  if (c) useGLTF.preload(c);
} catch {
  /* ignore */
}
