/**
 * Rapier kinematic CCT + downward ray — play contract.
 * Mesh is a costume. This capsule walks Sanctum trimesh / heightfield.
 */
import type { RapierRigidBody, World, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

export const CCT = {
  capsuleHalf: 0.45,
  capsuleRadius: 0.28,
  offset: 0.01,
  autostepH: 0.35,
  autostepR: 0.25,
  snap: 0.45,
  gravity: 28,
  rayLen: 2.4,
} as const;

export type CctTickInput = {
  wishX: number;
  wishZ: number;
  speed: number;
  jump: boolean;
  dt: number;
};

/**
 * Down-ray from capsule center. Grounded if hit within snap+radius.
 * Use world.castRay from @react-three/rapier / rapier3d-compat.
 */
export function rayGrounded(
  world: { castRay: (ray: unknown, max: number, solid: boolean) => { toi: number } | null },
  rapier: { Ray: new (orig: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }) => unknown },
  origin: { x: number; y: number; z: number },
  maxToi = CCT.rayLen,
): { grounded: boolean; toi: number } {
  const ray = new rapier.Ray(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: 0, y: -1, z: 0 },
  );
  const hit = world.castRay(ray, maxToi, true);
  if (!hit) return { grounded: false, toi: maxToi };
  const toi = hit.toi;
  const limit = CCT.capsuleHalf + CCT.capsuleRadius + CCT.snap;
  return { grounded: toi <= limit, toi };
}

/** Desired planar move + gravity for computeColliderMovement. */
export function desiredMove(input: CctTickInput, grounded: boolean, vy: number): THREE.Vector3 {
  const dt = Math.min(input.dt, 0.05);
  let nextVy = vy;
  if (!grounded) nextVy -= CCT.gravity * dt;
  else if (input.jump) nextVy = 9.2;
  else nextVy = Math.min(0, nextVy);
  return new THREE.Vector3(input.wishX * input.speed * dt, nextVy * dt, input.wishZ * input.speed * dt);
}

/** Copy kinematic body translation onto the skinned root (soles at capsule feet). */
export function syncMeshToCct(
  root: THREE.Object3D,
  body: RapierRigidBody | RigidBody,
  meshYOffset = -(CCT.capsuleHalf + CCT.capsuleRadius),
): void {
  const t = body.translation();
  root.position.set(t.x, t.y + meshYOffset, t.z);
}

export type { World };
