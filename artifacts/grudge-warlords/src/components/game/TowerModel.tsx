import { Component, Suspense, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
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

/** Procedural fallback when a GLB fails to load/parse (keeps /play playable). */
function ProceduralTower({ pack }: { pack: TowerPack }) {
  const color =
    pack === "elven" ? "#4a7a55" : pack === "orc" ? "#5a4a28" : pack === "ruins" ? "#4a4238" : "#5a4636";
  const accent =
    pack === "elven" ? "#8fd4a0" : pack === "orc" ? "#c07030" : pack === "ruins" ? "#8a7a60" : "#e0b252";
  return (
    <group>
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.6, 2.1, 4.8, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <mesh position={[0, 5.1, 0]} castShadow>
        <cylinderGeometry args={[1.9, 1.7, 0.7, 8]} />
        <meshStandardMaterial color={accent} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 5.8, 0]} castShadow>
        <boxGeometry args={[0.55, 1.1, 0.55]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

class TowerLoadBoundary extends Component<
  { pack: TowerPack; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[warlord] tower GLB failed — using procedural fallback", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) return <ProceduralTower pack={this.props.pack} />;
    return this.props.children;
  }
}

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
      const base = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      if (!base) return;
      const apply = (mat: THREE.Material) => {
        const std = (mat as THREE.MeshStandardMaterial).clone();
        if ("map" in std) {
          std.map = atlas;
          std.color?.set?.("#ffffff");
          std.roughness = 0.78;
          std.metalness = 0.08;
          std.needsUpdate = true;
        }
        return std;
      };
      m.material = Array.isArray(base) ? base.map(apply) : apply(base);
    });

    r.scale.set(1, 1, 1);
    r.position.set(0, 0, 0);
    r.updateWorldMatrix(true, true);
    let box = new THREE.Box3().setFromObject(r);
    const size = new THREE.Vector3();
    box.getSize(size);
    let hy = Math.max(size.y, 0.001);
    if (hy > 40) {
      const decade = Math.pow(10, Math.round(Math.log10(hy / TOWER_FIT_HEIGHT)));
      if (decade > 1) {
        r.scale.setScalar(1 / decade);
        r.updateWorldMatrix(true, true);
        box = new THREE.Box3().setFromObject(r);
        box.getSize(size);
        hy = Math.max(size.y, 0.001);
      }
    }
    const s = THREE.MathUtils.clamp(TOWER_FIT_HEIGHT / hy, 0.002, 8);
    r.scale.setScalar(s);
    r.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(r);
    r.position.y = -box.min.y;
    r.position.x = -((box.min.x + box.max.x) / 2);
    r.position.z = -((box.min.z + box.max.z) / 2);
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

  return (
    <TowerLoadBoundary pack={pack}>
      <Suspense fallback={<ProceduralTower pack={pack} />}>
        <TowerMesh key={`${pack}-${tier}-${cdnOk}`} modelUrl={modelUrl} atlasUrl={atlasUrl} />
      </Suspense>
    </TowerLoadBoundary>
  );
}

export function preloadTowers(cdnOk: boolean) {
  for (const pack of ["medieval", "elven", "orc", "ruins"] as const) {
    for (const tier of ["outer", "inner"] as const) {
      try {
        useGLTF.preload(towerModelUrl(pack, tier, cdnOk));
      } catch {
        // Preload failures must never break boot.
      }
    }
  }
}
