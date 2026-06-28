---
name: NPC unit models
description: Why footman/archer/knight use per-type GLBs (not the single ff.fbx) and how rendering is split
---

# NPC unit models

Footman/archer/knight render from per-type skinned GLBs in `public/models/units/`
(`footman.glb`, `archer.glb`, `knight.glb`), each with weapons baked in and its own
embedded idle clip. grunt/raider/ogre stay procedural meshes.

**Why:** A single `ff.fbx` + `Color_Palette.png` was also attached, but the per-type
GLBs already exist, are visually distinct per archetype, and carry weapons + clips —
strictly better than tinting/scaling one shared model. Prefer them over ff.fbx.

**How to apply:**
- `UnitMesh` is a thin dispatcher: GLB types return `<GLBUnit url>`; everything else
  returns `<ProceduralUnit>`. Keep the material-allocating hooks inside
  `ProceduralUnit` so GLB-backed units never allocate procedural materials.
- `GLBUnit` clones via `SkeletonUtils.clone` (independent mixer per unit), normalizes
  to height 1.7 with feet at y=0, and plays the first/idle clip via `useAnimations`.
  Parent `Units` group then applies world position / yaw / def.scale.
- Known perf ceiling: each GLB unit owns its own animation mixer, so very large
  battles cost more CPU than the old procedural meshes. Watch frame time if creep
  counts grow.
- GLB facing assumes yaw 0 = +Z (matches `Units.tsx`). If models moonwalk, the model
  faces -Z — rotate the cloned root 180° in `GLBUnit`.

## External palette albedo (white-model gotcha)

The footman/archer/knight GLBs ship with **no embedded texture, no baseColorFactor,
and no vertex colors** — only `TEXCOORD_0` UVs authored to sample the external
`public/models/units/Color_Palette.png` (256×256). Without binding that palette they
render pure white. `GLBUnit` loads the palette and binds it as `.map` on every unit
material with `flipY=false`, `colorSpace=SRGB`, Nearest filtering, mipmaps off, and
resets `material.color` to white.

**Why:** glTF UV origin is top-left, so `flipY` must be off or the atlas samples the
wrong texels; the palette is a hard-edged color atlas, so mipmaps/linear filtering
bleed neighboring swatches.

**How to apply:** materials come from the shared `useGLTF` cache, so this binding is a
deliberate *global* mutation that colors all instances of that GLB. Per-team / per-unit
recoloring would require cloning the materials first. Buildings are unaffected — their
GLBs carry their own `baseColorFactor`.
