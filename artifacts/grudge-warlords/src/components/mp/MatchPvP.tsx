import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type RootState, type ThreeEvent } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import {
  attachWebGLContextGuard,
  fleetMpCanvasProps,
  withFleetCanvasProps,
} from "@workspace/r3f-fleet";
import { CanvasErrorBoundary } from "../game/CanvasFallback";
import * as THREE from "three";
import { generateMap } from "@workspace/gw-sim";
import type { MatchInfo } from "../../net/mpStore";
import { runtime } from "../../net/runtime";
import { mpAttackMove, mpMove, mpStop } from "../../net/connection";
import { Terrain } from "./scene/Terrain";
import { Entities } from "./scene/Entities";

const CAM_HEIGHT = 26;
const CAM_DIST = 24;

function CameraRig({ team, fallbackZ }: { team: number; fallbackZ: number }) {
  const { camera } = useThree();
  const dist = useRef(CAM_DIST);
  const height = useRef(CAM_HEIGHT);
  const sign = team === 0 ? -1 : 1;

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      dist.current = THREE.MathUtils.clamp(dist.current + e.deltaY * 0.02, 12, 48);
      height.current = THREE.MathUtils.clamp(height.current + e.deltaY * 0.022, 14, 52);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  useFrame(() => {
    const p = runtime.predict;
    const tx = p.has ? p.x : 0;
    const tz = p.has ? p.z : fallbackZ;
    const desired = new THREE.Vector3(tx, height.current, tz + sign * dist.current);
    camera.position.lerp(desired, 0.12);
    camera.lookAt(tx, 0, tz);
  });

  return null;
}

function GroundPicker({ size }: { size: { w: number; l: number } }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(size.w, size.l), [size.w, size.l]);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const x = e.point.x;
    const z = e.point.z;
    if (e.button === 2) mpAttackMove(x, z);
    else if (e.button === 0) mpMove(x, z);
  };
  return (
    <mesh
      geometry={geo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      onPointerDown={onDown}
      visible={false}
    >
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

export function MatchPvP({ match }: { match: MatchInfo }) {
  const map = useMemo(() => generateMap(match.seed, match.mode), [match.seed, match.mode]);
  // Fallback camera anchor: our own core, so the view is sensible before the hero spawns.
  const fallbackZ = map.cores[match.team].z;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "s" || e.key === "S") mpStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CanvasErrorBoundary>
    <Canvas
      {...withFleetCanvasProps(fleetMpCanvasProps, {
        camera: {
          position: [0, CAM_HEIGHT, fallbackZ + (match.team === 0 ? -CAM_DIST : CAM_DIST)],
          fov: 50,
        },
        onContextMenu: (e: MouseEvent) => e.preventDefault(),
        style: { position: "absolute", inset: 0 },
        onCreated: (state: RootState) =>
          attachWebGLContextGuard(state.gl.domElement, "grudge-mp"),
      })}
    >
      <AdaptiveDpr pixelated />
      <color attach="background" args={["#10141c"]} />
      {/* No scene fog — full map visibility (no FOW wash) */}
      <hemisphereLight args={["#ccd6ff", "#26301d", 0.85]} />
      <directionalLight position={[40, 70, 20]} intensity={1.55} castShadow shadow-mapSize={[1024, 1024]} />
      <Terrain map={map} />
      <Entities map={map} />
      <GroundPicker size={match.mapSize} />
      <CameraRig team={match.team} fallbackZ={fallbackZ} />
    </Canvas>
    </CanvasErrorBoundary>
  );
}
