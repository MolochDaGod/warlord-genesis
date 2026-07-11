import * as THREE from "three";

const _mid = new THREE.Vector3();
const _curve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
);

export function projectileArcPosition(
  from: THREE.Vector3,
  dir: THREE.Vector3,
  traveled: number,
  dist: number,
  arc: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  out.copy(from).addScaledVector(dir, traveled);
  if (arc > 0 && dist > 1e-3) {
    const f = traveled / dist;
    out.y += arc * 4 * f * (1 - f);
  }
  return out;
}

export function bezierArcPosition(
  from: THREE.Vector3,
  to: THREE.Vector3,
  arcPeak: number,
  t: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  _mid.copy(from).add(to).multiplyScalar(0.5);
  _mid.y += arcPeak;
  _curve.v0.copy(from);
  _curve.v1.copy(_mid);
  _curve.v2.copy(to);
  return _curve.getPoint(Math.min(1, Math.max(0, t)), out);
}

export function meleeSwingArc(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  reach: number,
  halfAngle: number,
  segments: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const yaw = Math.atan2(dir.x, dir.z);
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = yaw - halfAngle + t * halfAngle * 2;
    tmp.set(origin.x + Math.sin(a) * reach, origin.y + 0.9, origin.z + Math.cos(a) * reach);
    pts.push(tmp.clone());
  }
  return pts;
}