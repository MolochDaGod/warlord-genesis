import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF, useTexture } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { bootEngine, getEngine } from "../../engine/boot";
import {
  towerAtlasUrl,
  towerModelUrl,
  type TowerPack,
  type TowerTier,
} from "../../engine/towerAssets";

/** Normalized world height for lane towers (matches prior procedural scale). */
const TOWER_FIT_HEIGHT = 7.2;

function TowerMesh({ modelUrl, atlasUrl }: { modelUrl: string; atlasUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  const atlas = useTexture(atlasUrl);

  const obj = useMemo(() => {
    atlas.flipY = false;
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.needsUpdate = true;

    const r = cloneSkeleton(scene);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.map = atlas;
      mat.color.set("#ffffff");
      mat.roughness = 0.78;
      mat.metalness = 0.08;
      m.material = mat;
    });

    const box = new THREE.Box3().setFromObject(r);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = TOWER_FIT_HEIGHT / Math.max(size.y, 0.001);
    r.scale.setScalar(s);
    r.position.y = -box.min.y * s;
    r.position.x = -((box.min.x + box.max.x) / 2) * s;
    r.position.z = -((box.min.z + box.max.z) / 2) * s;
    return r;
  }, [scene, atlas]);

  return <primitive object={obj} />;
}

export function TowerModel({ pack, tier }: { pack: TowerPack; tier: TowerTier }) {
  const [cdnOk, setCdnOk] = useState(() => getEngine().cdnReachable);
  useEffect(() => {
    bootEngine().then((s) => setCdnOk(s.cdnReachable));
  }, []);

  const modelUrl = towerModelUrl(pack, tier, cdnOk);
  const atlasUrl = towerAtlasUrl(pack, cdnOk);

  return <TowerMesh key={`${pack}-${tier}-${cdnOk}`} modelUrl={modelUrl} atlasUrl={atlasUrl} />;
}

export function preloadTowers(cdnOk: boolean) {
  for (const pack of ["medieval", "elven", "orc", "ruins"] as const) {
    for (const tier of ["outer", "inner"] as const) {
      useGLTF.preload(towerModelUrl(pack, tier, cdnOk));
    }
  }
}