# LOWPO Army + Elf Free units + Jade tools

## Warlord Genesis — default normal units (Crusade)

Source pack: **[LOWPO: Fantasy Army](https://standout7.itch.io/fantasy-army)** (Standout 7)

| Edition | Units | Format |
|---------|-------|--------|
| Free (Blessing of Aurion) | Captain, Footman, Knight + Sword/Shield/Spear/Bow | FBX |
| Premium ($3.99) | + General, Spearman, Squire, Archer | GLB/glTF/FBX |

### Mapping

| Shop slot | Mesh | Notes |
|-----------|------|--------|
| Footman | `models/units/lowpo/crusade/footman.glb` | Army_Footman_Blue |
| Archer | `models/units/lowpo/crusade/captain.glb` | Free pack has no archer; Captain + bow until Premium |
| Knight | `models/units/lowpo/crusade/knight.glb` | Army_Knight_Blue |
| Enemy tint | `*_enemy.glb` | Red army twins |

Also mirrored as `models/units/{footman,archer,knight}.glb` for legacy loaders.

Code SSOT: `src/grudge-warlords/engine/unitCatalog.ts`

## Fabled units

Source: `D:\Games\Models\Elf_Free.zip`

| Role | Mesh |
|------|------|
| Melee | `lowpo/fabled/elf.glb` |
| Ranged | `lowpo/fabled/ice_elf.glb` |
| Heavy | `lowpo/fabled/fire_elf.glb` |

## Jade stone tools (voxel / harvest)

Source: `D:\Games\Models\all_jade_stone_tools.glb`

| Location | Purpose |
|----------|---------|
| `models/tools/all_jade_stone_tools.glb` | Full multipack |
| `models/tools/jade/jade_*.glb` | 32 split tools (pickaxe, fishing_pole, …) |
| `models/tools/jade/catalog.json` | Mesh isolation catalog |
| Open: `artifacts/animator/public/models/tools/**` | Voxel / harvest runtime |
| Open TS: `src/game/jadeToolsCatalog.ts` | Role map (mine/chop/fish/…) |

Fishing: `jade_fishing_pole`, `jade_rod`, `jade_net`, `jade_hook`, `jade_bobber`, `jade_lure`.

## Convert / re-bake

```bash
# Units
blender --background --python scripts/convert_lowpo_units.py

# Jade splits (from gameopen animator)
blender --background --python artifacts/animator/scripts/split_jade_tools.py
```

## Upload (R2)

When wrangler is authenticated against `grudge-assets`:

```bash
wrangler r2 object put grudge-assets/models/units/lowpo/crusade/footman.glb \
  --file=models/units/lowpo/crusade/footman.glb --content-type=model/gltf-binary
# …repeat for lowpo/** and models/tools/**
```

Register keys in D1 asset registry (`grudge-d1-r2`) when promoting to `assets.grudge-studio.com`.

## License notes

- LOWPO: personal & commercial OK; do **not** redistribute raw FBX/ZIP.
- Ship only converted GLBs inside fleet games.
