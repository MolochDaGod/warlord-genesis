---
name: Hero dual-arsenal combat
description: How the hero's two-weapon (melee+ranged) combat model is wired, plus the non-obvious coupling traps.
---

The hero carries exactly ONE melee weapon and ONE ranged weapon (chosen in the lobby loadout, persisted on the roster). Q swaps the active weapon between them; dash is on F. Ranged combat is hitscan/projectile; melee is instant cone damage (`meleeConeHit`) plus short-lived crescent/shockwave visuals.

**Rule: ranged fire paths must never emit melee visuals (SlashWave/Shockwave).** Only `meleeSwing()` may spawn crescents, and only for non-`jab` styles.
**Why:** the original bug was crescents appearing on ranged attacks. Keep the visual emit strictly inside the melee path.

**Rule: the block flag (`EM.heroBlocking`) must be force-cleared on weapon swap, control-mode exit, and hero death.** Damage reduction is applied centrally in `store.damagePlayer` while the flag is true.
**Why:** a stuck flag silently grants permanent 75% damage reduction. Any state transition that ends the block stance must reset it.

**Gotcha: projectile AoE radius does NOT come from the firing weapon by default.** `EM.addProjectile` derives splash radius from the projectile MODEL (`PROJECTILES[model].splash.radius`), not the weapon config. For per-weapon AoE tuning (e.g. grenade), the caller must pass a `splashRadius` override (and `splashDamage`). Forgetting it makes the weapon silently use the model's default radius.
**How to apply:** when adding any new AoE ranged weapon, pass both `splashRadius` and `splashDamage` from its config to `addProjectile`.
