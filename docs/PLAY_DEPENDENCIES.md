# Warlord Genesis — `/play` dependencies

URL: https://warlord-genesis.vercel.app/play

## grudge6 hero scale + animation (ONE TRUTH)

| Concern | Pattern | Code |
|---------|---------|------|
| **Height** | Fit to **~1.85 m** world units | `normalizeCharacterGroup` in `engine/grudge6Character.ts` |
| **100× bug** | Never `scale.setScalar(target / worldSize)` when root already has non-unit scale — **reset → measure → multiply** | same |
| **cm FBX** | If height &gt; 20 at scale 1, apply `0.01` then fit | same |
| **Skeleton** | Unify Bip001 bones; bind all SkinnedMesh to one skeleton | `unifySkeletons` |
| **Equip** | Child-mesh visibility from gear preset **before** fit | `applyGearPreset` then normalize |
| **Anims** | Same-origin `/anims/baked/{pack}/…json` (CDN often 404) + `AnimationDirector` | `loadPackBundle` |
| **Staged GLB** | `/models/heroes/grudge6/{race}_{class}.glb` then still load **baked packs** (GLBs usually have no clips) | `prepareFromGltfRoot` |
| **Race FBX SSOT** | `assets…/models/grudge6/races/*_Characters.fbx` | `raceModelUrls` |

### Rapier + R3F (`/play`)

| Rule | Why |
|------|-----|
| One `<Physics timeStep={1/60} interpolate>` | Stable sim + smooth mesh follow |
| Terrain = heightfield (`Arena`) | Correct ground contacts |
| Hero = capsule collider ≈ `PLAYER.height` 1.2 + radius 0.4 | Matches fit mesh ~1.85 |
| Visual mesh child of rigid body | Scale/anim never fight physics transform |
| No Physics remount on Suspense thrash | Avoids collider storm |

Stack: **React + R3F + drei + @react-three/rapier + three + Node 20 / Vite / pnpm**.

## Why default starts felt weak

1. **Empty equipment bag** — roster booted with `equipment: {}`, so gear HP/defense/damage never applied (base ~240 HP only).
2. **Damage mult bug** — weapon `damageBase / 50` could drop damage *below* 1.0×.
3. **Silent `startGame()`** — unlock/loadout gates returned without starting; UI still thought battle began.
4. **Starter card level 1** — gear tier floor stayed at 1.
5. **Hero 100× scale** — normalize used world bbox as local scale (fixed 2026-07).
6. **T-pose staged heroes** — GLBs had no clips and skipped baked packs (fixed).

## Campaign-ready default (current)

On `/play` boot (`prepareAndStartMatch`):

- Unlock **Sir Aldric** (or selected prefab) at **card level ≥ 3** → gear tier 3  
- Equip **full warcamp kit** (blade, shield, full plate, jewelry, relic)  
- Canonical melee + ranged for the prefab  
- Seed all three lane creep pairs  
- Base hero HP **420** + gear bonuses (~800–1000+ effective HP)  
- Damage mult **never &lt; 1.0×**

## Browser (runtime) — required

| Capability | Why |
|------------|-----|
| **WebGL / WebGL2** | Three.js / R3F canvas |
| **WebAssembly** | `@react-three/rapier` physics |
| **ES Modules** | Vite production bundle |
| **Secure context** (HTTPS / localhost) | Pointer lock + modern APIs |

Checked in-app: `src/lib/capabilities.ts` → `CapabilityGate` on failure.

## Browser — recommended / optional

| Capability | Severity | Why |
|------------|----------|-----|
| Web Workers | recommended | Physics / asset offload |
| Pointer Lock | recommended | Combat mouse look |
| localStorage | recommended | Roster + meta |
| Web Audio | optional | SFX |
| IndexedDB | optional | Large caches |
| **WebGPU** | optional | Future renderer — **not required** for `/play` |

## Build / deploy (not in browser)

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | ≥ 20 | pnpm, Vite, tsc |
| **pnpm** | 9.x | Workspace monorepo (preinstall enforces) |
| TypeScript | ~5.9 | typecheck |
| Vite | catalog | Bundle `artifacts/grudge-warlords` |
| Vercel | — | Host |

## Package dependency tree (runtime)

```
react / react-dom / react-router-dom
  └─ needs: ESM, modern browser

three + @react-three/fiber + @react-three/drei
  └─ needs: WebGL/WebGL2

@react-three/rapier
  └─ needs: WebAssembly (+ Workers recommended)

zustand
  └─ needs: localStorage (recommended)

@workspace/game-content
  └─ prefabs, skills (bundled)

@workspace/grudge-engine
  └─ CDN boot probe

@workspace/r3f-fleet
  └─ canvas props + WebGL context guard

ObjectStore (objectstore.grudge-studio.com)
  └─ weapons/armor codex (network)

id.grudge-studio.com bootstrap (optional)
  └─ SSO
```

## Local verify

```powershell
cd C:\Users\david\Desktop\warlord-genesis
pnpm install
pnpm --filter @workspace/grudge-warlords run typecheck
pnpm --filter @workspace/grudge-warlords run build
pnpm --filter @workspace/grudge-warlords run dev
# open http://localhost:5173/play
```

## Deploy

```powershell
cd C:\Users\david\Desktop\warlord-genesis
pnpm run deploy:vercel
# or: vercel --prod --scope grudgenexus
```
