// ── Canonical 24-hero weapon loadouts ─────────────────────────────────────────
//
// Single matrix for the roster weapon spread (6 races × 4 classes). Drives API
// weapon skill trees, viewer → game handoff bag ids, NPC equipment seeds, and
// Warlords combat skill wiring.

import type { AnimPackId } from "./animDefaults";
import type { ApiWeaponId } from "./apiWeaponMatrix";
import { API_WEAPON_ANIM_PACK } from "./apiWeaponMatrix";
import type { WeaponType } from "./index";


/** Magic school carried by a staff or worge tome (matches offhandCoupling). */
export type MageSchool =
  | "fire"
  | "frost"
  | "lightning"
  | "nature"
  | "holy"
  | "arcane"
  | "shadow";

export type TomeSchool = MageSchool;

export interface PrefabLoadout {
  apiWeapon: ApiWeaponId;
  offhand?: ApiWeaponId;
  tomeSchool?: TomeSchool;
  mageSchool?: MageSchool;
  twoHanded?: boolean;
  /** Legacy WeaponType — entity spec, locomotion fallback, integrity checks. */
  weapon: WeaponType;
  animPack: AnimPackId;
}

/** Main-hand bag item per API weapon (grudge-game STARTER_BAG ids). */
export const API_WEAPON_BAG: Partial<Record<ApiWeaponId, string>> = {
  SWORD: "bag-wraithfang",
  GREATSWORD: "bag-wraithfang",
  AXE: "bag-gorehowl",
  GREATAXE: "bag-gorehowl",
  HAMMER: "bag-gorehowl",
  MACE: "bag-gorehowl",
  DAGGER: "bag-wraithfang",
  STAFF: "bag-emberwrath",
  WAND: "bag-glacial",
  BOW: "bag-shadowflight",
  GUN: "bag-shadowflight",
  CROSSBOW: "bag-shadowflight",
  SCYTHE: "bag-wraithfang",
};

export const OFFHAND_BAG: Partial<Record<ApiWeaponId, string>> = {
  SHIELD: "bag-aegis",
  TOME: "bag-arcane-grimoire",
};

/** Per-prefab canonical loadout — keyed by stable prefab slug id. */
export const PREFAB_LOADOUT_BY_ID: Record<string, PrefabLoadout> = {
  // ── Crusade · Human ─────────────────────────────────────────────────────────
  "sir-aldric-valorheart": {
    apiWeapon: "SWORD", offhand: "SHIELD", weapon: "sword", animPack: "sword_shield",
  },
  "gareth-moonshadow": {
    apiWeapon: "DAGGER", offhand: "TOME", tomeSchool: "holy", weapon: "dagger", animPack: "unarmed",
  },
  "archmage-elara-brightspire": {
    apiWeapon: "STAFF", mageSchool: "holy", weapon: "staff", animPack: "magic",
  },
  "kael-shadowblade": {
    apiWeapon: "BOW", weapon: "bow", animPack: "longbow",
  },

  // ── Crusade · Barbarian ─────────────────────────────────────────────────────
  "ulfgar-bonecrusher": {
    apiWeapon: "HAMMER", twoHanded: true, weapon: "hammer", animPack: "sword_shield",
  },
  "hrothgar-fangborn": {
    apiWeapon: "AXE", offhand: "TOME", tomeSchool: "lightning", weapon: "axe", animPack: "sword_shield",
  },
  "volka-stormborn": {
    apiWeapon: "STAFF", mageSchool: "frost", weapon: "staff", animPack: "magic",
  },
  "syala-windrider": {
    apiWeapon: "GUN", weapon: "other", animPack: "longbow",
  },

  // ── Fabled · Dwarf ──────────────────────────────────────────────────────────
  "thane-ironshield": {
    apiWeapon: "MACE", offhand: "SHIELD", weapon: "mace", animPack: "sword_shield",
  },
  "bromm-earthshaker": {
    apiWeapon: "HAMMER", offhand: "TOME", tomeSchool: "arcane", weapon: "hammer", animPack: "sword_shield",
  },
  "runa-forgekeeper": {
    apiWeapon: "STAFF", mageSchool: "fire", weapon: "staff", animPack: "magic",
  },
  "durin-tunnelwatcher": {
    apiWeapon: "CROSSBOW", weapon: "bow", animPack: "longbow",
  },

  // ── Fabled · Elf ────────────────────────────────────────────────────────────
  "thalion-bladedancer": {
    apiWeapon: "GREATSWORD", twoHanded: true, weapon: "sword", animPack: "sword_shield",
  },
  "sylara-wildheart": {
    apiWeapon: "SCYTHE", offhand: "TOME", tomeSchool: "nature", weapon: "other", animPack: "unarmed",
  },
  "lyra-stormweaver": {
    apiWeapon: "STAFF", mageSchool: "lightning", weapon: "staff", animPack: "magic",
  },
  "aelindra-swiftbow": {
    apiWeapon: "BOW", weapon: "bow", animPack: "longbow",
  },

  // ── Legion · Orc ────────────────────────────────────────────────────────────
  "grommash-ironjaw": {
    apiWeapon: "GREATAXE", twoHanded: true, weapon: "axe", animPack: "sword_shield",
  },
  "fenris-bloodfang": {
    apiWeapon: "MACE", offhand: "TOME", tomeSchool: "fire", weapon: "mace", animPack: "sword_shield",
  },
  "zuejin-the-hexmaster": {
    apiWeapon: "STAFF", mageSchool: "nature", weapon: "staff", animPack: "magic",
  },
  "razak-deadeye": {
    apiWeapon: "GUN", weapon: "other", animPack: "longbow",
  },

  // ── Legion · Undead ─────────────────────────────────────────────────────────
  "lord-malachar": {
    apiWeapon: "MACE", twoHanded: true, weapon: "mace", animPack: "sword_shield",
  },
  "the-ghoulfather": {
    apiWeapon: "SWORD", offhand: "TOME", tomeSchool: "frost", weapon: "sword", animPack: "sword_shield",
  },
  "necromancer-vexis": {
    apiWeapon: "WAND", mageSchool: "shadow", weapon: "staff", animPack: "magic",
  },
  "shade-whisper": {
    apiWeapon: "CROSSBOW", weapon: "bow", animPack: "longbow",
  },
};

/** Subtle skin multiply tints per race (hero codex palette). */
export const RACE_SKIN_TINT: Record<string, string> = {
  human: "#f5deb3",
  barbarian: "#d4a574",
  dwarf: "#c9a66b",
  elf: "#e8f0e8",
  orc: "#8fbc8f",
  undead: "#b0b8c8",
};

export function prefabLoadout(p: { id: string }): PrefabLoadout {
  const hit = PREFAB_LOADOUT_BY_ID[p.id];
  if (!hit) {
    throw new Error(`missing canonical loadout for prefab "${p.id}"`);
  }
  return hit;
}

export function weaponBagForLoadout(lo: PrefabLoadout): string {
  return API_WEAPON_BAG[lo.apiWeapon] ?? "bag-wraithfang";
}

export function offhandBagForLoadout(lo: PrefabLoadout): string | null {
  if (!lo.offhand) return null;
  return OFFHAND_BAG[lo.offhand] ?? null;
}

export function animPackForPrefab(p: { id: string }): AnimPackId {
  const lo = prefabLoadout(p);
  return lo.animPack ?? API_WEAPON_ANIM_PACK[lo.apiWeapon];
}