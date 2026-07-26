# Warlord Genesis — sign-in & game flow

**Live:** https://warlord-genesis.vercel.app/

## Sign-in (fixed)

| Path | How |
|------|-----|
| **Grudge Studio SSO** | Popup / redirect to `id.grudge-studio.com` → JWT → `/api/grudge/auth/me` |
| **Guest** | `POST /api/grudge/auth/guest` → JWT stored in `localStorage` + HttpOnly cookie |
| **Restore** | `grudge_auth_token` / `sso_token` + cookie |

### Bugs fixed

1. **SDK 404** — client loaded `objectstore…/sdk/grudge-sdk.js` (404). Profile resolve now uses **`/api/grudge/auth/me`** with Bearer; SDK only as fallback from `assets.grudge-studio.com/sdk/grudge-sdk.js`.
2. **Guest token not persisted** — guest responses include `token` but client never stored it → fleet hydrate/characters empty after guest.
3. **Login URL** — fleet dual-write `redirect_uri` / `return` / `origin` / `app=warlord-genesis`.
4. **Popup blocked** — falls back to full-page SSO; redirect token capture on return.

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

- `/api/grudge/*` → Railway `warlord-genesis-api`
- `/api/auth/*`, `/api/characters`, etc. → `grudge-api` fleet SSOT

## Code

- `artifacts/grudge-warlords/src/lib/grudgeStudio.ts`
- `artifacts/grudge-warlords/src/lib/grudgeAuth.ts`
- `artifacts/grudge-warlords/src/game/session.ts`
- `artifacts/grudge-warlords/src/pages/Lobby.tsx`
- `artifacts/grudge-warlords/src/components/ui/AuthPanel.tsx`
