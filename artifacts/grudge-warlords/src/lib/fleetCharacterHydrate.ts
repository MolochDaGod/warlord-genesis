/**
 * Hydrate Warlords roster from fleet `/api/characters` SSOT.
 * Captain = character = hero — one row drives lobby prefab + GRDG id.
 */

import { getStudioToken } from "./grudgeStudio";
import { FLEET_STORAGE_KEYS } from "./fleetStorageKeys";
import {
  GRUDGE_PREFAB_BY_ID,
  makeGrudgeId,
  opposingFaction,
  prefabFor,
  RACE_ANIM_PRESET,
  type GrudgeFactionId,
} from "../engine/grudge6";
import { canonicalWeaponsForPrefab } from "../game/canonicalLoadout";
import { unlockFleetWarlord, useMeta } from "../game/metaProgression";
import { useRoster } from "../game/roster";
import type { ClassId, PrefabRaceId } from "@workspace/game-content";

const CHARACTERS_API = "/api/characters";
const GAME_ERA = "warlords";

export interface FleetCharacterRow {
  id: string;
  name: string;
  raceId: string;
  classId: string;
  grudgeSpecId?: string | null;
  grudge_spec_id?: string | null;
  cnftMintId?: string | null;
  cnft_mint_id?: string | null;
  prefabId?: string | null;
  prefab_id?: string | null;
  activeForEra?: boolean;
  active_for_era?: boolean;
  model3d?: Record<string, unknown> | null;
}

function authHeaders(): Record<string, string> {
  const token = getStudioToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function activeCharacterId(): string | null {
  try {
    return (
      localStorage.getItem(FLEET_STORAGE_KEYS.activeCharacter) ||
      localStorage.getItem(FLEET_STORAGE_KEYS.legacyActiveCharacter)
    );
  } catch {
    return null;
  }
}

async function listFleetCharacters(): Promise<FleetCharacterRow[]> {
  const res = await fetch(
    `${CHARACTERS_API}?era=${encodeURIComponent(GAME_ERA)}&envelope=1`,
    { credentials: "include", headers: { ...authHeaders() } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as FleetCharacterRow[] | { characters: FleetCharacterRow[] };
  return Array.isArray(data) ? data : data.characters ?? [];
}

function resolvePrefab(row: FleetCharacterRow) {
  const raceId = row.raceId as PrefabRaceId;
  const classId = row.classId as ClassId;
  const explicit =
    row.prefabId ??
    row.prefab_id ??
    (row.model3d?.prefabId as string | undefined);
  if (explicit && GRUDGE_PREFAB_BY_ID[explicit]) {
    return GRUDGE_PREFAB_BY_ID[explicit];
  }
  return prefabFor(raceId, classId);
}

/** Apply fleet row to Warlords roster store (SSOT → gw_roster_v2). */
export function applyFleetCharacterToRoster(row: FleetCharacterRow): boolean {
  const prefab = resolvePrefab(row);
  if (!prefab) return false;

  const grudgeId =
    row.grudgeSpecId ??
    row.grudge_spec_id ??
    (row.model3d?.grudgeSpecId as string | undefined) ??
    makeGrudgeId(prefab.raceId, prefab.classId);

  unlockFleetWarlord(prefab.id);

  const weapons = canonicalWeaponsForPrefab(prefab.id);
  const factionId = prefab.faction as GrudgeFactionId;
  const gearTier = useMeta.getState().maxGearTierForPrefab(prefab.id);

  useRoster.setState({
    factionId,
    enemyFactionId: opposingFaction(factionId),
    raceId: prefab.raceId,
    classId: prefab.classId,
    prefabId: prefab.id,
    grudgeId,
    heroId: RACE_ANIM_PRESET[prefab.raceId],
    meleeId: weapons.melee,
    rangedId: weapons.ranged,
    gearTier,
    custom: {},
    loadoutLocked: false,
  });

  try {
    localStorage.setItem(FLEET_STORAGE_KEYS.activeCharacter, row.id);
  } catch { /* ignore */ }

  return true;
}

/** Fetch active fleet character and hydrate roster. Call after session restore. */
export async function hydrateRosterFromFleet(): Promise<boolean> {
  const chars = await listFleetCharacters();
  if (!chars.length) return false;

  const storedId = activeCharacterId();
  const active =
    (storedId ? chars.find((c) => c.id === storedId) : null) ??
    chars.find((c) => c.activeForEra ?? c.active_for_era) ??
    chars[0];

  if (!active) return false;
  return applyFleetCharacterToRoster(active);
}