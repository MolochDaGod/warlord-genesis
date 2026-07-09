/** Game-agnostic terrain query surface — implement per map backend (SP or PvP). */
export interface TerrainProvider {
  heightAt(x: number, z: number): number;
  isWalkable(x: number, z: number): boolean;
  nearestLane?(x: number, z: number): number;
  snapDeploy(x: number, z: number): { x: number; y: number; z: number };
}

export function slopeAt(
  terrain: TerrainProvider,
  x: number,
  z: number,
  sampleRadius: number,
): number {
  const h0 = terrain.heightAt(x, z);
  const hx = terrain.heightAt(x + sampleRadius, z) - h0;
  const hz = terrain.heightAt(x, z + sampleRadius) - h0;
  return Math.hypot(hx, hz);
}