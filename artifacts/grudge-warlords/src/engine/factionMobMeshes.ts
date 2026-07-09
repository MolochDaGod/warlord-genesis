/**
 * Faction lane-creep visuals — two KayKit mob assets per faction (melee + ranged).
 * These are walking MOBA minions only; lane guards use GRUDGE6 Bip001 heroes.
 */

import type { UnitMeshKind } from "../game/config";
import type { GrudgeFactionId } from "./grudge6";

export interface FactionMobPair {
  melee: UnitMeshKind;
  ranged: UnitMeshKind;
}

/** KayKit mob GLB id per faction line. */
export const FACTION_MOB_MESHES: Record<GrudgeFactionId, FactionMobPair> = {
  crusade: { melee: "kaykit_barbarian", ranged: "kaykit_rogue_hooded" },
  fabled: { melee: "kaykit_knight", ranged: "kaykit_ranger" },
  legion: { melee: "skeleton_warrior", ranged: "skeleton_mage" },
};

export function factionMobMesh(factionId: GrudgeFactionId, ranged: boolean): UnitMeshKind {
  const pair = FACTION_MOB_MESHES[factionId];
  return ranged ? pair.ranged : pair.melee;
}