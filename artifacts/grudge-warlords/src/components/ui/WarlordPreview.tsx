import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, type RootState } from "@react-three/fiber";
import { AdaptiveDpr, OrbitControls } from "@react-three/drei";
import {
  attachWebGLContextGuard,
  fleetPreviewCanvasProps,
  withFleetCanvasProps,
} from "@workspace/r3f-fleet";
import * as THREE from "three";
import { loadGrudge6Character, type PreparedGrudge6Character } from "../../engine/grudge6Character";
import { unitTypeId } from "../../engine/grudge6";
import type { ClassId, PrefabRaceId } from "@workspace/game-content";
import { detectWebGL } from "../../lib/webgl";
import { CanvasErrorBoundary } from "../game/CanvasFallback";

function configurePreviewRenderer(state: RootState): void {
  attachWebGLContextGuard(state.gl.domElement, "warlord-preview");
  state.gl.outputColorSpace = THREE.SRGBColorSpace;
  state.gl.toneMapping = THREE.ACESFilmicToneMapping;
  state.gl.toneMappingExposure = 1;
}

/**
 * Attach a cached GRUDGE6 root for lobby preview only — never dispose the shared
 * cache entry (mixer/director are reused by battle rigs).
 */
function attachCachedRoot(group: THREE.Group, prepared: PreparedGrudge6Character): void {
  prepared.root.removeFromParent();
  group.clear();
  group.add(prepared.root);
  prepared.director.setGaitTarget(false, false);
}

function WarlordModel({
  raceId,
  classId,
  tint,
  onStatusRef,
}: {
  raceId: PrefabRaceId;
  classId: ClassId;
  tint?: string;
  onStatusRef: MutableRefObject<(status: "loading" | "ready" | "error", detail?: string) => void>;
}) {
  const preparedRef = useRef<PreparedGrudge6Character | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const loadGenRef = useRef(0);
  const typeId = unitTypeId(raceId, classId);

  useEffect(() => {
    const gen = ++loadGenRef.current;
    preparedRef.current = null;
    onStatusRef.current("loading");

    loadGrudge6Character(typeId, { fitHeight: 2.15, tint })
      .then((prepared) => {
        if (gen !== loadGenRef.current) return;
        preparedRef.current = prepared;
        const g = groupRef.current;
        if (g) attachCachedRoot(g, prepared);
        onStatusRef.current("ready");
      })
      .catch((err: unknown) => {
        if (gen !== loadGenRef.current) return;
        onStatusRef.current(
          "error",
          err instanceof Error ? err.message : "Failed to load hero mesh",
        );
      });

    return () => {
      loadGenRef.current += 1;
      const prepared = preparedRef.current;
      if (prepared) prepared.root.removeFromParent();
      preparedRef.current = null;
    };
  }, [typeId, tint, onStatusRef]);

  useFrame((_, dt) => {
    preparedRef.current?.director.update(dt);
  });

  return <group ref={groupRef} position={[0, -0.05, 0]} />;
}

function PreviewCanvas({
  raceId,
  classId,
  tint,
  onStatusRef,
}: {
  raceId: PrefabRaceId;
  classId: ClassId;
  tint?: string;
  onStatusRef: MutableRefObject<(status: "loading" | "ready" | "error", detail?: string) => void>;
}) {
  return (
    <Canvas
      {...withFleetCanvasProps(fleetPreviewCanvasProps, {
        camera: { fov: 38, near: 0.1, far: 40, position: [0, 1.35, 3.6] },
        onCreated: configurePreviewRenderer,
      })}
    >
      <color attach="background" args={["#0e0a08"]} />
      <AdaptiveDpr pixelated />
      <hemisphereLight args={["#f3e6c8", "#1a100c", 0.85]} />
      <directionalLight position={[2.5, 5, 3]} intensity={1.35} color="#ffe8c8" />
      <directionalLight position={[-3, 2.5, -2]} intensity={0.45} color="#9bb6ff" />
      <ambientLight intensity={0.35} />
      <Suspense fallback={null}>
        <WarlordModel raceId={raceId} classId={classId} tint={tint} onStatusRef={onStatusRef} />
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
  );
}

function PreviewFallback({ reason }: { reason?: string }) {
  return (
    <div className="gw-warlord-preview gw-warlord-preview--fallback" role="status">
      <span className="gw-warlord-preview-fallback-title">3D preview offline</span>
      <span className="gw-deploy-hint">{reason ?? "WebGL unavailable on this device."}</span>
    </div>
  );
}

/**
 * Lobby warlord preview — canonical GRUDGE6 Bip001 mesh + AnimationDirector idle.
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
  const support = useMemo(() => detectWebGL(), []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorDetail, setErrorDetail] = useState<string>();
  const onStatusRef = useRef<(s: "loading" | "ready" | "error", detail?: string) => void>(
    () => {},
  );
  onStatusRef.current = (next, detail) => {
    setStatus(next);
    setErrorDetail(detail);
  };

  if (!support.ok) {
    return <PreviewFallback reason={support.reason} />;
  }

  return (
    <div className="gw-warlord-preview">
      <CanvasErrorBoundary>
        <PreviewCanvas raceId={raceId} classId={classId} tint={tint} onStatusRef={onStatusRef} />
      </CanvasErrorBoundary>
      <div className="gw-warlord-preview-plate" aria-hidden />
      {status === "loading" && (
        <div className="gw-warlord-preview-overlay" aria-live="polite">
          <span className="gw-play-boot-spinner" aria-hidden />
          <span>Loading GRUDGE6 mesh…</span>
        </div>
      )}
      {status === "error" && (
        <div className="gw-warlord-preview-overlay gw-warlord-preview-overlay--error" role="alert">
          <span>{errorDetail ?? "Hero mesh failed to load"}</span>
        </div>
      )}
    </div>
  );
}