# Three.js animation helpers

Ported from [SamuraiThirdPersonTemplateThreeJS](https://github.com/MolochDaGod/SamuraiThirdPersonTemplateThreeJS) and the clip contract in [threejs-game-skills](https://github.com/MolochDaGod/threejs-game-skills) (`idle / walk / run / jump / attack`).

## Layout

| File | Role |
|------|------|
| `engine/threeAnim/retargetClip.ts` | Mixamo/Bip001 bind: drop unknown joints, **scale translations from bone length** (never hips), freeze hips XZ |
| `engine/threeAnim/phaseLock.ts` | Walk is master gait; run/sprint share its phase + stride `timeScale` |
| `engine/threeAnim/conceptClips.ts` | Name map: idle, walk, run, slash, kick, jump, land, crouch |
| `engine/threeAnim/index.ts` | Public API |

## Rules we kept from the Samurai template

1. **Skin ≠ motion.** File clips bind first. Baked JSON only fills missing bands.
2. **Controller owns XZ.** Horizontal hips travel is frozen; vertical bob stays.
3. **Units from bone length.** Hips translation is *pose* (crouch would lie). Median ratio outside `[0.5, 2]` is cm↔m.
4. **All loco actions stay playing.** Only weights move (`AnimationDirector`). Phase-lock run to walk so blends do not four-leg shuffle.
5. **Stride rate = real speed / clip speed.** Raising move speed turns legs faster instead of skating.
6. **One-shots overlay.** Slash/kick/jump play through `director.requestOneShot`; loco keeps resolving underneath.
7. **`SkeletonUtils.clone` + own mixer** per spawn (unchanged hard rule).

## Concept IDs

`idle | walk | run | sprint | jump | hop | land | slash | kick | crouch | attack`

```ts
rig.playConcept("slash"); // true if the loaded file has a matching clip
```

Melee `rig.attack()` tries slash → kick → attack → pack clip.

## What we did *not* copy

- Samurai’s custom height-field / no-Rapier world (we keep Rapier + authored Sanctum).
- Full motion-warp `Attack.js` (next if melee standoff feels short).
- Ragdoll / judgement / blade-storm VFX.

## threejs-game-skills alignment

Gameplay-systems says: map states to clips, prefer **in-place** animation and move the entity in code, update mixers with `deltaSeconds`, report clip names after import (`assetVerify` already logs them).
