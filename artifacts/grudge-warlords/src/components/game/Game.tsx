import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { KeyboardControls, Sky, AdaptiveDpr } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { keyMap } from "./controls";
import { Arena } from "./Arena";
import { Player } from "./Player";
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
import { Trees } from "./Trees";
import { WoodsRocks } from "./WoodsRocks";
import { useGame } from "../../game/store";
import { EM } from "../../game/entities";
import { CanvasErrorBoundary, WebGLFallback } from "./CanvasFallback";
import { detectWebGL } from "../../lib/webgl";
import {
  applyFleetRenderer,
  attachWebGLContextGuard,
  fleetArenaCanvasProps,
  withFleetCanvasProps,
} from "@workspace/r3f-fleet";

function SceneContent() {
  const mapVersion = useGame((s) => s.mapVersion);
  const st = EM.map?.relief === "super-terrain";
  return (
    <>
      <Sky sunPosition={[60, 80, 20]} turbidity={2.8} rayleigh={0.75} mieCoefficient={0.002} distance={450000} />
      <fog attach="fog" args={["#5a7a9a", 120, 380]} />
      <hemisphereLight args={["#d8e8ff", "#2a3a28", 0.7]} />
      <directionalLight
        position={[50, 90, 30]}
        intensity={1.7}
        color="#fff4e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-far={400}
      />
      <ambientLight intensity={0.5} />

      <Physics gravity={[0, -22, 0]} timeStep={1 / 60} interpolate>
        <Arena />
        <Player />
        {st ? <Trees key={`trees-${mapVersion}`} /> : null}
      </Physics>
      <WoodsRocks />
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
    applyFleetRenderer(state.gl);
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
          <color attach="background" args={["#3d5a78"]} />
          <AdaptiveDpr />
          <Suspense fallback={<hemisphereLight args={["#fff", "#222", 1]} />}>
            <SceneContent />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>
    </KeyboardControls>
  );
}
