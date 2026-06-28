---
name: Animator character pipeline
description: How animated characters are built in artifacts/grudge-warlords, and the constraint that governs adding new ones.
---

The game's animated characters are **procedural voxel rigs** built by
`createAnimatedCharacter({classes, weapon, look, height})` in
`src/game/anim/`. Box meshes are parented to a cloned Mixamo skeleton; GLB/FBX
files are used ONLY as animation clip sources (retargeted), never rendered as
skinned character meshes.

**Rule:** To add new characters/enemies, define presets (weapon class + look +
height), not new 3D model meshes. Dropping in arbitrary GLB/FBX character models
(e.g. downloaded Mixamo/marketplace meshes) does not make them playable and
large ones are impractical for web.

**Why:** The whole rig is driven by one shared Mixamo skeleton + a clip pool, so
appearance is recolour/look-based and motion is class-based.

**How to apply:**
- A weapon class only animates well if its clip pack is staged under
  `public/anim/animations/<pack>/`. Well-staged packs: rifle (ranged), bow,
  pistol, striker (unarmed), plus reactions/block/extra. `sword` had only 1 clip
  and most other classes (magic, axe, mace, spear, hammer...) were NOT staged —
  restrict playable presets to ranged/bow/pistol/unarmed unless you stage more.
- `loadClips` tolerates missing clips (try/catch, skips) so a partial class
  won't hard-crash — it just falls back run→walk→idle, which looks static if the
  class has no loco clips at all.
- Character roster lives in `src/game/anim/presets.ts`; selection store in
  `src/game/roster.ts`; menu picker in `src/components/ui/CharacterSelect.tsx`.

## Customization (skinning) split
- Colour changes (skin/shirt/pants/hat/eye) apply LIVE via `VoxelCharacter.recolor(look)` — shared materials, no rebuild.
- Race change OR headgear TYPE change needs a FULL rebuild (geometry differs): `createAnimatedCharacter` again, dispose the old animator. Player rebuilds on `[heroId, custom.hat]`.
- **Why:** materials are shared/cheap to recolour, but hats and body proportions are baked at construction.
- Live menu preview is a SECOND R3F Canvas (`CharacterPreview.tsx`) idling the rig; dispose on unmount to avoid leaking a GL context.
