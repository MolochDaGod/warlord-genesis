import { EM } from "../game/entities";
import { WARLORD_MANIFEST } from "./warlordManifest";

/**
 * Terrain awareness facade — industry pattern: one query surface over the
 * procedural map generator (height, walkability, lane proximity).
 */
export const Terrain = {
  /** World Y at XZ (feet placement). */
  heightAt(x: number, z: number): number {
    return EM.map?.heightAt(x, z) ?? 0;
  },

  isWalkable(x: number, z: number): boolean {
    return EM.map?.grid?.isWalkableWorld(x, z) ?? true;
  },

  /** Approximate slope magnitude (0 = flat, higher = steeper ridge). */
  slopeAt(x: number, z: number): number {
    const r = WARLORD_MANIFEST.terrain.sampleRadius;
    const h0 = this.heightAt(x, z);
    const hx = this.heightAt(x + r, z) - h0;
    const hz = this.heightAt(x, z + r) - h0;
    return Math.hypot(hx, hz);
  },

  /** Nearest lane id for tactical AI / deployment hints (-1 if unknown). */
  nearestLane(x: number, z: number): number {
    const lanes = EM.map?.lanes;
    if (!lanes?.length) return -1;
    let best = 0;
    let bestD = Infinity;
    for (const lane of lanes) {
      for (const p of lane.pts) {
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = lane.id;
        }
      }
    }
    return best;
  },

  /** Snap a deploy position to walkable ground at terrain height. */
  snapDeploy(x: number, z: number): { x: number; y: number; z: number } {
    const map = EM.map;
    if (!map) return { x, y: 0, z };
    let wx = x;
    let wz = z;
    if (!map.grid.isWalkableWorld(wx, wz)) {
      const w = map.grid.nearestWalkable(wx, wz);
      wx = w.x;
      wz = w.z;
    }
    return { x: wx, y: map.heightAt(wx, wz), z: wz };
  },
};