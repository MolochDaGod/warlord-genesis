/**
 * Shared hero verbs — dash, slam, weapon-skill hit.
 * Player and AI warlords both call these. No AI-only skills.
 */
import * as THREE from "three";
import { ABILITIES, DASH, SLAM, type Faction } from "./config";
import { EM } from "./entities";
import { applyWeaponSkillHit } from "./weaponSkillCombat";
import type { WarlordWeaponSkill } from "./warlordWeaponSkills";
import type { ApiWeaponId } from "@workspace/game-content";
import { useGame } from "./store";

const _tmp = new THREE.Vector3();

export function performHeroSlam(opts: {
  x: number;
  y: number;
  z: number;
  faction: Faction;
  damageMult: number;
  slamDamageMult?: number;
}): number {
  const slamMult = opts.slamDamageMult ?? 1;
  const dmg = SLAM.shockDamage * opts.damageMult * slamMult * EM.factionDmgMult(opts.faction);
  _tmp.set(opts.x, 0.1, opts.z);
  EM.addShockwave({
    pos: _tmp.clone(),
    maxRadius: SLAM.shockRadius,
    duration: SLAM.shockDuration,
    damage: dmg,
    color: ABILITIES.slam.color,
    faction: opts.faction,
  });
  EM.addMuzzleFlash(new THREE.Vector3(opts.x, 0.5, opts.z));
  for (let k = 0; k < 16; k++) {
    EM.addEmber(new THREE.Vector3(opts.x, 0.3, opts.z), ABILITIES.slam.color);
  }
  if (opts.faction === "enemy") {
    const g = useGame.getState();
    const pd = Math.hypot(EM.playerPos.x - opts.x, EM.playerPos.z - opts.z);
    if (!g.heroDead && pd <= SLAM.shockRadius) {
      g.damagePlayer(dmg);
      EM.addSpark(EM.playerPos.clone().setY(1.2), ABILITIES.slam.color);
    }
  }
  return dmg;
}

export function performHeroDashVfx(x: number, z: number): void {
  const o = new THREE.Vector3(x, 0.4, z);
  for (let k = 0; k < 8; k++) EM.addEmber(o.clone(), ABILITIES.dash.color);
}

export const HERO_DASH = DASH;

export function performHeroWeaponSkill(opts: {
  skill: WarlordWeaponSkill;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  apiWeapon: ApiWeaponId;
  damageMult: number;
  faction: Faction;
}): void {
  applyWeaponSkillHit(opts.skill, opts.origin, opts.dir, opts.apiWeapon, opts.damageMult, {
    faction: opts.faction,
    casterPos: opts.origin,
  });
}
