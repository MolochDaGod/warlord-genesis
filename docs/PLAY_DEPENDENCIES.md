# Warlord Genesis — `/play` dependencies

**Live:** https://genesis.grudge.studio/play  
**Source:** `F:\GitHub\warlord-genesis\artifacts\grudge-warlords`

Play renderer is **one** `THREE.WebGLRenderer` via R3F `<Canvas>` (WebGL2 when the GPU has it, else WebGL1). **WebGPU is not the play path.** Node.js does not run Three in production — it only builds the SPA.

## Browser (runtime)

| Capability | Severity | Why |
|------------|----------|-----|
| **WebGL** | required | `WebGLRenderer` / R3F canvas |
| **WebGL2** | recommended | Preferred context (Three picks it automatically) |
| **WebAssembly** | required | `@react-three/rapier` |
| **ES Modules** | required | Vite bundle |
| **HTTPS / localhost** | required | Pointer lock |
| Web Workers | recommended | Physics / loaders |
| Pointer Lock | recommended | Combat look |
| **WebGPU** (`navigator.gpu`) | optional | Detected only — **not** used for `/play` |

Checked: `src/lib/webgl.ts` + `src/lib/capabilities.ts`.

## Node (build only — not in the browser)

| Tool | Version | Why |
|------|---------|-----|
| Node.js | ≥ 20 | pnpm / Vite / tsc |
| pnpm | 9.x | Workspace |
| Vite | catalog | Bundle `artifacts/grudge-warlords` |

**One Three instance:** Vite `resolve.alias` + `dedupe` pin `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier` to this package’s `node_modules`. Workspace libs must not ship a second `three`.

## Play packages (R3F warcamp)

| Package | Role |
|---------|------|
| `three` **^0.185.1** | Scene / WebGLRenderer |
| `@react-three/fiber` | React loop |
| `@react-three/drei` | Sky, AdaptiveDpr, useGLTF — **not** combat camera |
| `@react-three/rapier` | One `<Physics>` + heightfield + hero capsule |
| `zustand` | Match / command stores |

## R3F play practices (this repo)

| Rule | Where |
|------|--------|
| One `<Physics timeStep={1/60} interpolate>` | `Game.tsx` |
| Terrain = heightfield | `Arena.tsx` |
| Hero capsule child mesh | `Player.tsx` |
| Single TPS writer in combat; RTS camera in command | `Player.tsx` + `` ` `` |
| sRGB + ACES + DPR ≤ 1.5 + PCFSoft | `lib/r3f-fleet` `applyFleetRenderer` |
| No Physics remount on Suspense | `Game.tsx` |
| SI 1 unit = 1 m; hero ~1.85 m | `grudge6Character.ts` |

Do **not**: second mixer, OrbitControls in combat, WebGPU Canvas, Node `three` in Railway API.

## Local

```powershell
cd F:\GitHub\warlord-genesis
pnpm install
pnpm --filter @workspace/grudge-warlords run dev
# http://localhost:5173/play
```

## Deploy

```powershell
cd F:\GitHub\warlord-genesis
pnpm run deploy:spa
```
