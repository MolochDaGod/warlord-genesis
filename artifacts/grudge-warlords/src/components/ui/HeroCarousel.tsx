import { Suspense, useEffect, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { heroModelUrl } from "../../game/heroModels";

export interface CarouselHero {
  id: string;
  name: string;
}

interface HeroModelProps {
  heroId: string;
  index: number;
  posRef: MutableRefObject<number>;
  onSelect: () => void;
}

/** A single GLB voxel hero placed on the carousel, idle-animated via its own clips. */
function HeroModel({ heroId, index, posRef, onSelect }: HeroModelProps) {
  const url = heroModelUrl(heroId);
  const { scene, animations } = useGLTF(url);
  const group = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    const idle = actions["idle"] ?? (names[0] ? actions[names[0]] : undefined);
    idle?.reset().fadeIn(0.3).play();
    return () => {
      idle?.fadeOut(0.2).stop();
    };
  }, [actions, names]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const off = index - posRef.current;
    const targetX = off * 2.3;
    const targetZ = -Math.abs(off) * 1.7;
    const targetS = Math.max(0.5, 1 - Math.abs(off) * 0.24);
    g.position.x += (targetX - g.position.x) * 0.18;
    g.position.z += (targetZ - g.position.z) * 0.18;
    const s = g.scale.x + (targetS - g.scale.x) * 0.18;
    g.scale.setScalar(s);
    // Focused hero faces the viewer; side models angle slightly toward the centre.
    const targetRot = -off * 0.32;
    g.rotation.y += (targetRot - g.rotation.y) * 0.18;
  });

  return (
    <group
      ref={group}
      position={[index * 2.3, -0.95, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <primitive object={scene} />
    </group>
  );
}

function Ring({
  heroes,
  selected,
  onSelect,
}: {
  heroes: CarouselHero[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  const posRef = useRef(selected);
  useFrame(() => {
    posRef.current += (selected - posRef.current) * 0.15;
  });
  return (
    <>
      {heroes.map((h, i) => (
        <HeroModel
          key={h.id}
          heroId={h.id}
          index={i}
          posRef={posRef}
          onSelect={() => onSelect(i)}
        />
      ))}
    </>
  );
}

export function HeroCarousel({
  heroes,
  selected,
  onSelect,
}: {
  heroes: CarouselHero[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  return (
    <Canvas
      camera={{ fov: 42, near: 0.1, far: 50, position: [0, 0.7, 5.4] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 1.5]}
    >
      <hemisphereLight args={["#fff0d8", "#2a1c14", 0.9]} />
      <directionalLight position={[3, 6, 5]} intensity={1.5} color="#ffe8c8" />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} color="#9bb6ff" />
      <ambientLight intensity={0.5} />
      <Suspense fallback={null}>
        <Ring heroes={heroes} selected={selected} onSelect={onSelect} />
      </Suspense>
    </Canvas>
  );
}
