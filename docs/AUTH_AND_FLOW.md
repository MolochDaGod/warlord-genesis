# Warlord Genesis — sign-in & game flow

**Live:** https://warlord-genesis.vercel.app/ · https://genesis.grudge.studio/

## What `gw-core` is (not a session)

`assets/gw-core-20260713.js` is the **compiled production app** (React routes, lobby, play, HUD, auth). Vercel ships that file; `ci-build` does **not** rebuild from `artifacts/grudge-warlords`. Session is JWT in `localStorage` (`grudge_auth_token` / `sso_token`) plus `session.ts`.

| Layer | Owns |
|-------|------|
| Source | `artifacts/grudge-warlords/src/**` |
| Live boot | `gw-core-20260713.js` (minified ship) |
| Session | JWT + `restore()` / Grudge ID callback |
| Player SSOT | Railway `grudge-api` characters / bag |
| Title extras | Railway `warlord-genesis-api` `/api/grudge/*` (save, fleet map) |

## Sign-in (fixed)

| Path | How |
|------|-----|
| **Grudge Studio SSO** | Popup / redirect to `id.grudge-studio.com` → JWT → `/api/grudge/auth/me` or fleet `/api/auth/me` |
| **Restore** | `grudge_auth_token` / `sso_token` — no guest mint |
| **Guest** | **Removed.** `POST /api/grudge/auth/guest` → 410 |

### Bugs fixed

1. **SDK 404** — client loaded `objectstore…/sdk/grudge-sdk.js` (404). Profile resolve now uses **`/api/grudge/auth/me`** with Bearer; SDK only as fallback from `assets.grudge-studio.com/sdk/grudge-sdk.js`.
2. **Login URL** — fleet dual-write `redirect_uri` / `return` / `origin` / `app=warlord-genesis`.
3. **Popup blocked** — falls back to full-page SSO; redirect token capture on return.

## Game flow

```
/ (Intro) → SIGN IN (hub) or ENTER WARCAMP
  → /lobby  (pick warlord · loadout · MARCH TO WAR)
  → /play   (match)
Quick paths: /play?skirmish=1 · /mp · /deploy
```

| Step | Repair |
|------|--------|
| Empty warcamp | `ensureWarcampReady()` unlocks starter + gear |
| March blocked | Shows `warcampBlockMessage` + Quick Skirmish |
| Match start fail | Surface error; don’t silent-fail |

## API rewrites (vercel.json)

- `/api/auth/*`, `/api/characters`, `/api/account`, `/api/health` → **fleet** `grudge-api`
- `/api/grudge/*` → **title** `warlord-genesis-api` (save, fleet JSON)
- `/api/grudge/health` → title `/api/health` (not a second player DB)
- `/v1/play-kit.json` → static catalog (not Railway)

## Code

- `artifacts/grudge-warlords/src/lib/grudgeStudio.ts`
- `artifacts/grudge-warlords/src/lib/grudgeAuth.ts`
- `artifacts/grudge-warlords/src/game/session.ts`
- `artifacts/grudge-warlords/src/pages/Lobby.tsx`
- `artifacts/grudge-warlords/src/components/ui/AuthPanel.tsx`
