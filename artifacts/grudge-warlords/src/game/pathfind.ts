// ---------------------------------------------------------------------------
// Grudge Warlords — grid pathfinding.
//
// A WalkGrid is a coarse boolean walkability mask over the battlefield (derived
// from the generated terrain). Two kinds of routing run on top of it:
//
//   * FlowField — a Dijkstra distance field flooded from a single goal cell.
//     Many units share one field (all ally creeps push the enemy core; all
//     enemy creeps push the ally core), so per-frame steering is just a cheap
//     8-neighbour lookup. This is what keeps creeps in their lane corridor and
//     funnels them through cut-throughs without per-unit A*.
//   * findPath — A* between two arbitrary cells, used sparingly for player-
//     commanded move orders so summoned units route around ridges.
// ---------------------------------------------------------------------------

const DIAG = Math.SQRT2;

/** 8-neighbour offsets (dx, dz) with their step cost. */
const NEIGHBORS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, DIAG],
  [1, -1, DIAG],
  [-1, 1, DIAG],
  [-1, -1, DIAG],
];

/** Tiny binary min-heap keyed by a parallel cost array. */
class MinHeap {
  private items: number[] = [];
  constructor(private cost: Float32Array) {}

  get size() {
    return this.items.length;
  }

  push(cell: number) {
    const items = this.items;
    items.push(cell);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cost[items[parent]] <= this.cost[items[i]]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < n && this.cost[items[l]] < this.cost[items[smallest]]) smallest = l;
        if (r < n && this.cost[items[r]] < this.cost[items[smallest]]) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

export class WalkGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly originX: number;
  readonly originZ: number;
  readonly walkable: Uint8Array;

  /**
   * @param width  world X extent
   * @param length world Z extent
   * @param cell   world units per grid cell
   * @param test   predicate: is this world point walkable terrain?
   */
  constructor(width: number, length: number, cell: number, test: (x: number, z: number) => boolean) {
    this.cell = cell;
    this.cols = Math.max(2, Math.round(width / cell));
    this.rows = Math.max(2, Math.round(length / cell));
    // Cell (0,0) centre sits half a cell in from the -X/-Z corner.
    this.originX = -width / 2 + cell / 2;
    this.originZ = -length / 2 + cell / 2;
    this.walkable = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.originX + c * cell;
        const z = this.originZ + r * cell;
        this.walkable[r * this.cols + c] = test(x, z) ? 1 : 0;
      }
    }
  }

  idx(c: number, r: number): number {
    return r * this.cols + c;
  }

  cellX(x: number): number {
    return Math.round((x - this.originX) / this.cell);
  }

  cellZ(z: number): number {
    return Math.round((z - this.originZ) / this.cell);
  }

  worldX(c: number): number {
    return this.originX + c * this.cell;
  }

  worldZ(r: number): number {
    return this.originZ + r * this.cell;
  }

  inBounds(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  isWalkableCell(c: number, r: number): boolean {
    return this.inBounds(c, r) && this.walkable[r * this.cols + c] === 1;
  }

  isWalkableWorld(x: number, z: number): boolean {
    return this.isWalkableCell(this.cellX(x), this.cellZ(z));
  }

  /** Clamp a cell index into bounds. */
  private clampCell(c: number, r: number): [number, number] {
    return [
      Math.max(0, Math.min(this.cols - 1, c)),
      Math.max(0, Math.min(this.rows - 1, r)),
    ];
  }

  /**
   * Nearest walkable world point to (x,z) via an expanding ring search. Returns
   * the input clamped to bounds if nothing walkable is found within `maxR` cells.
   */
  nearestWalkable(x: number, z: number, maxR = 6): { x: number; z: number } {
    let [c, r] = this.clampCell(this.cellX(x), this.cellZ(z));
    if (this.isWalkableCell(c, r)) return { x, z };
    for (let radius = 1; radius <= maxR; radius++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!this.isWalkableCell(nc, nr)) continue;
          const wx = this.worldX(nc);
          const wz = this.worldZ(nr);
          const d = (wx - x) * (wx - x) + (wz - z) * (wz - z);
          if (d < bestD) {
            bestD = d;
            best = nr * this.cols + nc;
          }
        }
      }
      if (best >= 0) {
        return { x: this.worldX(best % this.cols), z: this.worldZ((best / this.cols) | 0) };
      }
    }
    [c, r] = this.clampCell(c, r);
    return { x: this.worldX(c), z: this.worldZ(r) };
  }
}

