// ---------------------------------------------------------------------------
// Grudge Warlords — procedural MOBA map generator.
//
// From a seed + size, generates a symmetric three-lane battlefield: a heightmap
// terrain with low walkable lane corridors and raised ridge dividers between
// them, base clearings around each Citadel, and (on larger maps) jungle cut-
// through paths carved low through the ridges so units can cross lanes.
//
// Two topologies are produced:
//   * "end-to-end" (standard) — two Citadels at opposite Z ends with three
//     roughly parallel lanes (West / Center / East).
//   * "corner" (large) — the classic MOBA shape: the two Citadels sit in
//     opposite corners with Top (along two walls), Mid (corner-to-corner
//     diagonal) and Bottom (along the other two walls) lanes, jungle quadrants
//     between them.
//
// The generator is the single source of truth a fresh match consumes: lane
// polylines, structure / spawn placements, a height-sampling helper, and the
// pathfinding grid + shared flow-fields. It feeds `entities.ts` (which builds
// the world) and the render/physics layers — no map data is hand-authored.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { TREE, type Faction } from "./config";
import { WalkGrid, FlowField } from "./pathfind";

export type MapSize = "standard" | "large";

/** A scattered destructible tree: world XZ plus per-instance scale + yaw. */
export interface TreeSpot {
  x: number;
  z: number;
  scale: number;
  rot: number;
}

export interface MapSizeDef {
  label: string;
  width: number;
  length: number;
  /** Number of mirrored cut-through pairs carved between lanes (0 = none). */
  cutthroughPairs: number;
  /**
   * Lane topology. `false` = end-to-end (cores at opposite Z ends, parallel
   * lanes); `true` = classic MOBA corner layout (cores in opposite corners,
   * Top / diagonal-Mid / Bottom lanes).
   */
  corner: boolean;
}

export const MAP_SIZES: Record<MapSize, MapSizeDef> = {
  standard: { label: "Standard", width: 64, length: 104, cutthroughPairs: 0, corner: false },
  large: { label: "Large", width: 160, length: 260, cutthroughPairs: 3, corner: true },
};

export const MAP_SIZE_ORDER: MapSize[] = ["standard", "large"];

// Terrain shaping constants (world units).
const HM_CELL = 1.7; // heightmap + pathfinding cell size
const CORRIDOR_HALF = 5; // half-width of a flat walkable lane corridor
const RAMP = 6; // distance over which ridges rise to full height
const RIDGE_HEIGHT = 3.6; // peak divider height
const BASE_RADIUS = 15; // flat clearing radius around each Citadel
const WALK_PAD = 1.2; // walkable extends slightly past the flat corridor
const WALL_HEIGHT = 3;
const BUILDING_OFFSET = 8; // production building offset clear of the lane corridor
const CORNER_INSET = 18; // core distance from each wall (corner layout)
const LANE_INSET = 12; // edge-lane corridor distance from the walls (corner layout)

export interface LanePathData {
  id: number;
  name: string;
  /** World-space waypoints, ally side -> enemy side, y = terrain height. */
  pts: THREE.Vector3[];
}

export interface TowerPlacement {
  faction: Faction;
  lane: number;
  /** Objective tier: "outer" sits forward toward mid, "inner" guards the core. */
  tier: "outer" | "inner";
  x: number;
  z: number;
}

export interface BuildingPlacement {
  faction: Faction;
  /** Which production building stands here. */
  kind: "barracks" | "archery";
  lane: number;
  /** Tier 1-3 (selects the matching GLB); placement uses tier 1 for now. */
  level: number;
  x: number;
  z: number;
}

export interface Cutthrough {
  a: THREE.Vector3;
  b: THREE.Vector3;
}

export interface GameMap {
  seed: number;
  size: MapSize;
  width: number;
  length: number;
  wallHeight: number;

  /** Bilinear terrain height at a world point. */
  heightAt(x: number, z: number): number;
  /** Distance from a world XZ to the nearest lane / cut-through / base centreline. */
  distToPath(x: number, z: number): number;

  // Heightmap grid (for rendering the terrain mesh).
  hmCols: number;
  hmRows: number;
  heights: Float32Array; // row-major, hmCols * hmRows

