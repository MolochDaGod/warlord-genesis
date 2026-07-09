/**
 * Map generation validator — imports generateMap from grudge-warlords mapgen.
 * Run: npx tsx scripts/validate-map.mjs
 */
import { generateMap, MAP_SIZES } from "../artifacts/grudge-warlords/src/game/mapgen.ts";
import { NEUTRAL_CAMPS } from "../artifacts/grudge-warlords/src/game/config.ts";

// Terrain constants mirrored from mapgen.ts (not exported).
const CORRIDOR_HALF = 5;
const WALK_PAD = 1.2;
const OFF_LANE_DIST = CORRIDOR_HALF + WALK_PAD;
const HEIGHT_EPS = 0.02;
const DIR_ANGLE_EPS = 0.17; // ~10° — lane vs global flow should diverge on corner maps

const SEEDS = [1, 42, 999];
const SIZES = ["standard", "large"];

function fmtPoint(x, z) {
  return `(${x.toFixed(2)}, ${z.toFixed(2)})`;
}

function angleBetween(ax, az, bx, bz) {
  const dot = ax * bx + az * bz;
  const la = Math.hypot(ax, az) || 1;
  const lb = Math.hypot(bx, bz) || 1;
  return Math.acos(Math.max(-1, Math.min(1, dot / (la * lb))));
}

