---
name: Procedural tree rendering
description: How forest trees are rendered (archetype instancing) and the gameplay invariants any tree-visual change must preserve.
---

# Procedural tree rendering

Trees are rendered as TWO InstancedMeshes (all branches, all leaves) built from a
small set of deterministic LOCAL-space "archetypes" (`game/treegen.ts`:
recursive branch skeleton + leaf cards w/ a canvas leaf texture). The renderer
(`components/game/Trees.tsx`) composes each archetype's local matrices with each
live tree's world transform (terrain-seated pos, yaw, per-tree scale) and writes
into the instanced arrays with a write-cursor; unused/dead slots collapse to a
zero matrix. Rebuild happens only when the alive-set or map (seed:size) changes,
never per frame.

**Why archetypes (not per-tree generation):** instancing a handful of pre-baked
shapes keeps 150 realistic trees to ~2 draw calls. Capacity = `TREE.countLarge *
worstCaseBranches/Leaves` (densest archetype could be picked by every tree).

**How to apply — visual-only invariant:** tree visuals are decoupled from
gameplay. Any change to tree LOOKS must NOT touch: per-tree `CylinderCollider`
(hero blocking, keyed off alive trees in Trees.tsx), the EM blocked-mask pathing
footprint (`entities.ts setBlockedCircle` on spawn/death), tree HP/destructible
(`entities.ts damageTree`), or terrain seating (`EM.groundY`). Those live in
`entities.ts` + the `TREE` config and are sized by `TREE.radius`/`blockRadius`/
`hp` — independent of the cosmetic branch/leaf geometry.

**Perf knobs (cosmetic):** `TREE.branchLevels`, `TREE.branchesPerNode`,
`TREE.leafSize`, `TREE.archetypeCount`, and leaf-per-branch density in
`treegen.ts addLeaves`. Large map densest archetype ≈ 53 branches / 191 leaves
→ caps ≈ 8k branch + 29k leaf instances. Leaves are alpha-tested double-sided
cards that RECEIVE but do not CAST shadows (cast was skipped for perf).
