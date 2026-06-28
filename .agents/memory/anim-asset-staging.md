---
name: Anim asset staging (Grudge Warlords)
description: Which animation clip packs are actually present on disk vs only referenced by the catalog.
---

# Animation clip pack staging

The clip catalog (`src/game/anim/clipCatalog.ts`) references ~120 clips across ~20 folders, but only **8 folders are staged** under `artifacts/grudge-warlords/public/anim/animations/`: `block`, `bow`, `extra`, `pistol`, `reactions`, `rifle`, `striker`, and `sword` (the last has only ONE file, `great-sword-slide-attack.fbx`).

Missing-from-disk (never committed — verified via `git ls-files`, no `.gitignore` rule, no deletion history): `greatsword`, `knife`, `mace`, `spear`, `hammer`, `greataxe`, `hammer2h`, `magic`, `magic-loco`, `climb`, `swim`, `farming`, `gestures`, and the GLB combo clips (`combo/melee-combo-*`).

**Consequence:** the loader resolves an id to `${BASE}anim/<id>.fbx`; a missing file 404s and the clip silently fails to load. So melee/magic hero loadouts (e.g. `HERO_PRESETS` `templar`=sword, `breaker`=hammer2h) reference unstaged assets and cannot animate properly. Only ranged/unarmed heroes (rifle/bow/pistol) are fully playable, plus the class-independent `reactions`/`extra` packs.

**Why:** the source FBX packs were never added to the repo; they cannot be generated from code.

**How to apply:** before mapping a clip id or adding a melee/magic hero, confirm the folder exists on disk. For class-independent effects (hit reactions, deaths), prefer keys that resolve into the staged `reactions`/`extra` packs. Staging the rest requires the user to upload the source FBX files.

## Fallback: unstaged classes animate from the `unarmed` set

`clipCatalog.ts` is the single sanctioned class-to-clip resolver: `STAGED_ANIM_CLASSES` lists the classes whose FBX packs are actually on disk, and `animClassFor(weapon)` maps any class NOT in that set to `unarmed`. The Animator must source every clip set through `animClassFor(this.weapon)`, never the raw weapon class — that is what lets melee/magic heroes play the staged unarmed/striker set instead of freezing in a T-pose.

**Key decoupling:** only CLIP SOURCING is rerouted. The held weapon MESH and the reported weapon class stay the real `this.weapon`, so combat logic and equipment identity are unaffected — a sword/hammer hero keeps its prop while animating unarmed.

**Why:** user directive — make melee heroes "at least playable now" with the staged unarmed/striker clips rather than waiting for the missing FBX packs.

**How to apply:** `STAGED_ANIM_CLASSES` is maintained by hand. When real melee/magic FBX packs are finally staged on disk, add those classes to the set and the fallback turns off automatically — no per-class wiring. Until then, expect every melee/magic hero to animate as `unarmed` regardless of its weapon. A startup warning listing classes that fell back to `unarmed` would catch a forgotten set update.
