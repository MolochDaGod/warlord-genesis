import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";

const ACTIVE = new THREE.Color("#c8a050");
const CLEARED = new THREE.Color("#4a5a40");

function CampMarker({ campId, x, z, tier }: { campId: number; x: number; z: number; tier: number }) {
  const ringMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: ACTIVE,
        emissive: ACTIVE,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.55,
      }),
    [],
  );
  const poleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: ACTIVE, emissive: ACTIVE, emissiveIntensity: 1.1 }),
    [],
  );
  const y = EM.groundY(x, z);

  useFrame(() => {
    const camp = EM.match.camps.find((c) => c.id === campId);
    const active = camp ? !camp.cleared : true;
    const pulse = active ? 0.85 + Math.sin(EM.match.clock * 2.2 + campId) * 0.15 : 0.25;
    ringMat.emissiveIntensity = pulse;
    poleMat.emissiveIntensity = pulse * 1.2;
    ringMat.color.copy(active ? ACTIVE : CLEARED);
    ringMat.emissive.copy(active ? ACTIVE : CLEARED);
    poleMat.color.copy(active ? ACTIVE : CLEARED);
    poleMat.emissive.copy(active ? ACTIVE : CLEARED);
  });

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} material={ringMat}>
        <ringGeometry args={[1.6, 2.4, 24]} />
      </mesh>
      <mesh position={[0, 0.55 + tier * 0.15, 0]} material={poleMat}>
        <cylinderGeometry args={[0.18, 0.28, 0.9 + tier * 0.25, 6]} />
      </mesh>
      <pointLight position={[0, 1.2, 0]} color="#ffb060" intensity={2} distance={10} />
    </group>
  );
}

/** World markers for neutral jungle camps (campfire + totem). */
export function CampMarkers() {
  const mapVersion = useGame((s) => s.mapVersion);
  const camps = EM.match.camps;
  if (!camps.length) return null;

  return (
    <group key={mapVersion}>
      {camps.map((c) => (
        <CampMarker key={c.id} campId={c.id} x={c.x} z={c.z} tier={c.tier} />
      ))}
    </group>
  );
}