# Open ↔ Warlord Genesis handoff

**Product SSOT:** `F:\GitHub\warlord-genesis` → https://warlord-genesis.vercel.app  
**Launcher:** https://open.grudge-studio.com (repo `gameopen`)

Open does **not** host the MOBA client. Library / genesis door hand off SSO + character.

## Launch URL

```
https://warlord-genesis.vercel.app/lobby
  ?sso_token=<jwt>
  &grudge_token=<jwt>
  &characterId=<uuid>
  &open=1
  &from=open
```

Built by Open:

- `artifacts/animator/src/lib/warlordGenesisLaunch.ts`
- `gameLibrary` entry `warlord-genesis` (`launch: "external"`)
- Account panel / App mode `genesis` → same helper

## Genesis capture

On load (`grudgeStudio.captureRedirectToken` + `openLaunch.captureOpenLaunchParams`):

| Param | Action |
|-------|--------|
| `sso_token` / `grudge_token` / `token` | Dual-write fleet token keys |
| `characterId` | `grudge_active_character` + session open key |
| `open=1` / `from=open` | Flag Open session → skirmish map defaults |

Sensitive query params are stripped after capture.

## Character hydrate

`fleetCharacterHydrate.hydrateRosterFromFleet`:

1. Prefer Open handoff `characterId`
2. Else stored active character / era-active / first roster row
3. Map race×class → grudge6 prefab, unlock warlord, set weapons

API: same-origin `GET /api/characters?era=warlords` (Vercel rewrite → Railway).

## Open play defaults

| Setting | Value |
|---------|--------|
| Map | **Skirmish** (compact 3-lane end-to-end) |
| Difficulty | Normal |
| Entry route | Intro auto-redirects to `/lobby` |

## Smoke

1. Sign in on open.grudge-studio.com, pick a Warlords character  
2. Library → **Warlord Genesis** → Launch ↗  
3. New tab: warlord-genesis `/lobby`, roster matches character  
4. Battlefield default **SKIRMISH**, March to War  
5. Lobby shows **← Back to Open library**

## Content map (Open-related)

| Area | File | Notes |
|------|------|--------|
| Characters | `fleetCharacterHydrate.ts`, prefabs | Fleet UUID → 24 prefabs |
| Units | `engine/grudge6.ts` `GRUDGE6_UNIT_TYPES` | 6 races × 4 classes, tiered |
| Maps | `game/mapgen.ts` | skirmish / standard / large |
