---
name: GLB warcamp character as in-match hero
description: How the chosen warcamp GLB becomes the playable hero (model mode), and the trap that hid it.
---

The warcamp character GLBs (`character-a..r.glb`) are NON-skinned whole-limb voxel
models (nodes: root, leg-left/right, torso, arm-left/right, head). They ship their
own embedded clips (idle/walk/sprint/attack-melee/holding-shoot/die) BUT the engine
does not need those — `VoxelCharacter` "model mode" attaches each part mesh rigidly
to the matching Mixamo skeleton bone (`attachModel`) and fills hip/neck gaps with a
voxel frame (`buildModelFrame`), so the parts ride the equipped weapon class's full
Mixamo clip set exactly like the procedural box avatar.

**Trap:** the whole model-mode path (`createAnimatedCharacter({model})` →
`loadCharacterModel` → `VoxelCharacter(model)`) already existed and worked, but
`Player.tsx` never passed `model`, so every match silently used the plain box avatar
and ignored the player's character pick. Fix was one param, not a new subsystem.

**Why it matters:** an old replit.md note claimed these GLBs were
"preview-only / not retarget-compatible." That was wrong — they are structurally
identical to the procedural rig (whole-limb parts on bones), so they animate fine.
Don't trust a "this asset can't be used" note over inspecting the GLB node graph
(`skins` count + node names) and checking whether a model-mode code path already exists.

**How to apply:** to give a preset a distinct skin, add it to `HERO_MODEL` in
`heroModels.ts` (preset id -> letter a..r). Unmapped presets fall back to `character-a`.
