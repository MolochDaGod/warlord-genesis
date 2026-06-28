---
name: Lane creep flow-field routing
description: How lane creeps are kept in their lane, and why corner-topology maps need per-lane masked flow fields.
---

# Lane creep flow-field routing

Lane creeps do NOT follow waypoint polylines — they steer by a Dijkstra `FlowField.sampleDir`
(`Units.tsx` `laneTarget`). There is no per-creep lane path; the lane is implied by which flow
field the creep samples.

## The rule
A single whole-map flow field per direction only keeps lanes separated when the lanes are
physically isolated by non-walkable ridges along their whole length (the end-to-end / parallel
topology). If two lanes share endpoints, a single field collapses every creep onto the globally
shortest route.

**Why:** the corner (classic MOBA) topology puts all three lanes' start AND end at the same two
corners. A shared `flowToEnemyCore` field there funnels Top + Bottom creeps onto the Mid diagonal
(the shortest path) — the side lanes go empty.

**How to apply:** for any topology where lanes share endpoints, build ONE flow field per lane on a
per-lane MASKED `WalkGrid` (only that lane's corridor + both base clearings walkable). Creeps then
sample `map.laneFlowToEnemy[lane]` / `laneFlowToAlly[lane]`. Where lanes are already ridge-separated,
alias those per-lane slots to the shared whole-map field (zero behaviour change). Keep the shared
full-grid `flowToEnemyCore`/`flowToAllyCore` around — it is still used for crowd-separation goal
ordering, the enemy warlord, and commandable A* fallbacks, none of which need lane discipline.

Per-lane masked grids intentionally EXCLUDE cut-throughs, so lane creeps never wander into the
jungle; cross-lane movement (hero, commandable units) uses the full grid via A*.
