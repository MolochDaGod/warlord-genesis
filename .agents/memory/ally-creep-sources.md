---
name: Ally creep sources
description: Each ally lane must have exactly one creep source — production buildings vs the baseline push
---

# Ally creep sources

Ally lane reinforcements come from two systems that must NOT both feed the same lane:

1. **Production buildings** (barracks = melee, archery = ranged) auto-spawn creeps
   on their own lane on a tier-scaled cadence. Player upgrades them L1→L2→L3 with
   credits (`BUILDINGS` config, `store.buildings` + `upgradeBuilding`, spawn loop in
   `MatchDirector`). **Ally only** — enemy production pressure stays governed by the
   DIFFICULTY system, by design.
2. **`spawnAllyPush()`** is the baseline lane wave. It now **skips any lane that has
   an ally production building** (computed from `EM.map.buildings`), so it only
   reinforces the remaining lane(s) — the centre.

**Why:** Buildings were originally additive on top of the baseline push, double-stacking
ally pressure on the two building lanes and making upgrades runaway-strong vs the
difficulty-paced enemy. The rule is: every ally lane has exactly one creep source.

**How to apply:** If you add/move production buildings or change lane count, the
skip-set in `spawnAllyPush()` auto-adapts (it reads building lanes at runtime). If you
ever want buildings to *augment* rather than *replace* the baseline on their lane,
that's a deliberate balance change — rebalance `BUILDINGS.interval/count/statMult` and
`ECONOMY.creepInterval/creepsPerLane` together, don't just remove the skip.
