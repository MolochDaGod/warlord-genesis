import * as THREE from "three";

/**
 * Analytic two-bone inverse kinematics, applied as a per-frame post-process AFTER
 * the AnimationMixer has posed the skeleton. We use it to lock a character's
 * support hand onto a grip anchor that lives on the weapon mesh, so two-handed
 * weapons (rifle, greatsword, spear...) are actually held with both hands instead
 * of one hand floating next to the prop.
 *
 * The math is the classic closed-form solver (law of cosines for the elbow bend,
 * then a single swing that aims the limb at the target). Axes/angles are read from
 * the original pose and converted into each bone's local space, then applied once
 * to the local rotations — this is numerically stable and avoids the drift you get
 * from mutating world matrices mid-solve.
 */

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _ca = new THREE.Vector3();
const _ba = new THREE.Vector3();
const _ta = new THREE.Vector3();
const _cb = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _n1 = new THREE.Vector3();
const _n2 = new THREE.Vector3();
const _n3 = new THREE.Vector3();
const _axis0 = new THREE.Vector3();
const _axis1 = new THREE.Vector3();
const _ax0r = new THREE.Vector3();
const _ax0m = new THREE.Vector3();
const _ax1r = new THREE.Vector3();
const _rootWQ = new THREE.Quaternion();
const _midWQ = new THREE.Quaternion();
const _rootInv = new THREE.Quaternion();
const _midInv = new THREE.Quaternion();
const _r0 = new THREE.Quaternion();
const _r1 = new THREE.Quaternion();
const _r2 = new THREE.Quaternion();
const _parentWQ = new THREE.Quaternion();
const _parentInv = new THREE.Quaternion();
const _desired = new THREE.Quaternion();

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);

/**
 * Bend `root`→`mid`→`tip` so `tip` reaches `targetWorld`. `poleWorld` hints which
 * way the elbow points; when omitted the current (animated) elbow position is used,
 * which keeps the bend in its natural plane and avoids pops.
 */
export function solveTwoBoneIK(
  root: THREE.Object3D,
  mid: THREE.Object3D,
  tip: THREE.Object3D,
  targetWorld: THREE.Vector3,
  poleWorld?: THREE.Vector3,
): void {
  root.updateWorldMatrix(true, false);
  mid.updateWorldMatrix(true, false);
  tip.updateWorldMatrix(true, false);

  const a = _a.setFromMatrixPosition(root.matrixWorld);
  const b = _b.setFromMatrixPosition(mid.matrixWorld);
  const c = _c.setFromMatrixPosition(tip.matrixWorld);
  const t = _t.copy(targetWorld);

  const lab = a.distanceTo(b);
  const lcb = b.distanceTo(c);
  if (lab < 1e-5 || lcb < 1e-5) return;
  const lat = THREE.MathUtils.clamp(a.distanceTo(t), 1e-4, lab + lcb - 1e-4);

  const ca = _ca.subVectors(c, a);
  const ba = _ba.subVectors(b, a);
  const ta = _ta.subVectors(t, a);
  const cb = _cb.subVectors(c, b);
  const ab = _ab.subVectors(a, b);

  // Current and desired interior angles.
  const acAb0 = Math.acos(clamp1(_n1.copy(ca).normalize().dot(_n2.copy(ba).normalize())));
  const baBc0 = Math.acos(clamp1(_n1.copy(ab).normalize().dot(_n2.copy(cb).normalize())));
  const acAt0 = Math.acos(clamp1(_n1.copy(ca).normalize().dot(_n2.copy(ta).normalize())));
  const acAb1 = Math.acos(clamp1((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat)));
  const baBc1 = Math.acos(clamp1((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb)));

  // Elbow hinge axis (bend plane normal) and the swing axis that aims at the target.
  const pole = poleWorld ?? b;
  const axis0 = _axis0.copy(ca).cross(_n3.subVectors(pole, a));
  if (axis0.lengthSq() < 1e-9) {
    axis0.copy(ca).cross(_n3.set(0, 1, 0));
    if (axis0.lengthSq() < 1e-9) axis0.copy(ca).cross(_n3.set(1, 0, 0));
  }
  axis0.normalize();
  const axis1 = _axis1.copy(ca).cross(ta);
  const aimable = axis1.lengthSq() >= 1e-9;
  if (aimable) axis1.normalize();

  root.getWorldQuaternion(_rootWQ);
  mid.getWorldQuaternion(_midWQ);
  _rootInv.copy(_rootWQ).invert();
  _midInv.copy(_midWQ).invert();

  // Convert the world-space axes into each bone's local frame, then post-multiply.
  const a0root = _ax0r.copy(axis0).applyQuaternion(_rootInv).normalize();
  const a0mid = _ax0m.copy(axis0).applyQuaternion(_midInv).normalize();
  _r0.setFromAxisAngle(a0root, acAb1 - acAb0);
  _r1.setFromAxisAngle(a0mid, baBc1 - baBc0);

  root.quaternion.multiply(_r0);
  if (aimable) {
    const a1root = _ax1r.copy(axis1).applyQuaternion(_rootInv).normalize();
    _r2.setFromAxisAngle(a1root, acAt0);
    root.quaternion.multiply(_r2);
  }
  mid.quaternion.multiply(_r1);

  root.updateMatrixWorld(true);
}

/**
 * Set `bone`'s world orientation to `targetWorld` (optionally times a local
 * `offset`), so e.g. the support hand visibly wraps the grip rather than keeping
 * whatever rotation the locomotion clip left it in.
 */
export function alignBoneToWorldQuat(
  bone: THREE.Object3D,
  targetWorld: THREE.Quaternion,
  offset?: THREE.Quaternion,
): void {
  const parent = bone.parent;
  if (!parent) return;
  parent.getWorldQuaternion(_parentWQ);
  _parentInv.copy(_parentWQ).invert();
  _desired.copy(targetWorld);
  if (offset) _desired.multiply(offset);
  bone.quaternion.copy(_parentInv.multiply(_desired));
  bone.updateMatrixWorld(true);
}
