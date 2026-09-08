/**
 * Shared local steering: tree avoidance, occupancy cost, hostile-tower cost.
 * A* / flow-fields live in pathfind.ts (pure grid). This layer reads EM.
 */
import { EM } from "./entities";
import type { Faction } from "./config";
import type { PathCostFn } from "./pathfind";

const AVOID_ANGLES = [0.55, -0.55, 1.15, -1.15, 1.85, -1.85] as const;

/** Deflect a heading around runtime obstacles (trees) on the occupancy mask. */
export function avoidHeading(
  x: number,
  z: number,
  dx: number,
  dz: number,
  look = 1.4,
): { x: number; z: number } {
  if (!EM.isBlocked(x + dx * look, z + dz * look)) return { x: dx, z: dz };
  for (const ang of AVOID_ANGLES) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const nx = dx * c - dz * s;
    const nz = dx * s + dz * c;
    if (!EM.isBlocked(x + nx * look, z + nz * look)) {
      return { x: nx, z: nz };
    }
  }
  return { x: dx, z: dz };
}

/** Extra A* cost for cells occupied by trees / dynamic blocks. */
export function obstacleCellCost(c: number, r: number): number {
  const g = EM.map.grid;
  return EM.isBlocked(g.worldX(c), g.worldZ(r)) ? 3.5 : 0;
}

/**
 * Soft penalty for walking through a hostile tower's fire unless the agent has
 * already committed to diving that objective.
 */
export function hostileTowerCost(self: Faction, diving: boolean): PathCostFn {
  return (c, r) => {
    let pen = obstacleCellCost(c, r);
    if (diving) return pen;
    const g = EM.map.grid;
    const wx = g.worldX(c);
    const wz = g.worldZ(r);
    for (const s of EM.structures) {
      if (!s.alive || s.faction === self || s.range <= 0) continue;
      const d = Math.hypot(s.pos.x - wx, s.pos.z - wz);
      if (d < s.range - 0.5) pen += 1.8;
    }
    return pen;
  };
}
