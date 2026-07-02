# Warlord Genesis

[![Live Demo](https://img.shields.io/badge/demo-warlord--genesis.vercel.app-00c389)](https://warlord-genesis.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Grudge Warlords RTS warcamp client — live at [warlord-genesis.vercel.app](https://warlord-genesis.vercel.app).

Static Vite production build with patched tower GLBs and runtime fixes for GLTF texture paths and lobby React stability.

## Repository

- **GitHub:** [github.com/MolochDaGod/warlord-genesis](https://github.com/MolochDaGod/warlord-genesis)
- **Vercel:** `grudgenexus/warlord-genesis`

Pushes to `main` auto-deploy via Vercel Git integration.

## Deploy manually

```bash
vercel link --project warlord-genesis
vercel deploy --prod
```

## Tower assets

Tower GLBs must not embed Windows absolute texture paths. Before shipping new models:

```bash
npm run assets:strip
npm run assets:upload-r2   # requires wrangler + R2 access
```

CDN layout: `assets.grudge-studio.com/models/maps/{theme}/{model}.glb`

Local fallback: `/models/towers/{theme}/{model}.glb`

## Fixes in this build

- Strip Windows absolute texture URIs from tower GLBs
- Skip invalid paths in GLTFLoader (`C:\`, `E:\`, OneDrive, etc.)
- React Rules-of-Hooks fix in `PackOverlay`
- Stable lobby/loadout effects (no infinite re-render)
- Default `cdnReachable: true`; cache key `gw_engine_boot_v3`

## Source migration

The original monorepo artifact was `artifacts/grudge-warlords` (React + Three.js + Vite). When that TypeScript source is available, move it under `artifacts/grudge-warlords/` and restore the pnpm workspace build; keep `scripts/strip-glb-external-textures.mjs` in the asset pipeline.

## License

MIT — see [LICENSE](LICENSE).