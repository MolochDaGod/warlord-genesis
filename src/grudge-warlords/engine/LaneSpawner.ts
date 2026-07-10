/**
 * Lane creep spawning — mirrors bundle _IA() + deploy laneDeployment.
 * MOBA: waves use pre-match picks on all lanes (no building skip).
 */
import type { LaneDeployment, LaneId } from "../types";

export type LaneDef = {
  id: LaneId;
  pts: Array<{ x: number; z: number }>;
};

export type SpawnUnitFn = (
  faction: "ally" | "enemy",
  unitId: string,
  x: number,
  z: number,
  opts: { commandable?: boolean; lane: LaneId; hpMult?: number; dmgMult?: number },
) => void;

/** Bundle: _IA — spawn ally lane creeps from deployment picks */
export function spawnAllyLaneWaves(
  lanes: LaneDef[],
  deployment: LaneDeployment,
  creepsPerLane: number,
  spawnUnit: SpawnUnitFn,
  hpMult = 1,
  dmgMult = 1,
): void {
  for (const lane of lanes) {
    const pick = deployment.lanes[lane.id];
    if (!pick || !lane.pts.length) continue;
    const spawn = lane.pts[0];
    const roster = buildLaneRoster(pick, creepsPerLane);
    for (let i = 0; i < creepsPerLane; i++) {
      const offset = (i - (creepsPerLane - 1) / 2) * 1.4;
      spawnUnit("ally", roster[i] ?? pick.meleeCreep, spawn.x + offset, spawn.z, {
        commandable: false,
        lane: lane.id,
        hpMult,
        dmgMult,
      });
    }
  }
}

function buildLaneRoster(pick: LaneDeployment["lanes"][LaneId], count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(i % 2 === 0 ? pick.meleeCreep : pick.rangedCreep);
  }
  return out;
}