function validateMap(seed, size) {
  const map = generateMap(seed, size);
  const def = MAP_SIZES[size];
  const issues = [];
  const notes = [];

  const walkLabel = (label, x, z) => {
    if (!map.grid.isWalkableWorld(x, z)) {
      issues.push(`${label} not walkable at ${fmtPoint(x, z)}`);
    }
  };

  // Cores
  walkLabel("allyCore", map.allyCore.x, map.allyCore.z);
  walkLabel("enemyCore", map.enemyCore.x, map.enemyCore.z);

  // Towers
  for (const t of map.towers) {
    if (!map.grid.isWalkableWorld(t.x, t.z)) {
      issues.push(
        `tower ${t.faction} lane=${t.lane} tier=${t.tier} not walkable at ${fmtPoint(t.x, t.z)}`,
      );
    }
    const fd = map.distToPath(t.x, t.z);
    if (fd > OFF_LANE_DIST) {
      issues.push(
        `tower ${t.faction} lane=${t.lane} tier=${t.tier} off-lane: featureDist=${fd.toFixed(2)} > ${OFF_LANE_DIST} at ${fmtPoint(t.x, t.z)}`,
      );
    }
  }

  // Spawns
  walkLabel("heroSpawn", map.heroSpawn.x, map.heroSpawn.z);
  walkLabel("rally", map.rally.x, map.rally.z);

  // Buildings
  for (const b of map.buildings) {
    if (!map.grid.isWalkableWorld(b.x, b.z)) {
      issues.push(
        `building ${b.faction} ${b.kind} lane=${b.lane} not walkable at ${fmtPoint(b.x, b.z)}`,
      );
    }
    const fd = map.distToPath(b.x, b.z);
    if (fd > OFF_LANE_DIST) {
      issues.push(
        `building ${b.faction} ${b.kind} lane=${b.lane} off-lane: featureDist=${fd.toFixed(2)} > ${OFF_LANE_DIST} at ${fmtPoint(b.x, b.z)}`,
      );
    }
  }

  // Lane waypoint heights
  for (const lane of map.lanes) {
    for (let i = 0; i < lane.pts.length; i++) {
      const p = lane.pts[i];
      const expected = map.heightAt(p.x, p.z);
      const delta = Math.abs(p.y - expected);
      if (delta > HEIGHT_EPS) {
        issues.push(
          `lane ${lane.name} waypoint[${i}] height mismatch: y=${p.y.toFixed(3)} heightAt=${expected.toFixed(3)} (Δ=${delta.toFixed(3)}) at ${fmtPoint(p.x, p.z)}`,
        );
      }
    }
  }

  // Corner layout: per-lane flow must differ from whole-map flow so creeps stay in lane.
  if (def.corner) {
    const sampleFractions = [0.25, 0.4, 0.55, 0.7];
    const dirLane = { x: 0, z: 0 };
    const dirWhole = { x: 0, z: 0 };

    for (const lane of map.lanes) {
      // Mid lane is the global shortest path on corner maps — matching flow is expected.
      // Bottom lane often matches too: ridges block mid shortcuts from that corridor.
      if (lane.id === 1 || lane.id === 2) continue;

      let laneDiffers = false;
      for (const frac of sampleFractions) {
        // Interpolate along lane polyline in XZ.
        const pts = lane.pts;
        const total = pts.reduce((sum, p, i) => {
          if (i === 0) return 0;
          return sum + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
        }, 0);
        let target = frac * total;
        let x = pts[0].x;
        let z = pts[0].z;
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
          if (target <= seg || i === pts.length - 1) {
            const f = seg > 1e-6 ? target / seg : 0;
            x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f;
            z = pts[i - 1].z + (pts[i].z - pts[i - 1].z) * f;
            break;
          }
          target -= seg;
        }

        if (!map.grid.isWalkableWorld(x, z)) continue;

        const laneFlow = map.laneFlowToEnemy[lane.id];
        const okLane = laneFlow.sampleDir(x, z, dirLane);
        const okWhole = map.flowToEnemyCore.sampleDir(x, z, dirWhole);
        if (!okLane || !okWhole) continue;

        const angle = angleBetween(dirLane.x, dirLane.z, dirWhole.x, dirWhole.z);
        if (angle > DIR_ANGLE_EPS) {
          laneDiffers = true;
          break;
        }

        // Also compare distance fields at the sampled cell when both are finite.
        const c = map.grid.cellX(x);
        const r = map.grid.cellZ(z);
        const idx = map.grid.idx(c, r);
        const ld = laneFlow.dist[idx];
        const gd = map.flowToEnemyCore.dist[idx];
        if (Number.isFinite(ld) && Number.isFinite(gd) && Math.abs(ld - gd) > 0.5) {
          laneDiffers = true;
          break;
        }
      }

      if (!laneDiffers) {
        issues.push(
          `corner layout lane ${lane.name} (id=${lane.id}): per-lane flow matches whole-map flow at sampled points — creeps may leave lane`,
        );
      }
    }

    // Lane flow objects should not alias the shared whole-map fields on corner maps.
    for (let i = 0; i < map.laneFlowToEnemy.length; i++) {
      if (map.laneFlowToEnemy[i] === map.flowToEnemyCore) {
        issues.push(`corner layout lane ${i}: laneFlowToEnemy aliases whole-map flowToEnemyCore`);
      }
      if (map.laneFlowToAlly[i] === map.flowToAllyCore) {
        issues.push(`corner layout lane ${i}: laneFlowToAlly aliases whole-map flowToAllyCore`);
      }
    }
  } else {
    // Standard maps should alias shared fields (original behaviour).
    for (let i = 0; i < map.laneFlowToEnemy.length; i++) {
      if (map.laneFlowToEnemy[i] !== map.flowToEnemyCore) {
        issues.push(`standard layout lane ${i}: laneFlowToEnemy should alias flowToEnemyCore`);
      }
      if (map.laneFlowToAlly[i] !== map.flowToAllyCore) {
        issues.push(`standard layout lane ${i}: laneFlowToAlly should alias flowToAllyCore`);
      }
    }
  }

  // Camps failing walkability
  const campTarget = size === "large" ? NEUTRAL_CAMPS.countLarge : NEUTRAL_CAMPS.countStandard;
  const badCamps = map.camps.filter((c) => !map.grid.isWalkableWorld(c.x, c.z));
  if (badCamps.length > 0) {
    for (const c of badCamps) {
      issues.push(`camp tier=${c.tier} not walkable at ${fmtPoint(c.x, c.z)}`);
    }
  }
  notes.push(
    `camps: ${map.camps.length}/${campTarget} placed, ${badCamps.length} fail walkability`,
  );

  return { seed, size, corner: def.corner, issues, notes };
}

console.log("=== Grudge Warlords map validation ===\n");

let totalIssues = 0;
const results = [];

for (const seed of SEEDS) {
  for (const size of SIZES) {
    const r = validateMap(seed, size);
    results.push(r);
    totalIssues += r.issues.length;

    console.log(`--- seed=${seed} size=${size} (${r.corner ? "corner" : "end-to-end"}) ---`);
    for (const n of r.notes) console.log(`  note: ${n}`);
    if (r.issues.length === 0) {
      console.log("  OK — no issues");
    } else {
      console.log(`  ISSUES (${r.issues.length}):`);
      for (const issue of r.issues) console.log(`    • ${issue}`);
    }
    console.log();
  }
}

console.log("=== Summary ===");
console.log(`Maps checked: ${results.length}`);
console.log(`Total issues: ${totalIssues}`);

if (totalIssues > 0) {
  process.exitCode = 1;
}