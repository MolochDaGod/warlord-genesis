# Warlord Genesis — `/play` dependencies

URL: https://warlord-genesis.vercel.app/play

## Why default starts felt weak

1. **Empty equipment bag** — roster booted with `equipment: {}`, so gear HP/defense/damage never applied (base ~240 HP only).
2. **Damage mult bug** — weapon `damageBase / 50` could drop damage *below* 1.0×.
3. **Silent `startGame()`** — unlock/loadout gates returned without starting; UI still thought battle began.
4. **Starter card level 1** — gear tier floor stayed at 1.

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
