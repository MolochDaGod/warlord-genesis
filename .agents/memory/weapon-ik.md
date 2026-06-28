---
name: Weapon support-hand IK
description: How two-handed weapons keep the off hand locked to the weapon mesh in the voxel rig
---

# Weapon support-hand IK

Two-handed weapons (rifle/`ranged`, and 2H melee: greatsword, spear, greataxe, hammer2h) lock the
off (support) hand onto a grip anchor that lives on the weapon mesh, via an analytic two-bone IK pass.

**Rule:** the weapon stays parented to its primary hand mount (driven by the animation clips). The
support hand is corrected *after* the mixer each frame — never bake IK into the clip or the bone rest
pose.

**Why:** the rig has no IK in the clips; without this the support hand floats next to the prop. A
post-mixer correction is non-destructive because the mixer rewrites the arm next frame, so there is no
drift/stacking. Skipping the pass while a one-shot is active (`Animator.once`) lets reload/attack clips
move the support hand off the weapon naturally.

**How to apply:**
- Grip anchors are plain `Object3D` children of the weapon group (`addGrip` in `weapons.ts`), exposed as
  `MountedWeapons.supportGrip` ({node, hand, rotOffset}). No GPU resources, so disposal rides on
  `unmountWeapons` removing the weapon group.
- `Animator.applyWeaponIK()` runs after every `mixer.update(dt)` (both ground and traversal paths),
  reads the grip world transform, solves `solveTwoBoneIK(arm, forearm, hand, target)` then
  `alignBoneToWorldQuat(hand, gripWorldQuat, rotOffset)` (ik.ts).
- Identity grip rotation makes the support hand match the primary hand's orientation (grip inherits the
  weapon = primary-hand frame). Tune by giving the grip a non-zero euler in `addGrip`.
- Solver reads original pose, converts world axes into bone-local space, post-multiplies local
  quaternions once. Clamps unreachable targets and guards degenerate/straight-limb axes.

**Perf note:** each pass calls `skeletonRoot.updateMatrixWorld(true)` + per-bone updates. Fine for the
few heroes/preview today; if large 2H-armed crowds appear, gate by distance/LOD or off-screen.

**Gap (not addressed):** `pistol` weapon class has no mesh in `mountWeapons` (falls through to EMPTY);
`ranged` builds the rifle. Drifter hero (pistol) therefore holds nothing until a pistol build is added.
