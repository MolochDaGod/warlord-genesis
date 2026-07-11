import * as THREE from "three";
import { damp } from "maath/easing";

export { damp };

const _flat = new THREE.Vector3();
const _dampPos = { value: 0 };

export function flatYaw(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function flatAimDir(
  from: THREE.Vector3,
  to: THREE.Vector3,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.set(to.x - from.x, 0, to.z - from.z).normalize();
}

export function dampScalar(current: number, target: number, lambda: number, dt: number): number {
  _dampPos.value = current;
  damp(_dampPos, "value", target, lambda, dt);
  return _dampPos.value;
}

export function dampYaw(current: number, target: number, lambda: number, dt: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return dampScalar(current, current + delta, lambda, dt);
}

export function flatAngle(a: THREE.Vector3, b: THREE.Vector3): number {
  _flat.copy(a);
  _flat.y = 0;
  const lenA = _flat.length();
  const lenB = Math.hypot(b.x, b.z);
  if (lenA < 1e-6 || lenB < 1e-6) return 0;
  return Math.acos(Math.min(1, Math.max(-1, (_flat.x * b.x + _flat.z * b.z) / (lenA * lenB))));
}