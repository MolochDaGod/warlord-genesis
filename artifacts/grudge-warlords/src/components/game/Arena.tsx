import { useEffect, useMemo, useState } from "react";
import { HeightfieldCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";
import { AuthoredMapVisual } from "./AuthoredMap";
import { authoredMapForSize } from "../../engine/mapAssets";
import { stAlbedoUrl } from "../../engine/superTerrainMoba";

/**
 * Battlefield:
 *  - Super Terrain (fleet alpine-mesh bake): 3D heightfield visual + collider; lanes stay low.
 *  - Fallback: authored Sanctum / 1v1 GLB deck at y≈0 + clamped heightfield.
 * Player TPS + combat crosshair live in Player.tsx / HUD — not replaced here.
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
    const relief = m.relief === "super-terrain";
    const hfHeights = new Array<number>(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const h = heights[r * cols + c] ?? 0;
        const y = Number.isFinite(h) ? h : 0;
        hfHeights[c * rows + r] = relief
          ? THREE.MathUtils.clamp(y, 0, 24)
          : THREE.MathUtils.clamp(y, -0.5, 2.5);
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
  const st = m.relief === "super-terrain";
  const allyY = st
    ? m.heightAt(m.allyCore.x, m.allyCore.z)
    : Math.min(2, Math.max(0, m.heightAt(m.allyCore.x, m.allyCore.z)));
  const enemyY = st
    ? m.heightAt(m.enemyCore.x, m.enemyCore.z)
    : Math.min(2, Math.max(0, m.heightAt(m.enemyCore.x, m.enemyCore.z)));

  return (
    <group>
      {st ? (
        <SuperTerrainVisual
          key={`st-${mapVersion}`}
          cols={m.hmCols}
          rows={m.hmRows}
          heights={m.heights}
          width={m.width}
          length={m.length}
          albedo={m.stAlbedo || stAlbedoUrl()}
        />
      ) : (
        <AuthoredMapVisual key={`map-${authored.id}-${mapVersion}`} />
      )}

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

function SuperTerrainVisual({
  cols,
  rows,
  heights,
  width,
  length,
  albedo,
}: {
  cols: number;
  rows: number;
  heights: Float32Array;
  width: number;
  length: number;
  albedo: string;
}) {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      albedo,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(8, 8);
        setMap(tex);
      },
      undefined,
      () => {
        /* keep grass color — never throw into CanvasErrorBoundary */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [albedo]);
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, length, Math.max(1, cols - 1), Math.max(1, rows - 1));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    if (!pos) return g;
    const halfW = width / 2;
    const halfL = length / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const fx = ((x + halfW) / width) * (cols - 1);
      const fz = ((z + halfL) / length) * (rows - 1);
      const c0 = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
      const r0 = Math.max(0, Math.min(rows - 1, Math.floor(fz)));
      const c1 = Math.min(cols - 1, c0 + 1);
      const r1 = Math.min(rows - 1, r0 + 1);
      const tx = fx - c0;
      const tz = fz - r0;
      const h00 = heights[r0 * cols + c0] ?? 0;
      const h10 = heights[r0 * cols + c1] ?? 0;
      const h01 = heights[r1 * cols + c0] ?? 0;
      const h11 = heights[r1 * cols + c1] ?? 0;
      pos.setY(i, h00 + (h10 - h00) * tx + (h01 - h00 + (h11 - h10 - h01 + h00) * tx) * tz);
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [cols, rows, heights, width, length]);
  return (
    <mesh geometry={geom} receiveShadow castShadow>
      <meshStandardMaterial
        map={map ?? undefined}
        color={map ? "#ffffff" : "#4f7d32"}
        roughness={0.88}
        metalness={0.04}
      />
    </mesh>
  );
}
