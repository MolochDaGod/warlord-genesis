import * as THREE from "three";
import { EM } from "./entities";
import { dealDamage, heroDealDamage, isAttackable, meleeConeHit, structRadius } from "./combat";
import type { WarlordWeaponSkill } from "./warlordWeaponSkills";
import type { ApiWeaponId } from "@workspace/game-content";
import { deploySandboxVfx, effectIdForWeaponSkill, VFX_HOTKEYS } from "./vfxSandboxHotkeys";
import type { Faction } from "./config";
import { useGame } from "./store";

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();

const RANGED_API: Set<ApiWeaponId> = new Set(["BOW", "CROSSBOW", "GUN"]);

export interface SkillHitOpts {
  faction?: Faction;
  casterPos?: THREE.Vector3;
}

function isHostileFaction(caster: Faction, other: Faction): boolean {
  if (other === caster) return false;
  return true;
}

/** Apply weapon-skill damage along an aim vector. Player and AI both use this. */
export function applyWeaponSkillHit(
  skill: WarlordWeaponSkill,
  cameraPos: THREE.Vector3,
  cameraDir: THREE.Vector3,
  apiWeapon: ApiWeaponId,
  damageMult: number,
  opts?: SkillHitOpts,
): void {
  const faction: Faction = opts?.faction ?? "ally";
  const caster = opts?.casterPos ?? EM.playerPos;
  const dmg = skill.damage * damageMult * EM.factionDmgMult(faction);
  _dir.copy(cameraDir).normalize();
  _origin.copy(cameraPos);

  const effectId =
    effectIdForWeaponSkill(skill.id ?? "") ||
    effectIdForWeaponSkill(skill.label ?? "");
  if (effectId) {
    const bind =
      VFX_HOTKEYS.find((b) => b.effectId === effectId) ??
      VFX_HOTKEYS.find((b) => b.key === "C")!;
    const feet = new THREE.Vector3(caster.x, caster.y + 1.1, caster.z);
    deploySandboxVfx({ ...bind, effectId }, feet, _dir);
  }

  const ranged = RANGED_API.has(apiWeapon);
  const reach = ranged ? 42 : 5.5;
  const halfAngle = ranged ? 0.08 : 1.05;
  const strike = (targetDmg: number, unit: Parameters<typeof dealDamage>[0]) => {
    if (faction === "ally") heroDealDamage(unit, targetDmg);
    else dealDamage(unit, targetDmg);
  };

  if (!ranged) {
    const feet = new THREE.Vector3(caster.x, caster.y + 1, caster.z);
    meleeConeHit(feet, _dir, reach, halfAngle, dmg, faction, "#ffd080", faction === "ally");
    if (faction === "enemy") {
      const g = useGame.getState();
      if (!g.heroDead) {
        const pdx = EM.playerPos.x - feet.x;
        const pdz = EM.playerPos.z - feet.z;
        const pd = Math.hypot(pdx, pdz);
        if (pd <= reach + 1) {
          const cosA = pd <= 1e-3 ? 1 : (pdx / pd) * _dir.x + (pdz / pd) * _dir.z;
          if (cosA >= Math.cos(halfAngle)) {
            g.damagePlayer(dmg);
            EM.addSpark(EM.playerPos.clone().setY(1.2), "#ffd080");
          }
        }
      }
    } else {
      EM.addShake(skill.damage > 40 ? 0.12 : 0.06);
    }
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
    if (!u.alive || !isHostileFaction(faction, u.faction)) continue;
    scan(u.pos, 0.95 * u.def.scale);
  }
  for (const s of EM.structures) {
    if (!s.alive || s.faction === faction || !isAttackable(s)) continue;
    scan(s.pos, structRadius(s.kind));
  }
  if (faction === "enemy") scan(EM.playerPos, 0.9);

  const impact = _origin.clone().addScaledVector(_dir, bestDist);
  EM.addMuzzleFlash(impact);
  for (const u of EM.units) {
    if (!u.alive || !isHostileFaction(faction, u.faction)) continue;
    if (u.pos.distanceTo(impact) > 2.2) continue;
    strike(dmg, u);
  }
  for (const s of EM.structures) {
    if (!s.alive || s.faction === faction || !isAttackable(s)) continue;
    if (s.pos.distanceTo(impact) > structRadius(s.kind) + 1) continue;
    strike(dmg, s);
  }
  if (faction === "enemy") {
    const g = useGame.getState();
    if (!g.heroDead && EM.playerPos.distanceTo(impact) <= 2.4) {
      g.damagePlayer(dmg);
    }
  }

  if (skill.damage >= 55) {
    EM.addShockwave({
      pos: impact.clone().setY(0.12),
      maxRadius: 7,
      duration: 0.45,
      damage: dmg * 0.35,
      color: "#8fd8ff",
      faction,
    });
  }
}
