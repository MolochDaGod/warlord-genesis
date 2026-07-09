/**
 * Canonical React Three Fiber Canvas defaults for Grudge fleet deployment.
 * Spread onto `<Canvas>` — never replaces per-scene camera/children.
 */
import * as THREE from "three";
import type { CanvasProps } from "@react-three/fiber";

/** Cap DPR on mobile GPUs — matches Three.js fundamentals skill guidance. */
export const FLEET_MAX_DPR = 1.5;
export const FLEET_DPR: [number, number] = [1, FLEET_MAX_DPR];

export function fleetGl(
  overrides: Partial<WebGLRendererParameters> = {},
): CanvasProps["gl"] {
  return {
    antialias: true,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
    ...overrides,
  };
}

/** Main warcamp / arena match — shadows + capped DPR. */
export const fleetArenaCanvasProps: Partial<CanvasProps> = {
  shadows: { type: THREE.PCFShadowMap },
  gl: fleetGl(),
  dpr: FLEET_DPR,
};

/** Lobby hero preview — transparent backdrop. */
export const fleetPreviewCanvasProps: Partial<CanvasProps> = {
  gl: fleetGl({ alpha: true }),
  dpr: FLEET_DPR,
};

/** Open-world sailing sector view. */
export const fleetWorldCanvasProps: Partial<CanvasProps> = {
  shadows: true,
  gl: fleetGl(),
  dpr: FLEET_DPR,
};

/** MP / lightweight scenes — no shadow map cost. */
export const fleetMpCanvasProps: Partial<CanvasProps> = {
  shadows: true,
  gl: fleetGl(),
  dpr: [1, 1.25] satisfies [number, number],
};

/** Merge fleet defaults with scene-specific overrides (camera, style, onCreated). */
export function withFleetCanvasProps(
  base: Partial<CanvasProps>,
  overrides: Partial<CanvasProps> = {},
): Partial<CanvasProps> {
  const glBase = (base.gl ?? {}) as Record<string, unknown>;
  const glOver = (overrides.gl ?? {}) as Record<string, unknown>;
  return {
    ...base,
    ...overrides,
    gl: { ...glBase, ...glOver },
    dpr: overrides.dpr ?? base.dpr,
    shadows: overrides.shadows ?? base.shadows,
  };
}