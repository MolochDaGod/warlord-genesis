// ── Per-API-weapon locomotion (Mixamo / baked stance families) ───────────────
//
// /world resolves idle / walk / run / sprint from the EQUIPPED weapon type, not
// only the class loadout animPack. Walk + run use weapon-appropriate Mixamo clips
// (catalog bake targets) instead of generic locomotion/walking while holding a
// sword or rifle.

import type { ApiWeaponId } from "./apiWeaponMatrix";
import { ANIM_BY_KEY } from "./animations";
import {
  type AnimPackId,
  type LocoBand,
  type LocoBakedSet,
  locoBakedForPack,
} from "./animDefaults";

function bakedOr(key: string, fallback: string): string {
  return ANIM_BY_KEY[key]?.baked ?? fallback;
}

export interface ApiWeaponLocoProfile extends LocoBakedSet {
  /** Omni / gait resolver pack id (feeds resolveOmniLocoBaked fallback). */
  omniPack: AnimPackId;
  /** Stable attack anim key for light-attack fallback. */
  attackKey: string;
}

/** Mixamo-forward walk/run per weapon family (catalog paths under /anims/baked). */
const LOCO = {
  venom: {
    idle: bakedOr("venom_idle", "venom/idle"),
    walk: bakedOr("venom_walk", "venom/walk-forward"),
    run: bakedOr("venom_run", "venom/run-forward"),
    sprint: bakedOr("venom_run", "venom/run-forward"),
  },
  sword1h: {
    idle: bakedOr("idle_shield", "sword_shield/sword and shield idle"),
    walk: bakedOr("venom_walk", "longbow/standing walk forward"),
    run: bakedOr("run", "sword_shield/sword and shield run"),
    sprint: bakedOr("sprint", "sword_shield/sword and shield run"),
  },
  sword2h: {
    idle: bakedOr("gs_idle", "sword/great sword idle"),
    walk: bakedOr("gs_walk", "sword/great sword walk"),
    run: bakedOr("gs_run", "sword/great sword run"),
    sprint: bakedOr("gs_run", "sword/great sword run"),
  },
  axe: {
    idle: bakedOr("axe_idle_loco", "axe/idle"),
    walk: bakedOr("axe_walk_loco", "axe/walk"),
    run: bakedOr("venom_run", "locomotion/running"),
    sprint: bakedOr("sprint", "uploads_2026_06/locomotion/running"),
  },
  club: {
    idle: bakedOr("idle_shield", "sword_shield/sword and shield idle"),
    walk: bakedOr("venom_walk", "locomotion/walking"),
    run: bakedOr("run", "locomotion/running"),
    sprint: bakedOr("sprint", "uploads_2026_06/locomotion/running"),
  },
  spear: {
    idle: bakedOr("gs_idle", "sword/great sword idle"),
    walk: bakedOr("gs_walk", "sword/great sword walk"),
    run: bakedOr("gs_run", "sword/great sword run"),
    sprint: bakedOr("gs_run", "sword/great sword run"),
  },
  bow: {
    idle: bakedOr("bow_idle", "longbow/standing idle 01"),
    walk: bakedOr("bow_walk_fwd", "longbow/standing walk forward"),
    run: bakedOr("bow_run", "longbow/standing run forward"),
    sprint: bakedOr("bow_run", "longbow/standing run forward"),
  },
  crossbow: {
    idle: bakedOr("bow_idle", "longbow/standing idle 01"),
    walk: bakedOr("bow_aim_walk_fwd", "longbow/standing aim walk forward"),
    run: bakedOr("bow_run", "longbow/standing run forward"),
    sprint: bakedOr("bow_run", "longbow/standing run forward"),
  },
  rifle: {
    idle: bakedOr("rifle_idle_loco", "rifle/idle"),
    walk: bakedOr("rifle_walk_fwd", "rifle/walk forward"),
    run: bakedOr("rifle_run_fwd", "rifle/run forward"),
    sprint: bakedOr("rifle_run_fwd", "rifle/run forward"),
  },
  magic: {
    idle: bakedOr("magic_idle", "magic/standing idle"),
    walk: bakedOr("magic_walk_fwd", "magic/Standing Walk Forward"),
    run: bakedOr("magic_run", "magic/Standing Run Forward"),
    sprint: bakedOr("magic_run", "magic/Standing Run Forward"),
  },
  dual: {
    idle: bakedOr("venom_idle", "unarmed/fight_idle"),
    walk: bakedOr("venom_walk", "venom/walk-forward"),
    run: bakedOr("venom_run", "venom/run-forward"),
    sprint: bakedOr("venom_run", "venom/run-forward"),
  },
} as const satisfies Record<string, LocoBakedSet>;

