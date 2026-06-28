import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EM, type UnitEntity } from "../../game/entities";
import { AI_LANE, ARCHER_SHELLS, PROJECTILES, type ProjectileModel } from "../../game/config";
import { findPath } from "../../game/pathfind";
import { useGame } from "../../game/store";
import {
  type CombatEntity,
  countUnitsNear,
  dealDamage,
  distXZ,
  entityById,
  findPriorityTarget,
  findTarget,
  isUnit,
  nearestThreatAhead,
  structRadius,
} from "../../game/combat";
import { UnitMesh } from "./UnitMesh";
import type { WalkGrid } from "../../game/pathfind";

const _dir = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _stage = new THREE.Vector3();
const _flow = { x: 0, z: 0 };

/** Candidate deflection angles (radians) when a dynamic obstacle blocks the path. */
const AVOID_ANGLES = [0.6, -0.6, 1.2, -1.2, 1.9, -1.9] as const;

/** Largest separation displacement a single unit may absorb in one frame. */
const MAX_SEP = 0.5;
/** Seconds of no-progress before a unit takes deterministic deadlock-breaking action. */
const STUCK_SIDESTEP = 0.35;
const STUCK_REPATH = 0.5;

// Per-frame scratch indexed by unit array position. Grown on demand so we never
// allocate inside the hot loop. `goalDist` caches each unit's flow-field distance
// to its objective core (used to make separation asymmetric); `prevX/prevZ` snapshot
// pre-movement position to measure real progress; `sepX/sepZ` accumulate pushes;
// `wantMove` flags units that intended to move this frame.
let _cap = 0;
let _goalDist = new Float32Array(0);
let _prevX = new Float32Array(0);
let _prevZ = new Float32Array(0);
let _sepX = new Float32Array(0);
let _sepZ = new Float32Array(0);
let _wantMove = new Uint8Array(0);
function ensureScratch(n: number) {
  if (n <= _cap) return;
  _cap = n;
  _goalDist = new Float32Array(n);
  _prevX = new Float32Array(n);
  _prevZ = new Float32Array(n);
  _sepX = new Float32Array(n);
  _sepZ = new Float32Array(n);
  _wantMove = new Uint8Array(n);
}

/**
 * Move along a desired displacement but slide along terrain instead of clipping
 * into ridges: if the full step lands on non-walkable ground, retry the X-only
 * then Z-only component so units glide along walls rather than stalling against
 * them (which previously triggered the snap-back clamp and chokepoint jitter).
 */
function slideMove(grid: WalkGrid, x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  if (grid.isWalkableWorld(x + dx, z + dz)) return { x: x + dx, z: z + dz };
  if (Math.abs(dx) > 1e-5 && grid.isWalkableWorld(x + dx, z)) return { x: x + dx, z };
  if (Math.abs(dz) > 1e-5 && grid.isWalkableWorld(x, z + dz)) return { x, z: z + dz };
  return { x, z };
}

/**
 * Steer a unit's intended heading around runtime obstacles (trees) tracked on the
 * spatial grid. Only dynamic blocks deflect — terrain pathing is already handled
 * by the lane flow-field, so we leave walkable/ridge decisions to it.
 */
function avoidObstacles(u: UnitEntity, dx: number, dz: number): { x: number; z: number } {
  const look = u.def.radius + 1.3;
  if (!EM.isBlocked(u.pos.x + dx * look, u.pos.z + dz * look)) return { x: dx, z: dz };
  for (const ang of AVOID_ANGLES) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const nx = dx * c - dz * s;
    const nz = dx * s + dz * c;
    if (!EM.isBlocked(u.pos.x + nx * look, u.pos.z + nz * look)) return { x: nx, z: nz };
  }
  return { x: dx, z: dz };
}

interface Decision {
  moveTo: THREE.Vector3 | null;
  target: CombatEntity | null;
  hero: boolean;
}

const NO_OP: Decision = { moveTo: null, target: null, hero: false };

/** Re-acquire / keep a sticky target within (range + slack). */
function acquire(u: UnitEntity, range: number): CombatEntity | null {
  if (u.targetId != null) {
    const cur = entityById(u.targetId);
    if (cur && cur.alive && cur.faction !== u.faction && distXZ(u.pos, cur.pos.x, cur.pos.z) <= range + 6) {
      return cur;
    }
    u.targetId = null;
  }
  const t = findTarget(u.faction, u.pos.x, u.pos.z, range);
  u.targetId = t ? t.id : null;
  return t;
}

