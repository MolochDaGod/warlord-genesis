import { useMemo } from "react";
import * as THREE from "three";
import type { SimMap } from "@workspace/gw-sim";

/** Builds the heightmapped battlefield mesh + lane strips from the shared map. */
export function Terrain({ map }: { map: SimMap }) {
  const geometry = useMemo(() => {
    const cols = Math.max(2, Math.round(map.w / 2));
    const rows = Math.max(2, Math.round(map.l / 2));
    const geo = new THREE.PlaneGeometry(map.w, map.l, cols, rows);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, map.heightAt(x, z));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, [map]);

  const laneGeo = useMemo(() => new THREE.PlaneGeometry(6, map.l - 18), [map.l]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#3f5733" roughness={1} metalness={0} />
      </mesh>
      {map.laneX.map((x, i) => (
        <mesh
          key={i}
          geometry={laneGeo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, 0.18, 0]}
        >
          <meshStandardMaterial
            color="#6b5a3a"
            transparent
            opacity={0.55}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}
