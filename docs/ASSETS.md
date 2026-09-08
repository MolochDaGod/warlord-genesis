# Warlord Genesis — new glTF packs

All new buildings, traps, shells, and the win-condition altar load as **binary glTF 2.0 (`.glb`)** through `useGLTF` + `instantiateGltf` in `artifacts/grudge-warlords/src/engine/gltfScene.ts`.

Do **not** drop FBX / OBJ / Unity prefabs into play. Convert first:

```bat
npx @gltf-transform/cli copy input.glb output.glb
```

Keep the Sketchfab root matrix (Y-up). The loader clones the scene graph, then fits height / grounds Y=0 / centers XZ / sets sRGB on color maps.

## Drop map

Copy from `D:\Games\Models\` into `models/` (Vercel rewrites) or the Vite public tree.

| Source | In-game path |
|---|---|
| `3_medieval_towers (2).glb` | `models/buildings/towers/medieval_kit.glb` |
| `crusadehomedestructable.glb` | `models/buildings/houses/crusade.glb` |
| `legiondestructablehouse.glb` | `models/buildings/houses/legion.glb` |
| `fableddestructiblehouse.glb` | `models/buildings/houses/fabled.glb` |
| `altar_light_version.glb` | `models/buildings/core/altar.glb` |
| `cc0_-_bomb.glb` | `models/projectiles/bomb.glb` |
| `stylized_stone_wall.glb` | `models/buildings/deploy/stone_wall.glb` |
| `defence_tower_for_unity_5.glb` | `models/buildings/deploy/defence_tower.glb` |
| `squire_cannontower_dd2_inspired.glb` | `models/buildings/deploy/squire_cannon.glb` |
| `mechanical_howitzer.glb` | `models/buildings/deploy/howitzer.glb` |
| `magic_fire_tower.glb` | `models/buildings/deploy/fire_tower.glb` |
| `helltower.glb` | `models/buildings/deploy/helltower.glb` |
| `missiletower_building002.glb` | `models/buildings/deploy/missile.glb` |
| `magic_crystal_tower.glb` | `models/buildings/deploy/crystal.glb` |
| `railguntower_building004.glb` | `models/buildings/deploy/railgun.glb` |
| `tower_ballista.glb` | `models/buildings/deploy/bolt_ballista.glb` |
| `fantasy_archer_tower_-_low_poly_3d_game_asset (2).glb` | `models/buildings/deploy/archer_tower.glb` |
| `stylized_game_asset_turret.glb` | `models/buildings/deploy/eng_turret.glb` |
| `turret_gun_flash_-_animated (1).glb` | `models/buildings/deploy/flash_gun.glb` |
| `jmp3r.glb` | `models/buildings/deploy/jumper.glb` |
| `spike_trap_hide_animation.glb` | `models/buildings/deploy/spikes.glb` |
| `tesla_coil_trap.glb` | `models/buildings/deploy/tesla.glb` |
| `venus_fly_trap (1).glb` | `models/buildings/deploy/flytrap.glb` |
| `beartrap.glb` | `models/buildings/deploy/beartrap.glb` |
| `water_tower.glb` | `models/buildings/deploy/water_tower.glb` |
| `mystical_watchtower_-_decorative_game_character (1).glb` | `models/buildings/deploy/watchtower.glb` |
| `m3dic.glb` | `models/buildings/deploy/medic.glb` |

Caps: **2 towers + 3 traps + 2 support + 1 wall**. Win/lose is still core HP.