/**
 * Lane-creep target acquisition: smarter than `acquire` (it scores foes via
 * `findPriorityTarget`). Sticks to an engaged enemy UNIT so it doesn't flip
 * targets every frame, but never sticks to a structure — so the instant a
 * hostile unit shows up, the creep peels off the tower to fight the line.
 */
function acquirePriority(u: UnitEntity, range: number): CombatEntity | null {
  let cur: CombatEntity | null = null;
  if (u.targetId != null) {
    const e = entityById(u.targetId);
    if (e && e.alive && e.faction !== u.faction && distXZ(u.pos, e.pos.x, e.pos.z) <= range + 6) cur = e;
    else u.targetId = null;
  }
  if (cur && isUnit(cur)) return cur;
  const t = findPriorityTarget(u, range);
  if (t) {
    u.targetId = t.id;
    return t;
  }
  if (cur) return cur; // keep sieging a structure that's just outside aggro slack
  u.targetId = null;
  return null;
}

/**
 * Tower-danger staging for lane creeps. Returns a hold position just outside a
 * hostile tower's range when the creep would otherwise walk into it without a
 * wave; returns null when it's clear to advance / dive. Creeps pile at the
 * danger edge until enough friendly support gathers (`waveSize`) — then they all
 * commit together — with an anti-stall timeout so a lane never freezes forever.
 */
function laneStaging(u: UnitEntity, dt: number): THREE.Vector3 | null {
  const threat = nearestThreatAhead(u);
  if (!threat) {
    u.stageTimer = 0;
    return null;
  }
  const edge = threat.range + AI_LANE.stageMargin;
  const dx = u.pos.x - threat.pos.x;
  const dz = u.pos.z - threat.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > edge) {
    // Not in danger yet — keep advancing along the lane toward the line.
    u.stageTimer = 0;
    return null;
  }
  // Inside the danger ring: commit with a wave, or once we've waited long enough.
  const support = countUnitsNear(u.faction, u.pos.x, u.pos.z, AI_LANE.waveRadius);
  if (support >= AI_LANE.waveSize) {
    u.stageTimer = 0;
    return null;
  }
  u.stageTimer += dt;
  if (u.stageTimer >= AI_LANE.maxStageTime) return null;
  // Hold at the danger edge (back off radially if we've drifted inside it).
  const len = d || 1;
  return _stage.set(threat.pos.x + (dx / len) * edge, 0, threat.pos.z + (dz / len) * edge);
}

function engage(u: UnitEntity, t: CombatEntity): Decision {
  const reach = u.def.attackRange + (isUnit(t) ? t.def.radius : structRadius(t.kind));
  if (distXZ(u.pos, t.pos.x, t.pos.z) <= reach) return { moveTo: null, target: t, hero: false };
  return { moveTo: t.pos, target: t, hero: false };
}

/** Lane creeps steer along their lane's flow-field toward the enemy core. */
function laneTarget(u: UnitEntity): THREE.Vector3 | null {
  const m = EM.map;
  const fields = u.faction === "ally" ? m.laneFlowToEnemy : m.laneFlowToAlly;
  const shared = u.faction === "ally" ? m.flowToEnemyCore : m.flowToAllyCore;
  const ff = u.lane >= 0 && u.lane < fields.length ? fields[u.lane] : shared;
  if (ff.sampleDir(u.pos.x, u.pos.z, _flow)) {
    return _tmp.set(u.pos.x + _flow.x * 3, 0, u.pos.z + _flow.z * 3);
  }
  const core = u.faction === "ally" ? EM.enemyCore : EM.allyCore;
  return core ? core.pos : null;
}

/**
 * A* path-follow toward a player-issued destination. Recomputes when the dest
 * object changes; returns the next waypoint (or the exact dest on the last leg).
 */
function pathTarget(u: UnitEntity, dest: THREE.Vector3): THREE.Vector3 {
  if (u.pathFor !== dest) {
    u.path = findPath(EM.map.grid, u.pos.x, u.pos.z, dest.x, dest.z);
    u.pathIdx = 0;
    u.pathFor = dest;
  }
  const path = u.path;
  if (!path || path.length === 0) return dest;
  while (u.pathIdx < path.length - 1) {
    const wp = path[u.pathIdx];
    if (distXZ(u.pos, wp.x, wp.z) < 1.6) {
      u.pathIdx++;
      continue;
    }
    return _tmp.set(wp.x, 0, wp.z);
  }
  return dest;
}

