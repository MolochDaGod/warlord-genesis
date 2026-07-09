import { useGame } from "../game/store";
import { useRoster } from "../game/roster";
import { useMeta, unlockFleetWarlord, applyCanonicalLoadoutToRoster } from "../game/metaProgression";
import type { LaneId } from "../game/laneDeployment";

function laneDeploymentValid(): boolean {
  const dep = useGame.getState().laneDeployment;
  return ([0, 1, 2] as LaneId[]).every((lane) => {
    const pick = dep.lanes[lane];
    return Boolean(pick?.meleeCreep && pick?.rangedCreep);
  });
}

/** Idempotent boot — unlock starter, sync weapons, seed lane picks for /deploy. */
export function ensureWarcampReady(): void {
  const meta = useMeta.getState();
  const roster = useRoster.getState();

  meta.ensureStarterUnlocked();

  const activePrefab = roster.prefabId;
  if (!meta.isCharacterUnlocked(activePrefab)) {
    const fallback = meta.starterPrefabId ?? activePrefab;
    if (fallback) unlockFleetWarlord(fallback);
  }

  applyCanonicalLoadoutToRoster(
    roster.prefabId,
    roster.setMelee,
    roster.setRanged,
    roster.setGearTier,
  );

  meta.seedDefaultLaneGuards(roster.factionId);

  if (!laneDeploymentValid()) {
    useGame.getState().resetLaneDeployment();
  }
}