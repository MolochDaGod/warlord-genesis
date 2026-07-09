import * as THREE from "three";
import { EM } from "./entities";
import { heroDealDamage, isAttackable, isUnit, meleeConeHit, structRadius } from "./combat";
import type { WarlordWeaponSkill } from "./warlordWeaponSkills";
import type { ApiWeaponId } from "@workspace/game-content";

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();

const RANGED_API: Set<ApiWeaponId> = new Set(["BOW", "CROSSBOW", "GUN"]);

/** Apply weapon-skill damage along the camera aim vector (crosshair-centered). */
export function applyWeaponSkillHit(
  skill: WarlordWeaponSkill,
  cameraPos: THREE.Vector3,
  cameraDir: THREE.Vector3,
  apiWeapon: ApiWeaponId,
  damageMult: number,
): void {
  const dmg = skill.damage * damageMult * EM.factionDmgMult("ally");
  _dir.copy(cameraDir).normalize();
  _origin.copy(cameraPos);

  const ranged = RANGED_API.has(apiWeapon);
  const reach = ranged ? 42 : 5.5;
  const halfAngle = ranged ? 0.08 : 1.05;

  if (!ranged) {
    const feet = new THREE.Vector3(EM.playerPos.x, EM.playerPos.y + 1, EM.playerPos.z);
    meleeConeHit(feet, _dir, reach, halfAngle, dmg, "ally", "#ffd080", true);
    EM.addShake(skill.damage > 40 ? 0.12 : 0.06);
    return;
  }

  let bestDist = reach;
  const scan = (pos: THREE.Vector3, radius: number) => {
    _hit.copy(pos).sub(_origin);
    const proj = _hit.dot(_dir);
    if (proj < 0.2 || proj > bestDist) return;
    _hit.copy(_origin).addScaledVector(_dir, proj);
    if (_hit.distanceTo(pos) <= radius) bestDist = proj;
  };

  for (const u of EM.units) {
    if (!u.alive || (u.faction !== "enemy" && u.faction !== "neutral")) continue;
    scan(u.pos, 0.95 * u.def.scale);
  }
  for (const s of EM.structures) {
    if (!s.alive || s.faction !== "enemy" || !isAttackable(s)) continue;
    scan(s.pos, structRadius(s.kind));
  }

  const impact = _origin.clone().addScaledVector(_dir, bestDist);
  EM.addMuzzleFlash(impact);
  for (const u of EM.units) {
    if (!u.alive || (u.faction !== "enemy" && u.faction !== "neutral")) continue;
    if (u.pos.distanceTo(impact) > 2.2) continue;
    heroDealDamage(u, dmg);
  }
  for (const s of EM.structures) {
    if (!s.alive || s.faction !== "enemy" || !isAttackable(s)) continue;
    if (s.pos.distanceTo(impact) > structRadius(s.kind) + 1) continue;
    heroDealDamage(s, dmg);
  }

  if (skill.damage >= 55) {
    EM.addShockwave({
      pos: impact.clone().setY(0.12),
      maxRadius: 7,
      duration: 0.45,
      damage: dmg * 0.35,
      color: "#8fd8ff",
      faction: "ally",
    });
  }
}