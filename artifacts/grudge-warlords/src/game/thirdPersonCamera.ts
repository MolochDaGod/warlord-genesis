/**
 * Editable third-person camera tuning — aligned with three-player-controller
 * best practices (hh-hang/three-player-controller CameraSystem):
 *
 *  - lookAt height as ratio of capsule (not a magic constant only)
 *  - min/max orbit distance + zoom
 *  - over-shoulder offset (action / combat)
 *  - spring / exponential follow on target + position
 *  - occlusion raycast with collision lerp (smooth pull-in, not hard snap)
 *  - polar angle clamp to avoid gimbal lock at poles
 *  - editable mouse sensitivity, FOV ease
 *
 * Mutate `TPC` at runtime (cheats / debug panel) or pass overrides into
 * `applyThirdPersonCombatCamera`.
 *
 * Reference: https://github.com/hh-hang/three-player-controller
 */

import * as THREE from "three";
import { resolveCameraOcclusion } from "./cameraOcclusion";

// ── Editable knobs (mutate freely) ───────────────────────────────────────────

export const TPC = {
  /** Pivot height above feet as fraction of character height (0 = feet, 1 = top). */
  lookAtHeightRatio: 0.82,
  /** Character height used when converting ratio → world Y (m). */
  characterHeightM: 1.85,

  // Orbit framing
  combatDistance: 4.35,
  commandDistance: 14,
  commandLift: 12,
  /** Over-shoulder lateral offset (m); 0 = dead center. */
  overShoulderM: 0.48,
  zoomMin: 0.55,
  zoomMax: 2.2,
  zoomStep: 0.12,

  // Smoothing (higher = snappier). Matches exp(-rate * dt) form.
  /** Position follow rate while free. */
  followRate: 14,
  /** Look yaw/pitch mouse-look smoothing time constant (s). */
  lookSmoothing: 0.05,
  /** Occlusion distance fraction lerp rate (1/s). */
  occlusionLerpRate: 22,
  /** Soft pull-in when occluded: lerp factor per frame (0..1 style, *not* rate). */
  collisionLerp: 0.18,
  /** Margin past hit surface before camera rests (m). */
  occlusionMargin: 0.32,
  /** Never pull closer than this fraction of desired distance. */
  minOcclusionFrac: 0.22,

  // Pitch limits (radians) — combat mouse-look
  pitchMin: -1.15,
  pitchMax: 0.95,

  // FOV
  fov: 58,
  sprintFov: 64,
  fovEase: 6,

  // Optional critically-damped spring on look target (Game Programming Gems style)
  enableSpringTarget: false,
  springSmoothTime: 0.06,

  // Debug / edit flags
  debugDrawPivot: false,
};

export type ThirdPersonCameraConfig = typeof TPC;

/** Deep-assign partial knobs (for cheats / editor). */
export function patchTPC(partial: Partial<ThirdPersonCameraConfig>): void {
  Object.assign(TPC, partial);
}

// ── Scratch ──────────────────────────────────────────────────────────────────

const _pivot = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _side = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _final = new THREE.Vector3();
const _springVel = new THREE.Vector3();
const _springOut = new THREE.Vector3();

/**
 * Critically-damped spring (Game Programming Gems 4 / Game Feel).
 * Same structure as three-player-controller CameraSystem.springTarget.
 */
export function springVec3(
  current: THREE.Vector3,
  target: THREE.Vector3,
  velocity: THREE.Vector3,
  delta: number,
  smoothTime: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * delta;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const a of ["x", "y", "z"] as const) {
    const change = current[a] - target[a];
    const temp = (velocity[a] + omega * change) * delta;
    velocity[a] = (velocity[a] - omega * temp) * exp;
    let o = target[a] + (change + temp) * exp;
    if (target[a] - current[a] > 0 === o > target[a]) {
      o = target[a];
      velocity[a] = 0;
    }
    out[a] = o;
  }
  return out;
}

export interface CombatCameraFrameArgs {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  /** Feet / capsule origin (world). */
  feet: THREE.Vector3;
  /** Already-smoothed look yaw / pitch (radians). */
  yaw: number;
  pitch: number;
  zoom: number;
  dt: number;
  /** Ignore hero mesh for occlusion. */
  ignoreRoot: THREE.Object3D | null;
  /** Entering combat this frame → snap. */
  snap?: boolean;
  /** Occlusion fraction state (persist across frames). */
  occlFrac: { current: number };
  /** Optional spring velocity for look pivot. */
  springVel?: THREE.Vector3;
}

/**
 * Apply combat third-person framing for one frame (quaternion already set by caller).
 * Returns pivot used for look-at / aim.
 */
export function applyThirdPersonCombatCamera(args: CombatCameraFrameArgs): THREE.Vector3 {
  const {
    camera,
    scene,
    feet,
    yaw,
    pitch,
    zoom,
    dt,
    ignoreRoot,
    snap,
    occlFrac,
  } = args;

  const lookH = TPC.characterHeightM * TPC.lookAtHeightRatio;
  _pivot.set(feet.x, feet.y + lookH, feet.z);

  if (TPC.enableSpringTarget && args.springVel) {
    springVec3(_pivot, _pivot, args.springVel, dt, TPC.springSmoothTime, _springOut);
    // pivot is already dest; spring useful when feet lag — keep API for future target lag
  }

  // Camera orientation is assumed set from yaw/pitch (YXZ). Build orbit offset.
  _side.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _side.y = 0;
  if (_side.lengthSq() > 1e-6) _side.normalize();
  camera.getWorldDirection(_dir).normalize();

  const dist = TPC.combatDistance * zoom;
  _desired
    .copy(_pivot)
    .addScaledVector(_dir, -dist)
    .addScaledVector(_side, TPC.overShoulderM);

  const occluded = resolveCameraOcclusion(
    scene,
    _pivot,
    _desired,
    ignoreRoot,
    TPC.occlusionMargin,
    camera,
  );

  const fullLen = _pivot.distanceTo(_desired);
  const safeLen = _pivot.distanceTo(occluded);
  const wantFrac =
    fullLen > 1e-4
      ? THREE.MathUtils.clamp(safeLen / fullLen, TPC.minOcclusionFrac, 1)
      : 1;

  if (snap) {
    occlFrac.current = wantFrac;
  } else {
    // Blend occlusion frac (rate-based) then soft collision lerp on position
    const occlEase = 1 - Math.exp(-TPC.occlusionLerpRate * dt);
    occlFrac.current += (wantFrac - occlFrac.current) * occlEase;
  }

  _final.copy(_pivot).lerp(_desired, occlFrac.current);

  // Soft collision pull (three-player-controller style) when strongly occluded
  if (wantFrac < 0.98 && !snap) {
    _final.lerp(occluded, TPC.collisionLerp);
  }

  if (snap) {
    camera.position.copy(_final);
  } else {
    camera.position.lerp(_final, 1 - Math.exp(-TPC.followRate * dt));
  }

  return _pivot;
}

export function clampPitch(p: number): number {
  return THREE.MathUtils.clamp(p, TPC.pitchMin, TPC.pitchMax);
}

export function clampZoom(z: number): number {
  return THREE.MathUtils.clamp(z, TPC.zoomMin, TPC.zoomMax);
}
