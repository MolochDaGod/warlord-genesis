# Warlord Genesis — Game Definitions & Best Practices

Canonical model for **https://warlord-genesis.vercel.app** (three-lane RTS warcamp).

## 1. Game flow (correct path)

```
/  (title + auth)
  → guest | Puter | Grudge ID SSO
  → ENTER THE WARCAMP → /lobby
  → QUICK BATTLE → /play?skirmish=1  (auto-arms kit + starts match)
  → WAGE WAR ONLINE → /mp
/lobby  (warcamp loadout)  ← canonical prep
  → pick faction · race · class · hero prefab · weapons · lane heroes
  → MARCH TO WAR → prepareAndStartMatch() → /play
/deploy  (optional march-orders only)
  → lock loadout · begin assault → /play
/play  (battle)
  → if already in match (from lobby/deploy): render canvas
  → else auto-prepare warcamp kit + startGame (deep link safe)
  → never infinite-spin: failure → gate with Retry / Open warcamp
```

Aliases: `/warcamp` → `/lobby`, `/battle` → `/play`, `/start` & `/skirmish` → `/play?skirmish=1`.

**Auth storage:** `clearSiteDataOnce` must never wipe `grudge_auth_token` / SSO keys.

**Start requirements (client):**

| Gate | Source | Rule |
|------|--------|------|
| Session | `WgEnsureSession` / guest or SSO | Soft — guest can play |
| Loadout ready | `isLoadoutReady(melee, ranged, prefab)` | Faction prefab + weapons set |
| Deploy done | `sessionStorage wg-deploy-done` | `/play` may restore prior match |
| Assets | unit/hero GLBs | Local + objectstore CDN |

**Do not** require a non-empty fleet `/api/characters` list to start a match. Heroes are roster **prefabs** (local codex), not MMO character rows. Fleet characters are optional handoff from The-ENGINE / character viewer.

### Best practice

1. Always offer **Continue as Guest** with device-stable id (`grudge_device_id`).
2. Persist loadout in `localStorage` (`gw_roster_v2`) so refresh does not block start.
3. Match state in `sessionStorage` for resume; meta (GBUX, cards) in `gw_meta_v1` + server save.
4. Never block `/play` on chain wallet or NFT ownership.

---

## 2. Accounts

| Layer | ID | Auth path | Role |
|-------|-----|-----------|------|
| **Genesis guest** | `GRUDGE_*` via Puter-shaped guest | `POST /api/grudge/auth/guest` → genesis Railway → grudge-api puter | `guest` |
| **Puter player** | Puter UUID | `POST /api/grudge/auth/puter` | `player` |
| **Grudge ID SSO** | Fleet token | `id.grudge-studio.com` + bootstrap | `player` |
| **Fleet account** | `GET /api/account` | grudge-api | Island, gold, era slots |

**Shape (fleet account):**

```json
{
  "grudgeId": "GRUDGE_…",
  "gbuxBalance": 0,
  "gold": 0,
  "premiumCurrency": 0,
  "characterTokens": 1,
  "eraSlots": {
    "nexus": { "max": 2, "activeCharacterId": null },
    "armada": { "max": 2, "activeCharacterId": null },
    "warlords": { "max": 5, "activeCharacterId": null }
  },
  "walletAddress": null,
  "walletType": null
}
```

### Best practice

- Treat **grudgeId** as the only stable cross-game key.
- Guest → full account: merge by deviceId / puter link; do not create duplicate purses.
- `eraSlots.warlords` is the Warlord Genesis character slot budget (max 5).

---

## 3. Units (canonical combat)

**Source of truth (SP):** `artifacts/grudge-warlords/src/game/config.ts` → `UNIT_TYPES`  
**Must match (PvP sim):** `lib/gw-sim/src/config.ts` → `UNIT_DEFS`  
**API mirror:** `GET /api/grudge/definitions/units`

### Shop (summon costs — match credits)

| id | Cost | Line | HP | DMG | Speed | Mesh |
|----|------|------|----|-----|-------|------|
| footman | 80 | melee | 150 | 16 | 5.4 | footman |
| archer | 120 | ranged | 90 | 20 | 5.0 | archer |
| knight | 180 | melee | 320 | 26 | 4.6 | knight |

