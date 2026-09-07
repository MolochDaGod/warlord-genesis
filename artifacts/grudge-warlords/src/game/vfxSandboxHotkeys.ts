/**
 * Fantasy VFX → Warlord combat. Catalog effects ride weapon-skill casts
 * (blend from AnimationDirector) plus Alt+hotkeys for sandbox fire.
 *
 * Unique hero reads: charge / crown / kraken / earthbend / shadow clone / multi-shot
 */

import * as THREE from "three";
import { EM } from "./entities";

export type VfxSandboxKey = "V" | "B" | "F" | "G" | "T" | "C";

export interface VfxHotkeyBinding {
  key: VfxSandboxKey;
  code: string;
  label: string;
  effectId: string;
  weaponSkillTags: string[];
  color: string;
  secondary?: string;
}

export const VFX_HOTKEYS: VfxHotkeyBinding[] = [
  {
    key: "V",
    code: "KeyV",
    label: "Ice Serpent",
    effectId: "ice_lightning_burst",
    weaponSkillTags: ["frost", "ice", "serpent", "nova", "kraken"],
    color: "#4f7bff",
    secondary: "#c9fbff",
  },
  {
    key: "B",
    code: "KeyB",
    label: "Moon Beam",
    effectId: "moon_beam",
    weaponSkillTags: ["holy", "beam", "light", "divine", "crown"],
    color: "#e8f4ff",
    secondary: "#a8d4ff",
  },
  {
    key: "F",
    code: "KeyF",
    label: "Frost Wave",
    effectId: "frost_wave",
    weaponSkillTags: ["wave", "frost", "shockwave", "slam"],
    color: "#5fd6ff",
    secondary: "#c9fbff",
  },
  {
    key: "G",
    code: "KeyG",
    label: "Aura Ring",
    effectId: "fire_aura",
    weaponSkillTags: ["aura", "buff", "ring", "flame body", "charge"],
    color: "#ff3b00",
    secondary: "#fff1b8",
  },
  {
    key: "T",
    code: "KeyT",
    label: "Earth Surge",
    effectId: "earth_bend",
    weaponSkillTags: ["earth", "surge", "quake", "ground", "bend", "stone"],
    color: "#c4a574",
    secondary: "#8b7355",
  },
  {
    key: "C",
    code: "KeyC",
    label: "Fireball",
    effectId: "fireball",
    weaponSkillTags: ["fireball", "bolt", "projectile", "mage"],
    color: "#ff5a1e",
    secondary: "#fff3b0",
  },
];

const byCode = new Map(VFX_HOTKEYS.map((b) => [b.code, b]));

export function vfxHotkeyByCode(code: string): VfxHotkeyBinding | undefined {
  return byCode.get(code);
}

function ringEmbers(origin: THREE.Vector3, color: string, n: number, radius: number, y = 0.4): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = origin.clone().add(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
    EM.addFire(p, color, 0.32);
  }
}

