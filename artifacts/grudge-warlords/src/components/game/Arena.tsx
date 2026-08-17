import { useMemo } from "react";
import { HeightfieldCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";
import { AuthoredMapVisual } from "./AuthoredMap";
import { authoredMapForSize } from "../../engine/mapAssets";

/**
 * Battlefield:
 *  - Visual: authored GLB deck planted at y≈0 (Sanctum / 1v1) — NOT on mesh min.y
 *  - Collider: flat-ish heightfield at mapgen heights (near y=0 once deck is planted)
 *  Units must stand ON the MOBA deck, never under the island in the sky void.
 */
export function Arena() {
  const mapVersion = useGame((s) => s.mapVersion);
  const size = EM.map?.size ?? "standard";
  const authored = authoredMapForSize(size);

  const heightfield = useMemo(() => {
    const m = EM.map;
    const { hmCols: cols, hmRows: rows, heights, width, length } = m;
    const nrows = Math.max(1, rows - 1);
    const ncols = Math.max(1, cols - 1);
    // Clamp heightfield to a thin band around y=0 so it matches the planted deck
    // (authored map ray-plants deck to y=0; old full ridge heights lifted feet into sky).
    const hfHeights = new Array<number>(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const h = heights[r * cols + c] ?? 0;
        hfHeights[c * rows + r] = THREE.MathUtils.clamp(h, -0.5, 2.5);
      }
    }
    return {
      nrows,
      ncols,
      heights: hfHeights,
      scale: { x: width, y: 1, z: length } as const,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapVersion]);

  const m = EM.map;
  // Markers sit on the deck (y≈0), not ridge peaks
  const allyY = Math.min(2, Math.max(0, m.heightAt(m.allyCore.x, m.allyCore.z)));
  const enemyY = Math.min(2, Math.max(0, m.heightAt(m.enemyCore.x, m.enemyCore.z)));

  return (
    <group>
      {/* Real map art — deck aligned to y=0 */}
      <AuthoredMapVisual key={`map-${authored.id}-${mapVersion}`} />

      {/* Invisible heightfield coplanar with deck for hero/unit feet */}
      <RigidBody
        key={`hf-${mapVersion}`}
        type="fixed"
        colliders={false}
        position={[0, 0, 0]}
        friction={1}
        restitution={0}
      >
        <HeightfieldCollider
          args={[
            heightfield.nrows,
            heightfield.ncols,
            heightfield.heights,
            heightfield.scale,
          ]}
          friction={1.2}
          restitution={0}
        />
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.allyCore.x, allyY + 0.06, m.allyCore.z]}>
        <circleGeometry args={[10, 40]} />
        <meshStandardMaterial color="#e0b252" roughness={1} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.enemyCore.x, enemyY + 0.06, m.enemyCore.z]}>
        <circleGeometry args={[10, 40]} />
        <meshStandardMaterial color="#c0392b" roughness={1} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}
