import { useMemo } from "react";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";

/** Single perimeter moat — below walkable lanes (y≈0), outside the arena walls. */
const WATER_Y = -1.35;
const WATER_COLOR = "#2a5f7a";
const WATER_OPACITY = 0.82;

/**
 * One authoritative water surface for the battlefield. Replaces ad-hoc duplicate
 * planes (e.g. a high decorative sheet plus a low moat) with a single moat ring
 * sitting below the heightmap so ridges and lanes read clearly above it.
 */
export function MapMoat() {
  const mapVersion = useGame((s) => s.mapVersion);
  const m = EM.map;
  const pad = 28;

  const { width, length } = useMemo(() => {
    const w = m.width + pad;
    const l = m.length + pad;
    return { width: w, length: l };
  }, [mapVersion, m.width, m.length]);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: WATER_COLOR,
        transparent: true,
        opacity: WATER_OPACITY,
        roughness: 0.18,
        metalness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  return (
    <mesh
      key={mapVersion}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, WATER_Y, 0]}
      material={mat}
      receiveShadow
      renderOrder={-2}
    >
      <planeGeometry args={[width, length]} />
    </mesh>
  );
}