---
name: Projectile meshes are cosmetic-only
description: Ranged combat is hitscan; flying shell meshes are pure VFX and must not carry damage.
---

# Projectile shell meshes are cosmetic-only

Ranged attacks in Grudge Warlords (hero, archer/raider units, towers/turrets/core) are
**hitscan**: damage is applied instantly at fire time via `dealDamage` / `damagePlayer`.
The flying FBX "shell" meshes are a **visual replacement for the old instant tracer/bolt
lines** only — they travel muzzle→impact and call `addImpact` on arrival, but deal **no
damage**.

**Why:** keeping damage at fire time means swapping tracers for traveling meshes is a
zero-balance-change cosmetic edit. Moving damage to projectile arrival would silently
change combat timing/feel (travel delay, dodgeable shots) and break tuning.

**How to apply:** when touching the projectile system, never tie *single-target* damage to
projectile arrival. The travel/despawn sim lives in a component `useFrame` and runs even if
the FBX assets fail to load, so gameplay never depends on assets being present. Source→shell
mapping is data-driven in `config.ts` (`PROJECTILES`, `ARCHER_SHELLS`, `STRUCT_PROJECTILE`)
— change visuals there, not in combat code. The melee SlashWave/Shockwave system is the
opposite (it *does* deal damage as it travels) — don't conflate the two.

**Exception — heavy AoE shells:** projectiles whose `PROJECTILES` def has a `splash`
profile (e.g. cannon/fire/wizard) deliberately deal their damage at *impact*, not fire time,
as an area blast. The firing code (`Structures.tsx`, `Units.tsx`) detects `splash` and, for
those shells only, passes `{faction, splashDamage}` to `addProjectile` and *skips* the
fire-time `dealDamage` (hero hits still use `damagePlayer` since the shockwave doesn't touch
the hero). `Projectiles.tsx` spawns an `addShockwave` (radius/damage/faction + optional
`slow`) at arrival, reusing the melee shock loop in `combat.ts` to apply AoE + the wizard
slow (`EM.slowUnit`). Light shells (arrows, ballista bolts, lane towers) stay hitscan.
