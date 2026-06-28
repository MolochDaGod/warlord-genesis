---
name: Animator crossfade T-pose guard
description: Why setActive must not crossFadeFrom a dead source action, or the bind pose snaps through.
---

# Animator crossfade must guard against a dead source

`AnimationAction.crossFadeFrom(src, fade, true)` sets the pair so the new clip
rises 0→1 while `src` falls 1→0. If `src` is already stopped or at ~zero weight,
nothing holds the pose during the fade, so the skeleton's bind pose (T-pose)
bleeds through for the fade duration and reads as a snap.

**Rule:** before crossfading, check the source is `enabled` and
`getEffectiveWeight() > ~1e-3`. If not, `fadeIn` the new clip on its own instead.

**Why:** this was the root of the "snapping / brief T-pose" between one-shots and
the locomotion blend — one-shot actions expire and the blend re-engages from a
collapsed/stopped state, so `this.current` was often a dead action.

**How to apply:** lives in `Animator.setWeapon`/`setActive` path in
`src/game/anim/Animator.ts`. Any new code that crossfades animation actions must
apply the same liveness guard on the source.
