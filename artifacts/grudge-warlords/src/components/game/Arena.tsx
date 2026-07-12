import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { HeightfieldCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { useGame } from "../../game/store";

// Vertex tint blended by terrain height: warm path tan in the low corridors,
// mossy green on the raised ridge dividers.
const LOW = new THREE.Color("#c9a875");
const HIGH = new THREE.Color("#5d6b3c");

/**
 * Battlefield visual mesh + Rapier heightfield collider (same height samples).
 * Heightfield is the correct Rapier primitive for terrain — thick contact surface,
 * no thin-trimesh tunneling. Walls stay fixed cuboids. Rebuilds on `mapVersion`.
 */
export function Arena() {
  const mapVersion = useGame((s) => s.mapVersion);

  const [groundDiff, groundNor] = useTexture([
    "/textures/ground_diff.jpg",
    "/textures/ground_nor.jpg",
  ]);

  // Build the terrain geometry + Rapier heightfield args from the active map.
  const { geom, heightfield } = useMemo(() => {
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

    // Rapier heightfield: nrows/ncols = cell counts along local Z/X;
    // heights must be column-major of size (nrows+1)*(ncols+1).
    // Mapgen bakes row-major [r * cols + c] — transpose into column-major.
    const nrows = Math.max(1, rows - 1);
    const ncols = Math.max(1, cols - 1);
    const hfHeights = new Array<number>(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        hfHeights[c * rows + r] = heights[r * cols + c];
      }
    }
    return {
      geom: g,
      heightfield: {
        nrows,
        ncols,
        heights: hfHeights,
        scale: { x: width, y: 1, z: length } as const,
      },
    };
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
  // Walls extend below y=0 so they still block on raised terrain ridges.
  const wallDepth = Math.max(wallH + 6, 12);
  const wallY = wallDepth / 2 - 2;

  const allyY = m.heightAt(m.allyCore.x, m.allyCore.z);
  const enemyY = m.heightAt(m.enemyCore.x, m.enemyCore.z);

  return (
    <group>
      {/* Visual terrain mesh (no physics) */}
      <mesh key={`vis-${mapVersion}`} geometry={geom} receiveShadow castShadow>
        <meshStandardMaterial
          map={groundDiff}
          normalMap={groundNor}
          vertexColors
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Rapier heightfield — real ground contact for hero / tree / future bodies */}
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
          // High density fixed body — default friction combine with capsule
        />
      </RigidBody>

      {/* faction territory tint near each core */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.allyCore.x, allyY + 0.06, m.allyCore.z]}>
        <circleGeometry args={[14, 40]} />
        <meshStandardMaterial color="#e0b252" roughness={1} transparent opacity={0.16} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[m.enemyCore.x, enemyY + 0.06, m.enemyCore.z]}>
        <circleGeometry args={[14, 40]} />
        <meshStandardMaterial color="#c0392b" roughness={1} transparent opacity={0.16} />
      </mesh>

      {/* perimeter walls — tall cuboids so ridges don't leave gaps under the wall */}
      {[
        { p: [0, wallY, -halfL] as const, s: [m.width, wallDepth, 1.2] as const },
        { p: [0, wallY, halfL] as const, s: [m.width, wallDepth, 1.2] as const },
        { p: [-halfW, wallY, 0] as const, s: [1.2, wallDepth, m.length] as const },
        { p: [halfW, wallY, 0] as const, s: [1.2, wallDepth, m.length] as const },
      ].map((w, i) => (
        <RigidBody
          key={`${mapVersion}-wall-${i}`}
          type="fixed"
          colliders="cuboid"
          position={w.p as unknown as [number, number, number]}
          friction={0.8}
          restitution={0}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={w.s as unknown as [number, number, number]} />
            <meshStandardMaterial color="#3a2a22" roughness={0.85} metalness={0.2} />
          </mesh>
          <mesh position={[0, wallDepth / 2 - 0.15, 0]}>
            <boxGeometry args={[w.s[0], 0.12, w.s[2]]} />
            <meshStandardMaterial color="#c0392b" emissive="#c0392b" emissiveIntensity={1.2} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
}
