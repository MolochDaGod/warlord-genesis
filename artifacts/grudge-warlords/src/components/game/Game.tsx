import { Suspense, useMemo } from "react";
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
import { CampMarkers } from "./CampMarkers";
import { Buildings } from "./Buildings";
import { Effects } from "./Effects";
import { Projectiles } from "./Projectiles";
import { WeaponTrail } from "../../engine/vfx/WeaponTrail";
import { CommandLayer, SelectionRings } from "./Command";
import { MatchDirector } from "./MatchDirector";
import { MapMoat } from "./MapMoat";
import { CanvasErrorBoundary, WebGLFallback } from "./CanvasFallback";
import { detectWebGL } from "../../lib/webgl";
import {
  attachWebGLContextGuard,
  fleetArenaCanvasProps,
  withFleetCanvasProps,
} from "@workspace/r3f-fleet";

function SceneContent() {
  return (
    <>
      <Sky sunPosition={[-30, 14, -40]} turbidity={8} rayleigh={0.8} mieCoefficient={0.004} distance={450000} />
      <fog attach="fog" args={["#6e5240", 140, 420]} />
      <MapMoat />
      <hemisphereLight args={["#ffd9a8", "#2a1c14", 0.6]} />
      <directionalLight
        position={[-20, 36, -10]}
        intensity={1.7}
        color="#ffd9a8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={170}
        shadow-camera-bottom={-170}
        shadow-camera-far={420}
      />
      <ambientLight intensity={0.4} />

      {/* Rapier world: fixed timestep + interpolation. Heightfield terrain lives
          in Arena; hero CCD capsule in Player; tree trunks in Trees. */}
      <Physics gravity={[0, -22, 0]} timeStep={1 / 60} interpolate>
        <Arena />
        <Player />
        <Trees />
      </Physics>

      <Grass />
      <Structures />
      <Relic />
      <CampMarkers />
      <Buildings />
      <Units />
      <EnemyHero />
      <Effects />
      <WeaponTrail />
      <Projectiles />
      <SelectionRings />
      <CommandLayer />
      <MatchDirector />
    </>
  );
}

export function Game() {
  const support = useMemo(() => detectWebGL(), []);
  const handleCreated = (state: RootState) => {
    attachWebGLContextGuard(state.gl.domElement, "grudge-warlords");
  };

  if (!support.ok) {
    return <WebGLFallback reason={support.reason} />;
  }

  return (
    <KeyboardControls map={keyMap}>
      <CanvasErrorBoundary>
        <Canvas
          {...withFleetCanvasProps(fleetArenaCanvasProps, {
            camera: { fov: 72, near: 0.22, far: 420, position: [0, 13, 44] },
            onCreated: handleCreated,
          })}
        >
          <color attach="background" args={["#6e5240"]} />
          <AdaptiveDpr pixelated />
          <Suspense fallback={null}>
            <SceneContent />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </KeyboardControls>
  );
}