/** A Dijkstra distance field flooded from one goal, used for shared steering. */
export class FlowField {
  readonly dist: Float32Array;

  constructor(
    private grid: WalkGrid,
    goalX: number,
    goalZ: number,
  ) {
    const n = grid.cols * grid.rows;
    this.dist = new Float32Array(n).fill(Infinity);
    let [gc, gr] = [grid.cellX(goalX), grid.cellZ(goalZ)];
    if (!grid.isWalkableCell(gc, gr)) {
      const w = grid.nearestWalkable(goalX, goalZ);
      gc = grid.cellX(w.x);
      gr = grid.cellZ(w.z);
    }
    const goal = grid.idx(gc, gr);
    if (!grid.isWalkableCell(gc, gr)) return;
    this.dist[goal] = 0;
    const heap = new MinHeap(this.dist);
    heap.push(goal);
    const { cols, walkable } = grid;
    while (heap.size > 0) {
      const cur = heap.pop();
      const cd = this.dist[cur];
      const cc = cur % cols;
      const cr = (cur / cols) | 0;
      for (const [dc, dr, cost] of NEIGHBORS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (!grid.isWalkableCell(nc, nr)) continue;
        // No diagonal corner cutting through ridge corners.
        if (dc !== 0 && dr !== 0) {
          if (walkable[cr * cols + nc] === 0 || walkable[nr * cols + cc] === 0) continue;
        }
        const ni = nr * cols + nc;
        const nd = cd + cost;
        if (nd < this.dist[ni]) {
          this.dist[ni] = nd;
          heap.push(ni);
        }
      }
    }
  }

  /** Unit-length steering direction toward the goal from a world point. */
  sampleDir(x: number, z: number, out: { x: number; z: number }): boolean {
    const grid = this.grid;
    const c = grid.cellX(x);
    const r = grid.cellZ(z);
    if (!grid.inBounds(c, r)) {
      out.x = 0;
      out.z = 0;
      return false;
    }
    const cols = grid.cols;
    let best = -1;
    let bestD = this.dist[r * cols + c];
    for (const [dc, dr] of NEIGHBORS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!grid.isWalkableCell(nc, nr)) continue;
      if (dc !== 0 && dr !== 0) {
        if (grid.walkable[r * cols + nc] === 0 || grid.walkable[nr * cols + c] === 0) continue;
      }
      const d = this.dist[nr * cols + nc];
      if (d < bestD) {
        bestD = d;
        best = nr * cols + nc;
      }
    }
    if (best < 0) {
      out.x = 0;
      out.z = 0;
      return false;
    }
    const tx = grid.worldX(best % cols);
    const tz = grid.worldZ((best / cols) | 0);
    let dx = tx - x;
    let dz = tz - z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    out.x = dx;
    out.z = dz;
    return true;
  }
}

/**
 * Walkable line-of-sight between two cells: samples the straight segment and
 * fails if any sampled cell is non-walkable. Conservative (over-samples) so it
 * never reports a clear line that actually clips a ridge corner.
 */
function losClear(grid: WalkGrid, c0: number, r0: number, c1: number, r1: number): boolean {
  const dc = c1 - c0;
  const dr = r1 - r0;
  const steps = Math.max(Math.abs(dc), Math.abs(dr)) * 2;
  if (steps === 0) return true;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const c = Math.round(c0 + dc * t);
    const r = Math.round(r0 + dr * t);
    if (!grid.isWalkableCell(c, r)) return false;
  }
  return true;
}

