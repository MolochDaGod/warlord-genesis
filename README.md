# Warlord Genesis

[![Live Demo](https://img.shields.io/badge/demo-warlord--genesis.vercel.app-00c389)](https://warlord-genesis.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Grudge Warlords RTS **warcamp** client — lane defense with GRUDGE6 viewer heroes, KayKit creeps, and fleet-backed player data.

**Live:** [warlord-genesis.vercel.app](https://warlord-genesis.vercel.app)  
**Repo:** [github.com/MolochDaGod/warlord-genesis](https://github.com/MolochDaGod/warlord-genesis)

## Architecture

| Layer | Host | Role |
|-------|------|------|
| Frontend | Vercel | Static React+Three.js bundle, SPA routes |
| Game API | Railway `warlord-genesis-api` | Auth adapter, `warlord_genesis_players` saves |
| Canonical DB | Railway `grudge-api` (Postgres) | Grudge ID, characters, wallet, islands |
| Assets | Cloudflare R2 | `assets.grudge-studio.com` models & textures |
| Catalog | ObjectStore | `objectstore.grudge-studio.com` JSON defs |
| Identity | Grudge ID | `id.grudge-studio.com` popup SSO |

```
Browser → warlord-genesis.vercel.app
          ├─ /api/grudge/*     → Railway warlord-genesis-api (player saves + auth adapter)
          ├─ /api/characters → Railway grudge-api (canonical Postgres)
          ├─ /api/auth/*     → Railway grudge-api (guest/SSO) + id.grudge-studio.com
          └─ /api/assets/*   → assets.grudge-studio.com (R2 CDN)
```

## Production environment variables

### Vercel (`warlord-genesis` project)

| Variable | Value |
|----------|-------|
| `GRUDGE_API_URL` | `https://grudge-api-production-0d46.up.railway.app` |
| `WARLORD_GENESIS_API_URL` | Railway URL after first deploy (see below) |

`vercel.json` rewrites are generated from these at build time:

```bash
npm run vercel:config
```

### Railway (`warlord-genesis-api` service)

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Same Postgres as `grudge-api` (Neon via grudge-studio-api) |
| `GRUDGE_API_URL` | `https://grudge-api-production-0d46.up.railway.app` |
| `PORT` | `8787` (Railway sets automatically) |

Copy `.env.example` for the full list.

## Database

Warlord Genesis uses the **canonical Grudge Studio Postgres** (not a separate silo). Game-specific progression lives in:

```sql
warlord_genesis_players (
  grudge_id TEXT PRIMARY KEY,
  user_id TEXT,
  device_id TEXT,
  role TEXT,
  save_json JSONB,  -- gbux, war chest cards, onboarding
  updated_at TIMESTAMPTZ
)
```

Run migrations:

```bash
cd api && npm install && npm run db:migrate
```

Player characters load from canonical `/api/characters?active=true` via `/api/grudge/characters/active`.

## Local development

```bash
# Patch bundle (lobby, about, cloud sync) + regenerate vercel.json
npm run predeploy

# API server (needs DATABASE_URL)
cd api && npm run dev

# Deploy frontend
vercel link --project warlord-genesis
npm run deploy
```

## Railway deploy

From repo root (linked to `grudge-warlords-db` or new `warlord-genesis-api` project):

```bash
railway link
railway variables set GRUDGE_API_URL=https://grudge-api-production-0d46.up.railway.app
# DATABASE_URL — reference Postgres from grudge-studio-api project
railway up
```

After deploy, set `WARLORD_GENESIS_API_URL` on Vercel to the Railway public URL and redeploy.

## Tower assets

Tower GLBs must not embed Windows absolute texture paths:

```bash
npm run assets:strip
npm run assets:upload-r2   # requires wrangler + R2 access
```

CDN: `assets.grudge-studio.com/models/maps/{theme}/{model}.glb`  
Local fallback: `/models/towers/{theme}/{model}.glb`

## Bundle patches (`scripts/patch-bundle.mjs`)

The shipped TypeScript source (`artifacts/grudge-warlords`) is not in this repo yet. Production fixes are applied to the Vite bundle:

- ObjectStore → `objectstore.grudge-studio.com`
- Lobby **About Studio** tab + hub **About Me** panel
- Cloud save sync → `warlord_genesis_players`
- Active character handoff → canonical `/api/characters`
- Tower GLB texture path guards (fix2 baseline)

Output: `assets/index-warlord-fix3.js`

## Source migration

When the monorepo artifact is available, restore `artifacts/grudge-warlords/` with Vite build and move patches into TypeScript source. Keep `scripts/strip-glb-external-textures.mjs` in CI.

## License

MIT — see [LICENSE](LICENSE).