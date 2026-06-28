# Grudge Warlords

A playable 3D browser MOBA/RTS: you are a hero warlord leading an allied warband against a rival AI faction across three lanes. Summon and command units, build defensive structures, and fight in first person — win by razing the enemy Citadel, lose if your own falls.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Shared PvP sim: `lib/gw-sim/` (`@workspace/gw-sim`) — pure headless TypeScript (no THREE/React) imported by BOTH client and server. Deterministic from seed+tick at `TICK_HZ=20`: `rng.ts` (mulberry32), `pathfind.ts` (WalkGrid/FlowField), `map.ts` (`generateMap(seed,mode)→SimMap`), `config.ts` (UNIT_DEFS/STRUCT_DEFS/SHOP/ECONOMY), `types.ts` (Net DTOs + WS protocol), `sim.ts` (`Sim`: step/snapshot/pushIntent/setConnected/forceWin, bots, waves, combat). The server is the sole authority; clients interpolate snapshots and predict only their own hero.
- Realtime PvP server: `artifacts/api-server/src/realtime/` — authoritative WebSocket on `/api/realtime` (attached to the http.Server via `upgrade`, same deploy/domain as the API). `auth.ts` (best-effort identity from the signed `gw_grudge` cookie, guest fallback), `lobby.ts` (rooms + quickplay queues for 1v1/2v2), `room.ts` (fixed-step `Sim` host: snapshots out at TICK_HZ, intents in, disconnect→bot fill / team-empty→forfeit), `client.ts`, `index.ts` (attachRealtime).
- PvP client: `artifacts/grudge-warlords/src/net/` (auto ws/wss URL from `window.location`, snapshot buffer + hero prediction runtime, zustand mp store, connection) and `src/components/mp/` (`MultiplayerPage` at route `/mp`, `MpLobby`, `MpHud`, R3F `MatchPvP`/`scene`). RTS controls: left-click move, right-click attack-move, summon down a chosen lane.
- Game artifact: `artifacts/grudge-warlords/` (React + Vite + Three.js)
  - `src/game/config.ts` — all non-spatial tunables: `UNIT_TYPES`, `STRUCT` defs, `ECONOMY`, `SHOP_UNITS`/`SHOP_BUILDS`, `PLAYER`/`WEAPON`/`MELEE` (the old static `MAP`/`LANES` tables were removed — the battlefield is generated procedurally)
  - `src/game/mapgen.ts` — seeded procedural map generator (`generateMap(seed,size)→GameMap`): mulberry32 RNG, `MAP_SIZES` (standard 64×104 = end-to-end topology; large 160×260 = `corner:true` classic-MOBA topology), heightmap grid + bilinear `heightAt`, 3 mirrored lanes, base/tower/rally/heroSpawn placements, `WalkGrid` + shared `flowToEnemyCore`/`flowToAllyCore` flow-fields, and per-lane `laneFlowToEnemy[]`/`laneFlowToAlly[]` fields. Two lane builders: `buildLanes` (parallel West/Center/East) and `buildCornerLanes` (Top up the walls / diagonal Mid / Bottom = 180° point-reflection of Top). Arc-length helpers (`polyLen`/`sampleAtFraction`/`tangentAtFraction`) place towers/buildings along bent corner lanes
  - `src/game/pathfind.ts` — grid pathfinding: `WalkGrid` (world↔cell, walkable mask, `nearestWalkable`), `FlowField` (Dijkstra dist + `sampleDir`), `findPath` (A*)
  - `src/game/store.ts` — zustand match state (phase menu/battle/victory/defeat, credits, score, kills, ammo, ally/enemy core HP mirror, hero respawn)
  - `src/game/command.ts` — zustand RTS state (control mode, marquee, selection, control groups, armed build target, `issueOrder`)
  - `src/game/entities.ts` — `EM` singleton: mutable world (units, structures, particle pools) + the active `map: GameMap`; `spawnUnit`/`addStructure` (snap y to terrain via `map.heightAt`); `newMatch(size,seed)`/`reset(map?)` regenerate the map and build both Citadels + per-lane towers/rally/heroSpawn from it
  - `src/game/combat.ts` — shared `findTarget`/`dealDamage`/`structRadius`/`isUnit` helpers (faction-aware)
  - `src/components/game/` — R3F scene: `Game` (Canvas), `Player` (hero FPS/RTS camera), `Units`, `Structures`, `Arena` (lane map), `Effects`, `Command` (`CommandLayer`+`SelectionRings`), `MatchDirector`, `UnitMesh`
  - `src/components/ui/` — `HUD`, `Shop`, `Screens`, `gameui.css` (fantasy UI kit: Cinzel Decorative/EB Garamond)
  - `public/textures/` — Poly Haven 1k PBR textures

## Architecture decisions

