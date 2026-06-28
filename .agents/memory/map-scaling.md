---
name: Map scaling (large MOBA map)
description: How the procedural arena scales and what must stay fractional when resizing maps.
---

# Map scaling — keep spatial offsets relative to coreZ, not fixed

`mapgen.ts` `MAP_SIZES` drives map dimensions. The large map is sized for a real
MOBA feel (much bigger than standard), so any per-lane structure placement MUST be
expressed as a fraction of `coreZ` (which derives from `length`), not a fixed
world-unit offset.

**Why:** the tower ladder originally used fixed offsets (`coreZ - 28`, `coreZ - 13`).
On a long map those put BOTH the outer and inner tower right next to the base, leaving
the whole lane from mid to base undefended — it stopped reading as a MOBA. Fractions
(outer ≈ 0.45·coreZ forward toward mid, inner ≈ 0.8·coreZ guarding the core) keep the
ladder spread correctly at any map length. Same logic for `buildingZ` (place it
between the inner tower and the core, e.g. midway, not a fixed `inner + N`).

**How to apply:** when changing map size or adding lane structures, scale placement by
`coreZ`/`halfL`/`width` fractions. Things that already scale automatically: perimeter
walls and terrain mesh (read `m.width`/`m.length` in `Arena.tsx`), heightmap noise
(normalized by width/length), flow fields/WalkGrid (built from the grid). Watch the
camera far-plane in `Game.tsx` — a longer map can exceed it and clip distant terrain.
Tree counts (`TREE.countLarge` in `config.ts`) are absolute, so bump them when the area
grows or the jungle looks sparse.
