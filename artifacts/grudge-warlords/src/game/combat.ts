import * as THREE from "three";
import { EM, type StructureEntity, type UnitEntity } from "./entities";
import { type Faction, type StructureKind, MOMENTUM, AI_MACRO, AI_LANE } from "./config";
import { useGame } from "./store";

export type CombatEntity = UnitEntity | StructureEntity;

export function isUnit(e: CombatEntity): e is UnitEntity {
  return (e as UnitEntity).def !== undefined;
}

/**
 * The objective-ladder gate: a structure can only be attacked once the
 * structures ahead of it in its lane have fallen. Non-lane structures (player
 * builds, production buildings, etc.) and outer towers are always attackable.
 * An inner tower opens once its lane's outer tower is razed; a Citadel core
 * opens only once at least one of that faction's lanes is fully broken (both
 * its towers down). Reads the O(1) gate refs recorded at battlefield build.
 */
export function isAttackable(s: StructureEntity): boolean {
  if (s.kind === "core") return laneBroken(s.faction);
  if (s.kind !== "tower") return true;
  if (s.tier === "outer") return true;
  if (s.tier === "inner") {
    const gate = EM.match.gate[s.faction][s.lane];
    const outer = gate?.outer ?? null;
    return !outer || !outer.alive;
  }
  return true;
}

/** True once any of this faction's lanes has both its towers razed. */
export function laneBroken(faction: Faction): boolean {
  for (const gate of EM.match.gate[faction]) {
    const outerDead = !gate.outer || !gate.outer.alive;
    const innerDead = !gate.inner || !gate.inner.alive;
    if (outerDead && innerDead) return true;
  }
  return false;
}

export function structRadius(kind: StructureKind): number {
  switch (kind) {
    case "core":
      return 3.4;
    case "tower":
      return 1.9;
    case "mage":
      return 1.2;
    case "cannon":
    case "ballista":
      return 1.1;
    case "barrier":
      return 1.3;
    default:
      return 1;
  }
}

export function distXZ(a: THREE.Vector3, bx: number, bz: number): number {
  const dx = a.x - bx;
  const dz = a.z - bz;
  return Math.hypot(dx, dz);
}

/** Nearest opposing entity within range; enemy units are preferred over buildings. */
export function findTarget(
  faction: Faction,
  x: number,
  z: number,
  range: number,
): CombatEntity | null {
  let best: CombatEntity | null = null;
  let bestD = range * range;
  for (const o of EM.units) {
    if (!o.alive || o.faction === faction) continue;
    const dx = x - o.pos.x;
    const dz = z - o.pos.z;
    const dd = dx * dx + dz * dz;
    if (dd < bestD) {
      bestD = dd;
      best = o;
    }
  }
  if (best) return best;
  bestD = range * range;
  for (const s of EM.structures) {
    if (!s.alive || s.faction === faction || !isAttackable(s)) continue;
    const dx = x - s.pos.x;
    const dz = z - s.pos.z;
    const dd = dx * dx + dz * dz;
    if (dd < bestD) {
      bestD = dd;
      best = s;
    }
  }
  return best;
}

/** Count alive units of a given faction within `range` of a world point. */
export function countUnitsNear(faction: Faction, x: number, z: number, range: number): number {
  const r2 = range * range;
  let n = 0;
  for (const u of EM.units) {
    if (!u.alive || u.faction !== faction) continue;
    const dx = x - u.pos.x;
    const dz = z - u.pos.z;
    if (dx * dx + dz * dz <= r2) n++;
  }
  return n;
}

/**
 * Smarter lane-creep target pick (vs. `findTarget`'s pure nearest). Scores
 * hostile units in range by closeness, how wounded they are (finish them off),
 * and whether they're already attacking this unit, so a creep engages the enemy
 * line sensibly instead of randomly aggroing. Only when NO hostile unit is in
 * range does it fall back to the nearest attackable structure (siege), which is
 * what keeps creeps from diving a tower while there's still a line to trade with.
 */
