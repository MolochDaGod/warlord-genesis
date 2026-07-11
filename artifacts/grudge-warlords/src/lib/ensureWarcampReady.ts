import { PREFAB_BY_ID } from "@workspace/game-content";
import { useGame } from "../game/store";
import { useRoster, isLoadoutReady } from "../game/roster";
import {
  useMeta,
  unlockFleetWarlord,
  applyCanonicalLoadoutToRoster,
} from "../game/metaProgression";
import {
  buildStarterEquipment,
  computeLoadoutStats,
  equipmentIsWeak,
} from "../game/equipment";
import type { LaneId } from "../game/laneDeployment";
import { canonicalWeaponsForPrefab } from "../game/canonicalLoadout";
import { MELEE_WEAPONS_CFG, RANGED_WEAPONS } from "../game/config";

function laneDeploymentValid(): boolean {
  const dep = useGame.getState().laneDeployment;
  return ([0, 1, 2] as LaneId[]).every((lane) => {
    const pick = dep.lanes[lane];
    return Boolean(pick?.meleeCreep && pick?.rangedCreep);
  });
}

const DEFAULT_STARTER = "sir-aldric-valorheart";

/**
 * Idempotent boot — unlock campaign-ready starter, full warcamp gear, weapons,
 * and lane picks so /lobby, /deploy, and /play never hard-block on empty state.
 */
export function ensureWarcampReady(): void {
  const meta = useMeta.getState();
  const roster = useRoster.getState();

  meta.ensureStarterUnlocked();

  // First visit / broken meta: auto-unlock default crusade champion (level 3).
  // Always complete onboarding so /lobby is never stuck behind an empty starter overlay
  // when PREFAB tables fail to load (CDN / content pack issues).
  if (!meta.onboardingDone || !meta.starterPrefabId) {
    const pick =
      (roster.prefabId && PREFAB_BY_ID[roster.prefabId] && roster.prefabId) ||
      DEFAULT_STARTER;
    if (PREFAB_BY_ID[pick]) {
      unlockFleetWarlord(pick);
      roster.setPrefab(pick);
      meta.completeStarterPick(pick);
    } else {
      // Last resort: mark onboarding done so warcamp UI is usable with defaults.
      try {
        meta.completeStarterPick(DEFAULT_STARTER);
      } catch {
        /* ignore */
      }
    }
  }

  const activePrefab = roster.prefabId;
  if (!meta.isCharacterUnlocked(activePrefab)) {
    const fallback = meta.starterPrefabId ?? DEFAULT_STARTER;
    if (fallback && PREFAB_BY_ID[fallback]) {
      unlockFleetWarlord(fallback);
      if (fallback !== activePrefab) roster.setPrefab(fallback);
      meta.completeStarterPick(fallback);
    }
  }

  // Ensure starter card is at least level 3 (gear tier 3) for playable /play.
  const live = useMeta.getState();
  const prefabId = useRoster.getState().prefabId;
  if (live.characterLevel(prefabId) < 3) {
    live.completeStarterPick(prefabId);
  }

  applyCanonicalLoadoutToRoster(
    useRoster.getState().prefabId,
    useRoster.getState().setMelee,
    useRoster.getState().setRanged,
    useRoster.getState().setGearTier,
  );

  // Full warcamp kit when naked or sparse — this was the weak default start.
  const r = useRoster.getState();
  if (equipmentIsWeak(r.equipment)) {
    const kit = buildStarterEquipment(false);
    useRoster.setState({ equipment: kit });
  }

  // Gear tier floors at card level (min 3 after starter fix).
  const tier = useMeta.getState().maxGearTierForPrefab(useRoster.getState().prefabId);
  if (useRoster.getState().gearTier < tier) {
    useRoster.getState().setGearTier(tier);
  }

  // Force canonical weapons if loadout drifted.
  const r2 = useRoster.getState();
  if (!isLoadoutReady(r2.meleeId, r2.rangedId, r2.prefabId)) {
    const kit = canonicalWeaponsForPrefab(r2.prefabId);
    if (MELEE_WEAPONS_CFG[kit.melee] && RANGED_WEAPONS[kit.ranged]) {
      r2.setMelee(kit.melee);
      r2.setRanged(kit.ranged);
    }
  }

  useMeta.getState().seedDefaultLaneGuards(useRoster.getState().factionId);

  if (!laneDeploymentValid()) {
    useGame.getState().resetLaneDeployment();
  }
}

export interface PlayReadyResult {
  ok: boolean;
  error?: string;
  prefabId?: string;
  gearTier?: number;
  bonusHp?: number;
  damageMult?: number;
  defense?: number;
}

/** Prepare warcamp + start match. Throws with a clear message on hard failure. */
export function prepareAndStartMatch(): PlayReadyResult {
  ensureWarcampReady();
  const roster = useRoster.getState();
  const meta = useMeta.getState();

  if (!PREFAB_BY_ID[roster.prefabId]) {
    return { ok: false, error: `Unknown warlord prefab: ${roster.prefabId}` };
  }
  if (!meta.isCharacterUnlocked(roster.prefabId)) {
    unlockFleetWarlord(roster.prefabId);
    meta.completeStarterPick(roster.prefabId);
  }
  if (!isLoadoutReady(roster.meleeId, roster.rangedId, roster.prefabId)) {
    const kit = canonicalWeaponsForPrefab(roster.prefabId);
    roster.setMelee(kit.melee);
    roster.setRanged(kit.ranged);
  }

  roster.lockLoadout();
  const started = useGame.getState().startGame();
  if (!started) {
    return {
      ok: false,
      error:
        "Battle boot refused — loadout or unlock still invalid after auto-repair. Open /deploy and try again.",
    };
  }

  const r = useRoster.getState();
  const ls = computeLoadoutStats(r.equipment, r.gearTier);
  return {
    ok: true,
    prefabId: r.prefabId,
    gearTier: r.gearTier,
    bonusHp: ls.bonusHp,
    damageMult: ls.damageMult,
    defense: ls.defense,
  };
}
