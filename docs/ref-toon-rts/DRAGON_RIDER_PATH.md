# Grudge Warlords — Canonical Dragon Rider Path

**Status:** Design + asset inventory SSOT (2026-07-16)  
**Catalogs:** `dragons.catalog.json`, `dragon-eggs.catalog.json`, `mounts-siege.catalog.json`  
**Rules:** `grudge-warlords-assets` (no Meshy/capsules), convert via `grudge-asset-convert`, register D1/R2.

---

## 1. Goal

Every playable dragon type has a **single progression ladder**:

```text
EGG (item) → HATCHLING (pet) → JUVENILE (ground mount) → ADULT (flight mount + combat)
```

No parallel forks. One egg binds one dragon type for that character (or allow rebind only via rare ritual — not default).

---

## 2. Dragon types (canonical)

| Type id | Name | Element | Unity pack | Mesh (uMMORPG / ObjectStore) |
|---------|------|---------|------------|------------------------------|
| `usurper` | Usurper Drake | Fire | four-evil-dragons | `DragonUsurperMesh.fbx` |
| `boar` | Boar Dragon | Earth | four-evil-dragons | `DragonBoarMesh.fbx` |
| `soul_eater` | Soul Eater | Shadow | four-evil-dragons | `DragonSoulEaterMesh.fbx` |
| `nightmare` | The Nightmare | Frost | four-evil-dragons | `DragonTheNightmareMesh.fbx` |
| `fantasy_skin` | Peak Drake | Variable (skins) | fantasy-dragons | `dragon_anim.FBX` + skin set |
| `terror_bringer` | Terror Bringer | Apocalypse | dragon-terror | `DefaultMesh.fbx` |

**Four Evil** also maps to boss phases Fire / Ice / Shadow (+ pack fourth mesh) and enemies: Fire Drake, Frost Wyrm, Shadow Dragon, Boar Dragon.

### Age variants (three stages)

| Age | Scale (proxy) | Ride | Flight | Role |
|-----|---------------|------|--------|------|
| **Hatchling** | 0.35 | No | No | Follow pet, bond XP |
| **Juvenile** | 0.65 | Yes | No | Ground mount + light combat |
| **Adult** | 1.0 | Yes | Yes | Full dragon rider |

> **Asset truth:** On this machine / ObjectStore, packs expose **adult meshes + anim banks**, not separate baby/young FBX filenames. Until age-specific FBX are imported from Unity, ship three GLBs per type as **scaled exports** of the adult mesh (same skeleton/clips). Prefer real age meshes when found.

---

## 3. Path steps (per dragon type)

### Step 0 — Unlock / acquire egg

| Source | Notes |
|--------|--------|
| Mission `dragon_egg_retrieval` | Existing ObjectStore mission (Dragon Peaks) |
| Zone `dragon_peaks` | Ambient / nest drops |
| Enemy/boss drops | Per-type rates in `dragon-eggs.catalog.json` |
| Faction vendor | Peak Drake (entry); Usurper at Crusade Honored |
| Boss rare | Terror / Evil Hatchling (1% in `bosses.json`) |

Egg is a **unique inventory item** (`ITEM-DRAGON-EGG-*`). Not equippable as weapon.

### Step 1 — Nest & hatch

1. Place nest structure (`dragon_nest_*`) on home island / warcamp.
2. Deposit egg + optional elemental fuel (glands, sinew, frost-heart).
3. Sit timer completes → consume egg → spawn **hatchling** companion bound to character UUID.
4. Hatchling uses age stage `hatchling` mesh; follows player; gains bond XP from combat proximity / feeding.

### Step 2 — Juvenile (first mount)

1. Bond threshold + player level gate (per egg catalog).
2. Evolution cutscene → `juvenile` mesh.
3. Mount action: ground locomotion only (reuse mount controller; seat bone search same as cavalry).
4. Combat: claw / short breath CD; no flight.

### Step 3 — Adult (full rider)

1. Higher bond + trial (per type: e.g. Dragon Peaks flight ring, or elemental shrine).
2. Evolution → `adult` mesh at scale 1.0.
3. Unlock flight controller + breath skill tied to element.
4. Optional armor/saddle cosmetics later (not required for v1).

