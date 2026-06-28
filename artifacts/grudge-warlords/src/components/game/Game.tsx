import { Suspense, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { KeyboardControls, Sky, AdaptiveDpr } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { keyMap } from "./controls";
import { Arena } from "./Arena";
import { Player } from "./Player";
import { Trees } from "./Trees";
import { Grass } from "./Grass";
import { Units } from "./Units";
import { EnemyHero } from "./EnemyHero";
import { Structures } from "./Structures";
import { Relic } from "./Relic";
import { Buildings } from "./Buildings";
import { Effects } from "./Effects";
import { Projectiles } from "./Projectiles";
import { CommandLayer, SelectionRings } from "./Command";
import { MatchDirector } from "./MatchDirector";
import { CanvasErrorBoundary, WebGLFallback } from "./CanvasFallback";
import { detectWebGL } from "../../lib/webgl";

function SceneContent() {
  return (
    <>
      <Sky sunPosition={[-30, 14, -40]} turbidity={10} rayleigh={1.1} mieCoefficient={0.012} />
      <fog attach="fog" args={["#7a5a44", 45, 120]} />
      <hemisphereLight args={["#ffd9a8", "#2a1c14", 0.6]} />
      <directionalLight
        position={[-20, 36, -10]}
        intensity={1.7}
        color="#ffd9a8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-camera-far={140}
      />
      <ambientLight intensity={0.4} />

      <Physics gravity={[0, -20, 0]}>
        <Arena />
        <Player />
        <Trees />
      </Physics>

      <Grass />
      <Structures />
      <Relic />
      <Buildings />
      <Units />
      <EnemyHero />
      <Effects />
      <Projectiles />
      <SelectionRings />
      <CommandLayer />
      <MatchDirector />
    </>
  );
}

export function Game() {
  const support = useMemo(() => detectWebGL(), []);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  const handleCreated = (state: RootState) => setCanvasEl(state.gl.domElement);

  useEffect(() => {
    if (!canvasEl) return;
    const onLost = (e: Event) => {
      e.preventDefault();
      console.warn("[grudge-warlords] WebGL context lost — awaiting restore");
    };
    const onRestored = () => {
      console.warn("[grudge-warlords] WebGL context restored");
    };
    canvasEl.addEventListener("webglcontextlost", onLost, false);
    canvasEl.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      canvasEl.removeEventListener("webglcontextlost", onLost, false);
      canvasEl.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [canvasEl]);

  if (!support.ok) {
    return <WebGLFallback reason={support.reason} />;
  }

  return (
    <KeyboardControls map={keyMap}>
      <CanvasErrorBoundary>
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          camera={{ fov: 72, near: 0.1, far: 420, position: [0, 13, 44] }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false,
          }}
          dpr={[1, 1.5]}
          onCreated={handleCreated}
        >
          <color attach="background" args={["#7a5a44"]} />
          <AdaptiveDpr pixelated />
          <Suspense fallback={null}>
            <SceneContent />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </KeyboardControls>
  );
}
