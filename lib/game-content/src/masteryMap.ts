// ── Weapon type → mastery tree mapping ───────────────────────────────────────

import type { ApiWeaponId } from "./apiWeaponMatrix";
import type { MasteryTreeId } from "./mastery";
import type { WeaponType } from "./index";

export const WEAPON_TYPE_TO_MASTERY: Partial<Record<WeaponType, MasteryTreeId>> = {
  sword: "swords",
  axe: "axes",
  hammer: "hammers",
  bow: "bows",
  staff: "staffs",
  spear: "spears",
  dagger: "swords",
  mace: "hammers",
  shield: "swords",
  pick: "axes",
  fishing: "bows",
  other: "guns",
};

export const API_WEAPON_TO_MASTERY: Partial<Record<ApiWeaponId, MasteryTreeId>> = {
  SWORD: "swords",
  GREATSWORD: "swords",
  AXE: "axes",
  GREATAXE: "axes",
  HAMMER: "hammers",
  MACE: "hammers",
  BOW: "bows",
  CROSSBOW: "crossbows",
  GUN: "guns",
  STAFF: "staves",
  WAND: "staffs",
  SPEAR: "spears",
  DAGGER: "swords",
  SCYTHE: "axes",
  SHIELD: "swords",
  TOME: "staffs",
};

export function masteryTreeForWeapon(type: WeaponType): MasteryTreeId {
  return WEAPON_TYPE_TO_MASTERY[type] ?? "swords";
}

export function masteryTreeForApiWeapon(
  apiId: string | null | undefined,
): MasteryTreeId | null {
  if (!apiId) return null;
  return API_WEAPON_TO_MASTERY[apiId.toUpperCase() as ApiWeaponId] ?? null;
}