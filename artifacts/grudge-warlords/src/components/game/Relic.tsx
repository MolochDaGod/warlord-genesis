import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EM } from "../../game/entities";
import { RELIC } from "../../game/config";

const NEUTRAL = new THREE.Color("#8fd8ff");
const ALLY = new THREE.Color("#f0c46b");
const ENEMY = new THREE.Color("#e0584a");

/**
 * World beacon for the recurring neutral relic objective. Sits at
 * EM.match.relic.pos and reads the authoritative relic state each frame:
 * a dim dormant crystal between cycles, and a bright pulsing beacon + capture
 * zone ring + progress disc (tinted by whoever is contesting it) while active.
 */
export function Relic() {
  const group = useRef<THREE.Group>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const cMat = useRef<THREE.MeshStandardMaterial>(null);
  const zoneMat = useRef<THREE.MeshBasicMaterial>(null);
  const fill = useRef<THREE.Mesh>(null);
  const fillMat = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const t = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const r = EM.match.relic;
    t.current += dt;
    g.position.set(r.pos.x, r.pos.y, r.pos.z);

    const active = r.phase === "active";
    const col = r.capturer === "ally" ? ALLY : r.capturer === "enemy" ? ENEMY : NEUTRAL;

    if (crystal.current) {
      crystal.current.rotation.y = t.current * (active ? 1.4 : 0.4);
      crystal.current.position.y = 2 + (active ? Math.sin(t.current * 2) * 0.25 : 0);
      crystal.current.scale.setScalar(active ? 1 : 0.7);
    }
    if (cMat.current) {
      cMat.current.color.copy(col);
      cMat.current.emissive.copy(col);
      cMat.current.emissiveIntensity = active ? 1.4 + Math.sin(t.current * 3) * 0.3 : 0.4;
    }
    if (light.current) {
      light.current.color.copy(col);
      light.current.intensity = active ? 6 : 1.2;
      light.current.distance = active ? 26 : 12;
    }
    if (zoneMat.current) {
      zoneMat.current.color.copy(col);
      zoneMat.current.opacity = active ? 0.22 + Math.sin(t.current * 2) * 0.06 : 0.05;
    }
    if (fill.current && fillMat.current) {
      const p = active ? r.progress : 0;
      fill.current.visible = p > 0.001;
      const rad = Math.max(0.001, p * (RELIC.radius - 0.4));
      fill.current.scale.set(rad, rad, 1);
      fillMat.current.color.copy(col);
    }
  });

  return (
    <group ref={group}>
      {/* stone dais */}
      <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.6, 1.9, 0.4, 16]} />
        <meshStandardMaterial color="#3a2c22" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* floating crystal */}
      <mesh ref={crystal} position={[0, 2, 0]} castShadow>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          ref={cMat}
          color={NEUTRAL}
          emissive={NEUTRAL}
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      <pointLight ref={light} position={[0, 2.4, 0]} color={NEUTRAL} intensity={1.2} distance={12} />
      {/* capture-zone boundary ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[RELIC.radius - 0.4, RELIC.radius, 56]} />
        <meshBasicMaterial
          ref={zoneMat}
          color={NEUTRAL}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* capture-progress fill disc (scaled by progress) */}
      <mesh ref={fill} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} visible={false}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial
          ref={fillMat}
          color={NEUTRAL}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
