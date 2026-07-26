/**
 * Foot plant IK — post-mixer correction to reduce foot float / ground pierce.
 *
 * Patterns from three-player-controller LegIKController:
 *  - Raycast sole samples toward ground
 *  - Move only lifts feet that would penetrate (no downward suction while walking)
 *  - Optional pelvis drop to average plant height
 *  - Two-bone solve on upper/lower leg → foot
 *
 * Call order each frame:
 *   footIk.restore()  // if using pose stash
 *   mixer.update(dt)
 *   footIk.update(dt, { onGround, moving, colliderMeshes })
 *
 * Editable: `FOOT_IK` object.
 */

import * as THREE from "three";
import { solveTwoBoneIK } from "./ik";

export const FOOT_IK = {
  enabled: false, // opt-in until bones validated on grudge6 mixamo names
  /** Only correct while grounded. */
  requireGrounded: true,
  /** While locomoting, only lift penetrating feet (no pull-down). */
  moveLiftOnly: true,
  moveLiftThreshold: 0.0005,
  /** Max pelvis vertical adjust (m). */
  maxPelvisDrop: 0.1,
  /** Ray length down from sample (m). */
  rayLength: 0.9,
  /** Ray start height above foot (m). */
  rayStartUp: 0.35,
  /** IK weight 0..1. */
  weight: 0.85,
  /** Foot pitch align to ground normal weight. */
  footAlignWeight: 0.65,
  maxFootTilt: (35 * Math.PI) / 180,
  /** Bone name fragments (Mixamo / Bip001). */
  bones: {
    hips: ["Hips", "hips", "pelvis", "Bip001 Pelvis"],
    left: {
      up: ["LeftUpLeg", "L_Thigh", "Bip001 L Thigh"],
      low: ["LeftLeg", "L_Calf", "Bip001 L Calf"],
      foot: ["LeftFoot", "L_Foot", "Bip001 L Foot"],
    },
    right: {
      up: ["RightUpLeg", "R_Thigh", "Bip001 R Thigh"],
      low: ["RightLeg", "R_Calf", "Bip001 R Calf"],
      foot: ["RightFoot", "R_Foot", "Bip001 R Foot"],
    },
  },
};

export function patchFootIK(partial: Partial<typeof FOOT_IK>): void {
  Object.assign(FOOT_IK, partial);
}

function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found) return;
    for (const n of names) {
      if (o.name === n || o.name.endsWith(n) || o.name.includes(n)) {
        found = o;
        return;
      }
    }
  });
  return found;
}

const _ray = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _hit = new THREE.Vector3();
const _nml = new THREE.Vector3();
const _target = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export interface FootIkLeg {
  up: THREE.Object3D;
  low: THREE.Object3D;
  foot: THREE.Object3D;
}

export interface FootIkRig {
  hips: THREE.Object3D | null;
  left: FootIkLeg | null;
  right: FootIkLeg | null;
}

export function bindFootIkRig(skeletonRoot: THREE.Object3D): FootIkRig {
  const b = FOOT_IK.bones;
  const hips = findBone(skeletonRoot, b.hips);
  const mk = (side: typeof b.left): FootIkLeg | null => {
    const up = findBone(skeletonRoot, side.up);
    const low = findBone(skeletonRoot, side.low);
    const foot = findBone(skeletonRoot, side.foot);
    if (!up || !low || !foot) return null;
    return { up, low, foot };
  };
  return { hips, left: mk(b.left), right: mk(b.right) };
}

export interface FootIkUpdateOpts {
  onGround: boolean;
  moving: boolean;
  /** Ground meshes for raycast (terrain + static). */
  colliders: THREE.Object3D[];
  camera?: THREE.Camera | null;
}

/**
 * One-shot foot plant correction for a bound rig. Safe no-op if bones missing
 * or FOOT_IK.enabled is false.
 */
export function updateFootIk(rig: FootIkRig, opts: FootIkUpdateOpts): void {
  if (!FOOT_IK.enabled) return;
  if (FOOT_IK.requireGrounded && !opts.onGround) return;
  if (!opts.colliders.length) return;

  if (opts.camera) (_ray as THREE.Raycaster & { camera?: THREE.Camera }).camera = opts.camera;

  const plant = (leg: FootIkLeg | null) => {
    if (!leg) return;
    leg.foot.updateWorldMatrix(true, false);
    _origin.setFromMatrixPosition(leg.foot.matrixWorld);
    _origin.y += FOOT_IK.rayStartUp;
    _ray.set(_origin, _down);
    _ray.far = FOOT_IK.rayLength + FOOT_IK.rayStartUp;
    _ray.near = 0.01;

    let hits: THREE.Intersection[];
    try {
      hits = _ray.intersectObjects(opts.colliders, true);
    } catch {
      return;
    }
    if (!hits.length) return;
    const h = hits[0]!;
    _hit.copy(h.point);
    if (h.face) {
      _nml.copy(h.face.normal).transformDirection(h.object.matrixWorld).normalize();
    } else {
      _nml.copy(_up);
    }

    const footY = _origin.y - FOOT_IK.rayStartUp;
    const groundY = _hit.y;
    const penetrate = groundY > footY + FOOT_IK.moveLiftThreshold;

    if (opts.moving && FOOT_IK.moveLiftOnly && !penetrate) {
      return; // three-player-controller: don't suction feet while walking
    }

    // Target: plant slightly above hit
    _target.copy(_hit);
    _target.y += 0.02;

    // If floating high and not lifting-only case, only pull a little
    if (!penetrate && footY - groundY > 0.25) {
      _target.y = footY - Math.min(0.08, footY - groundY);
    }

    solveTwoBoneIK(leg.up, leg.low, leg.foot, _target, undefined, FOOT_IK.weight);

    // Soft foot align to normal
    if (FOOT_IK.footAlignWeight > 0.01) {
      leg.foot.updateWorldMatrix(true, false);
      const parent = leg.foot.parent;
      if (parent) {
        const w = FOOT_IK.footAlignWeight;
        // Simple tilt: rotate foot so +Y approaches ground normal, clamped
        const tilt = Math.min(
          FOOT_IK.maxFootTilt,
          _up.angleTo(_nml) * w,
        );
        if (tilt > 1e-4) {
          const axis = _n3scratch().crossVectors(_up, _nml);
          if (axis.lengthSq() > 1e-8) {
            axis.normalize();
            _q.setFromAxisAngle(axis, tilt);
            // apply in world then convert — simplified local multiply
            leg.foot.quaternion.premultiply(_q);
          }
        }
      }
    }
  };

  plant(rig.left);
  plant(rig.right);
}

const _axisScratch = new THREE.Vector3();
function _n3scratch() {
  return _axisScratch;
}