function clearPath(u: UnitEntity) {
  u.path = null;
  u.pathIdx = 0;
  u.pathFor = null;
}

/** Per-unit AI: where to move and what (if anything) to attack this frame. */
function decide(u: UnitEntity, heroAlive: boolean, dt: number): Decision {
  const range = u.def.aggroRange;

  // Enemy units opportunistically swarm the hero when nearby.
  let heroD = Infinity;
  if (u.faction === "enemy" && heroAlive) heroD = distXZ(u.pos, EM.playerPos.x, EM.playerPos.z);

  if (u.commandable) {
    if (u.order === "move") {
      if (u.dest) {
        if (distXZ(u.pos, u.dest.x, u.dest.z) < 1.6) {
          u.order = "idle";
          u.anchor.copy(u.pos);
          u.dest = null;
          clearPath(u);
          return NO_OP;
        }
        return { moveTo: pathTarget(u, u.dest), target: null, hero: false };
      }
      return NO_OP;
    }
    if (u.order === "attackMove") {
      const t = acquire(u, range);
      if (t) return engage(u, t);
      if (u.dest) {
        if (distXZ(u.pos, u.dest.x, u.dest.z) < 1.6) {
          u.order = "idle";
          u.anchor.copy(u.pos);
          u.dest = null;
          clearPath(u);
          return NO_OP;
        }
        return { moveTo: pathTarget(u, u.dest), target: null, hero: false };
      }
      return NO_OP;
    }
    // idle / hold: guard the anchor, engage intruders, then leash back.
    const t = acquire(u, range);
    if (t) {
      if (distXZ(t.pos, u.anchor.x, u.anchor.z) > range + 6) {
        u.targetId = null;
        return { moveTo: u.anchor, target: null, hero: false };
      }
      return engage(u, t);
    }
    if (distXZ(u.pos, u.anchor.x, u.anchor.z) > 1.2) {
      return { moveTo: u.anchor, target: null, hero: false };
    }
    return NO_OP;
  }

  // Lane creep / elite.
  const t = acquirePriority(u, range);
  const tD = t ? distXZ(u.pos, t.pos.x, t.pos.z) : Infinity;
  if (heroD <= range && heroD < tD) {
    const reach = u.def.attackRange + 0.7;
    if (heroD <= reach) return { moveTo: null, target: null, hero: true };
    return { moveTo: EM.playerPos, target: null, hero: true };
  }
  if (t) return engage(u, t);
  // No foe in aggro range — advance along the lane, but stage just outside enemy
  // tower range until a wave forms so creeps don't trickle into tower fire alone.
  const stage = laneStaging(u, dt);
  if (stage) return { moveTo: stage, target: null, hero: false };
  const lane = laneTarget(u);
  return { moveTo: lane, target: null, hero: false };
}

function rangedShell(u: UnitEntity): ProjectileModel {
  return u.faction === "ally"
    ? ARCHER_SHELLS[(Math.random() * ARCHER_SHELLS.length) | 0]
    : "wizard";
}

function performAttack(u: UnitEntity, d: Decision, g: ReturnType<typeof useGame.getState>) {
  const from = u.pos.clone().setY(u.pos.y + 1.1 * u.def.scale);
  // Difficulty scales enemy outgoing damage (ally units keep dmgMult = 1);
  // army-wide buffs (relic + ally tech) scale both sides via factionDmgMult.
  const dmg = u.def.damage * u.dmgMult * EM.factionDmgMult(u.faction);
  if (d.hero) {
    const to = EM.playerPos.clone();
    if (u.def.ranged) {
      EM.addProjectile(rangedShell(u), from, to);
    }
    EM.addSpark(to.clone().setY(1.2), "#ff6b6b");
    g.damagePlayer(dmg);
    return;
  }
  const t = d.target;
  if (!t) return;
  const to = t.pos.clone().setY(isUnit(t) ? 1 * t.def.scale : 1.4);
  if (u.def.ranged) {
    const shell = rangedShell(u);
    // Heavy shells (e.g. raider wizard bolts) explode for AoE + slow at impact;
    // light shells stay single-target hitscan dealt now.
    const splashShell = !!PROJECTILES[shell].splash;
    EM.addProjectile(
      shell,
      from,
      to,
      splashShell ? { faction: u.faction, splashDamage: dmg } : {},
    );
    EM.addSpark(to, "#ffffff");
    if (!splashShell) dealDamage(t, dmg);
  } else {
    EM.addSpark(to, "#ffd27f");
    dealDamage(t, dmg);
  }
}

