import { Suspense, useEffect, useMemo, useRef, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { AdaptiveDpr, ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import {
  attachWebGLContextGuard,
  fleetPreviewCanvasProps,
  withFleetCanvasProps,
} from "@workspace/r3f-fleet";
import * as THREE from "three";
import {
  loadGrudge6CharacterInstance,
  type PreparedGrudge6Character,
} from "../../engine/grudge6Character";
import { unitTypeId } from "../../engine/grudge6";
import type { ClassId, PrefabRaceId } from "@workspace/game-content";
import { detectWebGL } from "../../lib/webgl";

/**
 * Canonical warcamp heights (meters). Orc = 2.0 m is the tallest frame reference;
 * other races scale relative so roster previews stay proportional.
 */
export const LOBBY_RACE_HEIGHT_M: Record<PrefabRaceId, number> = {
  orc: 2.0,
  barbarian: 1.92,
  human: 1.8,
  elf: 1.85,
  undead: 1.88,
  dwarf: 1.32,
};

export function lobbyHeroHeightM(raceId: PrefabRaceId): number {
  return LOBBY_RACE_HEIGHT_M[raceId] ?? 1.8;
}

/** Camera + orbit framing so a standing figure of height H fills the viewport. */
export function lobbyPreviewFrame(heightM: number) {
  const H = Math.max(1.1, heightM);
  return {
    fitHeight: H,
    cameraPosition: [0, H * 0.62, H * 1.95] as [number, number, number],
    target: [0, H * 0.52, 0] as [number, number, number],
    minDistance: H * 1.15,
    maxDistance: H * 2.85,
    fov: 34,
  };
}

function configurePreviewRenderer(state: RootState): void {
  attachWebGLContextGuard(state.gl.domElement, "warlord-preview");
  state.gl.outputColorSpace = THREE.SRGBColorSpace;
  state.gl.toneMapping = THREE.ACESFilmicToneMapping;
  state.gl.toneMappingExposure = 1.05;
  // Ensure canvas fills the CSS box (R3F sometimes boots at 0×0 in flex layouts)
  const parent = state.gl.domElement.parentElement;
  if (parent) {
    const { clientWidth: w, clientHeight: h } = parent;
    if (w > 0 && h > 0) {
      state.gl.setSize(w, h, false);
      state.setSize(w, h);
    }
  }
}

/** Keep renderer size in sync when the lobby grid reflows. */
function ResizeSync() {
  const { gl, setSize } = useThree();
  useEffect(() => {
    const el = gl.domElement.parentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 2 || cr.height < 2) return;
      gl.setSize(cr.width, cr.height, false);
      setSize(cr.width, cr.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [gl, setSize]);
  return null;
}

type Instance = PreparedGrudge6Character & { dispose: () => void };

function WarlordModel({
  raceId,
  classId,
  tint,
  fitHeight,
  onStatus,
}: {
  raceId: PrefabRaceId;
  classId: ClassId;
  tint?: string;
  fitHeight: number;
  onStatus: (status: "loading" | "ready" | "error", detail?: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const preparedRef = useRef<Instance | null>(null);
  const loadGenRef = useRef(0);
  const typeId = unitTypeId(raceId, classId);

  useEffect(() => {
    const gen = ++loadGenRef.current;
    preparedRef.current?.dispose();
    preparedRef.current = null;
    onStatus("loading");

    let cancelled = false;
    loadGrudge6CharacterInstance(typeId, { fitHeight, tint })
      .then((prepared) => {
        if (cancelled || gen !== loadGenRef.current) {
          prepared.dispose();
          return;
        }
        preparedRef.current = prepared;
        const g = groupRef.current;
        if (g) {
          g.clear();
          g.add(prepared.root);
        }
        prepared.director.setGaitTarget(false, false);
        onStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled || gen !== loadGenRef.current) return;
        onStatus(
          "error",
          err instanceof Error ? err.message : "Failed to load hero mesh",
        );
      });

    return () => {
      cancelled = true;
      loadGenRef.current += 1;
      preparedRef.current?.dispose();
      preparedRef.current = null;
      groupRef.current?.clear();
    };
  }, [typeId, tint, fitHeight, onStatus]);

  useFrame((_, dt) => {
    const p = preparedRef.current;
    if (!p) return;
    p.director.update(dt);
    // Slow turntable so gear/textures read clearly in the warcamp
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.28;
    }
  });

  return <group ref={groupRef} position={[0, 0, 0]} />;
}

function PreviewScene({
  raceId,
  classId,
  tint,
  onStatus,
}: {
  raceId: PrefabRaceId;
  classId: ClassId;
  tint?: string;
  onStatus: (status: "loading" | "ready" | "error", detail?: string) => void;
}) {
  const frame = useMemo(() => lobbyPreviewFrame(lobbyHeroHeightM(raceId)), [raceId]);

  return (
    <>
      <ResizeSync />
      <color attach="background" args={["#120e0a"]} />
      <fog attach="fog" args={["#120e0a", 8, 18]} />
      <AdaptiveDpr pixelated />
      <hemisphereLight args={["#f5e6c8", "#1a1210", 0.95]} />
      <directionalLight
        position={[3.2, 6.5, 2.8]}
        intensity={1.55}
        color="#ffe8c8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3.5, 2.2, -2.5]} intensity={0.55} color="#8aa8ff" />
      <ambientLight intensity={0.28} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial color="#1a1410" roughness={0.92} metalness={0.05} />
      </mesh>
      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.55}
        scale={4}
        blur={2.2}
        far={3}
      />
      <Suspense fallback={null}>
        <WarlordModel
          raceId={raceId}
          classId={classId}
          tint={tint}
          fitHeight={frame.fitHeight}
          onStatus={onStatus}
        />
        <Environment preset="warehouse" environmentIntensity={0.35} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={frame.minDistance}
        maxDistance={frame.maxDistance}
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.48}
        target={frame.target}
        autoRotate={false}
      />
    </>
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

/** Compact error boundary — do not replace the whole lobby with arena fallback. */
class PreviewErrorBoundary extends Component<
  { children: ReactNode; onError?: (msg: string) => void },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[warcamp-preview]", error, info);
    this.props.onError?.(error.message);
  }
  render() {
    if (this.state.error) {
      return <PreviewFallback reason={this.state.error} />;
    }
    return this.props.children;
  }
}

/**
 * Lobby warlord preview — independent GRUDGE6 Bip001 instance + idle director.
 * Never attaches the shared battle cache root (avoids mesh theft / empty canvas).
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
  const onStatus = useMemo(
    () => (next: "loading" | "ready" | "error", detail?: string) => {
      setStatus(next);
      setErrorDetail(detail);
    },
    [],
  );

  const frame = useMemo(() => lobbyPreviewFrame(lobbyHeroHeightM(raceId)), [raceId]);

  if (!support.ok) {
    return <PreviewFallback reason={support.reason} />;
  }

  return (
    <div className="gw-warlord-preview" data-status={status} data-race={raceId}>
      <PreviewErrorBoundary onError={(msg) => onStatus("error", msg)}>
        <Canvas
          key={`preview-${raceId}-${classId}`}
          className="gw-warlord-preview-canvas"
          style={{ width: "100%", height: "100%", display: "block" }}
          {...withFleetCanvasProps(fleetPreviewCanvasProps, {
            shadows: true,
            camera: {
              fov: frame.fov,
              near: 0.08,
              far: 50,
              position: frame.cameraPosition,
            },
            onCreated: configurePreviewRenderer,
            gl: { alpha: false, antialias: true, powerPreference: "high-performance" },
          })}
        >
          <PreviewScene raceId={raceId} classId={classId} tint={tint} onStatus={onStatus} />
        </Canvas>
      </PreviewErrorBoundary>
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
          <button
            type="button"
            className="gw-btn gw-btn-ghost gw-btn-mini"
            style={{ pointerEvents: "auto", marginTop: 8 }}
            onClick={() => {
              onStatus("loading");
              // remount by toggling key via force state
              setErrorDetail(undefined);
              setStatus("loading");
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      )}
    </div>
  );
}
