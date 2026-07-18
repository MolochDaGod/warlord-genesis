import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { KeyboardControls, Sky, AdaptiveDpr } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { keyMap } from "./controls";
import { Arena } from "./Arena";
import { Arena3Map } from "./Arena3Map";
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
      {/* Clear battlefield — no atmospheric fog / FOW wash */}
      <Sky sunPosition={[-24, 28, -36]} turbidity={3.2} rayleigh={0.55} mieCoefficient={0.0025} distance={450000} />
      <MapMoat />
      <hemisphereLight args={["#e8d8c0", "#1c2430", 0.55]} />
      <directionalLight
        position={[-16, 44, -10]}
        intensity={2.05}
        color="#fff0d0"
        castShadow
        // 1024 is enough for lane combat and ~4× cheaper than 2048
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={160}
        shadow-bias={-0.00025}
      />
      <ambientLight intensity={0.38} />
      {/* Soft fill so units read clean without fog */}
      <directionalLight position={[28, 18, 22]} intensity={0.35} color="#9eb6ff" />

      {/*
        Rapier best practices (warcamp /play):
        - Single <Physics> world per scene; fixed 1/60 step + interpolate for smooth R3F
        - Terrain = HeightfieldCollider (Arena) — never a thin Box for ground
        - Hero = kinematic/dynamic CapsuleCollider + CCD (Player) sized to ~1.2m height
        - Visual mesh (grudge6) is a child of the rigid body — fit to ~1.85m in grudge6Character
        - Trees = static colliders; units/creeps stay kinematic unless they need contacts
        - Do not put Physics inside Suspense that remounts every load (despawn chaos)
      */}
      <Physics gravity={[0, -22, 0]} timeStep={1 / 60} interpolate>
        <Arena />
        <Arena3Map />
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
          <color attach="background" args={["#1a2430"]} />
          <AdaptiveDpr pixelated />
          <Suspense fallback={null}>
            <SceneContent />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </KeyboardControls>
  );
}