export function findPriorityTarget(u: UnitEntity, range: number): CombatEntity | null {
  const r2 = range * range;
  let best: UnitEntity | null = null;
  let bestScore = -Infinity;
  for (const o of EM.units) {
    if (!o.alive || o.faction === u.faction) continue;
    const dx = u.pos.x - o.pos.x;
    const dz = u.pos.z - o.pos.z;
    const dd = dx * dx + dz * dz;
    if (dd > r2) continue;
    let score = -Math.sqrt(dd);
    score += (1 - o.hp / o.maxHp) * AI_LANE.lowHpWeight;
    if (o.targetId === u.id) score += AI_LANE.threatSelfBonus;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  if (best) return best;
  let bs: StructureEntity | null = null;
  let bd = r2;
  for (const s of EM.structures) {
    if (!s.alive || s.faction === u.faction || !isAttackable(s)) continue;
    const dx = u.pos.x - s.pos.x;
    const dz = u.pos.z - s.pos.z;
    const dd = dx * dx + dz * dz;
    if (dd < bd) {
      bd = dd;
      bs = s;
    }
  }
  return bs;
}

/**
 * Nearest alive hostile defensive structure (range > 0) that lies AHEAD of this
 * unit — closer to the unit's objective core than the unit itself — i.e. a tower
 * (or, once the lane is broken, the core) the flow field would funnel it into.
 * Lane creeps use this to stage just outside its range until a wave forms rather
 * than walking in solo. Returns null when nothing dangerous is ahead.
 */
export function nearestThreatAhead(u: UnitEntity): StructureEntity | null {
  const core = u.faction === "ally" ? EM.enemyCore : EM.allyCore;
  if (!core) return null;
  const myToCore = distXZ(u.pos, core.pos.x, core.pos.z);
  let best: StructureEntity | null = null;
  let bestD = Infinity;
  for (const s of EM.structures) {
    if (!s.alive || s.faction === u.faction || s.range <= 0) continue;
    // Only consider structures between the unit and its objective.
    if (distXZ(s.pos, core.pos.x, core.pos.z) > myToCore - 1) continue;
    const d = distXZ(u.pos, s.pos.x, s.pos.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export function entityById(id: number): CombatEntity | null {
  for (const o of EM.units) if (o.id === id) return o;
  for (const s of EM.structures) if (s.id === id) return s;
  return null;
}

/** Apply damage and resolve death (rewards, sparks). Cores never despawn. */
export function dealDamage(target: CombatEntity, dmg: number, sparkColor = "#ffce6b"): void {
  if (!target.alive) return;
  // Hard-guard the objective ladder: even direct AoE / hitscan cannot chip a
  // structure that is still gated behind a living tower ahead of it.
  if (!isUnit(target) && !isAttackable(target)) return;
  // Flag structures as under attack so the reactive AI can defend them.
  if (!isUnit(target)) target.underAttack = AI_MACRO.underAttackLinger;
  target.hp -= dmg;
  target.hitFlash = 0.12;
  const topY = isUnit(target)
    ? 2.1 * target.def.scale
    : target.kind === "core"
      ? 5.4
      : target.kind === "tower"
        ? 5
        : target.kind === "mage"
          ? 3.6
          : 2.2;
  EM.addFloatText(
    target.pos.x,
    topY,
    target.pos.z,
    String(Math.max(1, Math.round(dmg))),
    target.faction === "enemy" ? "#ffe08a" : "#ff8a7a",
  );
  // Faction-tinted flame burst at the point of impact.
  _mfx.copy(target.pos).setY(target.pos.y + topY * 0.5);
  EM.addFireBurst(_mfx, target.faction === "enemy" ? "#ffae42" : "#ff6a3c", 3, 0.5);
  if (target.hp > 0) return;

  const g = useGame.getState();
  if (!isUnit(target) && target.kind === "core") {
    target.hp = 0; // win/lose is resolved by the MatchDirector
    return;
  }
  target.alive = false;
  if (isUnit(target)) {
    EM.addSpark(target.pos.clone().setY(0.7), sparkColor);
    EM.addSpark(target.pos.clone().setY(0.4), "#ff7733");
    if (target.faction === "enemy") {
      const reward = Math.round(target.def.reward * EM.match.comeback.ally);
      g.addCredits(reward);
      g.addScore(reward);
      g.addKill();
    }
  } else {
    EM.addImpact(target.pos.clone().setY(1.2));
    // A razed lane structure escalates the WINNING side's pressure in that lane.
    onStructureRazed(target);
    if (target.faction === "enemy" && target.kind === "tower") {
      const reward = Math.round(70 * EM.match.comeback.ally);
      g.addCredits(reward);
      g.addScore(reward);
      g.pushMessage("ENEMY TOWER RAZED", "good");
    }
  }
}

/**
 * When a lane structure (tower) falls, stack momentum for the side that razed it
 * — the opponent of the structure's faction — in that same lane, capped by
 * `MOMENTUM.maxBreaches`. Non-lane structures (lane = -1) grant nothing.
 */
function onStructureRazed(s: StructureEntity): void {
  if (s.lane < 0) return;
  const winner: Faction = s.faction === "ally" ? "enemy" : "ally";
  const m = EM.match.momentum[winner];
  m[s.lane] = Math.min(MOMENTUM.maxBreaches, (m[s.lane] ?? 0) + 1);
}

const _mfx = new THREE.Vector3();

/**
 * Advance hero melee ranged effects: travelling slash waves (cut a moving band)
 * and expanding shockwave rings (area damage). Each effect damages a given
 * target at most once via its `hit` id-set. Call once per frame.
 */
export function updateMeleeFx(dt: number): void {
  // Only simulate (and deal damage) during an active match; on victory/defeat
  // drop any in-flight effects so they cannot alter the final score.
  if (useGame.getState().phase !== "battle") {
    if (EM.slashes.length) EM.slashes.length = 0;
    if (EM.shocks.length) EM.shocks.length = 0;
    return;
  }
  for (let i = EM.slashes.length - 1; i >= 0; i--) {
    const s = EM.slashes[i];
    s.traveled += s.speed * dt;
    s.pos.copy(s.origin).addScaledVector(s.dir, s.traveled);
    if (Math.random() < 0.6) EM.addEmber(s.pos.clone(), s.color);

    const near = s.traveled - 2.6;
    const far = s.traveled + 0.6;
    const cut = (ent: CombatEntity, radius: number) => {
      if (s.hit.has(ent.id)) return;
      _mfx.copy(ent.pos).sub(s.origin);
      _mfx.y = 0;
      const proj = _mfx.dot(s.dir);
      if (proj < near || proj > far) return;
      const perp = Math.sqrt(Math.max(0, _mfx.lengthSq() - proj * proj));
      if (perp <= s.width + radius) {
        s.hit.add(ent.id);
        if (s.damage > 0) dealDamage(ent, s.damage, s.color);
      }
    };
    for (const u of EM.units) {
      if (!u.alive || u.faction === s.faction) continue;
      cut(u, 0.9 * u.def.scale);
    }
    for (const b of EM.structures) {
      if (!b.alive || b.faction === s.faction) continue;
      cut(b, structRadius(b.kind));
    }
    // Trees are neutral cover: the slash band can chop any it sweeps through.
    for (const tr of EM.trees) {
      if (!tr.alive || s.hit.has(tr.id)) continue;
      _mfx.copy(tr.pos).sub(s.origin);
      _mfx.y = 0;
      const proj = _mfx.dot(s.dir);
      if (proj < near || proj > far) continue;
      const perp = Math.sqrt(Math.max(0, _mfx.lengthSq() - proj * proj));
      if (perp <= s.width + tr.radius) {
        s.hit.add(tr.id);
        if (s.damage > 0) EM.damageTree(tr, s.damage);
      }
    }

    if (s.traveled >= s.range) {
      const burst = s.pos.clone();
      for (let k = 0; k < 10; k++) EM.addEmber(burst, s.color);
      EM.addSmoke(burst.clone(), 0.5);
      if (s.spawnShock) {
        EM.addShockwave({
          pos: new THREE.Vector3(s.pos.x, 0.1, s.pos.z),
          maxRadius: s.shockRadius,
          duration: s.shockDuration,
          damage: s.shockDamage,
          color: s.color,
          faction: s.faction,
        });
      }
      EM.slashes.splice(i, 1);
    }
  }

  for (let i = EM.shocks.length - 1; i >= 0; i--) {
    const w = EM.shocks[i];
    w.life -= dt;
    const k = 1 - Math.max(0, w.life / w.maxLife);
    w.radius = w.maxRadius * k;
    for (const u of EM.units) {
      if (!u.alive || u.faction === w.faction || w.hit.has(u.id)) continue;
      if (distXZ(u.pos, w.pos.x, w.pos.z) <= w.radius) {
        w.hit.add(u.id);
        dealDamage(u, w.damage, w.color);
        if (w.slow && u.alive) EM.slowUnit(u, w.slow.factor, w.slow.duration);
      }
    }
    for (const b of EM.structures) {
      if (!b.alive || b.faction === w.faction || w.hit.has(b.id)) continue;
      if (distXZ(b.pos, w.pos.x, w.pos.z) - structRadius(b.kind) <= w.radius) {
        w.hit.add(b.id);
        dealDamage(b, w.damage, w.color);
      }
    }
    for (const tr of EM.trees) {
      if (!tr.alive || w.hit.has(tr.id)) continue;
      if (distXZ(tr.pos, w.pos.x, w.pos.z) - tr.radius <= w.radius) {
        w.hit.add(tr.id);
        EM.damageTree(tr, w.damage);
      }
    }
    if (w.life <= 0) EM.shocks.splice(i, 1);
  }
}

const _cone = new THREE.Vector3();

/**
 * Instant melee strike: damage every hostile entity inside a short forward cone
 * (reach + half-angle) around `origin`, once per call. Used by the hero's melee
 * swings so close-quarters weapons hit at true melee range instead of launching
 * a travelling projectile. Trees in the cone are chopped too.
 */
export function meleeConeHit(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  reach: number,
  halfAngle: number,
  damage: number,
  faction: Faction,
  color: string,
): void {
  const cos = Math.cos(halfAngle);
  const inCone = (px: number, pz: number, radius: number): boolean => {
    _cone.set(px - origin.x, 0, pz - origin.z);
    const d = _cone.length();
    if (d > reach + radius) return false;
    if (d <= 1e-3) return true;
    _cone.multiplyScalar(1 / d);
    return _cone.x * dir.x + _cone.z * dir.z >= cos;
  };
  for (const u of EM.units) {
    if (!u.alive || u.faction === faction) continue;
    if (inCone(u.pos.x, u.pos.z, 0.9 * u.def.scale)) dealDamage(u, damage, color);
  }
  for (const b of EM.structures) {
    if (!b.alive || b.faction === faction) continue;
    if (inCone(b.pos.x, b.pos.z, structRadius(b.kind))) dealDamage(b, damage, color);
  }
  for (const tr of EM.trees) {
    if (!tr.alive) continue;
    if (inCone(tr.pos.x, tr.pos.z, tr.radius)) EM.damageTree(tr, damage);
  }
}
