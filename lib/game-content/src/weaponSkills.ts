// ── Weapon skill trees ────────────────────────────────────────────────────────
//
// Per weapon-type skill progression, independent of class. A character's usable
// weapon skills = (class tree) ∪ (the equipped weapon's tree). Each node binds
// an animation key (animations.ts) and effect ids, mirroring the class tree
// shape so a single UI can render both.
//
// Each node also carries data-driven combat numbers — a `power` scalar over the
// weapon family's `baseDamage`, a resource `cost`, and a `damageType` — so the
// /world action bar, the HUD, and the panels can all show icon + cost + damage
// without any hard-coded values in the UI layer.

import type { WeaponType } from "./index";

export interface WeaponSkillNode {
  id: string;
  label: string;
  /** Unlock rank within the weapon tree (1 = base, higher = deeper). */
  rank: number;
  animKey?: string;
  effects: string[];
  cooldown?: number;
  description: string;
  /** Damage scalar over the weapon family's base hit (1 = a normal swing). */
  power?: number;
  /** Resource cost to use the skill. */
  cost?: { mana?: number; stamina?: number };
  /** Mitigated by defense (physical) or resistance (magical). Default physical. */
  damageType?: "physical" | "magical";
  /** Action-bar slot 1..6 when sourced from the API weapon matrix. */
  hotbarSlot?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Feed slot family: primary / secondary / ability (signature) / ultimate. */
  slotKind?: "primary" | "secondary" | "ability" | "ultimate";
}

export interface WeaponSkillTree {
  type: WeaponType;
  label: string;
  /** Base damage of a normal hit with this weapon family. */
  baseDamage: number;
  nodes: WeaponSkillNode[];
}

