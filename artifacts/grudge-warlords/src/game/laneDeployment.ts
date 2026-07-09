/**
 * Lane deployment — game-start GRUDGE6 hero guards (1 melee + 1 ranged) and per-lane
 * wave creep picks (3 melee + 2 ranged KayKit mob waves per faction).
 */

import { FACTION_BY_ID, type PrefabRaceId } from "@workspace/game-content";
import {
  factionUnitIds,
  playerGrudgeFaction,
  resolveUnitDef,
  unitTypeId,
  type GrudgeFactionId,
} from "../engine/grudge6";

export type LaneId = 0 | 1 | 2;

/** GRUDGE6 champions chosen at game start — same pair marches all three lanes. */
export interface LaneHeroPicks {
  meleeGuard: string;
  rangedGuard: string;
}

export interface LanePick {
  /** Creep types for auto waves — three melee + two ranged per lane. */
  meleeCreep: string;
  rangedCreep: string;
}

export interface LaneDeployment {
  heroes: LaneHeroPicks;
  lanes: Record<LaneId, LanePick>;
}

export const LANE_LABELS: Record<LaneId, string> = {
  0: "West Lane",
  1: "Center Lane",
  2: "East Lane",
};

/** Base wave size before time escalation / momentum extras. */
export const WAVE_MELEE_COUNT = 3;
export const WAVE_RANGED_COUNT = 2;
export const WAVE_BASE_SIZE = WAVE_MELEE_COUNT + WAVE_RANGED_COUNT;

export function defaultLaneHeroPicks(factionId: GrudgeFactionId): LaneHeroPicks {
  const race = FACTION_BY_ID[factionId].races[0];
  return {
    meleeGuard: unitTypeId(race, "warrior"),
    rangedGuard: unitTypeId(race, "ranger"),
  };
}

export function defaultLaneDeployment(
  factionId: GrudgeFactionId,
  heroes?: LaneHeroPicks,
): LaneDeployment {
  const [r0, r1] = FACTION_BY_ID[factionId].races;
  const laneRaces: [PrefabRaceId, PrefabRaceId, PrefabRaceId] = [r0, r0, r1];
  const lanes = {} as Record<LaneId, LanePick>;
  for (const lane of [0, 1, 2] as LaneId[]) {
    const race = laneRaces[lane];
    lanes[lane] = {
      meleeCreep: unitTypeId(race, "warrior"),
      rangedCreep: unitTypeId(race, lane === 2 ? "mage" : "ranger"),
    };
  }
  return {
    heroes: heroes ?? defaultLaneHeroPicks(factionId),
    lanes,
  };
}

export function playerDefaultDeployment(heroes?: LaneHeroPicks): LaneDeployment {
  return defaultLaneDeployment(playerGrudgeFaction(), heroes);
}

export function factionMeleeIds(factionId: GrudgeFactionId): string[] {
  return factionUnitIds(factionId).filter((id) => !resolveUnitDef(id)?.ranged);
}

export function factionRangedIds(factionId: GrudgeFactionId): string[] {
  return factionUnitIds(factionId).filter((id) => resolveUnitDef(id)?.ranged);
}

/** Build the creep type list for a lane wave (3M + 2R base, extras alternate). */
export function waveTypesForLane(pick: LanePick, totalCount: number): string[] {
  const types = [
    pick.meleeCreep,
    pick.meleeCreep,
    pick.meleeCreep,
    pick.rangedCreep,
    pick.rangedCreep,
  ];
  for (let i = types.length; i < totalCount; i++) {
    types.push(i % 2 === 0 ? pick.meleeCreep : pick.rangedCreep);
  }
  return types.slice(0, Math.max(0, totalCount));
}