- Two-tier state: zustand holds HUD-facing reactive values (`store.ts`) and RTS command state (`command.ts`); the `EM` singleton holds per-frame mutable world entities. All are reset together via the store's `startGame`/`reset`.
- The arena is generated procedurally per match from a seed (`mapgen.ts`): a heightmap with low flat walkable lane corridors, raised ridge dividers between the 3 lanes, base clearings, and (on large maps) jungle cut-throughs. Two map sizes (standard/large) are chosen from the menu; `store.mapSize` is preserved across resets and each generate bumps `store.mapVersion` (used to remount the terrain mesh + collider in `Arena.tsx`). The two sizes also use different TOPOLOGIES (`MapSizeDef.corner`): standard is end-to-end (Citadels at opposite Z ends, parallel West/Center/East lanes, tower ladder by FRACTIONS of `coreZ` — outer 0.45, inner 0.8); large is the classic corner MOBA (160×260, Citadels in opposite corners, Top/diagonal-Mid/Bottom lanes, towers/buildings placed by arc-length FRACTION along each bent lane — ally inner 0.16 / outer 0.34, enemy outer 0.66 / inner 0.84). Both keep the symmetry-by-point-reflection property.
- Movement is grid-based pathfinding, not waypoint polylines: lane creeps follow precomputed flow-fields toward the enemy/ally core (`FlowField.sampleDir`); commandable units path with A* (`findPath`). Lane creeps steer by their lane id via `map.laneFlowToEnemy[lane]`/`laneFlowToAlly[lane]` (`Units.tsx` `laneTarget`). On the end-to-end (standard) map those alias the shared whole-map fields (lanes are kept apart by ridges). On the corner (large) map the three lanes SHARE both endpoints, so a single field would funnel everyone down the shortest diagonal — instead each lane gets its own flow field built on a per-lane MASKED WalkGrid (only that lane's corridor + both base clearings) so creeps stay in lane. The shared `flowToEnemyCore`/`flowToAllyCore` (full grid) is still used for crowd-separation ordering and the enemy warlord / commandable fallbacks. Units clamp to walkable cells (`nearestWalkable`) and snap their y to `map.heightAt`; structures and hero spawns do the same. The hero rests on a Rapier trimesh collider built from the terrain.
- Units, structures, projectiles are driven manually in `useFrame` loops (no per-entity physics). Only the hero uses a Rapier rigidbody/capsule. Hero fire and turret/tower fire are hitscan against enemy units + structures.
- Components re-render only when their entity id-set changes (id diff in `useFrame`); transforms/HP bars are updated imperatively to avoid per-frame React reconciliation.
- Two control modes (backtick toggles): "combat" = pointer-locked FPS hero; "command" = free-cursor RTS (marquee select, A/M/H/S orders, B build with ghost+collision check, Shift+1-5 control groups, 1-5 recall). The hero only walks in combat mode so order hotkeys don't conflict.
- Lane creeps and enemy elites are spawned periodically by `MatchDirector` for both factions; player-summoned allies are commandable and spawn at the ally base rally.

## Product

Single-player 3D MOBA/RTS. You are a hero warlord defending your Citadel against a rival AI faction across three lanes (West/Center/East), each with a defensive tower per side. Passive income + kill rewards fund a shop (buy commandable Footman/Archer/Knight units anytime, build sentry turrets/barriers, or repair your Citadel). Command units with RTS orders and control groups while also fighting in first person. Win by razing the enemy Citadel; lose if yours falls or — temporarily — when your hero dies (respawns at base).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Weapon animation CLASS and mounted prop GEOMETRY are decoupled. A `WeaponClass`'s clip pack (`clipCatalog.ts` `WEAPON_SETS`) assumes a certain loadout, but the held mesh is built separately in `weapons.ts` `mountWeapons`. The `sword` class plays sword-and-shield clips, so its off-hand must be a shield (`buildShield`) — not a knife. Keep the mounted prop consistent with the clip pack.
- The selected warcamp character IS the in-match hero. `heroModels.ts` `HERO_MODEL` maps each preset to a real GLB voxel model (`public/models/characters/character-{a..r}.glb`, textures in `./Textures/`). These GLBs are NON-skinned whole-limb voxels (nodes `root, leg-left/right, torso, arm-left/right, head`), so `VoxelCharacter` model mode rigidly attaches each part mesh to the matching Mixamo skeleton bone (`attachModel`, side-disambiguated by world-X) and fills hip/neck gaps with a small voxel frame (`buildModelFrame`) — the parts then ride the equipped weapon class's Mixamo clips exactly like the procedural boxes. Wire-up: `Player.tsx` passes `model: \`character-${HERO_MODEL[heroId]}\`` to `createAnimatedCharacter`; a failed model load falls back to the procedural box avatar. The same `HERO_MODEL` mapping drives the `HeroCarousel` preview thumbnails (the carousel itself still plays each GLB's OWN embedded clips via drei `useGLTF`/`useAnimations`). `equipment.ts` normalizes Codex weapons+armor into slot-keyed `LoadoutItem`s (emoji field dropped); the equipped main-hand drives the hero's weapon CLASS (`effectiveWeaponClass` in `roster.ts`) and `computeLoadoutStats` (tier 1-8 scaled) feeds bonus HP / damage multiplier / defense into `store.startGame`. Roster selection + loadout persist to localStorage (`gw_roster_v1`).
- Hero combat is split by loadout: ranged kits use the global `WEAPON` hitscan + ammo (`Player.tsx` `fire()`); melee kits (`isMeleeWeapon` in `presets.ts`) use `meleeSwing()` with the `MELEE` config (no ammo). Melee is itself ranged-effect now: `meleeStyle(weapon)` picks "slash" (fast crescent SlashWave that cuts a moving band) or "slam" (heavier SlashWave + ground Shockwave AoE). `meleeSwing()` only *spawns* the effects — all damage is dealt by `updateMeleeFx(dt)` in `combat.ts` (faction-aware, each target hit once via a `hit` id-Set), which is driven from `Effects.tsx`'s per-frame loop and gated to the `battle` phase. Visuals are pooled crescent/ground ring meshes in `Effects.tsx` (mirrors the `bolts` pool). Add new playable weapons to a `HERO_PRESETS` entry; `CharacterSelect` lists them automatically.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
