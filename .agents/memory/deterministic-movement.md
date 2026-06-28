---
name: Deterministic unit movement
description: Why unit/creep movement (separation, deadlock-breaking, pathing) must avoid randomness and how it stays unwedged.
---

# Deterministic unit movement

Unit movement (lane creeps via flow-field, commanded units via A*) must be fully
deterministic — no `Math.random` anywhere in the movement/separation/deadlock path.

**Why:** later PvP needs a deterministic lockstep sim; two clients running the same
inputs must produce identical unit positions. Cosmetic-only randomness (e.g. archer
projectile shell-model selection in attacks) is fine because it doesn't affect sim state.

**How to apply:**
- Chokepoint clumping is resolved with *goal-distance-asymmetric* separation, not jitter:
  pairwise overlap is split by each unit's flow-field distance-to-objective so the unit
  further from its goal yields more and the front of the lane keeps advancing. Per-frame
  separation is capped (MAX_SEP) and applied with terrain wall-sliding so pushes never
  shove a unit onto a non-walkable ridge.
- Deadlock-breaking is deterministic, never random: a wedged creep sidesteps by rotating
  its steer a fixed angle whose sign is its `id` parity; a wedged commanded unit re-paths
  (clearPath) instead. "Wedged" = wanted to move but actual displacement < a fraction of
  its expected step for STUCK_SIDESTEP/STUCK_REPATH seconds (`UnitEntity.stuck` accumulator).
- Movement clips are avoided via `slideMove` (try full step, then X-only, then Z-only against
  `WalkGrid.isWalkableWorld`) rather than move-then-snap-back, which used to cause jitter.
- A* output is string-pulled (`smoothCells`/`losClear` in pathfind.ts) into sparse turn
  points so commanded units travel straight legs instead of oscillating cell-to-cell.
