# Terrain, performance, UX, and complete deploy

How Warlord Genesis should be built and shipped: **stylized authored terrain**, **lag-free combat**, **noded / instanced / baked** in the right places, and the **scripts + dependencies** that actually matter.

Live: https://warlord-genesis.vercel.app/play · alias https://warstrat.grudge-studio.com

---

## 1. What each layer is for

| Layer | Owns | Must not own |
|-------|------|----------------|
| **Authored GLB** (Sanctum / 1v1) | Look — deck, cliffs, water, vegetation, pads | Pathing, win conditions |
| **mapgen + WalkGrid** | Gameplay space — lanes, cores, camps, flow fields | Visual style |
| **HeightfieldCollider** | Feet / physics at y≈0 | Art (invisible, thin band −0.5…2.5) |
| **mapSurface sockets** | Tower pad snap (`dizuo`, turret pads) | Creep AI |
| **R3F scene** | One Physics world, AdaptiveDpr, fog | Remounting Physics inside Suspense |

**Rule:** plant the GLB **deck** at y≈0 (raycast upper 55% of mesh). Never plant on `Box3.min.y` — Sanctum has cliffs/water far below the lanes and that puts the island in the sky.

```
GLB art  →  scale to MAP_SIZES footprint  →  deck median y=0
mapgen   →  lanes / cores / camps at that same XZ
Rapier   →  clamped heightfield coplanar with deck
units    →  raycast mapSurface for Y when pads exist
```

### Stylized terrain (what “complete” looks like)

1. **One hero-scale truth:** ~1.85–2.0 m humans. Sanctum raw ≈ 190×190; 1v1 ≈ 56×50. `WORLD_SCALE = 1`.
2. **PBR tileables for *procedural* fillers only** (`pnpm textures:bake`): albedo sRGB, normal/rough/AO linear, RepeatWrapping, anisotropy 4–8. Authored maps already carry ground cover — do not also spawn procedural grass/trees on Sanctum.
3. **Toon / kit look stays on the mesh.** Do not hue-shift whole characters; use wardrobe visibility + atlas textures (`grudge6-equipment-meshes`).
4. **Fog + Sky + hemi + one sun** (`Game.tsx`). Shadow camera fits the island (~±140). No second lighting rig per scene.
5. **Sockets, not guesswork.** Named pad nodes (`dizuo`, `tower_pad`) register in `mapSurface.ts`. Turrets instance into those holes.

---

## 2. Noded vs instanced vs baked — where each wins

| Technique | Use for | Do not use for |
|-----------|---------|----------------|
| **Noded (Object3D tree)** | 1–3 unique heroes, authored map root, UI-attached FX, anything with a mixer | 80 identical creeps |
| **InstancedMesh** | Trees, rocks, debris, identical props, projectile *shells* if they share geo | Skinned units (each needs its own skeleton) |
| **Baked clips** (`/anims/baked/*.json`) | Shared Bip001 loco/attack when the GLB has **no** clips | Primary path when the file already has animations |
| **Embedded file clips** | Defaultcreeps, jungle bosses, any GLB/FBX that shipped with a skeleton + clips | Foreign Mixamo tracks dumped onto a different bind |
| **Baked lightmaps / atlases** | Towers (`models/towers/*/atlas.png`), unit palettes | Per-frame shader lights for every minion |

**Characters (current truth):**

```
load file (GLB/FBX)
  → verify size + textures + clips   (assetVerify.ts)
  → SkeletonUtils.clone per spawn     (never Object3D.clone)
  → AnimationMixer on THIS clone
  → play FILE clips first             (sourceClips.ts)
  → baked JSON only fills missing idle/walk/run
  → director.update(dt) every frame
```

Empty `AnimationClip("idle", 1, [])` is banned. Two of the same unit type must both animate.

**Creeps:** one GLB per role×team (`defaultcreeps/blue_melee_minion.glb` …). Clone + mixer per unit. When a wave is 6+ identical, next step is GPU instancing **only if** they stay unskinned; skinned waves stay cloned mixers with shared clip objects.

**Projectiles:** pool ~14 shells per model (`Projectiles.tsx`). Procedural geo unless `VITE_PROJECTILE_FBX=1`. Do not `new Mesh` per shot.

**Terrain:** one authored mesh (noded) + one heightfield. Do **not** instance the island.

---

## 3. Smooth, lag-free gameplay

| Practice | Where |
|----------|--------|
| Fixed `timeStep={1/60}` + `interpolate` | `<Physics>` in `Game.tsx` |
| Cap `dt` at 0.05 on mixers | `UnitMesh`, hero rig |
| `AdaptiveDpr` + fleet canvas props (`dpr` 1–1.5) | `@workspace/r3f-fleet` |
| Shadows 2048, one directional | Game lighting |
| Physics **outside** Suspense | Avoids collider storms |
| Heightfield, not a thin Box | Arena |
| Hero capsule ~1.2 h / 0.4 r, mesh child of RB | Player |
| Pointer lock only in combat | HUD / Player |
| 6-slot hotbar (Digit1–6) chosen **before** match | AbilityLoadout + DangerRoomHotbar |
| No mid-match skill overlay | `store.addHeroXp` only grows stats |

**UX / UI**

