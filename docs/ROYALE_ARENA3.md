# Royale Arena 3 — Clash-style Warlord Genesis

## Level art
- **Source:** `D:\Games\Models\arena3.glb` (~131MB)
- **Ship paths:**
  - `models/maps/arena3.glb` (repo)
  - `public/models/maps/arena3.glb` (Vite/static)
  - Open: `artifacts/animator/public/models/arena/arena3.glb`

## Gameplay (Clash Royale–inspired)

| Feature | Behavior |
|---------|----------|
| Map size | `royale` — compact dual-push field |
| King tower | Ally/enemy **core** (citadel) |
| Princess towers | **Outer** towers on left + right lanes only (no mid / no inner ladder) |
| Elixir | Start 5, max 10, regen ~1/2.8s; **2× after 120s** |
| Hand | 4 cards cycled from deck (Footmen, Archers, Knight, Militia, …) |
| Deploy | Select card → left-click **your half** of the map (z past river) |
| Push | Units auto **attack-move** toward enemy king |

## How to play
1. Open `/deploy`
2. Battlefield → **⚔ ROYALE**
3. **ENTER ROYALE ARENA**
4. Use bottom card hand + elixir bar
5. Raze enemy princess towers, then the king

## Code
| File | Role |
|------|------|
| `game/mapgen.ts` | `royale` size + princess tower layout |
| `game/royale.ts` | Elixir, deck, half-map rules |
| `game/store.ts` | `tickRoyale`, `deployRoyaleAt`, hand cycle |
| `components/ui/RoyaleHand.tsx` | Card UI |
| `components/game/Arena3Map.tsx` | GLB ground mesh |
| `components/game/Command.tsx` | Click-to-deploy |
| `pages/Deploy.tsx` | Mode toggle |

## Open Danger Room
`ArenaMatch` now prefers `models/arena/arena3.glb` for match floors.
