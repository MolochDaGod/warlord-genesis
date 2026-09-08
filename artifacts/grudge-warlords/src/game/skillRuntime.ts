/**
 * Production specialization skills — cooldowns, heals, slows, power shots.
 */

import { AI_DEFEND, type Faction } from "./config";
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

export function tickUnitSkills(u: UnitEntity, dt: number, _heroAlive: boolean) {
  for (const k of Object.keys(u.skillCd) as UnitSkillId[]) {
    if (u.skillCd[k]! > 0) u.skillCd[k] = Math.max(0, u.skillCd[k]! - dt);
  }
  if (!u.alive || (u.faction !== "ally" && u.faction !== "enemy")) return;
  const fac = u.faction;

  if (u.skills.includes("healPulse") && cdReady(u, "healPulse")) {
    let healed = false;
    for (const ally of EM.units) {
      if (!ally.alive || ally.faction !== fac) continue;
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
      if (!ally.alive || ally.faction !== fac) continue;
      if (distXZ(u.pos, ally.pos.x, ally.pos.z) > 5) continue;
      ally.hp = Math.min(ally.maxHp, ally.hp + Math.round(ally.maxHp * 0.04));
    }
    startCd(u, "auraHeal");
  }
}

/** World position of this faction's warlord (player for ally, unit hero for enemy). */
export function factionHeroPos(faction: Faction): { x: number; z: number } | null {
  if (faction === "ally") return EM.playerPos;
  for (const u of EM.units) {
    if (u.alive && u.isHero && u.faction === "enemy") return u.pos;
  }
  return null;
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

/** True when this faction's warlord is threatened and nearby troops should peel. */
export function heroNeedsDefense(heroAlive: boolean, faction: Faction = "ally"): boolean {
  const hp = factionHeroPos(faction);
  if (!hp) return false;
  if (faction === "ally" && !heroAlive) return false;
  const foe: Faction = faction === "ally" ? "enemy" : "ally";
  for (const e of EM.units) {
    if (!e.alive || e.faction !== foe || e.isHero) continue;
    if (distXZ(e.pos, hp.x, hp.z) <= AI_DEFEND.threatRadius) return true;
  }
  if (faction === "enemy" && heroAlive) {
    if (Math.hypot(EM.playerPos.x - hp.x, EM.playerPos.z - hp.z) <= AI_DEFEND.threatRadius) return true;
  }
  return false;
}

/** Nearest foe threatening this unit's warlord, within `range` of the unit. */
export function threatNearHero(u: UnitEntity, range: number) {
  const hp = factionHeroPos(u.faction);
  if (!hp) return null;
  let best: import("./combat").CombatEntity | null = null;
  let bestD = Infinity;
  for (const e of EM.units) {
    if (!e.alive || e.faction === u.faction || e.isHero) continue;
    const dHero = distXZ(e.pos, hp.x, hp.z);
    if (dHero > AI_DEFEND.threatRadius) continue;
    const d = distXZ(u.pos, e.pos.x, e.pos.z);
    if (d <= range && d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}