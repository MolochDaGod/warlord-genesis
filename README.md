# Warlord Genesis

[![Live Demo](https://img.shields.io/badge/demo-warlord--genesis.vercel.app-00c389)](https://warlord-genesis.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

3D browser MOBA/RTS from the Grudge Warlords game mode — hero warlord, three lanes, summonable units, cannon/ballista/mage turrets, and textured projectile shells.

**Live:** [warlord-genesis.vercel.app](https://warlord-genesis.vercel.app)  
**Repo:** [github.com/MolochDaGod/warlord-genesis](https://github.com/MolochDaGod/warlord-genesis)

## Monorepo stack

- `artifacts/grudge-warlords` — React + Vite + R3F + Rapier hero (source of truth for deploy/lane changes)
- `lib/gw-sim` — Headless PvP simulation (multiplayer)
- `lib/r3f-fleet`, `lib/game-content`, `lib/grudge-engine` — shared engine/content libs

## Play locally

```bash
corepack enable
pnpm install
BASE_PATH=/ PORT=5173 pnpm --filter @workspace/grudge-warlords run dev
```

Open `http://localhost:5173/play` or `http://localhost:5173/deploy`.

## Deploy (Vercel)

- **Install:** `pnpm install --frozen-lockfile`
- **Build:** `pnpm --filter @workspace/grudge-warlords run build`
- **Output:** `artifacts/grudge-warlords/dist/public`
- **Legacy CI bundle:** `pnpm run build:ci` (patches shipped `assets/index-warlord-fix3.js`)

## Architecture

| Layer | Host | Role |
|-------|------|------|
| Frontend | Vercel | React+Three.js SPA from monorepo artifact |
| Game API | Railway `warlord-genesis-api` | Auth adapter, `warlord_genesis_players` saves |
| Canonical DB | Railway `grudge-api` (Postgres) | Grudge ID, characters, wallet, islands |
| Assets | Cloudflare R2 | `assets.grudge-studio.com` models & textures |
| Catalog | ObjectStore | `objectstore.grudge-studio.com` JSON defs |
| Identity | Grudge ID | `id.grudge-studio.com` popup SSO |

## Production environment variables

See `.env.example`. Key Vercel vars: `GRUDGE_API_URL`, `WARLORD_GENESIS_API_URL`.

## Database & migrations

```bash
cd api && npm install && npm run db:migrate
pnpm run api:migrate
```

Fleet character migration: `node scripts/run-fleet-migration.mjs`

## License

MIT — see [LICENSE](LICENSE).
