/**
 * Isolates one keep from `3_medieval_towers.glb` (cannon-top / mid keep / mage).
 * Do not plant the whole three-tower scene on a pad.
 */
import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { EM } from "../../game/entities";
import {
  medievalKitTextureUrl,
  medievalKitUrl,
  type MedievalKitRole,
} from "../../engine/towerAssets";

const FIT_H: Record<MedievalKitRole, number> = {
  cannon: 7.4,
  keep: 7.1,
  mage: 6.6,
};

function scoreRole(name: string, role: MedievalKitRole): number {
  const n = name.toLowerCase();
  if (role === "cannon") {
    if (/(cannon|pushka|gun|barrel|bombard|artiller|mortar)/.test(n)) return 8;
    if (/(tower|keep|bashnia|watch)/.test(n)) return 1;
    return 0;
  }
  if (role === "mage") {
    if (/(mag|mage|wizard|magic|orb|crystal|staff|spire)/.test(n)) return 8;
    return 0;
  }
  if (/(cannon|pushka|gun|mag|mage|wizard)/.test(n)) return 0;
  if (/(tower|keep|bashnia|watch|stone)/.test(n)) return 4;
  return 1;
}

function meshCount(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n++;
  });
  return n;
}

function topPieces(scene: THREE.Object3D): THREE.Object3D[] {
  const kids = scene.children.filter((c) => meshCount(c) > 0);
  if (kids.length >= 2) return kids;
  const named: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o === scene) return;
    if (/(tower|cannon|mage|bashnia|pushka|mag)/i.test(o.name) && meshCount(o) > 0) named.push(o);
  });
  return named.length >= 2 ? named : [scene];
}

function pickPiece(scene: THREE.Object3D, role: MedievalKitRole): THREE.Object3D {
  const pieces = topPieces(scene);
  let best = pieces[0] ?? scene;
  let bestS = -1;
  for (const p of pieces) {
    let s = scoreRole(p.name, role);
    p.traverse((o) => {
      s = Math.max(s, scoreRole(o.name, role));
    });
    if (s > bestS) {
      bestS = s;
      best = p;
    }
  }
  if (role === "cannon" && bestS < 4) {
    let tall = best;
    let hy = 0;
    for (const p of pieces) {
      const box = new THREE.Box3().setFromObject(p);
      const y = box.getSize(new THREE.Vector3()).y;
      if (y > hy) {
        hy = y;
        tall = p;
      }
    }
    return tall;
  }
  return best;
}

function fitAndTexture(root: THREE.Object3D, atlas: THREE.Texture, targetH: number): void {
  atlas.flipY = false;
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.needsUpdate = true;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    const next = mats.map((mat) => {
      const sm = (mat as THREE.MeshStandardMaterial).clone();
      if (!sm.map) sm.map = atlas;
      if (sm.map) {
        sm.map.colorSpace = THREE.SRGBColorSpace;
        sm.map.needsUpdate = true;
      }
      if (sm.color) sm.color.set(0xffffff);
      sm.roughness = Math.min(0.86, sm.roughness ?? 0.78);
      sm.metalness = Math.min(0.22, sm.metalness ?? 0.08);
      sm.needsUpdate = true;
      return sm;
    });
    m.material = Array.isArray(m.material) ? next : next[0]!;
  });
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let hy = Math.max(size.y, 0.001);
  if (hy > 40) {
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
}

function KitMesh({ role, structureId }: { role: MedievalKitRole; structureId?: number }) {
  const { scene } = useGLTF(medievalKitUrl());
  const atlas = useTexture(medievalKitTextureUrl());
  const group = useRef<THREE.Group>(null);
  const obj = useMemo(() => {
    const r = cloneSkeleton(pickPiece(scene, role));
    r.parent = null;
    fitAndTexture(r, atlas, FIT_H[role]);
    return r;
  }, [scene, atlas, role]);
  useFrame(() => {
    if (!group.current) return;
    const s = structureId != null ? EM.structures.find((x) => x.id === structureId) : undefined;
    const recoil = s?.muzzleFlash ?? 0;
    const kick = recoil > 0 ? 1 - Math.min(1, recoil / 0.12) : 1;
    group.current.position.z = (1 - kick) * -0.35;
    group.current.scale.y = 1 + (1 - kick) * 0.04;
  });
  return (
    <group ref={group}>
      <primitive object={obj} />
    </group>
  );
}

export function MedievalKitTower({ role, structureId }: { role: MedievalKitRole; structureId?: number }) {
  return (
    <Suspense fallback={null}>
      <KitMesh key={role} role={role} structureId={structureId} />
    </Suspense>
  );
}

export function preloadMedievalKit(): void {
  try {
    useGLTF.preload(medievalKitUrl());
  } catch {
    /* boot must not die */
  }
}

try {
  preloadMedievalKit();
} catch {
  /* ignore */
}
