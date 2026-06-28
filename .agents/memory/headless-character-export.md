---
name: Headless GLB export of procedural voxel characters
description: How to export the game's procedural box-rig characters to GLB from Node, outside the browser.
---

# Headless GLB export of procedural voxel characters

The procedural `VoxelCharacter` rig can be built and exported to GLB entirely
headless (no browser/WebGL) — geometry math and glTF export need no GPU. Used to
hand the player-race meshes off for external Mixamo rigging. Reusable script:
`artifacts/grudge-warlords/tools/export-tpose.ts` (not in `src/`, so excluded
from typecheck).

**How to apply / gotchas (each cost an iteration to discover):**
- No `tsx`/`ts-node` installed, but Node 24 strips TS types natively — run a
  `.ts` file directly with `node file.ts`, importing other TS with explicit
  `.ts` extensions. `import type` deps (e.g. `./types`) are erased.
- Bare specifiers (`three`, `three/examples/...`) resolve relative to the FILE,
  not cwd — the runner MUST live inside the artifact dir so it resolves the
  artifact's `node_modules/three`.
- Load the skeleton FBX from disk with `new FBXLoader().parse(arrayBuffer, "")`
  (slice the Buffer to a real ArrayBuffer); do NOT use `loadAsync(url)` — that
  expects a web URL.
- `GLTFExporter` binary export calls `FileReader`, absent in Node. Polyfill a
  minimal `FileReader` (Node has global `Blob`/`blob.arrayBuffer()`) before
  calling `parse(..., {binary:true})`.
- The shared skeleton's bind pose is ALREADY a clean T-pose (arms horizontal,
  constant Y), so no re-posing is needed before baking for Mixamo.
- For a Mixamo-ready mesh, bake each box's `matrixWorld` into cloned geometry,
  carry material color into a per-vertex COLOR_0 attribute, merge to one mesh,
  and drop the skeleton (Mixamo adds its own). `ColorManagement.enabled = false`
  keeps the literal hex palette.
