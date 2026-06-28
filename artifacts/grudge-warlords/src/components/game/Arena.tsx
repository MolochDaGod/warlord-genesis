import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";

// Vertex tint blended by terrain height: warm path tan in the low corridors,
// mossy green on the raised ridge dividers.
const LOW = new THREE.Color("#c9a875");
const HIGH = new THREE.Color("#5d6b3c");

/**
 * Renders the procedurally generated battlefield: a heightmap terrain mesh
 * (with a matching trimesh physics collider for the hero), faction base tints,
 * and perimeter walls. Everything is rebuilt whenever the store's `mapVersion`
 * changes (a new match generates a new layout); the `key` on the terrain
 * RigidBody forces the collider to remount onto the new geometry.
 */
export function Arena() {
  const mapVersion = useGame((s) => s.mapVersion);

  const [groundDiff, groundNor] = useTexture([
    "/textures/ground_diff.jpg",
    "/textures/ground_nor.jpg",
  ]);

  // Build the terrain geometry from the active map's heightmap.
  const geom = useMemo(() => {
    const m = EM.map;
    const { hmCols: cols, hmRows: rows, heights, width, length } = m;
    const halfW = width / 2;
    const halfL = length / 2;
    const repX = width / 8;
    const repY = length / 8;

    const positions = new Float32Array(cols * rows * 3);
    const uvs = new Float32Array(cols * rows * 2);
    const colors = new Float32Array(cols * rows * 3);
    const tmp = new THREE.Color();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const x = -halfW + (c / (cols - 1)) * width;
        const z = -halfL + (r / (rows - 1)) * length;
        const h = heights[i];
        positions[i * 3] = x;
        positions[i * 3 + 1] = h;
        positions[i * 3 + 2] = z;
        uvs[i * 2] = (c / (cols - 1)) * repX;
        uvs[i * 2 + 1] = (r / (rows - 1)) * repY;
        const t = Math.min(1, h / 3.2);
        tmp.copy(LOW).lerp(HIGH, t);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
      }
    }

    const indices: number[] = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = r * cols + c + 1;
        const d = (r + 1) * cols + c;
        const e = (r + 1) * cols + c + 1;
        indices.push(a, d, b, b, d, e);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapVersion]);

  useMemo(() => {
    const m = EM.map;
    for (const t of [groundDiff, groundNor]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(m.width / 8, m.length / 8);
      t.anisotropy = 8;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groundDiff, groundNor, mapVersion]);

  const m = EM.map;
  const halfW = m.width / 2;
  const halfL = m.length / 2;
  const wallH = m.wallHeight;

  const allyY = m.heightAt(m.allyCore.x, m.allyCore.z);
  const enemyY = m.heightAt(m.enemyCore.x, m.enemyCore.z);

  return (
    <group>
      {/* Heightmap terrain (visual only). The hero is grounded deterministically by
          a per-frame heightmap clamp in Player.tsx, NOT a physics collider: a thin
          trimesh floor lets the dynamic capsule tunnel on fast moves/slopes and then
          ejects it violently, which reads as the hero "flying" around. Perimeter
          walls keep their cuboid colliders (below); units are non-physical. */}
      <mesh key={mapVersion} geometry={geom} receiveShadow castShadow>
        <meshStandardMaterial
          map={groundDiff}
          normalMap={groundNor}
          vertexColors
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* faction territory tint near each core */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.allyCore.x, allyY + 0.06, m.allyCore.z]}>
        <circleGeometry args={[14, 40]} />
        <meshStandardMaterial color="#e0b252" roughness={1} transparent opacity={0.16} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.enemyCore.x, enemyY + 0.06, m.enemyCore.z]}>
        <circleGeometry args={[14, 40]} />
        <meshStandardMaterial color="#c0392b" roughness={1} transparent opacity={0.16} />
      </mesh>

      {/* perimeter walls */}
      {[
        { p: [0, wallH / 2, -halfL] as const, s: [m.width, wallH, 1] as const },
        { p: [0, wallH / 2, halfL] as const, s: [m.width, wallH, 1] as const },
        { p: [-halfW, wallH / 2, 0] as const, s: [1, wallH, m.length] as const },
        { p: [halfW, wallH / 2, 0] as const, s: [1, wallH, m.length] as const },
      ].map((w, i) => (
        <RigidBody key={`${mapVersion}-${i}`} type="fixed" colliders="cuboid" position={w.p as unknown as [number, number, number]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={w.s as unknown as [number, number, number]} />
            <meshStandardMaterial color="#3a2a22" roughness={0.85} metalness={0.2} />
          </mesh>
          <mesh position={[0, wallH / 2 - 0.1, 0]}>
            <boxGeometry args={[w.s[0], 0.12, w.s[2]]} />
            <meshStandardMaterial color="#c0392b" emissive="#c0392b" emissiveIntensity={1.2} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