- Combat: Danger Room 6-cell hotbar, crosshair, citadel frames. Keep FOV clean.
- Command (`` ` ``): rails scroll independently; shop / lanes / production stay off the center.
- Warcamp: pick faction → warlord → **abilities 1–6** → lanes → march. Card level unlocks slots (1–2 at Lv1, through 6 at Lv5).
- Never block `/play` on `/api/characters` or wallet. Guest can skirmish.
- Persist loadout in `gw_roster_v3` / meta in `gw_meta_v2`.

---

## 4. Dependencies (keep this set)

**Runtime that must stay aligned**

| Package | Role | Notes |
|---------|------|--------|
| `react` / `react-dom` **19.1.0** (catalog) | UI | Do not drift; Expo catalog pins it |
| `three` **^0.184** | Renderer | Match `@types/three` |
| `@react-three/fiber` **^9.6** | R3F | |
| `@react-three/drei` **^10.7** | loaders, Sky, AdaptiveDpr, useGLTF | |
| `@react-three/rapier` **^2.2** | WASM physics | Needs HTTPS + WASM |
| `zustand` **^5** | Game + roster | |
| `react-router-dom` **^7** | Routes | |
| `zod` (catalog) | Content + API | |
| `@workspace/game-content` | Prefabs, weapon matrix, anim defaults | |
| `@workspace/r3f-fleet` | Canvas props + WebGL guard | |
| `@workspace/gw-sim` | PvP sim must match `UNIT_TYPES` | |
| `@tanstack/react-query` | Profile / fleet | |

**Do not add** a second physics engine, a second router (`wouter` is leftover catalog — do not use in warlords), or a second Three import (vite `dedupe`).

**pnpm:** Node ≥ 20, `pnpm@9.15.9`, `minimumReleaseAge: 1440`. Use workspace catalog versions.

---

## 5. Scripts that matter

| Script | When |
|--------|------|
| `pnpm --filter @workspace/grudge-warlords dev` | Local `/play` on :5173 |
| `pnpm typecheck` | Libs + artifacts |
| `pnpm textures:bake` | Tileable ground PBR → `/textures` |
| `pnpm assets:stage` | Copy heroes/icons/towers into public |
| `pnpm assets:upload-r2` / `assets:heroes:upload` | Heavy GLBs to ObjectStore |
| `pnpm vercel:config` | Regen `vercel.json` rewrites |
| `pnpm verify` / `verify:live` | Inventory + live HEAD |
| `pnpm deploy` / `deploy:vercel` | Production |
| `pnpm build:ci` | Vercel: skip bake if Vite/gw-core already ships |

**Examples**

```powershell
cd C:\Users\david\Desktop\warlord-genesis
pnpm install
pnpm --filter @workspace/grudge-warlords run dev
# http://localhost:5173/play?skirmish=1

pnpm textures:bake
pnpm assets:stage
node scripts/stage-baked-anims.mjs   # unarmed/venom/loco JSON
pnpm verify
pnpm deploy:vercel
```

Bake **offline**. Runtime only **loads** baked JSON / GLBs. Never bake in the request path.

---

## 6. Complete game deploy

```
Desktop/warlord-genesis  (source of truth)
  → git LFS: *.glb *.fbx
  → Vercel outputDirectory "."  (static: index.html + /models + /anims + /assets)
  → /api/* rewrites → Railway grudge-api + warlord-genesis-api
  → Heavy / optional meshes → objectstore.grudge-studio.com
```

**Must be same-origin 200 (not CDN HTML):**

- `/anims/baked/{pack}/…json` (unarmed idle/walk/run now in git)
- `/models/maps/sanctum_island.glb`, `arena_1v1.glb`, `sanctum_turret.glb`
- `/models/units/defaultcreeps/*.glb`, `/models/units/jungle/*.glb`

**Title API (keep small):** `GET/PATCH /api/games/:id/profile`, `POST /api/games/:id/matches`, `/api/grudge/auth/*`.  
Do not block boot on `/api/combat`, `/api/inventory`, `/api/player` (those 404 on fleet today).

**Ship checklist**

1. Two of the same unit both animate.
2. Idle is not bind pose; move → walk/run.
3. 1–6 fire warcamp abilities; no level-up picker.
4. Sanctum deck at feet, not in the sky.
5. Console: no `[grudge6] no animations`, no `asset-verify` height 20 m+ giants.
6. Loco JSON and map GLBs **200**.

---

## 7. File map

| Path | Role |
|------|------|
| `engine/mapAssets.ts` | Which GLB per map size |
| `engine/mapSurface.ts` | Deck raycast + pad sockets |
| `components/game/AuthoredMap.tsx` | Fit + plant authored island |
| `components/game/Arena.tsx` | Visual + heightfield |
| `game/mapgen.ts` | Lanes / camps / WalkGrid |
| `engine/sourceClips.ts` | Native file clip classify |
| `engine/assetVerify.ts` | Size / tex / anim gate |
| `game/abilityLoadout.ts` | 6 slots, card-level unlocks |
| `components/ui/DangerRoomHotbar.tsx` | Combat 1–6 |
| `docs/MAP-BEST-PRACTICES.md` | Texture bake + physics layers |
| `docs/PLAY_DEPENDENCIES.md` | Browser + Rapier rules |
