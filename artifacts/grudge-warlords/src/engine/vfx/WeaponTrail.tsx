import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { meleeSwingArc } from "../math/splines";

const MAX_TRAILS = 8;
const SEGMENTS = 10;

/** Imperative melee swing trails synced to EM.slashes. */
export function WeaponTrail() {
  const groupRef = useRef<THREE.Group>(null);
  type TrailSlot = { line: THREE.Line; positions: Float32Array; color: THREE.Color };
  const poolRef = useRef<TrailSlot[]>([]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const pool: TrailSlot[] = [];
    for (let i = 0; i < MAX_TRAILS; i++) {
      const positions = new Float32Array((SEGMENTS + 1) * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color: 0xffd080,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const line = new THREE.Line(geom, mat);
      line.visible = false;
      line.frustumCulled = false;
      group.add(line);
      pool.push({ line, positions, color: new THREE.Color(0xffd080) });
    }
    poolRef.current = pool;
    return () => {
      for (const { line } of pool) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        group.remove(line);
      }
      poolRef.current = [];
    };
  }, []);

  useFrame(() => {
    const pool = poolRef.current;
    let slot = 0;
    for (const slash of EM.slashes) {
      if (slot >= pool.length) break;
      const pts = meleeSwingArc(slash.origin, slash.dir, slash.traveled + 0.4, 0.55, SEGMENTS);
      const { line, positions, color } = pool[slot]!;
      for (let i = 0; i < pts.length; i++) {
        positions[i * 3] = pts[i]!.x;
        positions[i * 3 + 1] = pts[i]!.y;
        positions[i * 3 + 2] = pts[i]!.z;
      }
      line.geometry.attributes.position!.needsUpdate = true;
      line.geometry.setDrawRange(0, pts.length);
      color.set(slash.color);
      (line.material as THREE.LineBasicMaterial).color.copy(color);
      line.visible = true;
      slot++;
    }
    for (let i = slot; i < pool.length; i++) pool[i]!.line.visible = false;
  });

  return <group ref={groupRef} />;
}