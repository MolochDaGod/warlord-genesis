# Third-person camera + IK review

Reference: [hh-hang/three-player-controller](https://github.com/hh-hang/three-player-controller)  
Local clone: `F:\GitHub\three-player-controller`

## Summary

| Area | Ours (warlord-genesis) | Reference best practice | Status |
|------|------------------------|-------------------------|--------|
| **Support hand IK** | Analytic two-bone + grip align (`anim/ik.ts`, `Animator.applyWeaponIK`) | Post-mixer IK; weight; skip one-shots | **Improved** — `HAND_IK` editable knobs, weight blend, skip one-shot flag |
| **Foot IK** | Missing | LegIKController: ray sole samples, lift-only while moving, pelvis drop, CCD option | **Added** — `anim/footIk.ts` (opt-in `FOOT_IK.enabled = false` until bones validated) |
| **TPS camera** | Combat orbit + occlusion + command RTS | Spring target, lookAt height ratio, min/max dist, over-shoulder, collisionLerp | **Improved** — `game/thirdPersonCamera.ts` (`TPC`) wired into `Player.tsx` |
| **Occlusion** | `resolveCameraOcclusion` scene ray | Collider ray + epsilon + lerp | Good; now uses TPC margin + collisionLerp |
| **Editability** | Magic constants in Player | Config objects / GUI | **TPC / HAND_IK / FOOT_IK** patchable at runtime |

## Frame order (best practice)

```
1. Restore last-frame IK deltas (optional pose stash)
2. AnimationMixer.update(dt)     // pure clip pose
3. Hand IK post-pass             // support grip
4. Foot IK post-pass             // ground plant (if enabled)
5. skeletonRoot.updateMatrixWorld
6. Camera follow + occlusion
```

three-player-controller LegIK explicitly does `restore → player.update → legIK.update`.

## Editable APIs

### Camera — `TPC` / `patchTPC`

```ts
import { TPC, patchTPC } from "./game/thirdPersonCamera";

patchTPC({
  combatDistance: 4.8,
  overShoulderM: 0.55,
  lookAtHeightRatio: 0.8,
  collisionLerp: 0.2,
  followRate: 16,
  enableSpringTarget: true,
});
```

### Hand IK — `HAND_IK` / `patchHandIK`

```ts
import { HAND_IK, patchHandIK } from "./game/anim/ik";

patchHandIK({ weight: 0.9, skipDuringOneShot: true, alignHandRotation: true });
```

### Foot IK — `FOOT_IK` / `patchFootIK` (opt-in)

```ts
import { FOOT_IK, patchFootIK, bindFootIkRig, updateFootIk } from "./game/anim/footIk";

patchFootIK({ enabled: true, moveLiftOnly: true, weight: 0.8 });
const rig = bindFootIkRig(skeletonRoot);
// after mixer:
updateFootIk(rig, { onGround: true, moving: speed > 0.1, colliders: [terrain] });
```

## RTS-Grudge camera

`client/src/game/components/Camera.tsx` already has strong multi-mode (MMO / Action / Overhead). Configs are now **exported** + `patchCameraModeConfig` for runtime edit; collisionLerp / lookAtHeightRatio fields documented for future occlusion pass.

## Gaps / next steps

1. **Enable foot IK** on grudge6 Bip001 after sole bone names confirmed in-game.
2. **Mesh-BVH** firstHitOnly on occlusion rays (reference uses three-mesh-bvh) for large islands.
3. **lil-gui** debug panel binding TPC/HAND_IK/FOOT_IK in DEV.
4. Optional **CCD** for legs on steep slopes (reference `ccdIK.js`) if two-bone foot plant fails on cliffs.
