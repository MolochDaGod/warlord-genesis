# Warlord Genesis

Grudge Warlords RTS warcamp client — live at [warlord-genesis.vercel.app](https://warlord-genesis.vercel.app).

Static Vite production build with patched tower GLBs and runtime fixes for GLTF texture paths and lobby React stability.

## Deploy

```bash
vercel link --project warlord-genesis
vercel deploy --prod
```

Vercel project: `grudgenexus/warlord-genesis` (`prj_FE1mPbTqRv39PbvkyjrxNL5gVrJY`).

## Tower assets

Tower GLBs must not embed Windows absolute texture paths. Before shipping new models:

```bash
npm run assets:strip
npm run assets:upload-r2   # requires wrangler + R2 access
```

CDN layout: `assets.grudge-studio.com/models/maps/{theme}/{model}.glb`

## Source migration

The original monorepo artifact was `artifacts/grudge-warlords` (React + Three.js + Vite). When that TypeScript source is available, move it under `artifacts/grudge-warlords/` and restore the pnpm workspace build; keep `scripts/strip-glb-external-textures.mjs` in the asset pipeline.