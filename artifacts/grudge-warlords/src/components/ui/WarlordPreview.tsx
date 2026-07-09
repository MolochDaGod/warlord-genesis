import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  attachWebGLContextGuard,
  fleetPreviewCanvasProps,
  withFleetCanvasProps,
} from "@workspace/r3f-fleet";
import * as THREE from "three";
import { loadGrudge6Character, type PreparedGrudge6Character } from "../../engine/grudge6Character";
import { unitTypeId } from "../../engine/grudge6";
import type { ClassId, PrefabRaceId } from "@workspace/game-content";

function WarlordModel({
  raceId,
  classId,
  tint,
}: {
  raceId: PrefabRaceId;
  classId: ClassId;
  tint?: string;
}) {
  const preparedRef = useRef<PreparedGrudge6Character | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const typeId = unitTypeId(raceId, classId);

  useEffect(() => {
    let cancelled = false;
    preparedRef.current = null;
    loadGrudge6Character(typeId, { fitHeight: 2.15, tint }).then((prepared) => {
      if (cancelled) {
        prepared.mixer.stopAllAction();
        return;
      }
      preparedRef.current = prepared;
      const g = groupRef.current;
      if (g) {
        g.clear();
        g.add(prepared.root);
      }
      prepared.actions.idle?.reset().fadeIn(0.2).play();
    });
    return () => {
      cancelled = true;
      preparedRef.current?.mixer.stopAllAction();
      preparedRef.current = null;
    };
  }, [typeId, tint]);

  useFrame((_, dt) => {
    preparedRef.current?.mixer.update(dt);
  });

  return <group ref={groupRef} position={[0, -0.05, 0]} />;
}

/**
 * Lobby warlord preview — canonical GRUDGE6 Bip001 mesh + baked idle (viewer pipeline).
 */
export function WarlordPreview({
  raceId,
  classId,
  tint,
}: {
  raceId: PrefabRaceId;
  classId: ClassId;
  tint?: string;
}) {
  return (
    <div className="gw-warlord-preview">
      <Canvas
        {...withFleetCanvasProps(fleetPreviewCanvasProps, {
          camera: { fov: 38, near: 0.1, far: 40, position: [0, 1.35, 3.6] },
          onCreated: (state: RootState) =>
            attachWebGLContextGuard(state.gl.domElement, "warlord-preview"),
        })}
      >
        <color attach="background" args={["#0e0a08"]} />
        <hemisphereLight args={["#f3e6c8", "#1a100c", 0.85]} />
        <directionalLight position={[2.5, 5, 3]} intensity={1.35} color="#ffe8c8" />
        <directionalLight position={[-3, 2.5, -2]} intensity={0.45} color="#9bb6ff" />
        <ambientLight intensity={0.35} />
        <Suspense fallback={null}>
          <WarlordModel raceId={raceId} classId={classId} tint={tint} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2.4}
          maxDistance={5.5}
          minPolarAngle={Math.PI * 0.28}
          maxPolarAngle={Math.PI * 0.52}
          target={[0, 1.05, 0]}
        />
      </Canvas>
      <div className="gw-warlord-preview-plate" aria-hidden />
    </div>
  );
}