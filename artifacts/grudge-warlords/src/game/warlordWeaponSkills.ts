/**
 * Canonical GRUDGE6 weapon skills for Warlords combat — sourced from the live
 * API weapon matrix in @workspace/game-content (same trees as /world Danger Room).
 */

import {
  ANIM_BY_KEY,
  API_WEAPON_TREE_BY_ID,
  HOTBAR_SKILL_COUNT,
  skillBlendFor,
  weaponSkillDamage,
  weaponSkillDamageType,
  type ApiWeaponId,
  type WeaponSkillNode,
} from "@workspace/game-content";
import type { MeleeWeaponId, RangedWeaponId } from "./config";
import { bindingFor } from "@workspace/game-content";
import { canonicalApiWeaponForPrefab } from "./canonicalLoadout";

export interface WarlordWeaponSkill {
  id: string;
  label: string;
  /** Baked clip path (no `.json`) on assets.grudge-studio.com. */
  baked: string;
  description: string;
  cooldown: number;
  damage: number;
  damageType: "physical" | "magical";
  blend: number;
  hotbarSlot: number;
  effects: string[];
  /** Display key from game-content controller (Digit1..6). */
  keyLabel: string;
}

const SLOT_KEYS = ["skill_1", "skill_2", "skill_3", "skill_4", "skill_5", "skill_6"].map(
  (id, i) => bindingFor("action", id)?.key ?? `Digit${i + 1}`,
);

function keyLabel(code: string): string {
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Key")) return code.slice(3);
  return code;
}

const MELEE_API: Record<MeleeWeaponId, ApiWeaponId> = {
  swordshield: "SWORD",
  warhammer: "HAMMER",
  greatsword: "GREATSWORD",
  knife: "DAGGER",
  barehands: "SCYTHE",
};

const RANGED_API: Record<RangedWeaponId, ApiWeaponId> = {
  rifle: "GUN",
  pistol: "GUN",
  shotgun: "GUN",
  grenade: "GUN",
  bow: "BOW",
};

export function apiWeaponForLoadout(
  meleeId: MeleeWeaponId,
  rangedId: RangedWeaponId,
  active: "ranged" | "melee",
): ApiWeaponId {
  return active === "melee" ? MELEE_API[meleeId] : RANGED_API[rangedId];
}

function nodeToSkill(node: WeaponSkillNode, baseDamage: number, slotIndex: number): WarlordWeaponSkill | null {
  if (!node.animKey) return null;
  const def = ANIM_BY_KEY[node.animKey];
  if (!def?.baked) return null;
  return {
    id: node.id,
    label: node.label,
    baked: def.baked,
    description: node.description,
    cooldown: node.cooldown ?? 0,
    damage: weaponSkillDamage(baseDamage, node),
    damageType: weaponSkillDamageType(node),
    blend: skillBlendFor(node.id, node.animKey),
    hotbarSlot: node.hotbarSlot ?? slotIndex + 1,
    effects: node.effects,
    keyLabel: keyLabel(SLOT_KEYS[slotIndex] ?? "Digit1"),
  };
}

/** Up to six hotbar skills for the equipped weapon (API matrix, baked-only). */
export function warlordSkillsForApiWeapon(apiId: ApiWeaponId): WarlordWeaponSkill[] {
  const tree = API_WEAPON_TREE_BY_ID[apiId];
  if (!tree) return [];
  const out: WarlordWeaponSkill[] = [];
  for (const node of tree.nodes) {
    const sk = nodeToSkill(node, tree.baseDamage, out.length);
    if (sk) out.push(sk);
    if (out.length >= HOTBAR_SKILL_COUNT) break;
  }
  return out;
}

export function warlordSkillsForLoadout(
  meleeId: MeleeWeaponId,
  rangedId: RangedWeaponId,
  active: "ranged" | "melee",
): WarlordWeaponSkill[] {
  return warlordSkillsForApiWeapon(apiWeaponForLoadout(meleeId, rangedId, active));
}

/** Canonical prefab hotbar — uses the roster's pinned API weapon tree. */
export function warlordSkillsForPrefab(prefabId: string): WarlordWeaponSkill[] {
  const api = canonicalApiWeaponForPrefab(prefabId);
  return api ? warlordSkillsForApiWeapon(api) : [];
}