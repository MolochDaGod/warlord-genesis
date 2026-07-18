// Headless procedural battlefield. Deterministic from a seed so every client
// renders identical terrain and the server pathfinds on the same grid. Produces
// a gentle heightmap (for the renderer), three lanes, core/tower/spawn
// placements, a walkable grid, and a flow field toward each team's core.
//
// This is the headless cousin of the single-player mapgen.ts: same ideas, but
// plain {x,z} math (no THREE) and trimmed to what PvP needs.

import { mulberry32, type Rng } from "./rng";
import { FlowField, WalkGrid } from "./pathfind";
import type { GameMode, Team } from "./types";

export interface Placement {
  x: number;
  z: number;
}

export interface MapSize {
  w: number;
  l: number;
}

export const MAP_SIZES: Record<GameMode, MapSize> = {
  "1v1": { w: 108, l: 168 },
  "2v2": { w: 144, l: 204 },
  "3v3": { w: 180, l: 252 },
  /** Clash-style Arena 3 proportions (king + 2 princess). */
  royale: { w: 96, l: 144 },
};

const CELL = 1.5;
const BORDER = 4;

export interface SimMap {
  seed: number;
  mode: GameMode;
  w: number;
  l: number;
  /** coarse vertex heightmap for the renderer (row-major, hcols*hrows) */
  heights: Float32Array;
  hcols: number;
  hrows: number;
  hstep: number;
  /** lane center x-offsets (left, center, right) */
  laneX: number[];
  /** core placement per team */
  cores: Record<Team, Placement>;
  /** towers per team, one per lane (index matches laneX) */
  towers: Record<Team, Placement[]>;
  /** hero spawn per team */
  heroSpawn: Record<Team, Placement>;
  grid: WalkGrid;
  /** flow field that descends toward team N's core */
  flowToCore: Record<Team, FlowField>;
  /** per-lane flow (index = lane id) — keeps waves in their corridor */
  flowToCoreByLane: Record<Team, FlowField[]>;
  heightAt(x: number, z: number): number;
}

function buildHeights(rng: Rng, w: number, l: number) {
  const hstep = 8;
  const hcols = Math.ceil(w / hstep) + 1;
  const hrows = Math.ceil(l / hstep) + 1;
  const heights = new Float32Array(hcols * hrows);
  for (let r = 0; r < hrows; r++) {
    for (let c = 0; c < hcols; c++) {
      // Gentle rolling noise, flattened toward the centre lanes so play stays
      // readable. Edges lift a little to frame the arena.
      const nx = c / (hcols - 1) - 0.5;
      const edge = Math.abs(nx) > 0.4 ? (Math.abs(nx) - 0.4) * 6 : 0;
      const n = (rng() - 0.5) * 1.6;
      heights[r * hcols + c] = n * 0.5 + edge;
    }
  }
  return { heights, hcols, hrows, hstep };
}

function dist2(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function generateMap(seed: number, mode: GameMode): SimMap {
  const rng = mulberry32(seed >>> 0);
  const { w, l } = MAP_SIZES[mode];
  const minX = -w / 2;
  const minZ = -l / 2;

  const { heights, hcols, hrows, hstep } = buildHeights(rng, w, l);

  const heightAt = (x: number, z: number): number => {
    const fx = (x - minX) / hstep;
    const fz = (z - minZ) / hstep;
    const c0 = Math.max(0, Math.min(hcols - 2, Math.floor(fx)));
    const r0 = Math.max(0, Math.min(hrows - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - c0));
    const tz = Math.max(0, Math.min(1, fz - r0));
    const h00 = heights[r0 * hcols + c0]!;
    const h10 = heights[r0 * hcols + c0 + 1]!;
    const h01 = heights[(r0 + 1) * hcols + c0]!;
    const h11 = heights[(r0 + 1) * hcols + c0 + 1]!;
    const a = h00 * (1 - tx) + h10 * tx;
    const b = h01 * (1 - tx) + h11 * tx;
    return a * (1 - tz) + b * tz;
  };

  const laneOff = w * 0.31;
  const laneX = [-laneOff, 0, laneOff];

  const coreZ = l / 2 - 9;
  const cores: Record<Team, Placement> = {
    0: { x: 0, z: -coreZ },
    1: { x: 0, z: coreZ },
  };
  const heroSpawn: Record<Team, Placement> = {
    0: { x: 0, z: -coreZ + 5 },
    1: { x: 0, z: coreZ - 5 },
  };

  // Towers: MOBA = one per lane; Royale = princess towers on left+right only.
  const towerZ = l / 2 - 30;
  const towers: Record<Team, Placement[]> =
    mode === "royale"
      ? {
          0: [laneX[0], laneX[2]].map((x) => ({ x: x!, z: -towerZ })),
          1: [laneX[0], laneX[2]].map((x) => ({ x: x!, z: towerZ })),
        }
      : {
          0: laneX.map((x) => ({ x, z: -towerZ })),
          1: laneX.map((x) => ({ x, z: towerZ })),
        };

  // Walk grid: whole field walkable except a border ring.
  const grid = new WalkGrid({ minX, minZ, width: w, length: l, cell: CELL });
  for (let cz = 0; cz < grid.rows; cz++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      const wx = grid.worldX(cx);
      const wz = grid.worldZ(cz);
      if (
        wx < minX + BORDER ||
        wx > minX + w - BORDER ||
        wz < minZ + BORDER ||
        wz > minZ + l - BORDER
      ) {
        grid.setWalkable(cx, cz, false);
      }
    }
  }

  const flowToCore: Record<Team, FlowField> = {
    0: new FlowField(grid, cores[0].x, cores[0].z),
    1: new FlowField(grid, cores[1].x, cores[1].z),
  };

  // Block structure footprints so pathing routes around towers / cores.
  for (const team of [0, 1] as Team[]) {
    grid.blockDisc(cores[team].x, cores[team].z, 3.2);
    for (const tw of towers[team]) {
      grid.blockDisc(tw.x, tw.z, 2.2);
    }
  }

  const flowToCoreByLane: Record<Team, FlowField[]> = { 0: [], 1: [] };
  for (const team of [0, 1] as Team[]) {
    for (let lane = 0; lane < 3; lane++) {
      const laneGrid = new WalkGrid({ minX, minZ, width: w, length: l, cell: CELL });
      const lx = laneX[lane]!;
      const corridor = w * 0.14;
      for (let cz = 0; cz < laneGrid.rows; cz++) {
        for (let cx = 0; cx < laneGrid.cols; cx++) {
          const wx = laneGrid.worldX(cx);
          const wz = laneGrid.worldZ(cz);
          const onLane = Math.abs(wx - lx) <= corridor;
          const inBorder =
            wx < minX + BORDER ||
            wx > minX + w - BORDER ||
            wz < minZ + BORDER ||
            wz > minZ + l - BORDER;
          const nearStruct =
            dist2(wx, wz, cores[team].x, cores[team].z) < 12 ||
            towers[team].some((tw) => dist2(wx, wz, tw.x, tw.z) < 8);
          laneGrid.setWalkable(cx, cz, onLane && !inBorder && !nearStruct);
        }
      }
      flowToCoreByLane[team].push(
        new FlowField(laneGrid, cores[team === 0 ? 1 : 0].x, cores[team === 0 ? 1 : 0].z),
      );
    }
  }

  return {
    seed,
    mode,
    w,
    l,
    heights,
    hcols,
    hrows,
    hstep,
    laneX,
    cores,
    towers,
    heroSpawn,
    grid,
    flowToCore,
    flowToCoreByLane,
    heightAt,
  };
}
