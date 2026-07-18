/**
 * Hydrate Warlords roster from fleet `/api/characters` SSOT.
 * Captain = character = hero — one row drives lobby prefab + GRDG id.
 *
 * Open handoff: prefer characterId from open.grudge-studio.com query capture
 * (session/local) over generic active keys.
 */

import { getStudioToken } from "./grudgeStudio";
import { FLEET_STORAGE_KEYS } from "./fleetStorageKeys";
import {
  openLaunchCharacterId,
  openLaunchRaceId,
  openLaunchBaseId,
  getOpenLaunchState,
  isOpenLaunch,
} from "./openLaunch";
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
  /** Optional level for loadout tier hints */
  level?: number;
}

function authHeaders(): Record<string, string> {
  const token = getStudioToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function activeCharacterId(): string | null {
  // Open handoff wins — player picked this character in open.grudge-studio.com
  const fromOpen = openLaunchCharacterId();
  if (fromOpen) return fromOpen;
  try {
    return (
      localStorage.getItem(FLEET_STORAGE_KEYS.activeCharacter) ||
      localStorage.getItem(FLEET_STORAGE_KEYS.legacyActiveCharacter) ||
      localStorage.getItem("grudge.open.selectedCharacterId")
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
  if (!res.ok) {
    // Retry without envelope for older API shapes
    const res2 = await fetch(
      `${CHARACTERS_API}?era=${encodeURIComponent(GAME_ERA)}`,
      { credentials: "include", headers: { ...authHeaders() } },
    );
    if (!res2.ok) return [];
    const data2 = (await res2.json()) as
      | FleetCharacterRow[]
      | { characters: FleetCharacterRow[] };
    return Array.isArray(data2) ? data2 : data2.characters ?? [];
  }
  const data = (await res.json()) as
    | FleetCharacterRow[]
    | { characters: FleetCharacterRow[] };
  return Array.isArray(data) ? data : data.characters ?? [];
}

function resolvePrefab(row: FleetCharacterRow) {
  const raceId = (row.raceId || "human") as PrefabRaceId;
  const classId = (row.classId || "warrior") as ClassId;
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

  // Open / fleet characters are always march-ready for their prefab
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
    // Keep look custom empty; fleet identity is in storage + prefabId
    custom: {},
    loadoutLocked: false,
  });

  // Tag Open sessions for UI / map defaults (session only)
  if (isOpenLaunch()) {
    try {
      sessionStorage.setItem("gw_fleet_character_name", row.name || prefab.name);
    } catch {
      /* ignore */
    }
  }

  try {
    localStorage.setItem(FLEET_STORAGE_KEYS.activeCharacter, row.id);
    localStorage.setItem(FLEET_STORAGE_KEYS.legacyActiveCharacter, row.id);
  } catch {
    /* ignore */
  }

  return true;
}

/** Normalize handoff race keys → PrefabRaceId (human|barbarian|dwarf|elf|orc|undead). */
function normalizePrefabRace(raw: string | null | undefined): PrefabRaceId {
  const r = (raw || "human").toLowerCase().replace(/-/g, "_");
  if (r.includes("orc")) return "orc";
  if (r.includes("undead") || r === "ud") return "undead";
  if (r.includes("barb")) return "barbarian";
  if (r.includes("dwarf") || r.includes("dwf")) return "dwarf";
  // high_elf / high-elf / elf → prefab "elf"
  if (r.includes("elf")) return "elf";
  if (r.includes("human") || r.includes("kingdom") || r === "wk") return "human";
  const allowed: PrefabRaceId[] = ["human", "barbarian", "dwarf", "elf", "orc", "undead"];
  if ((allowed as string[]).includes(r)) return r as PrefabRaceId;
  return "human";
}

/**
 * Build a synthetic fleet row from charactersgrudox / Open handoff when the
 * UUID is local (campfire slot) and not yet on Railway warlords era.
 */
function rowFromOpenHandoff(): FleetCharacterRow | null {
  if (!isOpenLaunch()) return null;
  const state = getOpenLaunchState();
  const raceHint =
    state.raceId ||
    openLaunchRaceId() ||
    (state.baseId ? state.baseId : openLaunchBaseId());
  if (!raceHint && !state.characterId) return null;

  const raceId = normalizePrefabRace(raceHint);
  const baseId = state.baseId || openLaunchBaseId() || "";
  // Prefab ClassId: mage | warrior | ranger | worge (no "knight" — map to warrior)
  let classId: ClassId = "warrior";
  const b = baseId.toLowerCase();
  if (b.includes("mage") || b.includes("wizard") || b.includes("sorcer")) classId = "mage";
  else if (b.includes("ranger") || b.includes("archer") || b.includes("hunter")) classId = "ranger";
  else if (b.includes("worge")) classId = "worge";
  else classId = "warrior";

  return {
    id: state.characterId || openLaunchCharacterId() || `open-${raceId}-${classId}`,
    name: state.characterName || "Warlord",
    raceId,
    classId,
    prefabId: null,
    level: 1,
  };
}

/**
 * Fetch active fleet character and hydrate roster.
 * Always call on boot — Open/charactersgrudox handoff works even without a token
 * (local campfire UUIDs resolve via raceId/baseId).
 */
export async function hydrateRosterFromFleet(): Promise<boolean> {
  const token = getStudioToken();
  const storedId = activeCharacterId();
  const open = isOpenLaunch();

  // 1) Prefer exact fleet row match for the handoff characterId
  if (token) {
    try {
      const chars = await listFleetCharacters();
      if (chars.length) {
        if (storedId) {
          const match = chars.find((c) => c.id === storedId);
          if (match) return applyFleetCharacterToRoster(match);
        }
        // Open handoff with unknown local UUID: do NOT steal a random fleet hero —
        // fall through to race/base synthetic row first.
        if (!open) {
          const active =
            chars.find((c) => c.activeForEra ?? c.active_for_era) ?? chars[0];
          if (active) return applyFleetCharacterToRoster(active);
        }
      }
    } catch {
      /* network — fall through to handoff */
    }
  }

  // 2) charactersgrudox / Open campfire hero (race + class from handoff)
  const handoff = rowFromOpenHandoff();
  if (handoff) return applyFleetCharacterToRoster(handoff);

  // 3) Signed-in fleet default (non-Open)
  if (token && !open) {
    try {
      const chars = await listFleetCharacters();
      if (chars[0]) return applyFleetCharacterToRoster(chars[0]);
    } catch {
      /* */
    }
  }

  return false;
}

/**
 * Open boot path: hydrate handoff warlord + mark warcamp ready.
 * Safe to call from App / Lobby / Intro on every mount.
 */
export async function hydrateOpenLaunchWarlord(): Promise<boolean> {
  if (!isOpenLaunch()) return false;
  const ok = await hydrateRosterFromFleet();
  if (ok) {
    // Ensure march gates pass (onboarding + unlock already set by applyFleetCharacterToRoster)
    try {
      const { ensureWarcampReady } = await import("./ensureWarcampReady");
      ensureWarcampReady();
    } catch {
      /* circular-safe no-op */
    }
  }
  return ok;
}
