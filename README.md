# Warlord Genesis

[![Live](https://img.shields.io/badge/live-warlord--genesis.vercel.app-00c389)](https://warlord-genesis.vercel.app)
[![Domain](https://img.shields.io/badge/domain-warstrat.grudge--studio.com-7c5cff)](https://warstrat.grudge-studio.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

3D browser MOBA/RTS warcamp — hero warlord, three lanes, summonable units, turrets, and Grudge6 characters.

## Production URLs

| Role | URL |
|------|-----|
| **Vercel production** | https://warlord-genesis.vercel.app |
| **Branded DNS** | https://warstrat.grudge-studio.com |
| **Play** | `/play` on either host |
| **Warcamp** | `/lobby` · march orders `/deploy` |
| **Repo** | [github.com/MolochDaGod/warlord-genesis](https://github.com/MolochDaGod/warlord-genesis) |

Both hosts serve the same Vercel project (`warlord-genesis`). DNS for `warstrat` is a CNAME (or Vercel alias) under `grudge-studio.com`.

## Monorepo stack

- `artifacts/grudge-warlords` — React + Vite + R3F + Rapier (source of truth for client)
- `lib/gw-sim` — Headless PvP simulation
- `lib/r3f-fleet`, `lib/game-content`, `lib/grudge-engine` — shared engine/content

## Play defaults (campaign-ready)

On `/play` the client **auto-prepares** a strong first match (no empty paper-doll):

- Starter warlord unlocked at **card level ≥ 3** (gear tier 3)
- Full **warcamp kit** (blade, shield, plate, jewelry, relic)
- Canonical melee + ranged for the prefab
- Seeded lane creep pairs
- Default difficulty **Skirmish (easy)** for first boot
- One-time site-data wipe (`gw_site_data_cleared_v68`) so pre-v68 weak saves are not sticky

Capability preflight: WebGL/WebGL2 + WASM required; WebGPU optional. See [docs/PLAY_DEPENDENCIES.md](docs/PLAY_DEPENDENCIES.md).

## Play locally

```bash
corepack enable
pnpm install
BASE_PATH=/ PORT=5173 pnpm --filter @workspace/grudge-warlords run dev
```

Open `http://localhost:5173/play` or `http://localhost:5173/deploy`.

## Deploy (Vercel)

```bash
# Build client → ship static root used by CI
pnpm --filter @workspace/grudge-warlords run build
# copy dist assets into assets/index-warlord-fix3.js + bump index.html ?v=
pnpm run deploy:vercel
# or
npx vercel --prod --yes --scope grudgenexus
```

- **Project:** `warlord-genesis` (team `grudgenexus`)
- **Install:** `pnpm install --frozen-lockfile`
- **Output (vite):** `artifacts/grudge-warlords/dist/public`
- **Shipped SPA:** `index.html` + `assets/index-warlord-fix3.js` (static ship mode when present)

### Domains

```bash
# Attach branded host to this project
npx vercel domains add warstrat.grudge-studio.com warlord-genesis --scope grudgenexus
```

Cloudflare DNS (`grudge-studio.com` zone) — CNAME:

```
warstrat  CNAME  cname.vercel-dns.com  (proxied optional)
```

Keep **warlord-genesis.vercel.app** as the always-on Vercel alias.

## Architecture

| Layer | Host | Role |
|-------|------|------|
| Frontend | Vercel | React+Three.js SPA |
| Game API | Railway `warlord-genesis-api` | Auth adapter, saves |
| Canonical DB | Railway `grudge-api` | Grudge ID, characters |
| Assets | Cloudflare R2 | `assets.grudge-studio.com` |
| Catalog | ObjectStore | `objectstore.grudge-studio.com` |
| Identity | Grudge ID | `id.grudge-studio.com` |

## Environment

See `.env.example`. Key Vercel vars: `GRUDGE_API_URL`, `WARLORD_GENESIS_API_URL`.

## Database

```bash
cd api && npm install && npm run db:migrate
pnpm run api:migrate
```

## Docs

- [docs/PLAY_DEPENDENCIES.md](docs/PLAY_DEPENDENCIES.md) — browser/build deps
- [docs/GAME_DEFINITIONS.md](docs/GAME_DEFINITIONS.md) — flow, units, accounts
- [scripts/README.md](scripts/README.md) — bundle patch pipeline

## License

MIT — see [LICENSE](LICENSE).
