---
name: Hero foot grounding
description: Why the hero/warlord floated when idle and the runtime sole-grounding fix.
---
# Hero foot grounding (idle float)

The VoxelCharacter rig is grounded (feet at root y=0) ONLY in its bind pose via
`rig.ts` `fit()`. At runtime, idle/stance clips re-baseline the Hips channel to a
single `bindHipY` (`Animator.lockHorizontalRoot`) that ignores per-clip /
per-weapon-class stance differences, so the soles lift off the ground. A fixed
capsule-derived offset (`FEET_OFFSET = PLAYER.height/2 + PLAYER.radius`) cannot
compensate because the gap is pose-dependent.

**Rule:** ground the hero by the LIVE posed sole, not by hips or a fixed capsule
offset. `VoxelCharacter.lowestSoleWorldY()` returns the lowest foot/toe bone world Y
minus the bind-pose sole gap (foot bones only, so a low-held weapon never drags the
estimate down). The engine eases the model Y so that value rests on
`EM.map.heightAt(x,z)`.

**Why:** hip-height re-baselining trades idle/stance float for fixing exported-too-high
packs; no single hip constant satisfies all clips. Measuring the actual sole does.

**How to apply:** in the per-frame rig-drive (`Player.tsx`, `EnemyHero.tsx`), after
`a.update(dt)`, smooth a `groundCorr` (~14/s) toward `terrain - lowestSoleWorldY()`.
SKIP the correction while airborne (jump/dash/roll) so those arcs still leave the
ground; the smoothing re-lands feet flat. Capsule physics offset stays unchanged.
