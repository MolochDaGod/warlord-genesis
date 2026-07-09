import type { ApiWeaponId, PrefabCharacter } from "@workspace/game-content";
import { PREFAB_BY_ID, prefabLoadout } from "@workspace/game-content";
import { MELEE_WEAPONS_CFG, RANGED_WEAPONS, type MeleeWeaponId, type RangedWeaponId } from "./config";

export interface CanonicalWeaponPair {
  melee: MeleeWeaponId;
  ranged: RangedWeaponId;
}

const DEFAULT_PAIR: CanonicalWeaponPair = { melee: "swordshield", ranged: "rifle" };

const RANGED_API: ApiWeaponId[] = ["BOW", "GUN", "CROSSBOW"];
const CASTER_API: ApiWeaponId[] = ["STAFF", "WAND"];

function meleeFromApi(api: ApiWeaponId): MeleeWeaponId {
  switch (api) {
    case "SWORD":
      return "swordshield";
    case "HAMMER":
    case "MACE":
      return "warhammer";
    case "GREATSWORD":
    case "GREATAXE":
    case "AXE":
      return "greatsword";
    case "DAGGER":
      return "knife";
    case "SCYTHE":
      return "barehands"; // maps to SCYTHE API skills in combat (warlordWeaponSkills)
    default:
      return "swordshield";
  }
}

function rangedFromApi(api: ApiWeaponId): RangedWeaponId {
  switch (api) {
    case "BOW":
      return "bow";
    case "GUN":
    case "CROSSBOW":
      return "rifle";
    case "STAFF":
    case "WAND":
      return "rifle";
    default:
      return "pistol";
  }
}

/** Lobby melee/ranged pair derived from the prefab's canonical API loadout. */
export function canonicalWeaponsForPrefab(prefabId: string): CanonicalWeaponPair {
  const p = PREFAB_BY_ID[prefabId];
  if (!p) return DEFAULT_PAIR;
  const lo = prefabLoadout(p);
  if (lo.apiWeapon === "SCYTHE") {
    return { melee: "barehands", ranged: "rifle" };
  }
  if (RANGED_API.includes(lo.apiWeapon)) {
    return { melee: "knife", ranged: rangedFromApi(lo.apiWeapon) };
  }
  if (CASTER_API.includes(lo.apiWeapon)) {
    return { melee: "knife", ranged: "rifle" };
  }
  return { melee: meleeFromApi(lo.apiWeapon), ranged: rangedFromApi(lo.apiWeapon) };
}

export function canonicalWeaponsForCharacter(p: PrefabCharacter): CanonicalWeaponPair {
  return canonicalWeaponsForPrefab(p.id);
}

/** Primary API weapon for combat skill hotbar (ignores secondary carry). */
export function canonicalApiWeaponForPrefab(prefabId: string): ApiWeaponId | null {
  return PREFAB_BY_ID[prefabId]?.apiWeapon ?? null;
}

/** Lobby label for melee slot (barehands → Scythe when API weapon is SCYTHE). */
export function meleeDisplayName(prefabId: string, meleeId: MeleeWeaponId): string {
  if (meleeId === "barehands" && canonicalApiWeaponForPrefab(prefabId) === "SCYTHE") {
    return "Scythe";
  }
  return MELEE_WEAPONS_CFG[meleeId]?.name ?? meleeId;
}

export function rangedDisplayName(rangedId: RangedWeaponId): string {
  return RANGED_WEAPONS[rangedId]?.name ?? rangedId;
}