export const WEAPON_SKILL_TREES: WeaponSkillTree[] = [
  {
    type: "sword",
    label: "Swordsmanship",
    baseDamage: 18,
    nodes: [
      { id: "sword.slash", label: "Slash Combo", rank: 1, animKey: "sword_attack_a", effects: ["fx.warrior.cleave"], cooldown: 0, power: 1, cost: { stamina: 8 }, description: "Three-hit chaining slash." },
      { id: "sword.dash", label: "Dash Strike", rank: 2, animKey: "sword_dash_attack", effects: ["fx.warrior.cleave"], cooldown: 8, power: 1.4, cost: { stamina: 18 }, description: "Close distance with a thrust." },
      { id: "sword.finisher", label: "Crescent Finisher", rank: 3, animKey: "sword_combo_finisher", effects: ["fx.warrior.cleave"], cooldown: 14, power: 2.2, cost: { stamina: 30 }, description: "Heavy spinning finisher." },
    ],
  },
  {
    type: "axe",
    label: "Axe Mastery",
    baseDamage: 24,
    nodes: [
      { id: "axe.chop", label: "Heavy Chop", rank: 1, animKey: "sword_attack_c", effects: ["fx.warrior.cleave"], cooldown: 0, power: 1.1, cost: { stamina: 10 }, description: "Overhead chopping blow." },
      { id: "axe.rend", label: "Rend", rank: 2, animKey: "sword_attack_b", effects: ["fx.warrior.cleave"], cooldown: 9, power: 1.6, cost: { stamina: 20 }, description: "Bleeding wound over time." },
      { id: "axe.cleave", label: "Whirlwind", rank: 3, animKey: "sword_combo_finisher", effects: ["fx.warrior.cleave"], cooldown: 14, power: 2.1, cost: { stamina: 28 }, description: "Spinning axe cleave." },
    ],
  },
  {
    type: "hammer",
    label: "Hammer Mastery",
    baseDamage: 30,
    nodes: [
      { id: "hammer.smash", label: "Smash", rank: 1, animKey: "sword_attack_c", effects: ["fx.warrior.ground_slam"], cooldown: 0, power: 1.2, cost: { stamina: 12 }, description: "Crushing downward strike." },
      { id: "hammer.quake", label: "Quake", rank: 2, animKey: "sword_combo_finisher", effects: ["fx.warrior.ground_slam"], cooldown: 16, power: 2.4, cost: { stamina: 34 }, description: "Ground-shaking shockwave." },
    ],
  },
  {
    type: "spear",
    label: "Spearmanship",
    baseDamage: 16,
    nodes: [
      { id: "spear.thrust", label: "Thrust", rank: 1, animKey: "sword_attack_b", effects: ["fx.warrior.cleave"], cooldown: 0, power: 1, cost: { stamina: 8 }, description: "Long-reach piercing thrust." },
      { id: "spear.sweep", label: "Sweep", rank: 2, animKey: "unarmed_spin", effects: ["fx.warrior.cleave"], cooldown: 10, power: 1.5, cost: { stamina: 20 }, description: "Wide knockback sweep." },
    ],
  },
  {
    type: "staff",
    label: "Staff Channeling",
    baseDamage: 22,
    nodes: [
      { id: "staff.bolt", label: "Arcane Bolt", rank: 1, animKey: "magic_cast", effects: ["fx.mage.arcane"], cooldown: 0, power: 1.2, cost: { mana: 14 }, damageType: "magical", description: "Channeled magic bolt." },
      { id: "staff.nova", label: "Nova", rank: 2, animKey: "magic_cast", effects: ["fx.mage.frost_nova"], cooldown: 12, power: 2, cost: { mana: 30 }, damageType: "magical", description: "Radial elemental burst." },
      { id: "staff.lance", label: "Arcane Lance", rank: 3, animKey: "run_jump_attack", effects: ["fx.mage.firebolt"], cooldown: 16, power: 2.4, cost: { mana: 36 }, damageType: "magical", description: "Long-range arcane strike." },
    ],
  },
  {
    type: "bow",
    label: "Archery",
    baseDamage: 14,
    nodes: [
      { id: "bow.shot", label: "Quick Shot", rank: 1, animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"], cooldown: 0, power: 1, cost: { stamina: 6 }, description: "Fast aimed arrow." },
      { id: "bow.volley", label: "Volley", rank: 2, animKey: "bow_shot", effects: ["fx.ranger.volley"], cooldown: 13, power: 1.8, cost: { stamina: 24 }, description: "Area arrow rain." },
      { id: "bow.pierce", label: "Piercing Shot", rank: 3, animKey: "throw_overhand", effects: ["fx.ranger.piercing_shot"], cooldown: 10, power: 2.2, cost: { stamina: 20 }, description: "Armor-piercing aimed shot." },
    ],
  },
  {
    type: "dagger",
    label: "Knifeplay",
    baseDamage: 10,
    nodes: [
      { id: "dagger.stab", label: "Double Stab", rank: 1, animKey: "sword_attack_a", effects: ["fx.warrior.cleave"], cooldown: 0, power: 1.1, cost: { stamina: 6 }, description: "Rapid twin stab." },
      { id: "dagger.backstab", label: "Backstab", rank: 2, animKey: "sword_dash_attack", effects: ["fx.ranger.camouflage"], cooldown: 12, power: 2.6, cost: { stamina: 22 }, description: "High-damage strike from stealth." },
    ],
  },
  {
    type: "mace",
    label: "Mace Mastery",
    baseDamage: 26,
    nodes: [
      { id: "mace.bash", label: "Bash", rank: 1, animKey: "sword_attack_c", effects: ["fx.warrior.ground_slam"], cooldown: 0, power: 1.2, cost: { stamina: 12 }, description: "Stunning blunt strike." },
    ],
  },
  {
    type: "shield",
    label: "Shield Tactics",
    baseDamage: 12,
    nodes: [
      { id: "shield.bash", label: "Shield Bash", rank: 1, animKey: "shield_bash", effects: ["fx.warrior.cleave"], cooldown: 6, power: 1, cost: { stamina: 14 }, description: "Stagger with the shield." },
      { id: "shield.dash", label: "Shield Charge", rank: 2, animKey: "sword_dash_attack", effects: ["fx.warrior.cleave"], cooldown: 10, power: 1.4, cost: { stamina: 22 }, description: "Charge through enemies." },
    ],
  },
  {
    type: "pick",
    label: "Pickaxe (Harvest)",
    baseDamage: 8,
    nodes: [
      { id: "pick.mine", label: "Mine", rank: 1, animKey: "mine", effects: ["fx.warrior.ground_slam"], cooldown: 0, power: 1, cost: { stamina: 6 }, description: "Break ore and stone nodes." },
    ],
  },
  {
    type: "fishing",
    label: "Angling",
    baseDamage: 4,
    nodes: [
      { id: "fish.cast", label: "Cast Line", rank: 1, animKey: "fishing_cast", effects: ["fx.ranger.piercing_shot"], cooldown: 0, power: 1, cost: { stamina: 4 }, description: "Cast into a fishing spot." },
      { id: "fish.idle", label: "Hold Line", rank: 2, animKey: "fishing_idle", effects: [], cooldown: 0, power: 0.5, cost: { stamina: 2 }, description: "Wait with line in the water." },
    ],
  },
  {
    type: "other",
    label: "Symbiote Arts",
    baseDamage: 14,
    nodes: [
      { id: "venom.lunge", label: "Symbiote Lunge", rank: 1, animKey: "venom_attack_a", effects: ["fx.warrior.cleave"], cooldown: 0, power: 1.15, cost: { stamina: 8 }, description: "Lunge with symbiote claws." },
      { id: "venom.claws", label: "Raking Claws", rank: 1, animKey: "venom_attack_b", effects: ["fx.warrior.cleave"], cooldown: 0, power: 1.1, cost: { stamina: 7 }, description: "Fast rake with tendrils." },
      { id: "venom.tentacles", label: "Tendril Lash", rank: 2, animKey: "venom_tentacles_a", effects: ["fx.warrior.cleave"], cooldown: 6, power: 1.35, cost: { stamina: 14 }, description: "Wide tendril arc." },
      { id: "venom.symbiote", label: "Symbiote Burst", rank: 2, animKey: "venom_symbiote", effects: ["fx.mage.arcane"], cooldown: 12, power: 1.6, cost: { mana: 22 }, damageType: "magical", description: "Channel a symbiote surge." },
      { id: "venom.shackle", label: "Tendril Shackle", rank: 2, animKey: "venom_shackle", effects: ["fx.mage.frost_nova"], cooldown: 14, power: 1.5, cost: { mana: 18 }, damageType: "magical", description: "Binding symbiote tendrils." },
      { id: "venom.flight", label: "Symbiote Flight", rank: 3, animKey: "venom_flight_start", effects: ["fx.mage.arcane"], cooldown: 16, power: 1.8, cost: { stamina: 28 }, description: "Symbiote hover flight." },
    ],
  },
];

export const WEAPON_SKILL_TREE_BY_TYPE: Partial<Record<WeaponType, WeaponSkillTree>> =
  Object.fromEntries(WEAPON_SKILL_TREES.map((t) => [t.type, t]));

/** Display damage for a weapon-skill node = round(baseDamage × power). */
export function weaponSkillDamage(baseDamage: number, node: WeaponSkillNode): number {
  return Math.round(baseDamage * (node.power ?? 1));
}

/** A node's damage type (defaults to physical). */
export function weaponSkillDamageType(node: WeaponSkillNode): "physical" | "magical" {
  return node.damageType ?? "physical";
}
