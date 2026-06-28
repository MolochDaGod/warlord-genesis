# Warlord Genesis

3D browser MOBA/RTS from the Grudge Warlords game mode — hero warlord, three lanes, summonable units, cannon/ballista/mage turrets, and textured projectile shells.

## Play locally

```bash
corepack enable
pnpm install
BASE_PATH=/ PORT=5173 pnpm --filter @workspace/grudge-warlords run dev
```

Open `http://localhost:5173/play`.

## Deploy (Vercel)

- **Build:** `pnpm --filter @workspace/grudge-warlords run build`
- **Output:** `artifacts/grudge-warlords/dist/public`
- **Assets:** Local `public/` models + optional R2 proxy for `/assets` and `/anims`

## Stack

- `artifacts/grudge-warlords` — React + Vite + R3F + Rapier hero
- `lib/gw-sim` — Headless PvP simulation (multiplayer)