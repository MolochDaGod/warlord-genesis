/**
 * Faction lane-creep visual roles → defaultcreeps pack (blue ally / red enemy).
 * Heroes / lane guards use GRUDGE6 Bip001 — never this table.
 *
 * Mesh kind is only a role hint (melee / ranged / siege); UnitMesh maps it
 * through meshToCreepRole() + faction color.
 */

import type { UnitMeshKind } from "../game/config";
import type { GrudgeFactionId } from "./grudge6";

export interface FactionMobPair {
  melee: UnitMeshKind;
  ranged: UnitMeshKind;
}

/** All factions share defaultcreeps roles — team color is ally=blue / enemy=red. */
export const FACTION_MOB_MESHES: Record<GrudgeFactionId, FactionMobPair> = {
  crusade: { melee: "footman", ranged: "archer" },
  fabled: { melee: "footman", ranged: "archer" },
  legion: { melee: "footman", ranged: "archer" },
};

export function factionMobMesh(factionId: GrudgeFactionId, ranged: boolean): UnitMeshKind {
  const pair = FACTION_MOB_MESHES[factionId];
  return ranged ? pair.ranged : pair.melee;
}