  lanes: LanePathData[];
  allyCore: { x: number; z: number };
  enemyCore: { x: number; z: number };
  towers: TowerPlacement[];
  /** Production buildings set back behind the side towers (barracks W / archery E). */
  buildings: BuildingPlacement[];
  /** Where shop-summoned allies appear, just in front of the ally Citadel. */
  rally: { x: number; z: number };
  /** Hero spawn / respawn point. */
  heroSpawn: { x: number; z: number };
  /** Enemy warlord spawn / respawn point (mirrors heroSpawn at the enemy core). */
  enemyHeroSpawn: { x: number; z: number };
  cutthroughs: Cutthrough[];
  /** Scattered destructible trees (ridge cover + jungle-trail edges). */
  trees: TreeSpot[];

  grid: WalkGrid;
  /** Field over the FULL walkable grid (hero / commandable A* fallbacks + crowd ordering). */
  flowToEnemyCore: FlowField;
  flowToAllyCore: FlowField;
  /**
   * Per-lane creep steering fields (index = lane id). Built on per-lane masked
   * grids so creeps stay disciplined in their own lane even where lanes share
   * endpoints (the corner layout). On the end-to-end layout these alias the
   * shared whole-map fields above, preserving the original behaviour.
   */
  laneFlowToEnemy: FlowField[];
  laneFlowToAlly: FlowField[];
}

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/** Distance from point P to segment AB in the XZ plane. */
function distToSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 1e-6 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}

interface Seg {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

interface LaneDef2 {
  id: number;
  name: string;
  pts2: [number, number][];
}

/** Build the three roughly-parallel end-to-end lane polylines (ally -> enemy). */
function buildLanes(width: number, length: number): LaneDef2[] {
  const halfW = width / 2;
  const halfL = length / 2;
  const coreZ = halfL - 12;
  const endZ = coreZ - 4; // lane endpoints just outside the cores
  const outer = halfW - 11; // how far side lanes bow toward the walls
  const inner = 7; // side-lane endpoint X near the cores

  const center: [number, number][] = [
    [0, endZ],
    [0, coreZ * 0.4],
    [0, 0],
    [0, -coreZ * 0.4],
    [0, -endZ],
  ];
  const west: [number, number][] = [
    [-inner, endZ],
    [-outer, coreZ * 0.5],
    [-outer, 0],
    [-outer, -coreZ * 0.5],
    [-inner, -endZ],
  ];
  const east: [number, number][] = west.map(([x, z]) => [-x, z]);

  return [
    { id: 0, name: "West", pts2: west },
    { id: 1, name: "Center", pts2: center },
    { id: 2, name: "East", pts2: east },
  ];
}

/**
 * Build the classic MOBA corner lanes (ally -> enemy). The Citadels sit in
 * opposite corners; Top runs up one wall then across the next, Mid cuts the
 * diagonal, Bottom is the 180° point-reflection of Top (guaranteeing symmetry).
 */
function buildCornerLanes(width: number, length: number): LaneDef2[] {
  const halfW = width / 2;
  const halfL = length / 2;
  const cx = halfW - CORNER_INSET; // core X magnitude
  const cz = halfL - CORNER_INSET; // core Z magnitude
  const lx = halfW - LANE_INSET; // edge-lane X near the walls
  const lz = halfL - LANE_INSET; // edge-lane Z near the walls
  const ally: [number, number] = [-cx, cz];
  const enemy: [number, number] = [cx, -cz];

  // Top lane: out to the west wall, up it, then across the north wall.
  const top: [number, number][] = [
    ally,
    [-lx, cz * 0.45],
    [-lx, -lz],
    [-cx * 0.1, -lz],
    enemy,
  ];
  // Bottom lane: 180° point-reflection of Top, reversed so it still runs
  // ally -> enemy (across the south wall, then up the east wall).
  const bottom: [number, number][] = top
    .map(([x, z]) => [-x, -z] as [number, number])
    .reverse();
  // Mid lane: straight diagonal corner-to-corner.
  const mid: [number, number][] = [
    ally,
    [-cx * 0.5, cz * 0.5],
    [0, 0],
    [cx * 0.5, -cz * 0.5],
    enemy,
  ];

  return [
    { id: 0, name: "Top", pts2: top },
    { id: 1, name: "Mid", pts2: mid },
    { id: 2, name: "Bottom", pts2: bottom },
  ];
}

/** Total length of a 2D polyline. */
function polyLen(pts: [number, number][]): number {
  let l = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    l += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  }
  return l;
}

