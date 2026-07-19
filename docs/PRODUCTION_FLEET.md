# Warlord Genesis MOBA — Production fleet

## Live

| Surface | URL |
|---------|-----|
| Game | https://warlord-genesis.vercel.app |
| Alias | https://warstrat.grudge-studio.com |
| Fleet probes | https://warlord-genesis.vercel.app/fleet-connections.html |
| Leaderboards | https://warlord-genesis.vercel.app/leaderboards.html |
| Title API | Railway `warlord-genesis-api-production-3b5a` |
| Account SSOT | Railway `grudge-api-production-0d46` |
| Auth | https://id.grudge-studio.com |

## Favicon

Grudox brand PNGs at site root: `favicon.png`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`.

## Connections

| Concern | Path |
|---------|------|
| Health (account) | `/api/health` → grudge-api |
| Games / profile / matches | `/api/games/*` → warlord-genesis-api |
| Leaderboards | `/api/games/grudge-warlords/leaderboards/:board` |
| Fleet JSON | `/api/grudge/fleet` |
| PvP health | `/api/mp/health` → `WARLORD_MP_URL` or `warlord-mp.up.railway.app` |
| Auth | `/login`, `/auth/*`, `/api/auth/*` |

## Leaderboard boards

- `moba_wins`
- `lane_kills`
- `match_score`
- `warlord_score`

Match POST `/api/games/grudge-warlords/matches` with `{ won, kills, score, rewardGbux }` updates ranks when authenticated.

## Deploy

```bash
# regenerate vercel.json after fleet changes
node scripts/generate-vercel-config.mjs

# full production
pnpm deploy
# or
node scripts/deploy.mjs
```

Env (Vercel / Railway):

| Var | Where |
|-----|--------|
| `VITE_MP_URL` / `WARLORD_MP_URL` | Socket.IO MOBA host |
| `GRUDGE_API_URL` | Account API (default production Railway) |
| `WARLORD_GENESIS_API_URL` | Title API |
| `DATABASE_URL` | Title API Postgres |
