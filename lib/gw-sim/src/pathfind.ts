// Pure grid pathfinding ported from the single-player game (no THREE / no React).
// WalkGrid maps world<->cell and tracks a walkable mask; FlowField is a Dijkstra
// distance field that yields a steering direction toward a goal cell.

export interface GridConfig {
  /** World-space minimum corner. */
  minX: number;
  minZ: number;
  /** World-space size. */
  width: number;
  length: number;
  /** Cell size in world units. */
  cell: number;
}

export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly minX: number;
  readonly minZ: number;
  /** 1 = walkable, 0 = blocked. */
  readonly mask: Uint8Array;

  constructor(cfg: GridConfig) {
    this.cell = cfg.cell;
    this.minX = cfg.minX;
    this.minZ = cfg.minZ;
    this.cols = Math.max(1, Math.ceil(cfg.width / cfg.cell));
    this.rows = Math.max(1, Math.ceil(cfg.length / cfg.cell));
    this.mask = new Uint8Array(this.cols * this.rows);
    this.mask.fill(1);
  }

  idx(cx: number, cz: number): number {
    return cz * this.cols + cx;
  }

  inBounds(cx: number, cz: number): boolean {
    return cx >= 0 && cz >= 0 && cx < this.cols && cz < this.rows;
  }

  cellX(worldX: number): number {
    return Math.floor((worldX - this.minX) / this.cell);
  }

  cellZ(worldZ: number): number {
    return Math.floor((worldZ - this.minZ) / this.cell);
  }

  worldX(cx: number): number {
    return this.minX + (cx + 0.5) * this.cell;
  }

  worldZ(cz: number): number {
    return this.minZ + (cz + 0.5) * this.cell;
  }

  walkable(cx: number, cz: number): boolean {
    return this.inBounds(cx, cz) && this.mask[this.idx(cx, cz)] === 1;
  }

  setWalkable(cx: number, cz: number, v: boolean) {
    if (this.inBounds(cx, cz)) this.mask[this.idx(cx, cz)] = v ? 1 : 0;
  }

  /** Block a disc of world radius r centered at (wx, wz). */
  blockDisc(wx: number, wz: number, r: number) {
    const c0x = this.cellX(wx - r);
    const c1x = this.cellX(wx + r);
    const c0z = this.cellZ(wz - r);
    const c1z = this.cellZ(wz + r);
    const r2 = r * r;
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        if (!this.inBounds(cx, cz)) continue;
        const dx = this.worldX(cx) - wx;
        const dz = this.worldZ(cz) - wz;
        if (dx * dx + dz * dz <= r2) this.mask[this.idx(cx, cz)] = 0;
      }
    }
  }

  /** Nearest walkable cell to a world point, returned in world coords. */
  nearestWalkable(wx: number, wz: number): { x: number; z: number } {
    let cx = this.cellX(wx);
    let cz = this.cellZ(wz);
    cx = Math.max(0, Math.min(this.cols - 1, cx));
    cz = Math.max(0, Math.min(this.rows - 1, cz));
    if (this.walkable(cx, cz)) return { x: this.worldX(cx), z: this.worldZ(cz) };
    for (let ring = 1; ring < Math.max(this.cols, this.rows); ring++) {
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (this.walkable(nx, nz)) {
            return { x: this.worldX(nx), z: this.worldZ(nz) };
          }
        }
      }
    }
    return { x: this.worldX(cx), z: this.worldZ(cz) };
  }
}

const NEI = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Dijkstra distance field toward a single goal cell, with a sampled direction. */
export class FlowField {
  readonly grid: WalkGrid;
  readonly dist: Float32Array;

  constructor(grid: WalkGrid, goalWorldX: number, goalWorldZ: number) {
    this.grid = grid;
    const n = grid.cols * grid.rows;
    this.dist = new Float32Array(n);
    this.dist.fill(Infinity);

    const goal = grid.nearestWalkable(goalWorldX, goalWorldZ);
    const gx = grid.cellX(goal.x);
    const gz = grid.cellZ(goal.z);
    if (!grid.inBounds(gx, gz)) return;

    const queue: number[] = [grid.idx(gx, gz)];
    this.dist[grid.idx(gx, gz)] = 0;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++]!;
      const cz = Math.floor(cur / grid.cols);
      const cx = cur - cz * grid.cols;
      const base = this.dist[cur]!;
      for (const [dx, dz] of NEI) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!grid.walkable(nx, nz)) continue;
        // Disallow diagonal cuts through blocked corners.
        if (dx !== 0 && dz !== 0) {
          if (!grid.walkable(cx + dx, cz) || !grid.walkable(cx, cz + dz)) continue;
        }
        const step = dx !== 0 && dz !== 0 ? 1.41421356 : 1;
        const ni = grid.idx(nx, nz);
        const nd = base + step;
        if (nd < this.dist[ni]!) {
          this.dist[ni] = nd;
          queue.push(ni);
        }
      }
    }
  }

  reachable(wx: number, wz: number): boolean {
    const cx = this.grid.cellX(wx);
    const cz = this.grid.cellZ(wz);
    if (!this.grid.inBounds(cx, cz)) return false;
    return Number.isFinite(this.dist[this.grid.idx(cx, cz)]!);
  }

  /** Unit-ish direction (dx,dz) that descends the distance field, or null. */
  sampleDir(wx: number, wz: number): { x: number; z: number } | null {
    const grid = this.grid;
    const cx = grid.cellX(wx);
    const cz = grid.cellZ(wz);
    if (!grid.inBounds(cx, cz)) return null;
    let best = this.dist[grid.idx(cx, cz)]!;
    let bx = 0;
    let bz = 0;
    for (const [dx, dz] of NEI) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!grid.walkable(nx, nz)) continue;
      if (dx !== 0 && dz !== 0) {
        if (!grid.walkable(cx + dx, cz) || !grid.walkable(cx, cz + dz)) continue;
      }
      const d = this.dist[grid.idx(nx, nz)]!;
      if (d < best) {
        best = d;
        bx = dx;
        bz = dz;
      }
    }
    if (bx === 0 && bz === 0) return null;
    const len = Math.hypot(bx, bz) || 1;
    return { x: bx / len, z: bz / len };
  }
}