export const API_WEAPON_LOCO: Record<ApiWeaponId, ApiWeaponLocoProfile> = {
  SWORD: { ...LOCO.sword1h, omniPack: "sword_shield", attackKey: "sword_attack_a" },
  SHIELD: { ...LOCO.sword1h, omniPack: "sword_shield", attackKey: "shield_bash" },
  AXE: { ...LOCO.axe, omniPack: "sword_shield", attackKey: "sword_attack_c" },
  GREATAXE: { ...LOCO.axe, omniPack: "sword_shield", attackKey: "sword_attack_c" },
  GREATSWORD: { ...LOCO.sword2h, omniPack: "sword_shield", attackKey: "sword_attack_c" },
  HAMMER: { ...LOCO.club, omniPack: "sword_shield", attackKey: "sword_attack_c" },
  MACE: { ...LOCO.club, omniPack: "sword_shield", attackKey: "sword_attack_c" },
  SPEAR: { ...LOCO.spear, omniPack: "sword_shield", attackKey: "sword_attack_b" },
  DAGGER: { ...LOCO.dual, omniPack: "unarmed", attackKey: "sword_attack_a" },
  SCYTHE: { ...LOCO.venom, omniPack: "unarmed", attackKey: "venom_attack_a" },
  BOW: { ...LOCO.bow, omniPack: "longbow", attackKey: "bow_shot" },
  CROSSBOW: { ...LOCO.crossbow, omniPack: "longbow", attackKey: "bow_shot" },
  GUN: { ...LOCO.rifle, omniPack: "rifle", attackKey: "rifle_fire" },
  STAFF: { ...LOCO.magic, omniPack: "magic", attackKey: "magic_cast" },
  WAND: { ...LOCO.magic, omniPack: "magic", attackKey: "magic_cast" },
  TOME: { ...LOCO.magic, omniPack: "magic", attackKey: "magic_cast" },
};

/** Locomotion baked path for an API weapon type + gait band. */
export function locoBakedForApiWeapon(
  apiId: string | null | undefined,
  band: LocoBand,
  fallbackPack: AnimPackId = "unarmed",
): string {
  if (!apiId) return locoBakedForPack(fallbackPack, band);
  const prof = API_WEAPON_LOCO[apiId.toUpperCase() as ApiWeaponId];
  return prof?.[band] ?? locoBakedForPack(fallbackPack, band);
}

/** Full locomotion set + omni pack for an equipped API weapon. */
export function locoProfileForApiWeapon(
  apiId: string | null | undefined,
  fallbackPack: AnimPackId = "unarmed",
): ApiWeaponLocoProfile & { bands: LocoBakedSet } {
  const up = apiId?.toUpperCase() as ApiWeaponId | undefined;
  const prof = up ? API_WEAPON_LOCO[up] : undefined;
  if (prof) {
    return {
      ...prof,
      bands: {
        idle: prof.idle,
        walk: prof.walk,
        run: prof.run,
        sprint: prof.sprint,
      },
    };
  }
  return {
    omniPack: fallbackPack,
    attackKey: "unarmed_hook",
    bands: {
      idle: locoBakedForPack(fallbackPack, "idle"),
      walk: locoBakedForPack(fallbackPack, "walk"),
      run: locoBakedForPack(fallbackPack, "run"),
      sprint: locoBakedForPack(fallbackPack, "sprint"),
    },
    idle: locoBakedForPack(fallbackPack, "idle"),
    walk: locoBakedForPack(fallbackPack, "walk"),
    run: locoBakedForPack(fallbackPack, "run"),
    sprint: locoBakedForPack(fallbackPack, "sprint"),
  };
}