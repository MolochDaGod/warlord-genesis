# Scripts

Production pipeline for Warlord Genesis (static SPA + patched minified bundle).

## Daily commands

| Command | What it does |
|---------|----------------|
| `npm run build` | Full CI: textures → stage → GLB fix → **patch** → CSS → vercel config → verify |
| `npm run patch` | `fix2.js` → `fix3.js` via `patch-bundle.mjs` |
| `npm run css:hud` | Craftpix combat HUD styles |
| `npm run css:pregame` | War Council pregame styles |
| `npm run deploy:vercel` | Production deploy |
| `npm run verify` | Local inventory + patch markers |
| `npm run clean:scratch` | Delete probe dumps (`scripts/_*`, deploy logs) |

## Keep (sources for patch inject)

| File | Role |
|------|------|
| `patch-bundle.mjs` | Main patch pipeline (reads `assets/index-warlord-fix2.js`) |
| `play-setup.min.txt` | War Council pregame (path + deploy + load) |
| `hud-craftpix.min.txt` | Combat HUD (globes, slots, minimap, windows) |
| `map-best-practices.min.txt` | Physics layers + texture/mesh prep helpers |
| `terrain-y.min.txt` | Heightmap terrain component (PBR + heightfield) |
| `deploy-screen-v2.min.txt` | Legacy `/deploy` screen (redirects to `/play`) |
| `admin-screen.min.txt` | Map admin UI |
| `bake-map-textures.mjs` | Procedural PBR ground maps |
| `ci-build.mjs` | Vercel `buildCommand` entry |
| `vercel-deploy.mjs` / `verify-deploy.mjs` | Ship + gate |

## Do not commit

- `scripts/_*` — one-off probes (gitignored)
- `deploy-*.txt`, `verify-output.txt` — CLI noise
- `api/node_modules`, root `node_modules`

## Bundle flow

```
assets/index-warlord-fix2.js   (baseline, do not edit by hand)
        │
        ▼  node scripts/patch-bundle.mjs
assets/index-warlord-fix3.js   (production, pinned in index.html ?v=N)
```