Meshes: `/models/units/{mesh}.glb` (KayKit-backed on CDN).

Production buildings also spawn tiered creeps (militia / skirmisher / marksman, etc.) from the same `UNIT_TYPES` table — do not invent parallel IDs.

---

## 4. Heroes

| Concept | Definition | Storage |
|---------|------------|---------|
| **Prefab** | Authored champion (`sir-aldric-valorheart`, …) | `lib/game-content` + `heroes.seed.json` |
| **Class** | `warrior` \| `ranger` \| `mage` \| `worge` | `classes.ts` |
| **Race (short)** | `human`, `barbarian`, `elf`, `dwarf`, `orc`, `undead` | roster |
| **Race kit (mesh)** | `western-kingdoms`, `barbarians`, … | `raceKitMap.ts` |
| **Faction** | `crusade` \| `fabled` \| `legion` | grudge6 engine |
| **GRDG id** | Deterministic `GRDG-XXXXXX` from seed | `ids.ts` / seed file |
| **Instance UUID** | `HERO-…` for saves | generate only for owned instances |

### Race remapping (required)

```
human → western-kingdoms
barbarian → barbarians
elf → high-elves
dwarf → dwarves
orc → orcs
undead → undead
```

Hero GLB path: `/models/heroes/grudge6/{kit}_{class}.glb`

### Best practice

- UI and codex use **prefab id** + short **raceId**.
- Loaders always call `raceKitId(raceId)` before mesh path.
- Stars (1–5) are collection rarity, not combat level; match level is XP-in-match only unless meta cards say otherwise.

---

## 5. Wallets & currencies (do not conflate)

| Currency | Scope | Persistence | Used for |
|----------|--------|-------------|----------|
| **Match credits** | One battle | Memory / session | Summons, towers, repair |
| **GBUX** | Meta progression | Account + `game_profiles.currency` | Packs, daily, cosmetics meta |
| **Gold** | Fleet MMO | grudge-api account | Island / world (not match shop) |
| **Premium / Embers** | Fleet premium | account.premiumCurrency | Soft premium |
| **Character tokens** | Character creation | account.characterTokens | Minting roster slots |
| **Chain wallet** | Crossmint / Solana | account.walletAddress | NFTs / on-chain items |

`GET /api/grudge/wallet` returns this layered model.  
`GET /api/wallet` on grudge-api may 404 — prefer genesis wallet or `GET /api/account` fields.

### Best practice

- Never debit GBUX for in-match summons.
- Never display chain address as “gold balance”.
- Victory grants GBUX via `metaProgression` (e.g. 85 win / 30 loss), not match credits.

---

## 6. API routing (production)

| Path | Destination |
|------|-------------|
| `/api/grudge/*` | warlord-genesis-api (Railway) |
| `/api/account`, `/api/characters`, … | grudge-api (Railway) |
| `/api/auth/guest|puter|me|…` | grudge-api explicit list |
| `/api/auth/*` (remainder) | id.grudge-studio.com |
| `/api/games` | **genesis API only** — never grudge-studio.com |
| Catch-all `/api/*` | grudge-api |

**Bug fixed:** catch-all used to proxy to `grudge-studio.com`, so `/api/games` returned a **NES/NDS ROM catalog**. That is not Warlord Genesis.

---

## 7. Verify games can start

Live smoke checklist:

```bash
node scripts/verify-deploy.mjs --live
```

Manual:

1. `GET /` → HTML “Warlord Genesis”
2. `POST /api/auth/guest` or `POST /api/grudge/auth/guest` → 200 + token
3. `GET /api/account` with Bearer → purse + eraSlots
4. `GET /models/units/footman.glb` → 200 glTF
5. `GET /models/heroes/grudge6/western-kingdoms_warrior.glb` → 200
6. Browser: guest → Lobby → loadout defaults → Deploy or Quick Battle → `/play` canvas boots

Match start is **client-authoritative** for SP (`startGame` in zustand store). Multiplayer uses `lib/gw-sim` with the same unit costs/stats.
