# Warlord Genesis — sign-in & game flow

**Live:** https://warlord-genesis.vercel.app/ · https://genesis.grudge.studio/ · https://warstrat.grudge-studio.com/

## One app (no second bundle)

| Layer | Owns |
|-------|------|
| Source | `artifacts/grudge-warlords/src/**` (Vite) |
| Live boot | `/assets/index-*.js?v=` from `pnpm run deploy:spa` / GHA **Deploy Genesis SPA** |
| Session | JWT + `restore()` / Grudge ID callback |
| Player SSOT | Railway `grudge-api` `/api/*` (characters, bag) |
| Title extras | Railway `warlord-genesis-api` `/api/games/*` |
| Terrain | Fleet Super Terrain catalog `info.grudge-studio.com/api/v1/super-terrain.json` |

`gw-core-*.js` is **dead**. Old URLs 308 to the Vite pin. Do not `patch-bundle.mjs` for production.

## Deploy (best practice)

1. Edit source under `artifacts/grudge-warlords`.
2. `pnpm run deploy:spa` **or** push `main` (GHA Vite-builds, pins `index.html`, `vercel --prod --force`).
3. Vercel **git auto-build is skipped** (`ignoreCommand`) so it cannot compete.

`.vercelignore` still drops `/artifacts` on the Vercel builder — that is why compile happens on GHA/local, not on Vercel’s 8 GB git machine.

## Sign-in

| Path | How |
|------|-----|
| Login | `id.grudge-studio.com` via `/api/auth/*` rewrite |
| Guest `/api/auth/guest` | 403 — not wanted |
| Open handoff | `?characterId=` + `grudge.open.*` / `gw_open_*` |