export function deploySandboxVfx(
  binding: VfxHotkeyBinding,
  origin: THREE.Vector3,
  forward: THREE.Vector3,
): void {
  const dir = forward.clone();
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();

  const at = origin.clone().addScaledVector(dir, 1.1);
  at.y = origin.y + 0.2;
  const ahead = origin.clone().addScaledVector(dir, 4.5);
  ahead.y = origin.y + 0.4;

  switch (binding.effectId) {
    case "fireball": {
      EM.addFireBurst(at, binding.color, 5, 0.55);
      EM.addSlashWave({
        origin: at,
        dir,
        range: 9,
        speed: 18,
        width: 0.9,
        damage: 0,
        color: binding.color,
        faction: "ally",
        spawnShock: true,
        shockRadius: 1.4,
        shockDamage: 0,
        shockDuration: 0.25,
      });
      EM.addSmoke(ahead, 0.45);
      break;
    }
    case "ice_lightning_burst":
    case "kraken": {
      EM.addFireBurst(at, binding.color, 8, 0.7);
      EM.addImpact(ahead);
      for (let i = 0; i < 14; i++) {
        EM.addEmber(at, i % 2 ? binding.color : binding.secondary ?? binding.color);
      }
      const left = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.55);
      const right = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.55);
      for (const d of [dir, left, right]) {
        EM.addSlashWave({
          origin: at,
          dir: d,
          range: 6.5,
          speed: 12,
          width: 0.7,
          damage: 0,
          color: binding.secondary ?? binding.color,
          faction: "ally",
          spawnShock: false,
          shockRadius: 0,
          shockDamage: 0,
          shockDuration: 0,
        });
      }
      EM.addShake(0.1);
      break;
    }
    case "moon_beam":
    case "crown": {
      EM.addFireBurst(origin.clone().setY(origin.y + 1.6), binding.color, 7, 0.85);
      ringEmbers(origin, binding.secondary ?? binding.color, 12, 0.55, 1.7);
      EM.addImpact(ahead);
      EM.addSmoke(ahead, 0.45);
      break;
    }
    case "frost_wave": {
      EM.addSlashWave({
        origin: at,
        dir,
        range: 7,
        speed: 14,
        width: 2.4,
        damage: 0,
        color: binding.color,
        faction: "ally",
        spawnShock: true,
        shockRadius: 2.8,
        shockDamage: 0,
        shockDuration: 0.35,
      });
      EM.addFireBurst(at, binding.secondary ?? binding.color, 4, 0.4);
      EM.addShake(0.06);
      break;
    }
    case "earth_bend": {
      EM.addShockwave({
        pos: origin.clone().setY(0.12),
        maxRadius: 6.5,
        duration: 0.5,
        damage: 0,
        color: binding.color,
        faction: "ally",
      });
      EM.addSlashWave({
        origin: at,
        dir,
        range: 8,
        speed: 11,
        width: 2.8,
        damage: 0,
        color: binding.color,
        faction: "ally",
        spawnShock: true,
        shockRadius: 3.2,
        shockDamage: 0,
        shockDuration: 0.4,
      });
      EM.addShake(0.14);
      break;
    }
    case "fire_aura":
    case "charge": {
      EM.addFireBurst(origin.clone().setY(origin.y + 0.3), binding.color, 10, 0.65);
      ringEmbers(origin, binding.color, 16, 1.4, 0.4);
      EM.addSlashWave({
        origin: at,
        dir,
        range: 5,
        speed: 22,
        width: 1.1,
        damage: 0,
        color: binding.secondary ?? binding.color,
        faction: "ally",
        spawnShock: true,
        shockRadius: 1.2,
        shockDamage: 0,
        shockDuration: 0.2,
      });
      break;
    }
    case "shadow_clone": {
      const offsets = [-1.6, 0, 1.6];
      for (const o of offsets) {
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(o);
        const p = origin.clone().add(side);
        p.y = origin.y + 0.2;
        EM.addSmoke(p, 0.7);
        EM.addFireBurst(p, "#2a2438", 4, 0.35);
        EM.addSlashWave({
          origin: p,
          dir,
          range: 7,
          speed: 16,
          width: 0.55,
          damage: 0,
          color: "#6b5b95",
          faction: "ally",
          spawnShock: false,
          shockRadius: 0,
          shockDamage: 0,
          shockDuration: 0,
        });
      }
      break;
    }
    case "multi_shot": {
      const spreads = [-0.22, -0.08, 0.08, 0.22];
      for (const ang of spreads) {
        const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
        EM.addSlashWave({
          origin: at,
          dir: d,
          range: 14,
          speed: 24,
          width: 0.35,
          damage: 0,
          color: binding.color,
          faction: "ally",
          spawnShock: false,
          shockRadius: 0,
          shockDamage: 0,
          shockDuration: 0,
        });
      }
      EM.addMuzzleFlash(at);
      break;
    }
    case "getsuga_slash": {
      EM.addSlashWave({
        origin: at,
        dir,
        range: 8,
        speed: 16,
        width: 1.4,
        damage: 0,
        color: "#ffd080",
        faction: "ally",
        spawnShock: true,
        shockRadius: 1.6,
        shockDamage: 0,
        shockDuration: 0.22,
      });
      break;
    }
    default: {
      EM.addFireBurst(at, binding.color, 4, 0.5);
      EM.addImpact(at);
    }
  }
}

export function effectIdForWeaponSkill(skillIdOrName: string): string | null {
  const k = skillIdOrName.toLowerCase();
  for (const b of VFX_HOTKEYS) {
    if (b.weaponSkillTags.some((t) => k.includes(t))) return b.effectId;
  }
  if (/kraken|tentacle|whirl/.test(k)) return "kraken";
  if (/crown|halo|diadem|king/.test(k)) return "crown";
  if (/clone|shadow|mirror|afterimage/.test(k)) return "shadow_clone";
  if (/multi|volley|spread|barrage|fan/.test(k)) return "multi_shot";
  if (/charge|lunge|warstride|dash strike/.test(k)) return "charge";
  if (/earth|quake|stone|bend|upheaval/.test(k)) return "earth_bend";
  if (/slash|cleave|blade|getsuga/.test(k)) return "getsuga_slash";
  if (/fire|bolt|ball/.test(k)) return "fireball";
  if (/frost|ice|cold/.test(k)) return "ice_lightning_burst";
  if (/holy|heal|light|beam/.test(k)) return "moon_beam";
  if (/wave|slam|shock/.test(k)) return "frost_wave";
  if (/aura|buff|ring/.test(k)) return "fire_aura";
  return "getsuga_slash";
}
