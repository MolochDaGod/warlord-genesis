# Open → Warlord Genesis handoff

**Product SSOT:** this repo (`warlord-genesis.vercel.app`) — 3-lane MOBA/RTS warcamp.  
**Not this game:** Ruins Brawler (`gameopen.vercel.app/brawl` only).

## Entry

```
https://warlord-genesis.vercel.app/lobby
  ?open=1
  &from=open|gameopen|charactersgrudox
  &characterId=<uuid>
  &baseId=race-human|explorer|grudge-…
  &raceId=human|orc|elf|dwarf|barbarian|undead
  &characterName=…
  &sso_token=…   (or grudge_token)
```

Open library / GRUDOX campfire builds this via `gameopen` `lib/warlordGenesisLaunch.ts`.

## Boot sequence

1. `grudgeStudio.captureRedirectToken` → tokens + `captureOpenLaunchParams`
2. `useSession.restore` → `hydrateRosterFromFleet`
3. Open launch always runs `hydrateOpenLaunchWarlord`:
   - Match Railway `/api/characters?era=warlords` by id when signed in
   - Else **synthetic prefab** from `raceId` / `baseId` (campfire UUIDs)
   - `unlockFleetWarlord` → onboarding done + canonical weapons
   - `ensureWarcampReady` → lane guards + loadout
4. Intro redirects `/` → `/lobby`
5. Starter overlay **skipped** when `isOpenLaunch()`
6. March → `/play` (3-lane battle)

## Ownership

| Surface | Host |
|---------|------|
| Warlord Genesis (this game) | warlord-genesis.vercel.app |
| Ruins Brawler | gameopen.vercel.app/brawl |
| Characters GRUDOX (4 slots) | charactersgrudox / campfire roster |
| Open picker → Genesis | gameopen.vercel.app/genesis |

## Prefab race ids

`human | barbarian | dwarf | elf | orc | undead`  
(`high_elf` / `race-high-elf` normalize to `elf`)
