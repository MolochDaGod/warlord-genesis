/**
 * Production specialization skills — cooldowns, heals, slows, power shots.
 */

import { AI_DEFEND } from "./config";
import { EM, type UnitEntity } from "./entities";
import { isUnit, distXZ } from "./combat";
import type { UnitSkillId } from "./productionSpecs";

export type { UnitSkillId };

const SKILL_CD: Record<UnitSkillId, number> = {
  powerShot: 3,
  healPulse: 4,
  frostSlow: 0,
  fireBurst: 5,
  defendWarlord: 0,
  charge: 6,
  auraHeal: 5,
};

function cdReady(u: UnitEntity, skill: UnitSkillId): boolean {
  return (u.skillCd[skill] ?? 0) <= 0;
}

function startCd(u: UnitEntity, skill: UnitSkillId) {
  u.skillCd[skill] = SKILL_CD[skill];
}

export function tickUnitSkills(u: UnitEntity, dt: number, heroAlive: boolean) {
  for (const k of Object.keys(u.skillCd) as UnitSkillId[]) {
    if (u.skillCd[k]! > 0) u.skillCd[k] = Math.max(0, u.skillCd[k]! - dt);
  }
  if (!u.alive || u.faction !== "ally") return;

  if (u.skills.includes("healPulse") && cdReady(u, "healPulse")) {
    let healed = false;
    for (const ally of EM.units) {
      if (!ally.alive || ally.faction !== "ally") continue;
      if (distXZ(u.pos, ally.pos.x, ally.pos.z) > 7) continue;
      const missing = ally.maxHp - ally.hp;
      if (missing < 4) continue;
      const amt = Math.min(missing, Math.round(ally.maxHp * 0.08));
      ally.hp += amt;
      EM.addFloatText(ally.pos.x, 1.8, ally.pos.z, `+${amt}`, "#8effa0");
      healed = true;
    }
    if (healed) startCd(u, "healPulse");
  }

  if (u.skills.includes("auraHeal") && cdReady(u, "auraHeal")) {
    for (const ally of EM.units) {
      if (!ally.alive || ally.faction !== "ally") continue;
      if (distXZ(u.pos, ally.pos.x, ally.pos.z) > 5) continue;
      ally.hp = Math.min(ally.maxHp, ally.hp + Math.round(ally.maxHp * 0.04));
    }
    startCd(u, "auraHeal");
  }

}

/** Modify outgoing attack for skill procs; returns damage multiplier. */
export function trySkillOnAttack(
  u: UnitEntity,
  baseDmg: number,
  target: import("./combat").CombatEntity | null,
): number {
  let dmg = baseDmg;

  if (u.skills.includes("charge") && cdReady(u, "charge") && u.locomotion === "run") {
    startCd(u, "charge");
    EM.addSpark(u.pos.clone().setY(0.8), "#ffb066");
  }

  if (u.skills.includes("powerShot") && cdReady(u, "powerShot")) {
    dmg *= 2.6;
    startCd(u, "powerShot");
    EM.addSpark(u.pos.clone().setY(1.2), "#ffe08a");
  }

  if (u.skills.includes("fireBurst") && cdReady(u, "fireBurst")) {
    dmg *= 1.85;
    startCd(u, "fireBurst");
    if (target && isUnit(target)) {
      EM.addProjectile("fire", u.pos.clone().setY(1.1), target.pos.clone().setY(1), {
        faction: u.faction,
        splashDamage: dmg * 0.4,
      });
    }
  }

  if (u.skills.includes("frostSlow") && target && isUnit(target)) {
    target.slowTimer = 2.2;
    target.slowFactor = 0.55;
  }

  return dmg;
}

/** True when allies should peel to defend the warlord. */
export function heroNeedsDefense(heroAlive: boolean): boolean {
  if (!heroAlive) return false;
  for (const e of EM.units) {
    if (!e.alive || e.faction !== "enemy" || e.isHero) continue;
    if (distXZ(e.pos, EM.playerPos.x, EM.playerPos.z) <= AI_DEFEND.threatRadius) return true;
  }
  return false;
}

/** Nearest enemy threatening the hero within range. */
export function threatNearHero(u: UnitEntity, range: number) {
  let best: import("./combat").CombatEntity | null = null;
  let bestD = Infinity;
  for (const e of EM.units) {
    if (!e.alive || e.faction === u.faction || e.isHero) continue;
    const dHero = distXZ(e.pos, EM.playerPos.x, EM.playerPos.z);
    if (dHero > AI_DEFEND.threatRadius) continue;
    const d = distXZ(u.pos, e.pos.x, e.pos.z);
    if (d <= range && d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}