export function Units() {
  const { camera } = useThree();
  const refs = useMemo(() => new Map<number, THREE.Group>(), []);
  const [, force] = useState(0);
  const version = useRef("");

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const g = useGame.getState();
    if (g.phase !== "battle") return;
    const heroAlive = !g.heroDead;
    const units = EM.units;
    const map = EM.map;
    const halfW = map.width / 2 - 2;
    const halfL = map.length / 2 - 2;

    const grid = map.grid;
    const cols = grid.cols;
    ensureScratch(units.length);

    // Pass 1 — AI, movement, attacks. Also snapshots pre-move position and the
    // flow-field goal distance (drives asymmetric separation in Pass 2) and clears
    // the separation accumulators.
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      _sepX[i] = 0;
      _sepZ[i] = 0;
      _wantMove[i] = 0;
      if (!u.alive) continue;
      _prevX[i] = u.pos.x;
      _prevZ[i] = u.pos.z;
      {
        const ff = u.faction === "ally" ? map.flowToEnemyCore : map.flowToAllyCore;
        const cc = grid.cellX(u.pos.x);
        const rr = grid.cellZ(u.pos.z);
        let gd = grid.inBounds(cc, rr) ? ff.dist[rr * cols + cc] : Infinity;
        if (!isFinite(gd)) gd = 1e6;
        _goalDist[i] = gd;
      }

      // The enemy warlord lives in `units` only so faction-aware targeting hits
      // it; EnemyHero.tsx owns its AI, movement, attacks and rendering. We still
      // snapshot its position + goal-distance above so other units separate from
      // it as an obstacle, but skip simulating it here and in the passes below.
      if (u.isHero) continue;

      const d = decide(u, heroAlive, dt);
      let desiredYaw = u.yaw;
      let movingNow = false;

      // Decay any active wizard slow; while active it scales move speed.
      if (u.slowTimer > 0) {
        u.slowTimer -= dt;
        if (u.slowTimer <= 0) u.slowFactor = 1;
      }
      const speed = u.def.speed * u.slowFactor;

      if (d.moveTo) {
        _dir.set(d.moveTo.x - u.pos.x, 0, d.moveTo.z - u.pos.z);
        const dist = _dir.length();
        if (dist > 0.05) {
          _dir.multiplyScalar(1 / dist);
          let sx = _dir.x;
          let sz = _dir.z;
          const steer = avoidObstacles(u, sx, sz);
          sx = steer.x;
          sz = steer.z;
          // Deadlock break: a unit wedged for too long sidesteps to slip around the
          // blockage. Turn toward whichever side has open terrain (probing the
          // left/right perpendicular) so a unit jammed against a ridge peels off
          // the correct way; ties fall back to id parity so two wedged units don't
          // both shove the same direction.
          if (u.stuck > STUCK_SIDESTEP) {
            const px = -sz;
            const pz = sx;
            const open = (sign: number) =>
              grid.isWalkableWorld(u.pos.x + px * sign * 0.8, u.pos.z + pz * sign * 0.8) &&
              grid.isWalkableWorld(u.pos.x + px * sign * 1.4, u.pos.z + pz * sign * 1.4);
            const leftOpen = open(1);
            const rightOpen = open(-1);
            let a: number;
            if (leftOpen && !rightOpen) a = 0.9;
            else if (rightOpen && !leftOpen) a = -0.9;
            else a = (u.id & 1) === 1 ? 0.9 : -0.9;
            const cs = Math.cos(a);
            const sn = Math.sin(a);
            const rx = sx * cs - sz * sn;
            const rz = sx * sn + sz * cs;
            sx = rx;
            sz = rz;
          }
          const step = speed * dt;
          const mv = slideMove(grid, u.pos.x, u.pos.z, sx * step, sz * step);
          u.pos.x = mv.x;
          u.pos.z = mv.z;
          desiredYaw = Math.atan2(sx, sz);
          u.bob += dt * speed * 1.7;
          movingNow = true;
          _wantMove[i] = 1;
        }
      } else if (d.hero) {
        desiredYaw = Math.atan2(EM.playerPos.x - u.pos.x, EM.playerPos.z - u.pos.z);
      } else if (d.target) {
        desiredYaw = Math.atan2(d.target.pos.x - u.pos.x, d.target.pos.z - u.pos.z);
      }

      // Smooth facing toward the intended heading (frame-rate independent).
      let dy = desiredYaw - u.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      u.yaw += dy * Math.min(1, dt * 10);

      // Attack when standing in range.
      u.attackTimer -= dt;
      if (!movingNow && (d.target || d.hero) && u.attackTimer <= 0) {
        performAttack(u, d, g);
        u.attackTimer = u.def.attackCooldown;
        u.swing = 1;
      }
      u.swing = Math.max(0, u.swing - dt * 4);
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      u.vel.set(movingNow ? 1 : 0, 0, 0);
    }

    // Pass 2a — accumulate pairwise separation. The push is split by flow-field
    // goal distance: the unit further from its objective yields more, so front-of-
    // lane units keep advancing instead of being shoved backward into a deadlock.
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j];
        if (!b.alive) continue;
        const dx = a.pos.x - b.pos.x;
        const dz = a.pos.z - b.pos.z;
        const min = a.def.radius + b.def.radius;
        const dist = Math.hypot(dx, dz);
        if (dist >= min) continue;
        if (dist > 1e-3) {
          const overlap = min - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          const ga = _goalDist[i];
          const gb = _goalDist[j];
          const sum = ga + gb;
          let wa = 0.5;
          let wb = 0.5;
          if (sum > 1e-3 && isFinite(sum)) {
            wa = ga / sum;
            wb = gb / sum;
          }
          _sepX[i] += nx * overlap * wa;
          _sepZ[i] += nz * overlap * wa;
          _sepX[j] -= nx * overlap * wb;
          _sepZ[j] -= nz * overlap * wb;
        } else {
          // Exactly coincident: nudge apart deterministically by id order.
          const sgn = a.id < b.id ? 1 : -1;
          _sepX[i] += sgn * 0.05;
          _sepX[j] -= sgn * 0.05;
        }
      }
    }

    // Pass 2b — apply separation (capped, wall-sliding), push out of structures,
    // clamp to bounds + walkable terrain, snap height, and update deadlock state.
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      if (!a.alive || a.isHero) continue;
      let sx = _sepX[i];
      let sz = _sepZ[i];
      const m = Math.hypot(sx, sz);
      // Cap the per-frame separation step to roughly the unit's own move budget
      // (small floor so coincident units still escape, hard ceiling at MAX_SEP).
      // A fixed large cap let crowded units "pop" sideways several units a frame.
      const cap = Math.min(MAX_SEP, Math.max(0.12, a.def.speed * dt * 1.5));
      if (m > cap) {
        const k = cap / m;
        sx *= k;
        sz *= k;
      }
      if (m > 1e-5) {
        const mv = slideMove(grid, a.pos.x, a.pos.z, sx, sz);
        a.pos.x = mv.x;
        a.pos.z = mv.z;
      }
      for (const s of EM.structures) {
        if (!s.alive) continue;
        const dx = a.pos.x - s.pos.x;
        const dz = a.pos.z - s.pos.z;
        const min = a.def.radius + structRadius(s.kind);
        const dist = Math.hypot(dx, dz);
        if (dist > 1e-3 && dist < min) {
          const push = min - dist;
          a.pos.x += (dx / dist) * push;
          a.pos.z += (dz / dist) * push;
        }
      }
      a.pos.x = Math.max(-halfW, Math.min(halfW, a.pos.x));
      a.pos.z = Math.max(-halfL, Math.min(halfL, a.pos.z));
      // Keep units out of the raised ridges, then snap to terrain height.
      if (!grid.isWalkableWorld(a.pos.x, a.pos.z)) {
        const w = grid.nearestWalkable(a.pos.x, a.pos.z);
        a.pos.x = w.x;
        a.pos.z = w.z;
      }
      a.pos.y = map.heightAt(a.pos.x, a.pos.z);

      // Deadlock tracking: a unit that wanted to move but barely advanced is wedged.
      if (_wantMove[i] === 1) {
        const moved = Math.hypot(a.pos.x - _prevX[i], a.pos.z - _prevZ[i]);
        if (moved < a.def.speed * dt * 0.35) a.stuck += dt;
        else a.stuck = 0;
      } else {
        a.stuck = 0;
      }
      // Commanded units recompute their A* route when wedged so they route around
      // the blockage instead of grinding into it.
      if (
        a.commandable &&
        a.stuck > STUCK_REPATH &&
        (a.order === "move" || a.order === "attackMove")
      ) {
        clearPath(a);
        a.stuck = 0;
      }
    }

    // Pass 3 — render transforms + health bars.
    for (const u of units) {
      if (u.isHero) continue;
      const grp = refs.get(u.id);
      if (!grp) continue;
      const bob = u.vel.x > 0 ? Math.abs(Math.sin(u.bob)) * 0.09 : 0;
      grp.position.set(u.pos.x, u.pos.y + bob, u.pos.z);
      grp.rotation.y = u.yaw;
      grp.rotation.x = -u.swing * 0.35;
      grp.scale.setScalar(u.def.scale);

      const ud = grp.userData as {
        hpbar?: THREE.Object3D;
        hpfill?: THREE.Mesh;
        hpmat?: THREE.MeshBasicMaterial;
      };
      if (ud.hpbar === undefined) {
        ud.hpbar = grp.getObjectByName("hpbar") ?? undefined;
        ud.hpfill = (grp.getObjectByName("hpfill") as THREE.Mesh) ?? undefined;
        ud.hpmat = ud.hpfill?.material as THREE.MeshBasicMaterial | undefined;
      }
      if (ud.hpbar) {
        // Face the camera and hold a constant world size despite unit yaw/scale.
        ud.hpbar.quaternion.copy(grp.quaternion).invert().multiply(camera.quaternion);
        ud.hpbar.scale.setScalar(1 / u.def.scale);
      }
      if (ud.hpfill) {
        const frac = Math.max(0.001, u.hp / u.maxHp);
        ud.hpfill.scale.x = frac;
        ud.hpfill.position.x = -(1 - frac) * 0.53;
        // Allies shade green -> amber -> red as they bleed; enemies stay red.
        if (ud.hpmat && u.faction === "ally") ud.hpmat.color.setHSL(0.33 * frac, 0.7, 0.5);
      }
    }

    // Re-render the React list only when the alive id-set changes (the warlord
    // is rendered by EnemyHero.tsx, so it never appears in this list).
    let key = "";
    for (const u of units) if (u.alive && !u.isHero) key += u.id + ",";
    if (key !== version.current) {
      version.current = key;
      force((n) => n + 1);
    }
  });

  const setRef = (id: number) => (el: THREE.Group | null) => {
    if (el) refs.set(id, el);
    else refs.delete(id);
  };

  return (
    <>
      {EM.units
        .filter((u) => u.alive && !u.isHero)
        .map((u) => {
          const headY = (2.1 * 1) ; // local space (group scales overall)
          const barColor = u.faction === "ally" ? "#7ee37e" : "#ff6b6b";
          return (
            <group key={u.id} ref={setRef(u.id)} position={[u.pos.x, 0, u.pos.z]}>
              <UnitMesh def={u.def} faction={u.faction} />
              <group name="hpbar" position={[0, headY, 0]}>
                <mesh position={[0, 0, -0.02]}>
                  <planeGeometry args={[1.2, 0.22]} />
                  <meshBasicMaterial color="#0a0604" transparent opacity={0.9} depthTest={false} depthWrite={false} />
                </mesh>
                <mesh position={[0, 0, -0.01]}>
                  <planeGeometry args={[1.1, 0.13]} />
                  <meshBasicMaterial color={u.faction === "ally" ? "#16310f" : "#3a1412"} depthTest={false} depthWrite={false} />
                </mesh>
                <mesh name="hpfill" position={[0, 0, 0]}>
                  <planeGeometry args={[1.06, 0.1]} />
                  <meshBasicMaterial color={barColor} depthTest={false} depthWrite={false} />
                </mesh>
              </group>
            </group>
          );
        })}
    </>
  );
}
