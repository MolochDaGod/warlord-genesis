/**
 * Off-lane environment kits. isolateMeshes() pulls each mesh apart so we
 * scatter individuals in the woods — never the whole Sketchfab scene on a lane.
 *
 *   D:\Games\Models\rockclusters (1).glb  → models/env/rockclusters.glb
 */
const LOCAL = import.meta.env.BASE_URL;

export const ENV_PACKS = {
  rockclusters: `${LOCAL}models/env/rockclusters.glb`,
} as const;

export const ROCK_FIT_H = 1.85;
export const ROCK_COUNT_STANDARD = 72;
export const ROCK_COUNT_LARGE = 110;
export const ROCK_MIN_SPACING = 4.6;
export const ROCK_LANE_CLEAR = 6.4;

export function envPackUrl(id: keyof typeof ENV_PACKS): string {
  return ENV_PACKS[id];
}