/**
 * String-pull an A* cell chain into sparse turn points: keep a waypoint only
 * when the straight line from the current anchor to the cell *after* it is
 * blocked. Turns the per-cell zigzag into long straight legs so units stop
 * oscillating between adjacent grid cells. `cells` excludes the start cell.
 */
function smoothCells(grid: WalkGrid, sc: number, sr: number, cells: number[]): number[] {
  if (cells.length <= 1) return cells;
  const cols = grid.cols;
  const out: number[] = [];
  let ac = sc;
  let ar = sr;
  for (let i = 0; i < cells.length - 1; i++) {
    const nc = cells[i + 1] % cols;
    const nr = (cells[i + 1] / cols) | 0;
    if (!losClear(grid, ac, ar, nc, nr)) {
      out.push(cells[i]);
      ac = cells[i] % cols;
      ar = (cells[i] / cols) | 0;
    }
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/**
 * A* between two world points. Returns a list of world waypoints (excluding the
 * start, including the goal) or null if unreachable. Cheap enough for the
 * occasional player move order; not meant for per-frame use. The raw cell chain
 * is string-pulled into sparse turn points so units travel straight legs.
 */
export function findPath(
  grid: WalkGrid,
  sx: number,
  sz: number,
  gx: number,
  gz: number,
): { x: number; z: number }[] | null {
  let sc = grid.cellX(sx);
  let sr = grid.cellZ(sz);
  if (!grid.isWalkableCell(sc, sr)) {
    const w = grid.nearestWalkable(sx, sz);
    sc = grid.cellX(w.x);
    sr = grid.cellZ(w.z);
  }
  let gc = grid.cellX(gx);
  let gr = grid.cellZ(gz);
  if (!grid.isWalkableCell(gc, gr)) {
    const w = grid.nearestWalkable(gx, gz);
    gc = grid.cellX(w.x);
    gr = grid.cellZ(w.z);
  }
  if (!grid.isWalkableCell(sc, sr) || !grid.isWalkableCell(gc, gr)) return null;

  const cols = grid.cols;
  const n = cols * grid.rows;
  const start = sr * cols + sc;
  const goal = gr * cols + gc;
  if (start === goal) return [{ x: grid.worldX(gc), z: grid.worldZ(gr) }];

  const g = new Float32Array(n).fill(Infinity);
  const f = new Float32Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const h = (c: number, r: number) => {
    const dc = Math.abs(c - gc);
    const dr = Math.abs(r - gr);
    return Math.max(dc, dr) + (DIAG - 1) * Math.min(dc, dr);
  };
  g[start] = 0;
  f[start] = h(sc, sr);
  const heap = new MinHeap(f);
  heap.push(start);

  while (heap.size > 0) {
    const cur = heap.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cc = cur % cols;
    const cr = (cur / cols) | 0;
    for (const [dc, dr, cost] of NEIGHBORS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (!grid.isWalkableCell(nc, nr)) continue;
      if (dc !== 0 && dr !== 0) {
        if (grid.walkable[cr * cols + nc] === 0 || grid.walkable[nr * cols + cc] === 0) continue;
      }
      const ni = nr * cols + nc;
      if (closed[ni]) continue;
      const tentative = g[cur] + cost;
      if (tentative < g[ni]) {
        from[ni] = cur;
        g[ni] = tentative;
        f[ni] = tentative + h(nc, nr);
        heap.push(ni);
      }
    }
  }

  if (from[goal] === -1 && start !== goal) return null;
  const cells: number[] = [];
  let cur = goal;
  while (cur !== start && cur !== -1) {
    cells.push(cur);
    cur = from[cur];
  }
  cells.reverse();
  const smoothed = smoothCells(grid, sc, sr, cells);
  return smoothed.map((ci) => ({
    x: grid.worldX(ci % cols),
    z: grid.worldZ((ci / cols) | 0),
  }));
}
