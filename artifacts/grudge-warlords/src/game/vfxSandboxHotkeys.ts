/**
 * Fantasy VFX Sandbox hotkeys (vfxgrudge.puter.site) → Warlord combat VFX.
 *
 * Sandbox primary keys (from the Effect Library hotkey panel):
 *   V = Ice Serpent / ice-lightning burst
 *   B = Moon Beam
 *   F = Frost Wave
 *   G = Aura Ring (fire aura)
 *   T = Earth Surge (ground frost/shock)
 *   C = Fireball
 *
 * In Warlords /play, bare C/G already drive dash/slam — so production deploy
 * uses **Alt + key** (mirrors the world sandbox Alt+hotkey pattern). Hold Alt
 * and press V/B/F/G/T/C to fire the catalog effect from the hero.
 */

import * as THREE from "three";
import { EM } from "./entities";

export type VfxSandboxKey = "V" | "B" | "F" | "G" | "T" | "C";

export interface VfxHotkeyBinding {
  key: VfxSandboxKey;
  code: string;
  /** Sandbox panel label */
  label: string;
  /** Catalog effect id (vfxEffectCatalog / fleet ONE TRUTH) */
  effectId: string;
  /** Weapon-skill archetypes that should inherit this VFX when casting. */
  weaponSkillTags: string[];
  color: string;
  secondary?: string;
}

/** Canonical V/B/F/G/T/C map from https://vfxgrudge.puter.site/ */
export const VFX_HOTKEYS: VfxHotkeyBinding[] = [
  {
    key: "V",
    code: "KeyV",
    label: "Ice Serpent",
    effectId: "ice_lightning_burst",
    weaponSkillTags: ["frost", "ice", "serpent", "nova"],
    color: "#4f7bff",
    secondary: "#c9fbff",
  },
  {
    key: "B",
    code: "KeyB",
    label: "Moon Beam",
    effectId: "moon_beam",
    weaponSkillTags: ["holy", "beam", "light", "divine"],
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
    weaponSkillTags: ["aura", "buff", "ring", "flame body"],
    color: "#ff3b00",
    secondary: "#fff1b8",
  },
  {
    key: "T",
    code: "KeyT",
    label: "Earth Surge",
    effectId: "frost_wave",
    weaponSkillTags: ["earth", "surge", "quake", "ground"],
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

/**
 * Deploy a sandbox-style effect at the hero (caster) or slightly ahead of aim.
 * Uses the existing EM particle API so it always renders without extra loaders.
 */
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
    case "ice_lightning_burst": {
      EM.addFireBurst(at, binding.color, 8, 0.7);
      EM.addImpact(ahead);
      for (let i = 0; i < 12; i++) {
        EM.addEmber(at, i % 2 ? binding.color : binding.secondary ?? binding.color);
      }
      EM.addShake(0.08);
      break;
    }
    case "moon_beam": {
      EM.addFireBurst(ahead, binding.color, 6, 0.9);
      EM.addImpact(ahead);
      EM.addSmoke(ahead, 0.6);
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
    case "fire_aura": {
      EM.addFireBurst(origin.clone().setY(origin.y + 0.3), binding.color, 10, 0.65);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const p = origin.clone().add(new THREE.Vector3(Math.cos(a) * 1.4, 0.4, Math.sin(a) * 1.4));
        EM.addFire(p, binding.color, 0.35);
      }
      break;
    }
    default: {
      EM.addFireBurst(at, binding.color, 4, 0.5);
      EM.addImpact(at);
    }
  }

}

/** Map a weapon skill name/id to a sandbox effect for production casts. */
export function effectIdForWeaponSkill(skillIdOrName: string): string | null {
  const k = skillIdOrName.toLowerCase();
  for (const b of VFX_HOTKEYS) {
    if (b.weaponSkillTags.some((t) => k.includes(t))) return b.effectId;
  }
  if (/slash|cleave|blade/.test(k)) return "getsuga_slash";
  if (/fire|bolt|ball/.test(k)) return "fireball";
  if (/frost|ice|cold/.test(k)) return "ice_lightning_burst";
  if (/holy|heal|light|beam/.test(k)) return "moon_beam";
  if (/wave|slam|quake|shock/.test(k)) return "frost_wave";
  if (/aura|buff|ring/.test(k)) return "fire_aura";
  return null;
}