/** Point at arc-length fraction `t` (0..1) along a polyline. */
function sampleAtFraction(pts: [number, number][], t: number): [number, number] {
  const total = polyLen(pts);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (target <= seg || i === pts.length - 2) {
      const f = seg > 1e-6 ? target / seg : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}

/** Unit tangent at arc-length fraction `t` along a polyline. */
function tangentAtFraction(pts: [number, number][], t: number): [number, number] {
  const total = polyLen(pts);
  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    const dz = pts[i + 1][1] - pts[i][1];
    const seg = Math.hypot(dx, dz);
    if (target <= seg || i === pts.length - 2) {
      const len = seg || 1;
      return [dx / len, dz / len];
    }
    target -= seg;
  }
  return [0, -1];
}

/** Sample a polyline at a target Z (linear interp between the bracketing pts). */
function sampleAtZ(pts: [number, number][], z: number): [number, number] {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    if ((z - az) * (z - bz) <= 0 && Math.abs(bz - az) > 1e-3) {
      const t = (z - az) / (bz - az);
      return [ax + (bx - ax) * t, z];
    }
  }
  const last = pts[pts.length - 1];
  return [last[0], z];
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export function generateMap(seed: number, size: MapSize): GameMap {
  const def = MAP_SIZES[size];
  const { width, length } = def;
  const corner = def.corner;
  const halfL = length / 2;
  const halfW = width / 2;
  const rnd = mulberry32(seed);

  const coreZ = halfL - 12; // end-to-end core Z; unused on the corner layout

  const laneDefs = corner ? buildCornerLanes(width, length) : buildLanes(width, length);
  const midPts = laneDefs[1].pts2;
  const allyCore = corner
    ? { x: midPts[0][0], z: midPts[0][1] }
    : { x: 0, z: coreZ };
  const enemyCore = corner
    ? { x: midPts[midPts.length - 1][0], z: midPts[midPts.length - 1][1] }
    : { x: 0, z: -coreZ };

  // Collect all corridor segments (lanes) for the distance field.
  const laneSegs: Seg[] = [];
  for (const lane of laneDefs) {
    for (let i = 0; i < lane.pts2.length - 1; i++) {
      laneSegs.push({
        ax: lane.pts2[i][0],
        az: lane.pts2[i][1],
        bx: lane.pts2[i + 1][0],
        bz: lane.pts2[i + 1][1],
      });
    }
  }

  // Cut-throughs: connectors carved low between lanes (jungle crossings).
  const cutthroughs: Cutthrough[] = [];
  const cutSegs: Seg[] = [];
  const pushCut = (a: [number, number], b: [number, number]) => {
    cutthroughs.push({ a: new THREE.Vector3(a[0], 0, a[1]), b: new THREE.Vector3(b[0], 0, b[1]) });
    cutSegs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1] });
  };
  if (corner) {
    // Connect Mid to each side lane at a couple of arc-length fractions so the
    // jungle quadrants have crossings for ganks / flanks.
    const top = laneDefs[0].pts2;
    const mid = laneDefs[1].pts2;
    const bottom = laneDefs[2].pts2;
    for (const f of [0.3, 0.7]) {
      const m0 = sampleAtFraction(mid, f);
      pushCut(m0, sampleAtFraction(top, f));
      pushCut(m0, sampleAtFraction(bottom, f));
    }
  } else if (def.cutthroughPairs > 0) {
    const west = laneDefs[0].pts2;
    const center = laneDefs[1].pts2;
    const east = laneDefs[2].pts2;
    // Choose connector Z bands away from the centre and the bases.
    for (let p = 0; p < def.cutthroughPairs; p++) {
      const frac = 0.32 + p * 0.3 + (rnd() - 0.5) * 0.08;
      const zMag = coreZ * frac;
      for (const zSign of [1, -1]) {
        const z = zMag * zSign;
        pushCut(sampleAtZ(west, z), sampleAtZ(center, z));
        pushCut(sampleAtZ(center, z), sampleAtZ(east, z));
      }
    }
  }

  const allSegs = laneSegs.concat(cutSegs);

  // Distance from a point to the nearest walkable feature centerline.
  const featureDist = (x: number, z: number): number => {
    let d = Math.min(
      Math.hypot(x - allyCore.x, z - allyCore.z) - BASE_RADIUS,
      Math.hypot(x - enemyCore.x, z - enemyCore.z) - BASE_RADIUS,
    );
    if (d < 0) d = 0;
    for (const s of allSegs) {
      const sd = distToSeg(x, z, s.ax, s.az, s.bx, s.bz);
      if (sd < d) d = sd;
    }
    return d;
  };

  // Value-noise lookup (smooth) for natural ridge variation.
  const noiseGrid = 7;
  const noise = new Float32Array((noiseGrid + 1) * (noiseGrid + 1));
  for (let i = 0; i < noise.length; i++) noise[i] = rnd();
  const sampleNoise = (x: number, z: number): number => {
    const u = ((x / width) + 0.5) * noiseGrid;
    const v = ((z / length) + 0.5) * noiseGrid;
    const x0 = Math.max(0, Math.min(noiseGrid - 1, Math.floor(u)));
    const y0 = Math.max(0, Math.min(noiseGrid - 1, Math.floor(v)));
    const tx = u - x0;
    const ty = v - y0;
    const n00 = noise[y0 * (noiseGrid + 1) + x0];
    const n10 = noise[y0 * (noiseGrid + 1) + x0 + 1];
    const n01 = noise[(y0 + 1) * (noiseGrid + 1) + x0];
    const n11 = noise[(y0 + 1) * (noiseGrid + 1) + x0 + 1];
    const a = n00 + (n10 - n00) * smoothstep(tx);
    const b = n01 + (n11 - n01) * smoothstep(tx);
    return a + (b - a) * smoothstep(ty);
  };

  // Raw terrain height before discretisation.
  const rawHeight = (x: number, z: number): number => {
    const d = featureDist(x, z);
    if (d <= CORRIDOR_HALF) return 0;
    const t = smoothstep((d - CORRIDOR_HALF) / RAMP);
    const n = 0.7 + sampleNoise(x, z) * 0.6;
    return RIDGE_HEIGHT * t * n;
  };

  // Bake the heightmap grid.
  const hmCols = Math.max(2, Math.round(width / HM_CELL) + 1);
  const hmRows = Math.max(2, Math.round(length / HM_CELL) + 1);
  const heights = new Float32Array(hmCols * hmRows);
  for (let r = 0; r < hmRows; r++) {
    const z = -halfL + (r / (hmRows - 1)) * length;
    for (let c = 0; c < hmCols; c++) {
      const x = -halfW + (c / (hmCols - 1)) * width;
      heights[r * hmCols + c] = rawHeight(x, z);
    }
  }

  const heightAt = (x: number, z: number): number => {
    const fx = ((x + halfW) / width) * (hmCols - 1);
    const fz = ((z + halfL) / length) * (hmRows - 1);
    const c0 = Math.max(0, Math.min(hmCols - 1, Math.floor(fx)));
    const r0 = Math.max(0, Math.min(hmRows - 1, Math.floor(fz)));
    const c1 = Math.min(hmCols - 1, c0 + 1);
    const r1 = Math.min(hmRows - 1, r0 + 1);
    const tx = fx - c0;
    const tz = fz - r0;
    const h00 = heights[r0 * hmCols + c0];
    const h10 = heights[r0 * hmCols + c1];
    const h01 = heights[r1 * hmCols + c0];
    const h11 = heights[r1 * hmCols + c1];
    const a = h00 + (h10 - h00) * tx;
    const b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  };

  // Walkability mask: corridors + bases + cut-throughs (a bit past the flat).
  const grid = new WalkGrid(width, length, HM_CELL, (x, z) => featureDist(x, z) <= CORRIDOR_HALF + WALK_PAD);
  const flowToEnemyCore = new FlowField(grid, enemyCore.x, enemyCore.z);
  const flowToAllyCore = new FlowField(grid, allyCore.x, allyCore.z);

  // Per-lane creep steering fields. On the corner layout the three lanes share
  // endpoints, so a single whole-map field would funnel every creep down the
  // shortest (diagonal) route. Build one masked grid per lane — only that lane's
  // corridor plus both base clearings — so each lane's flow keeps its creeps in
  // lane. The end-to-end layout's lanes are already separated by ridges, so it
  // simply aliases the shared fields (identical to the original behaviour).
  let laneFlowToEnemy: FlowField[];
  let laneFlowToAlly: FlowField[];
  if (corner) {
    laneFlowToEnemy = [];
    laneFlowToAlly = [];
    for (const lane of laneDefs) {
      const segs: Seg[] = [];
      for (let i = 0; i < lane.pts2.length - 1; i++) {
        segs.push({
          ax: lane.pts2[i][0],
          az: lane.pts2[i][1],
          bx: lane.pts2[i + 1][0],
          bz: lane.pts2[i + 1][1],
        });
      }
      const laneWalk = (x: number, z: number): boolean => {
        let d = Math.min(
          Math.hypot(x - allyCore.x, z - allyCore.z) - BASE_RADIUS,
          Math.hypot(x - enemyCore.x, z - enemyCore.z) - BASE_RADIUS,
        );
        if (d < 0) d = 0;
        for (const s of segs) {
          const sd = distToSeg(x, z, s.ax, s.az, s.bx, s.bz);
          if (sd < d) d = sd;
        }
        return d <= CORRIDOR_HALF + WALK_PAD;
      };
      const lg = new WalkGrid(width, length, HM_CELL, laneWalk);
      laneFlowToEnemy.push(new FlowField(lg, enemyCore.x, enemyCore.z));
      laneFlowToAlly.push(new FlowField(lg, allyCore.x, allyCore.z));
    }
  } else {
    laneFlowToEnemy = laneDefs.map(() => flowToEnemyCore);
    laneFlowToAlly = laneDefs.map(() => flowToAllyCore);
  }

  // Resolve lane polylines at terrain height.
  const lanes: LanePathData[] = laneDefs.map((lane) => ({
    id: lane.id,
    name: lane.name,
    pts: lane.pts2.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z), z)),
  }));

  // Two towers per lane per faction form the objective ladder: an OUTER tower
  // set forward toward mid and an INNER tower guarding the core. The inner tower
  // (and the core) only become attackable once the outer ahead of it falls.
  const towers: TowerPlacement[] = [];
  if (corner) {
    // Place by arc-length fraction so the ladder follows each lane's bends and
    // stays symmetric around mid (0.5) regardless of lane shape.
    for (const lane of laneDefs) {
      const ai = sampleAtFraction(lane.pts2, 0.16);
      const ao = sampleAtFraction(lane.pts2, 0.34);
      const eo = sampleAtFraction(lane.pts2, 0.66);
      const ei = sampleAtFraction(lane.pts2, 0.84);
      towers.push({ faction: "ally", lane: lane.id, tier: "inner", x: ai[0], z: ai[1] });
      towers.push({ faction: "ally", lane: lane.id, tier: "outer", x: ao[0], z: ao[1] });
      towers.push({ faction: "enemy", lane: lane.id, tier: "outer", x: eo[0], z: eo[1] });
      towers.push({ faction: "enemy", lane: lane.id, tier: "inner", x: ei[0], z: ei[1] });
    }
  } else {
    // Offsets are FRACTIONS of coreZ so the ladder scales with the map: on a
    // large map the outer tower holds mid-field and the inner guards the base.
    const outerZ = coreZ * 0.45;
    const innerZ = coreZ * 0.8;
    for (const lane of laneDefs) {
      const ao = sampleAtZ(lane.pts2, outerZ);
      const ai = sampleAtZ(lane.pts2, innerZ);
      const eo = sampleAtZ(lane.pts2, -outerZ);
      const ei = sampleAtZ(lane.pts2, -innerZ);
      towers.push({ faction: "ally", lane: lane.id, tier: "outer", x: ao[0], z: ao[1] });
      towers.push({ faction: "ally", lane: lane.id, tier: "inner", x: ai[0], z: ai[1] });
      towers.push({ faction: "enemy", lane: lane.id, tier: "outer", x: eo[0], z: eo[1] });
      towers.push({ faction: "enemy", lane: lane.id, tier: "inner", x: ei[0], z: ei[1] });
    }
  }

  // Production buildings flanking the side lanes: a barracks behind the West/Top
  // tower (lane 0) and an archery range behind the East/Bottom tower (lane 2),
  // mirrored for both factions. Offset clear of the walkable corridor so they
  // don't block lane traffic.
  const buildings: BuildingPlacement[] = [];
  if (corner) {
    const placeCorner = (kind: BuildingPlacement["kind"], laneId: number) => {
      const pts = laneDefs[laneId].pts2;
      for (const faction of ["ally", "enemy"] as const) {
        const t = faction === "ally" ? 0.13 : 0.87;
        const [px, pz] = sampleAtFraction(pts, t);
        const [tx, tz] = tangentAtFraction(pts, t);
        let nx = -tz;
        let nz = tx;
        // Push to the wall side (away from the map centre / jungle).
        if (nx * px + nz * pz < 0) {
          nx = -nx;
          nz = -nz;
        }
        buildings.push({ faction, kind, lane: laneId, level: 1, x: px + nx * BUILDING_OFFSET, z: pz + nz * BUILDING_OFFSET });
      }
    };
    placeCorner("barracks", 0);
    placeCorner("archery", 2);
  } else {
    const innerZ = coreZ * 0.8;
    const buildingZ = (innerZ + coreZ) / 2;
    const placeBuilding = (kind: BuildingPlacement["kind"], laneId: number, side: number) => {
      const pts = laneDefs[laneId].pts2;
      for (const faction of ["ally", "enemy"] as const) {
        const z = faction === "ally" ? buildingZ : -buildingZ;
        const [lx] = sampleAtZ(pts, z);
        buildings.push({ faction, kind, lane: laneId, level: 1, x: lx + side * BUILDING_OFFSET, z });
      }
    };
    placeBuilding("barracks", 0, -1);
    placeBuilding("archery", 2, 1);
  }

  // Rally / hero spawns sit just in front of each Citadel, nudged toward the
  // map centre (down the diagonal on the corner layout, down -Z otherwise).
  let rally: { x: number; z: number };
  let heroSpawn: { x: number; z: number };
  let enemyHeroSpawn: { x: number; z: number };
  if (corner) {
    const len = Math.hypot(allyCore.x, allyCore.z) || 1;
    const ux = -allyCore.x / len;
    const uz = -allyCore.z / len; // unit vector ally core -> centre
    rally = { x: allyCore.x + ux * (BASE_RADIUS - 2), z: allyCore.z + uz * (BASE_RADIUS - 2) };
    heroSpawn = { x: allyCore.x + ux * 7, z: allyCore.z + uz * 7 };
    enemyHeroSpawn = { x: enemyCore.x - ux * 7, z: enemyCore.z - uz * 7 };
  } else {
    rally = { x: 0, z: coreZ - BASE_RADIUS + 2 };
    heroSpawn = { x: 0, z: coreZ - 7 };
    enemyHeroSpawn = { x: 0, z: -(coreZ - 7) };
  }

  // Scatter destructible trees: ridge cover between the lanes, plus jungle-trail
  // edges flanking the cross-lane cut-throughs (large maps). Seeded off the map
  // seed so a given layout is reproducible; min-spacing prevents overlapping
  // trunks. `featureDist` measures distance to the nearest walkable centreline,
  // so trees stay clear of the corridors units travel.
  const large = size === "large";
  const trees: TreeSpot[] = [];
  {
    const trnd = mulberry32((seed ^ 0x7a3bc1) >>> 0);
    const target = large ? TREE.countLarge : TREE.countStandard;
    const minGap = 2.4;
    let attempts = 0;
    while (trees.length < target && attempts < target * 50) {
      attempts++;
      const x = (trnd() - 0.5) * (width - 6);
      const z = (trnd() - 0.5) * (length - 6);
      if (Math.hypot(x - allyCore.x, z - allyCore.z) < 15) continue;
      if (Math.hypot(x - enemyCore.x, z - enemyCore.z) < 15) continue;
      const h = heightAt(x, z);
      const dW = featureDist(x, z);
      // Ridge cover: elevated ground safely off the corridors.
      const onRidge = h > 1.4 && dW > CORRIDOR_HALF + 1.2;
      // Jungle-trail edges: flat ground flanking a cut-through (large maps only).
      let trail = false;
      if (large && !onRidge) {
        for (const c of cutthroughs) {
          const dc = distToSeg(x, z, c.a.x, c.a.z, c.b.x, c.b.z);
          if (dc > 1.8 && dc < 4.5) {
            trail = true;
            break;
          }
        }
      }
      if (!onRidge && !trail) continue;
      let tooClose = false;
      for (const t of trees) {
        if (Math.hypot(t.x - x, t.z - z) < minGap) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      trees.push({ x, z, scale: 0.8 + trnd() * 0.9, rot: trnd() * Math.PI * 2 });
    }
  }

  return {
    seed,
    size,
    width,
    length,
    wallHeight: WALL_HEIGHT,
    heightAt,
    distToPath: featureDist,
    hmCols,
    hmRows,
    heights,
    lanes,
    allyCore,
    enemyCore,
    towers,
    buildings,
    rally,
    heroSpawn,
    enemyHeroSpawn,
    cutthroughs,
    trees,
    grid,
    flowToEnemyCore,
    flowToAllyCore,
    laneFlowToEnemy,
    laneFlowToAlly,
  };
}