### Step 4 — Mastery (optional endgame)

- Skin unlocks for `fantasy_skin` pool.
- Terror path: only from mythic egg / boss mount drop.
- Siege synergy: adult dragon can carry rider over walls; bolt thrower / catapult remain ground siege (separate tree).

---

## 4. Parallel trees (not dragon)

| Class | Source | Status |
|-------|--------|--------|
| **Cavalry mounts** (6 races) | Toon RTS `*_Cavalry_customizable.FBX` | Source on disk |
| **Catapult** WK / ORC | Toon RTS | Source on disk |
| **Bolt thrower** ELF | Toon RTS + `ELF_bolt.FBX` projectile | Source on disk |
| Siege tower / ram | Icons only | No FBX yet |
| ObjectStore mounts (Warhorse, Dire Wolf, …) | Data-only | Map to cavalry kits |

Cavalry is the **default mount path**. Dragon rider is **endgame / rare** layered on top — never replace grudge6 foot kits.

---

## 5. Runtime contract (Three.js)

```text
1. Character owns dragonBond: { typeId, age, bondXp, eggConsumed }
2. Load GLB: /models/grudge6/dragons/{typeId}/{age}.glb
3. Bind textures sRGB, flipY=false for FBX lineage
4. Ground Y: position.y = -bbox.min.y
5. If age == hatchling: companion AI follow
6. If age == juvenile|adult && mounted:
     parent rider to seat bone (Mount_Seat → Seat → Bip001 fallback)
7. If age == adult && flight: flight controller + breath VFX
8. AnimMixer: idle | run | attack | scream | flame/fireball clips from pack
```

Convert flags: `--cm-to-m`, **no** human `--height 1.7`. Collider: capsule under torso for hatchling/juvenile; larger box/capsule for adult.

---

## 6. CDN layout

```text
models/grudge6/dragons/{typeId}/{hatchling|juvenile|adult}.glb
models/grudge6/dragons/eggs/{typeId}_egg.glb
textures/grudge6/dragons/{typeId}/*.webp
anims/baked/dragons/{typeId}/{clip}.json
icons/items/dragon_eggs/{typeId}_egg.png

models/grudge6/mounts/{repoRaceId}/cavalry.glb
models/grudge6/siege/{wk_catapult|orc_catapult|elf_boltthrower}.glb
```

---

## 7. Gaps & next actions

| Gap | Action |
|-----|--------|
| Four-evil / fantasy / terror **binaries not on R2** (404) | Export from Unity project that still has packages; `grudge-convert` + R2 upload |
| Local `ummorpgdev` missing dragon packages | Re-import Unity packages into GenesisGrudge or stage under `warlord-genesis/.cache/dragon-src/` |
| **No egg meshes** in packs | Art pass egg props (color per element) or import egg FBX if package contains them |
| **No named age FBX** | Use scale exports now; replace when Unity age variants located |
| ObjectStore mounts lack mesh ids | Crosswalk already in `mounts-siege.catalog.json` |

### Priority pipeline

1. Stage Toon RTS siege + cavalry → convert → CDN (unblocks mounts/siege immediately).  
2. Locate Unity `FourEvilDragonsHP` + `Fantasy-dragons` + `DragonTerrorBringer` source.  
3. Convert four evil meshes + anim bank → adult GLBs.  
4. Batch hatchling/juvenile scaled GLBs.  
5. Author eggs + icons; push ObjectStore `dragon-eggs` + extend `master-mounts.json`.  
6. Runtime: bond state on Railway character row + Open/Warlords mount UI.

---

## 8. Acceptance (done when)

- [ ] Six dragon types listed in D1/ObjectStore with egg + three ages  
- [ ] At least one type (usurper) loads hatchling → juvenile → adult in warlord-genesis / Open  
- [ ] Egg item appears in inventory from mission or vendor  
- [ ] Adult flight + breath smoke test  
- [ ] Cavalry + catapult + bolt thrower load with polyart materials  
- [ ] No capsules / Meshy as final visuals  
