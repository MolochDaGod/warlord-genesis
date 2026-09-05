# Live audit — warlord-genesis.vercel.app (2026-09-05)

**Origin:** https://warlord-genesis.vercel.app  
**Alias:** genesis.grudge.studio · warstrat.grudge-studio.com (same app)

## Scorecard

| Gate | Status | Evidence |
|------|--------|----------|
| 1 Identity / bootstrap MIME | **PASS** | `/grudge-game-bootstrap.js` `application/javascript` |
| 2 CORS /auth/me | **PASS** (401 anon) | Same-origin rewrite → Railway Express |
| 3 Characters rewrite | **PASS** (401 anon) | `/api/characters` → grudge-api |
| 4 Vercel catch-all vs play-kit | **FIXED** | `/api/v1/play-kit` was swallowed by `/api/:path*` → Railway 404 |
| 5 Bundle `lanes.every` | **PASS** | gw-core has `[0,1,2].every`, not `deploy.lanes.every` |
| 6 Deploy health | **PASS** | `/` 200 · `/api/health` 200 JSON |
| 7 Fleet | **PASS** | FLEET_GAME_ORIGINS / onboarding audit |

## Blocker (game flow)

**Conflict:** fleet rewrite `/api/:path*` → Railway. Destinations under `/api/v1/*.json` were **re-proxied** to Express (`API route not found`). Boot splash fetched play-kit and showed degraded/empty; Play.tsx same.

**Fix:** static catalog at **`/v1/play-kit.json`** + **`/v1/health.json`**. Rewrites `/api/v1/play-kit` → `/v1/play-kit.json` (destination **not** under `/api`). SPA catch-all excludes `v1/`.

## Other conflicts (not invented)

| Issue | Notes |
|-------|--------|
| Two Railway APIs | Fleet `grudge-api` = account/characters. Title `warlord-genesis-api` = `/api/grudge/*` save. `/api/grudge/health` now aliases title `/api/health`. |
| og:url | Canonical `warlord-genesis.vercel.app` (same project as warstrat / genesis.grudge.studio). |
| `/login` rewrite | Grudge ID gateway. |
| Auto-guest restore | Live bundle used to mint a guest on every cold load. Source does not. Live patched: restore only if JWT exists; explicit Guest button still calls `lO()`. |
| gw-core vs source | gw-core is the **shipped compile**, not a session. Source is `artifacts/grudge-warlords`. Live still boots gw-core until a real Vite rebuild. |

## Verify

```bash
curl -sI https://warlord-genesis.vercel.app/v1/play-kit.json | findstr /i content-type
curl -s https://warlord-genesis.vercel.app/api/v1/play-kit | findstr ok
curl -sI https://warlord-genesis.vercel.app/grudge-game-bootstrap.js | findstr /i content-type
curl -s https://warlord-genesis.vercel.app/api/health
```
