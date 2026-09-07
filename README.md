# Warlord Genesis

[![Live](https://img.shields.io/badge/live-genesis.grudge.studio-00c389)](https://genesis.grudge.studio)
[![Vercel](https://img.shields.io/badge/vercel-warlord--genesis-00c389)](https://warlord-genesis.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

3D browser MOBA — hero warlord, three lanes, summonable units, turrets, Grudge6 / Toon RTS play kits. Combat is third-person + center crosshair. Sanctum ground uses the fleet Super Terrain catalog.

## Production URLs

| Role | URL |
|------|-----|
| **Canonical** | https://genesis.grudge.studio |
| **Vercel** | https://warlord-genesis.vercel.app |
| **Alias** | https://warstrat.grudge-studio.com |
| **Play** | `/play` (faction onboarding → match) |
| **Warcamp** | `/lobby` · `/deploy` |
| **Map edit** | `/edit` |
| **Repo** | [MolochDaGod/warlord-genesis](https://github.com/MolochDaGod/warlord-genesis) |

Same Vercel project `warlord-genesis` (`prj_FE1mPbTqRv39PbvkyjrxNL5gVrJY`).

## One SPA (no second bundle)

| Layer | Owns |
|-------|------|
| **Source** | `artifacts/grudge-warlords` (Vite + React + R3F + Rapier) |
| **Live boot** | `/assets/index-*.js?v=` pinned in root `index.html` |
| **Identity** | `id.grudge-studio.com` via `/api/auth/*` |
| **Player SSOT** | Railway `grudge-api` `/api/*` (characters, bag) |
| **Title API** | Railway `warlord-genesis-api` `/api/games/*` |
| **Binaries** | `assets.grudge-studio.com` |
| **Terrain catalog** | `info.grudge-studio.com/api/v1/super-terrain.json` |

`gw-core-*.js`, `index-warlord-fix*.js`, `grudge-game-bootstrap.js`, and `/sdk/grudge-sdk.js` are **dead**. Old `gw-core` URLs **308** to the Vite pin. Do not `patch-bundle.mjs` for production.

## Play

- `/play` boots the Vite app → faction onboarding (sign-in required).
- Combat: TPS camera + HUD crosshair (`` ` `` Combat / Command).
- Sanctum standard/large: fleet Super Terrain heightfield; lanes stay walkable. 1v1 keeps the authored arena GLB.
- Play kit: Toon RTS `{race}.glb` + one mixer. Not Meshy / capsule heroes.

```bash
corepack enable
pnpm install
pnpm --filter @workspace/grudge-warlords run dev
```

Open `http://localhost:5173/play`.

## Deploy

Compile happens **off Vercel’s git builder** (`.vercelignore` drops `/artifacts`). One path:

```bash
pnpm run deploy:spa
```

That runs `scripts/ship-vite-spa.mjs` (Vite build → pin `index.html` + hashed `/assets`) then `vercel --prod --force`.

Or push `main`: GHA **Deploy Genesis SPA** (needs repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Vercel git auto-build is **skipped** (`ignoreCommand`).

| Do | Do not |
|----|--------|
| Edit `artifacts/grudge-warlords/src` | Patch `gw-core` / `index-warlord-fix3.js` |
| `pnpm run deploy:spa` or GHA | Rely on Vercel git compile |
| Guest auth 403 | Auto guest login |

## Map edit (`/edit`)

Static `edit.html` + `assets/map-edit.mjs` (Three.js CDN importmap). React source for the in-SPA editor: `artifacts/grudge-warlords/src/pages/Edit.tsx`.

```bash
pnpm run verify
pnpm run edit:verify
```

## Architecture

| Layer | Host |
|-------|------|
| Frontend | Vercel static Vite SPA |
| Game API | Railway `warlord-genesis-api` |
| Canonical DB | Railway `grudge-api` |
| Assets | R2 `assets.grudge-studio.com` |
| Catalog | ObjectStore / `info.grudge-studio.com` |
| Identity | Grudge ID `id.grudge-studio.com` |

## Docs

- [docs/AUTH_AND_FLOW.md](docs/AUTH_AND_FLOW.md) — login, one-SPA law, deploy
- [docs/PLAY_DEPENDENCIES.md](docs/PLAY_DEPENDENCIES.md) — WebGL / WASM
- [docs/GAME_DEFINITIONS.md](docs/GAME_DEFINITIONS.md) — flow, units

## License

MIT — see [LICENSE](LICENSE).
