# Flare-Boss → Warlords Era islands (content port)

## Goal

Port **Whisps**, **Dark Elves**, **mission scripts**, and **dungeons** that work in Flare-Boss-Arena into the Warlords Era Three.js deployment surfaces:

| Surface | Route / module |
|---------|----------------|
| Lobby / warcamp | `/lobby` + mission cards |
| Home island | `/home-island` |
| 9 sector maps | `lib/world-content` `sectors` + `flarePort/sectorEvents` |
| Events | `DARK_ELF_EVENT_SITES` |
| Instances / dungeons | `/dungeon/:dungeonId` |
| Mission board | `/missions` |

## Source

- **Flare-Boss-Arena** — `GameEngine` dungeon spawn, `MonsterModels`, `bosses.ts` (Thornguard Matriarch), camp portals
- **GrudgeBuilder** — `missionSystem.ts` (safehouse / first harvest), whisp item icons
- **Warlord Genesis** — Elf Free meshes (`elf` / `ice_elf` / `fire_elf`), 9-sector `SECTOR_META`

## Package location

```
lib/world-content/src/flarePort/
  darkElves.ts      # units + event sites + tint specs
  whisp.ts          # companion/collectible defs + behavior ticks
  missions.ts       # island mission catalog
  dungeons.ts       # Briar Depths + home Shadow Crypt scripts
  sectorEvents.ts   # bind all of the above to 9 sectors
  index.ts
```

Client façade: `artifacts/grudge-warlords/src/game/flareIslandContent.ts`

## Dark elves

- Units: `dark_elf_raider`, `dark_elf_assassin`, `dark_elf_sorceress`, `dark_elf_matriarch`
- Visuals: Elf Free GLBs + purple/void **tint** (no Meshy)
- Also registered in `src/grudge-warlords/engine/unitCatalog.ts` as `DARK_ELF_UNITS`

## Whisps

- `whisp_green` / `blue` / `purple` / `red` — elemental companions
- States: wild → caged → following → bagged
- Account bag item ids match Grudge economy whisp items

## Dungeons

| Id | Sector | Notes |
|----|--------|--------|
| `DUNGEON_HOME_SHADOW_CRYPT` | c / home | Tutorial instance |
| `DUNGEON_BRIAR_DEPTHS` | e | Full script: cages → elite → Matriarch |

Spawn policy mirrors Flare: room templates + kit minions + optional GLB monsters.

## Next runtime steps

1. Mount R3F/Three combat canvas on `/dungeon/:id` using room spawn lists.
2. Stream sector events when sailing `SECTOR_META` cells (water / world-map client).
3. Apply `darkElfTintSpec` after GLB load in unit renderer.
4. Persist mission runs on Railway when ready (currently localStorage via client façade).

## Verify

```bash
# typecheck world-content
pnpm --filter @workspace/world-content run typecheck
```
