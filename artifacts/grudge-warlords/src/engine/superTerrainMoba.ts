/**
 * Super Terrain fleet bake as Genesis MOBA ground.
 * Catalog: info.grudge-studio.com/api/v1/super-terrain.json
 * Same CDN as weapons/nature. Lanes stay walkable; jungle uses 3D relief.
 * Does not replace Player TPS / crosshair / Rapier.
 */
import type { GameMap } from "../game/mapgen";

const CATALOG = "https://info.grudge-studio.com/api/v1/super-terrain.json";
const BAKE = "https://assets.grudge-studio.com/worlds/super-terrain";
const TEX = "https://assets.grudge-studio.com/textures/super-terrain";

export const MOBA_ST_KIND = "alpine-mesh";

export function stAlbedoUrl(kind = MOBA_ST_KIND): string {
  return `${TEX}/kind-${kind}.png`;
}

type FleetBake = {
  heights: number[];
  biomes?: number[];
  size?: number;
  cellSize?: number;
  maxHeight?: number;
  seaLevel?: number;
  engine?: string;
};

function sampleGrid(
  heights: number[],
  grid: number,
  u: number,
  v: number,
): number {
  const fx = Math.max(0, Math.min(grid - 1, u * (grid - 1)));
  const fz = Math.max(0, Math.min(grid - 1, v * (grid - 1)));
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fz);
  const c1 = Math.min(grid - 1, c0 + 1);
  const r1 = Math.min(grid - 1, r0 + 1);
  const tx = fx - c0;
  const tz = fz - r0;
  const h00 = heights[r0 * grid + c0] ?? 0;
  const h10 = heights[r0 * grid + c1] ?? 0;
  const h01 = heights[r1 * grid + c0] ?? 0;
  const h11 = heights[r1 * grid + c1] ?? 0;
  return h00 + (h10 - h00) * tx + (h01 - h00 + (h11 - h10 - h01 + h00) * tx) * tz;
}

/** Overlay fleet heightfield onto an existing MOBA map (lanes stay low). */
export function applyBakeToMap(map: GameMap, raw: FleetBake, kind = MOBA_ST_KIND): boolean {
  const src = raw.heights;
  if (!src?.length) return false;
  const grid = Math.round(Math.sqrt(src.length));
  if (grid * grid !== src.length) return false;
  const maxRaw = src.reduce((m, h) => (h > m ? h : m), 0);
  const norm = maxRaw > 1.5 ? 255 : 1;
  const maxH = typeof raw.maxHeight === "number" ? raw.maxHeight : 16;
  const { hmCols, hmRows, width, length, heights, distToPath } = map;
  const halfW = width / 2;
  const halfL = length / 2;
  for (let r = 0; r < hmRows; r++) {
    const z = -halfL + (r / Math.max(1, hmRows - 1)) * length;
    const v = r / Math.max(1, hmRows - 1);
    for (let c = 0; c < hmCols; c++) {
      const x = -halfW + (c / Math.max(1, hmCols - 1)) * width;
      const u = c / Math.max(1, hmCols - 1);
      const st = (sampleGrid(src, grid, u, v) / norm) * maxH;
      const d = distToPath(x, z);
      const i = r * hmCols + c;
      if (d <= 7) {
        heights[i] = st * 0.12;
      } else {
        heights[i] = st;
      }
    }
  }
  map.relief = "super-terrain";
  map.stKind = kind;
  map.stAlbedo = stAlbedoUrl(kind);
  map.stEngine = raw.engine || "super-terrain (fleet CDN bake)";
  return true;
}

export async function overlaySuperTerrain(map: GameMap, kind = MOBA_ST_KIND): Promise<boolean> {
  if (map.size === "skirmish" || map.size === "royale") return false;
  try {
    let bakeUrl = `${BAKE}/${kind}.json`;
    try {
      const cat = await fetch(CATALOG);
      if (cat.ok) {
        const j = (await cat.json()) as { kinds?: Array<{ id: string; bake?: string }> };
        const hit = j.kinds?.find((k) => k.id === kind);
        if (hit?.bake) bakeUrl = hit.bake;
      }
    } catch {
      /* bake URL fallback */
    }
    const res = await fetch(bakeUrl);
    if (!res.ok) return false;
    const raw = (await res.json()) as FleetBake;
    return applyBakeToMap(map, raw, kind);
  } catch {
    return false;
  }
}
