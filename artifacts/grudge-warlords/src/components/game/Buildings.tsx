import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";

const BASE = import.meta.env.BASE_URL;

/** GLB for a production building at a given tier (L1..L3 committed under public). */
const buildingUrl = (kind: string, level: number) =>
  `${BASE}models/buildings/${kind}_l${Math.min(3, Math.max(1, level))}.glb`;

/** Largest world dimension a building model is normalized to. */
const BUILDING_FIT = 9;

/** Render one static building GLB, normalized to a consistent size with its
 *  footprint centred and resting on y = 0. Cloned so instances stay independent. */
function BuildingModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const r = cloneSkeleton(scene);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(r);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = BUILDING_FIT / Math.max(size.x, size.y, size.z, 0.001);
    r.scale.setScalar(s);
    r.position.y = -box.min.y * s;
    r.position.x = -((box.min.x + box.max.x) / 2) * s;
    r.position.z = -((box.min.z + box.max.z) / 2) * s;
    return r;
  }, [scene]);
  return <primitive object={obj} />;
}

/** Static production buildings (barracks / archery) placed by the map generator
 *  behind the side towers. Remounts when a fresh map is generated (mapVersion). */
export function Buildings() {
  const phase = useGame((s) => s.phase);
  const mapVersion = useGame((s) => s.mapVersion);
  // Ally building tiers drive which GLB renders; enemy buildings stay tier 1.
  const levels = useGame((s) => s.buildings);
  if (phase !== "battle") return null;
  const buildings = EM.map?.buildings ?? [];
  return (
    <group key={mapVersion}>
      {buildings.map((b, i) => {
        const level =
          b.faction === "ally" ? levels[b.kind as "barracks" | "archery"] ?? 1 : b.level;
        const url = buildingUrl(b.kind, level);
        const y = EM.map.heightAt(b.x, b.z);
        // Ally buildings face the enemy half (-z); enemy buildings face +z.
        const yaw = b.faction === "ally" ? Math.PI : 0;
        return (
          <group key={`${i}-${level}`} position={[b.x, y, b.z]} rotation={[0, yaw, 0]}>
            <BuildingModel url={url} />
          </group>
        );
      })}
    </group>
  );
}

for (const kind of ["barracks", "archery"] as const) {
  for (let l = 1; l <= 3; l++) useGLTF.preload(buildingUrl(kind, l));
}
