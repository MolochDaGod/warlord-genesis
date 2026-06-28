---
name: Animator.reaction fallback semantics
description: Why a reaction key can silently no-op even though a global reaction with that name exists.
---

# Animator.reaction() resolution order

`Animator.reaction(key)` does `this.resolve(key) ?? resolveGlobalAction(key)`. `resolve(key)` returns the **class-specific** action id if the active weapon class defines one — even when that clip file is missing on disk. Because it short-circuits, the global-reactions fallback is never reached, and `playOnce` no-ops on the missing file.

**Concrete trap:** the key `"hit"` is defined per class in `WEAPON_SETS` (several classes map it to `animations/greatsword/great-sword-impact`, an unstaged folder). Using `"hit"` for a generic hit reaction is therefore unreliable across loadouts.

**Why:** class actions take priority over globals by design, but there is no existence check on the resolved clip.

**How to apply:** for effects that must work on every hero (hit reactions, generic flinches), only use keys that are NOT overridden as class actions — i.e. true `GLOBAL_REACTIONS` keys like `hitHead`, `stumble`, `jogStumble`, `stunned`, `bigBlow`, `flyingBack`, `wallCrash`. Avoid `"hit"`.
