// AUTO-GENERATED from weaponSkills.json v3.1.0 — feed skills only (no invented nodes).
// Layout: hotbar slot N = flattenWeaponSkills index N−1 (Digit1..6 → skill_1..6).
// Regenerate: node scripts/src/generate-weapon-matrix.mjs

import type { AnimPackId } from "./animDefaults";
import type { WeaponSkillNode, WeaponSkillTree } from "./weaponSkills";

/** API weapon-type ids (UPPERCASE) from the live ObjectStore feed. */
export type ApiWeaponId =
  | "SWORD"
  | "AXE"
  | "BOW"
  | "CROSSBOW"
  | "GUN"
  | "DAGGER"
  | "STAFF"
  | "HAMMER"
  | "SHIELD"
  | "GREATSWORD"
  | "GREATAXE"
  | "SPEAR"
  | "TOME"
  | "MACE"
  | "WAND"
  | "SCYTHE";

export const API_WEAPON_IDS: ApiWeaponId[] = [
  "SWORD",
  "AXE",
  "BOW",
  "CROSSBOW",
  "GUN",
  "DAGGER",
  "STAFF",
  "HAMMER",
  "SHIELD",
  "GREATSWORD",
  "GREATAXE",
  "SPEAR",
  "TOME",
  "MACE",
  "WAND",
  "SCYTHE",
];

/** Locomotion / stance pack each API weapon activates in /world (omni fallback). */
export const API_WEAPON_ANIM_PACK: Record<ApiWeaponId, AnimPackId> = {
  SWORD: "sword_shield",
  AXE: "sword_shield",
  BOW: "longbow",
  CROSSBOW: "longbow",
  GUN: "longbow",
  DAGGER: "unarmed",
  STAFF: "magic",
  HAMMER: "sword_shield",
  SHIELD: "sword_shield",
  GREATSWORD: "sword_shield",
  GREATAXE: "sword_shield",
  SPEAR: "sword_shield",
  TOME: "magic",
  MACE: "sword_shield",
  WAND: "magic",
  SCYTHE: "unarmed",
};

export const HOTBAR_SKILL_COUNT = 6;

/** Per-weapon skill trees keyed by API id — up to 6 hotbar nodes from the live feed. */
export const API_WEAPON_SKILL_TREES: Array<WeaponSkillTree & { apiId: ApiWeaponId }> = [
  {
    apiId: "SWORD",
    type: "sword" as never,
    label: "Sword",
    baseDamage: 18,
    nodes: [
      { id: "sword_vengeful_slash", label: "Vengeful Slash", rank: 1, animKey: "sword_attack_a", effects: ["fx.warrior.cleave"], power: 2.5, cost: {"stamina":6}, damageType: "physical", description: "Single-target slash, builds 1 Grudge Mark stack, max 3", hotbarSlot: 1, slotKind: "primary" },
      { id: "sword_lunging_strike", label: "Lunging Strike", rank: 2, animKey: "sword_attack_b", effects: ["fx.warrior.cleave"], cooldown: 2, power: 3.06, cost: {"stamina":9}, damageType: "physical", description: "Ranged thrust attack", hotbarSlot: 2, slotKind: "primary" },
      { id: "sword_fearful_swipe", label: "Fearful Swipe", rank: 3, animKey: "sword_dash_attack", effects: ["fx.warrior.cleave"], cooldown: 4, power: 2.22, cost: {"stamina":12}, damageType: "physical", description: "AoE fear attack", hotbarSlot: 3, slotKind: "primary" },
      { id: "sword_blood_rush", label: "Blood Rush", rank: 1, animKey: "sword_block", effects: ["fx.warrior.cleave"], cooldown: 8, power: 1.94, cost: {"stamina":15}, damageType: "physical", description: "Dash forward 8m, AoE damage", hotbarSlot: 4, slotKind: "secondary" },
      { id: "sword_iron_grudge", label: "Iron Grudge", rank: 2, animKey: "sword_combo_finisher", effects: ["fx.warrior.cleave"], cooldown: 12, power: 0.5, cost: {"stamina":18}, damageType: "physical", description: "3s damage reduction + reflect", hotbarSlot: 5, slotKind: "secondary" },
      { id: "sword_clan_charge", label: "Clan Charge", rank: 3, animKey: "run_jump_attack", effects: ["fx.warrior.cleave"], cooldown: 10, power: 2.22, cost: {"stamina":21}, damageType: "physical", description: "Gap-closer charge + 1s stun", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "AXE",
    type: "sword" as never,
    label: "Axe",
    baseDamage: 24,
    nodes: [
      { id: "axe_rending_chop", label: "Rending Chop", rank: 1, animKey: "sword_attack_c", effects: ["fx.warrior.cleave"], power: 2.08, cost: {"stamina":6}, damageType: "physical", description: "Single target, applies Bleed stack", hotbarSlot: 1, slotKind: "primary" },
      { id: "axe_lunging_chop", label: "Lunging Chop", rank: 2, animKey: "sword_attack_b", effects: ["fx.warrior.cleave"], cooldown: 2, power: 2.29, cost: {"stamina":9}, damageType: "physical", description: "Extended range chop", hotbarSlot: 2, slotKind: "primary" },
      { id: "axe_ground_slam", label: "Ground Slam", rank: 3, animKey: "sword_dash_attack", effects: ["fx.warrior.cleave"], cooldown: 4, power: 1.88, cost: {"stamina":12}, damageType: "physical", description: "AoE slow attack", hotbarSlot: 3, slotKind: "primary" },
      { id: "axe_adrenaline_surge", label: "Adrenaline Surge", rank: 1, animKey: "unarmed_spin", effects: ["fx.warrior.cleave"], cooldown: 15, power: 0.5, cost: {"stamina":15}, damageType: "physical", description: "+Attack speed buff", hotbarSlot: 4, slotKind: "secondary" },
      { id: "axe_whirl_pain", label: "Whirl of Pain", rank: 2, animKey: "sword_combo_finisher", effects: ["fx.warrior.cleave"], cooldown: 10, power: 3.33, cost: {"stamina":18}, damageType: "physical", description: "Channeled AoE spin", hotbarSlot: 5, slotKind: "secondary" },
      { id: "axe_bloodletting", label: "Bloodletting", rank: 3, animKey: "run_jump_attack", effects: ["fx.warrior.cleave"], cooldown: 8, power: 1.67, cost: {"stamina":21}, damageType: "physical", description: "AoE bleed apply", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "BOW",
    type: "sword" as never,
    label: "Bow",
    baseDamage: 14,
    nodes: [
      { id: "bow_quick_shot", label: "Quick Shot", rank: 1, animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"], power: 3.21, cost: {"stamina":6}, damageType: "physical", description: "Basic arrow shot", hotbarSlot: 1, slotKind: "primary" },
      { id: "bow_aimed_shot", label: "Aimed Shot", rank: 2, animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"], cooldown: 2, power: 5.71, cost: {"stamina":9}, damageType: "physical", description: "Charged precision shot", hotbarSlot: 2, slotKind: "primary" },
      { id: "bow_fire_arrow", label: "Fire Arrow", rank: 3, animKey: "throw_overhand", effects: ["fx.ranger.piercing_shot"], cooldown: 10, power: 2.86, cost: {"stamina":12}, damageType: "physical", description: "Ignites target for DoT", hotbarSlot: 3, slotKind: "primary" },
      { id: "bow_multishot", label: "Multishot", rank: 1, animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"], cooldown: 8, power: 2.5, cost: {"stamina":15}, damageType: "physical", description: "Fire 3 arrows at once", hotbarSlot: 4, slotKind: "secondary" },
      { id: "bow_piercing", label: "Piercing Shot", rank: 3, animKey: "unarmed_spin", effects: ["fx.ranger.piercing_shot"], cooldown: 6, power: 4.29, cost: {"stamina":18}, damageType: "physical", description: "Arrow pierces through enemies", hotbarSlot: 5, slotKind: "secondary" },
      { id: "bow_bear_trap", label: "Bear Trap", rank: 1, animKey: "marvel_melee", effects: ["fx.ranger.piercing_shot"], cooldown: 15, power: 1.43, cost: {"stamina":21}, damageType: "physical", description: "Place trap that roots enemies", hotbarSlot: 6, slotKind: "ability" },
    ],
  },
  {
    apiId: "CROSSBOW",
    type: "sword" as never,
    label: "Crossbow",
    baseDamage: 18,
    nodes: [
      { id: "xbow_heavy_bolt", label: "Heavy Bolt", rank: 1, animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"], power: 3.06, cost: {"stamina":6}, damageType: "physical", description: "Single shot, builds Mark", hotbarSlot: 1, slotKind: "primary" },
      { id: "xbow_rapid_fire", label: "Rapid Fire", rank: 2, animKey: "throw_overhand", effects: ["fx.ranger.piercing_shot"], cooldown: 3, power: 1.67, cost: {"stamina":9}, damageType: "physical", description: "Quick successive shots", hotbarSlot: 2, slotKind: "primary" },
      { id: "xbow_explosive_round", label: "Explosive Round", rank: 3, animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"], cooldown: 6, power: 2.78, cost: {"stamina":12}, damageType: "physical", description: "AoE explosion on hit", hotbarSlot: 3, slotKind: "primary" },
      { id: "xbow_knockback_bolt", label: "Knockback Bolt", rank: 1, animKey: "sword_attack_b", effects: ["fx.ranger.piercing_shot"], cooldown: 8, power: 2.22, cost: {"stamina":15}, damageType: "physical", description: "Push enemy back", hotbarSlot: 4, slotKind: "secondary" },
      { id: "xbow_trap_bolt", label: "Trap Bolt", rank: 2, animKey: "marvel_melee", effects: ["fx.ranger.piercing_shot"], cooldown: 12, power: 1.39, cost: {"stamina":18}, damageType: "physical", description: "Root trap on ground", hotbarSlot: 5, slotKind: "secondary" },
      { id: "xbow_sniper_shot", label: "Sniper Shot", rank: 3, animKey: "run_jump_attack", effects: ["fx.ranger.piercing_shot"], cooldown: 10, power: 5, cost: {"stamina":21}, damageType: "physical", description: "Long range precision", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "GUN",
    type: "sword" as never,
    label: "Gun",
    baseDamage: 20,
    nodes: [
      { id: "gun_grudge_shot", label: "Grudge Shot", rank: 1, animKey: "rifle_fire", effects: ["fx.ranger.piercing_shot"], power: 3, cost: {"stamina":6}, damageType: "physical", description: "Single shot, builds Powder Mark. Hitscan 30m range.", hotbarSlot: 1, slotKind: "primary" },
      { id: "gun_quick_reload", label: "Quick Reload", rank: 2, animKey: "rifle_fire_2", effects: ["fx.ranger.piercing_shot"], cooldown: 15, power: 0.5, cost: {"stamina":9}, damageType: "physical", description: "Rapidly cycle the chamber, +40% attack speed for 4s", hotbarSlot: 2, slotKind: "primary" },
      { id: "gun_smoke_shot", label: "Smoke Shot", rank: 3, animKey: "rifle_reload", effects: ["fx.ranger.piercing_shot"], cooldown: 12, power: 1.5, cost: {"stamina":12}, damageType: "physical", description: "Fire a flashbang round, blinding enemies in 4m", hotbarSlot: 3, slotKind: "primary" },
      { id: "gun_explosive_round", label: "Explosive Round", rank: 1, animKey: "rifle_melee", effects: ["fx.ranger.piercing_shot"], cooldown: 8, power: 3.5, cost: {"stamina":15}, damageType: "physical", description: "Fire incendiary shell that explodes on impact", hotbarSlot: 4, slotKind: "secondary" },
      { id: "gun_flame_burst", label: "Flame Burst", rank: 2, animKey: "rifle_fire_2", effects: ["fx.ranger.piercing_shot"], cooldown: 10, power: 2.5, cost: {"stamina":18}, damageType: "physical", description: "Spray ignited powder in a cone, setting ground ablaze", hotbarSlot: 5, slotKind: "secondary" },
      { id: "gun_sniper_round", label: "Sniper Round", rank: 3, animKey: "rifle_fire", effects: ["fx.ranger.piercing_shot"], cooldown: 12, power: 6, cost: {"stamina":21}, damageType: "physical", description: "Steady aim, charged shot that pierces armor at extreme range", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "DAGGER",
    type: "sword" as never,
    label: "Dagger",
    baseDamage: 10,
    nodes: [
      { id: "dagger_shadow_stab", label: "Shadow Stab", rank: 1, animKey: "sword_attack_a", effects: ["fx.ranger.camouflage"], power: 4, cost: {"stamina":6}, damageType: "physical", description: "Single stab, builds Mark", hotbarSlot: 1, slotKind: "primary" },
      { id: "dagger_chain_slash", label: "Chain Slash", rank: 2, animKey: "sword_dash_attack", effects: ["fx.ranger.camouflage"], cooldown: 3, power: 3.5, cost: {"stamina":9}, damageType: "physical", description: "Rapid burst combo", hotbarSlot: 2, slotKind: "primary" },
      { id: "dagger_poison_shiv", label: "Poison Shiv", rank: 3, animKey: "marvel_stealth", effects: ["fx.ranger.camouflage"], cooldown: 6, power: 2.5, cost: {"stamina":12}, damageType: "physical", description: "Apply DoT poison", hotbarSlot: 3, slotKind: "primary" },
      { id: "dagger_phantom_dash", label: "Phantom Dash", rank: 1, animKey: "venom_attack_b", effects: ["fx.ranger.camouflage"], cooldown: 8, power: 4.5, cost: {"stamina":15}, damageType: "physical", description: "Dash through enemies", hotbarSlot: 4, slotKind: "secondary" },
      { id: "dagger_assassin_focus", label: "Assassin\'s Focus", rank: 2, animKey: "unarmed_spin", effects: ["fx.ranger.camouflage"], cooldown: 15, power: 0.5, cost: {"stamina":18}, damageType: "physical", description: "+Attack speed buff", hotbarSlot: 5, slotKind: "secondary" },
      { id: "dagger_lunging_stabs", label: "Lunging Stabs", rank: 3, animKey: "sword_attack_b", effects: ["fx.ranger.camouflage"], cooldown: 10, power: 6, cost: {"stamina":21}, damageType: "physical", description: "Burst mobility combo", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "STAFF",
    type: "sword" as never,
    label: "Staff",
    baseDamage: 22,
    nodes: [
      { id: "staff_fire_bolt", label: "Fire Bolt", rank: 1, animKey: "magic_cast", effects: ["fx.mage.firebolt"], power: 2.27, cost: {"stamina":6}, damageType: "physical", description: "Single-target, builds Burn stack", hotbarSlot: 1, slotKind: "primary" },
      { id: "staff_frost_bolt", label: "Frost Bolt", rank: 2, animKey: "magic_cast", effects: ["fx.mage.firebolt"], power: 2.05, cost: {"stamina":9}, damageType: "physical", description: "Single-target, builds Chill", hotbarSlot: 2, slotKind: "primary" },
      { id: "staff_holy_light", label: "Holy Light", rank: 3, animKey: "venom_symbiote", effects: ["fx.mage.firebolt"], cooldown: 2, power: 0.5, cost: {"stamina":12}, damageType: "physical", description: "Heal single ally", hotbarSlot: 3, slotKind: "primary" },
      { id: "staff_flame_wave", label: "Flame Wave", rank: 1, animKey: "venom_shackle", effects: ["fx.mage.firebolt"], cooldown: 8, power: 2.73, cost: {"stamina":15}, damageType: "physical", description: "Cone AoE DoT", hotbarSlot: 4, slotKind: "secondary" },
      { id: "staff_ice_nova", label: "Ice Nova", rank: 2, animKey: "venom_tentacles_a", effects: ["fx.mage.firebolt"], cooldown: 10, power: 2.5, cost: {"stamina":18}, damageType: "physical", description: "AoE slow around caster", hotbarSlot: 5, slotKind: "secondary" },
      { id: "staff_divine_wave", label: "Divine Wave", rank: 3, animKey: "run_jump_attack", effects: ["fx.mage.firebolt"], cooldown: 12, power: 0.5, cost: {"stamina":21}, damageType: "physical", description: "AoE heal allies", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "HAMMER",
    type: "sword" as never,
    label: "Hammer",
    baseDamage: 30,
    nodes: [
      { id: "hammer_earthshatter", label: "Earthshatter", rank: 1, animKey: "sword_attack_c", effects: ["fx.warrior.ground_slam"], power: 1.83, cost: {"stamina":6}, damageType: "physical", description: "AoE, applies Slow", hotbarSlot: 1, slotKind: "primary" },
      { id: "hammer_skullbash", label: "Skullbash", rank: 2, animKey: "sword_combo_finisher", effects: ["fx.warrior.ground_slam"], cooldown: 2, power: 2, cost: {"stamina":9}, damageType: "physical", description: "Single target slow", hotbarSlot: 2, slotKind: "primary" },
      { id: "hammer_ground_pound", label: "Ground Pound", rank: 3, animKey: "sword_dash_attack", effects: ["fx.warrior.ground_slam"], cooldown: 4, power: 1.67, cost: {"stamina":12}, damageType: "physical", description: "Armor break attack", hotbarSlot: 3, slotKind: "primary" },
      { id: "hammer_thunderous_charge", label: "Thunderous Charge", rank: 1, animKey: "sword_block", effects: ["fx.warrior.ground_slam"], cooldown: 10, power: 1.5, cost: {"stamina":15}, damageType: "physical", description: "Charge stun", hotbarSlot: 4, slotKind: "secondary" },
      { id: "hammer_quake_strike", label: "Quake Strike", rank: 2, animKey: "unarmed_spin", effects: ["fx.warrior.ground_slam"], cooldown: 12, power: 2.33, cost: {"stamina":18}, damageType: "physical", description: "Knockup AoE", hotbarSlot: 5, slotKind: "secondary" },
      { id: "hammer_iron_skin", label: "Iron Skin", rank: 3, animKey: "run_jump_attack", effects: ["fx.warrior.ground_slam"], cooldown: 18, power: 0.5, cost: {"stamina":21}, damageType: "physical", description: "Damage reduction", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "SHIELD",
    type: "sword" as never,
    label: "Shield (Off-Hand)",
    baseDamage: 12,
    nodes: [
    ],
  },
  {
    apiId: "GREATSWORD",
    type: "sword" as never,
    label: "Greatsword",
    baseDamage: 28,
    nodes: [
      { id: "gs_cleave", label: "Cleaving Strike", rank: 1, animKey: "sword_attack_a", effects: ["fx.warrior.cleave"], power: 1.96, cost: {"stamina":6}, damageType: "physical", description: "Wide arc slash hitting all in front", hotbarSlot: 1, slotKind: "primary" },
      { id: "gs_overhead", label: "Overhead Slash", rank: 2, animKey: "sword_attack_c", effects: ["fx.warrior.cleave"], cooldown: 3, power: 2.86, cost: {"stamina":9}, damageType: "physical", description: "Slow powerful downward strike", hotbarSlot: 2, slotKind: "primary" },
      { id: "gs_executioner", label: "Executioner\'s Swing", rank: 3, animKey: "sword_dash_attack", effects: ["fx.warrior.cleave"], cooldown: 5, power: 2.5, cost: {"stamina":12}, damageType: "physical", description: "Massive hit, bonus on low HP targets", hotbarSlot: 3, slotKind: "primary" },
      { id: "gs_whirlwind", label: "Whirlwind Slash", rank: 1, animKey: "sword_block", effects: ["fx.warrior.cleave"], cooldown: 8, power: 2.32, cost: {"stamina":15}, damageType: "physical", description: "360° spin dealing AoE damage", hotbarSlot: 4, slotKind: "secondary" },
      { id: "gs_impale", label: "Impaling Thrust", rank: 2, animKey: "sword_combo_finisher", effects: ["fx.warrior.cleave"], cooldown: 10, power: 2.5, cost: {"stamina":18}, damageType: "physical", description: "Lunge forward, pin target", hotbarSlot: 5, slotKind: "secondary" },
      { id: "gs_giant_reach", label: "Giant\'s Reach", rank: 3, animKey: "run_jump_attack", effects: ["fx.warrior.cleave"], cooldown: 8, power: 2.14, cost: {"stamina":21}, damageType: "physical", description: "Extended range wave slash", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "GREATAXE",
    type: "sword" as never,
    label: "Greataxe",
    baseDamage: 30,
    nodes: [
      { id: "ga_brutal", label: "Brutal Chop", rank: 1, animKey: "sword_attack_c", effects: ["fx.warrior.cleave"], power: 2, cost: {"stamina":6}, damageType: "physical", description: "Slow powerful cleave with bleed", hotbarSlot: 1, slotKind: "primary" },
      { id: "ga_rending", label: "Rending Swing", rank: 2, animKey: "unarmed_spin", effects: ["fx.warrior.cleave"], cooldown: 2, power: 1.83, cost: {"stamina":9}, damageType: "physical", description: "Wide arc, amplifies existing bleeds", hotbarSlot: 2, slotKind: "primary" },
      { id: "ga_skull_split", label: "Skull Splitter", rank: 3, animKey: "sword_dash_attack", effects: ["fx.warrior.cleave"], cooldown: 5, power: 2.83, cost: {"stamina":12}, damageType: "physical", description: "Overhead smash, ignores 50% armor", hotbarSlot: 3, slotKind: "primary" },
      { id: "ga_primal_rage", label: "Primal Rage", rank: 1, animKey: "sword_attack_b", effects: ["fx.warrior.cleave"], cooldown: 20, power: 0.5, cost: {"stamina":15}, damageType: "physical", description: "Enter rage, +40% damage, take 15% more", hotbarSlot: 4, slotKind: "secondary" },
      { id: "ga_berserker_charge", label: "Berserker Charge", rank: 2, animKey: "sword_combo_finisher", effects: ["fx.warrior.cleave"], cooldown: 12, power: 2.33, cost: {"stamina":18}, damageType: "physical", description: "Unstoppable charge, cleave on arrival", hotbarSlot: 5, slotKind: "secondary" },
      { id: "ga_war_cry", label: "War Cry", rank: 3, animKey: "run_jump_attack", effects: ["fx.warrior.cleave"], cooldown: 18, power: 0.5, cost: {"stamina":21}, damageType: "physical", description: "AoE fear, allies gain attack speed", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "SPEAR",
    type: "sword" as never,
    label: "Spear",
    baseDamage: 16,
    nodes: [
      { id: "spear_thrust", label: "Quick Thrust", rank: 1, animKey: "sword_attack_b", effects: ["fx.warrior.cleave"], power: 2.5, cost: {"stamina":6}, damageType: "physical", description: "Fast jab with extended reach", hotbarSlot: 1, slotKind: "primary" },
      { id: "spear_lunge", label: "Piercing Lunge", rank: 2, animKey: "sword_attack_a", effects: ["fx.warrior.cleave"], cooldown: 3, power: 3.44, cost: {"stamina":9}, damageType: "physical", description: "Lunge forward with armor-piercing stab", hotbarSlot: 2, slotKind: "primary" },
      { id: "spear_sweep", label: "Sweeping Stab", rank: 3, animKey: "sword_dash_attack", effects: ["fx.warrior.cleave"], cooldown: 4, power: 2.81, cost: {"stamina":12}, damageType: "physical", description: "Low sweep knocking enemies off balance", hotbarSlot: 3, slotKind: "primary" },
      { id: "spear_javelin", label: "Javelin Throw", rank: 1, animKey: "sword_block", effects: ["fx.warrior.cleave"], cooldown: 8, power: 4.06, cost: {"stamina":15}, damageType: "physical", description: "Hurl spear as ranged projectile", hotbarSlot: 4, slotKind: "secondary" },
      { id: "spear_vault", label: "Vaulting Strike", rank: 2, animKey: "unarmed_spin", effects: ["fx.warrior.cleave"], cooldown: 10, power: 4.38, cost: {"stamina":18}, damageType: "physical", description: "Pole-vault over, strike from above", hotbarSlot: 5, slotKind: "secondary" },
      { id: "spear_wall", label: "Wall of Spears", rank: 3, animKey: "run_jump_attack", effects: ["fx.warrior.cleave"], cooldown: 15, power: 2.5, cost: {"stamina":21}, damageType: "physical", description: "Plant spears creating damage zone", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "TOME",
    type: "sword" as never,
    label: "Tome (Off-Hand Relic)",
    baseDamage: 20,
    nodes: [
    ],
  },
  {
    apiId: "MACE",
    type: "sword" as never,
    label: "Mace",
    baseDamage: 26,
    nodes: [
      { id: "mace_holy_strike", label: "Holy Strike", rank: 1, animKey: "sword_attack_c", effects: ["fx.mage.arcane"], power: 1.73, cost: {"stamina":6}, damageType: "physical", description: "Mace hit infused with holy energy", hotbarSlot: 1, slotKind: "primary" },
      { id: "mace_crushing", label: "Crushing Blow", rank: 2, animKey: "magic_cast", effects: ["fx.mage.arcane"], cooldown: 3, power: 2.31, cost: {"stamina":9}, damageType: "physical", description: "Overhead smash, stuns briefly", hotbarSlot: 2, slotKind: "primary" },
      { id: "mace_judgement", label: "Judgement Smite", rank: 3, animKey: "shield_bash", effects: ["fx.mage.arcane"], cooldown: 4, power: 2.12, cost: {"stamina":12}, damageType: "physical", description: "Holy-empowered strike with splash", hotbarSlot: 3, slotKind: "primary" },
      { id: "mace_sanctify", label: "Sanctify", rank: 1, animKey: "sword_block", effects: ["fx.mage.arcane"], cooldown: 12, power: 0.5, cost: {"stamina":15}, damageType: "physical", description: "Bless ground, heal allies in zone", hotbarSlot: 4, slotKind: "secondary" },
      { id: "mace_divine_rush", label: "Divine Rush", rank: 2, animKey: "unarmed_spin", effects: ["fx.mage.arcane"], cooldown: 10, power: 1.92, cost: {"stamina":18}, damageType: "physical", description: "Dash empowered with holy energy", hotbarSlot: 5, slotKind: "secondary" },
      { id: "mace_consecrate", label: "Consecrate", rank: 3, animKey: "sword_combo_finisher", effects: ["fx.mage.arcane"], cooldown: 15, power: 2.69, cost: {"stamina":21}, damageType: "physical", description: "Create holy ground damaging undead", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "WAND",
    type: "sword" as never,
    label: "Wand",
    baseDamage: 18,
    nodes: [
      { id: "wand_missile", label: "Magic Missile", rank: 1, animKey: "magic_cast", effects: ["fx.mage.arcane"], power: 2.22, cost: {"stamina":6}, damageType: "physical", description: "3 homing arcane bolts", hotbarSlot: 1, slotKind: "primary" },
      { id: "wand_pulse", label: "Arcane Pulse", rank: 2, animKey: "venom_symbiote", effects: ["fx.mage.arcane"], cooldown: 2, power: 3.06, cost: {"stamina":9}, damageType: "physical", description: "Charged pulse with AoE splash", hotbarSlot: 2, slotKind: "primary" },
      { id: "wand_void_bolt", label: "Void Bolt", rank: 3, animKey: "venom_shackle", effects: ["fx.mage.arcane"], cooldown: 6, power: 2.78, cost: {"stamina":12}, damageType: "physical", description: "Shadow bolt that silences", hotbarSlot: 3, slotKind: "primary" },
      { id: "wand_blink", label: "Blink", rank: 1, animKey: "venom_tentacles_a", effects: ["fx.mage.arcane"], cooldown: 12, power: 0.5, cost: {"stamina":15}, damageType: "physical", description: "Instant teleport to target location", hotbarSlot: 4, slotKind: "secondary" },
      { id: "wand_barrier", label: "Arcane Barrier", rank: 2, animKey: "run_jump_attack", effects: ["fx.mage.arcane"], cooldown: 18, power: 0.5, cost: {"stamina":18}, damageType: "physical", description: "Create damage absorption shield", hotbarSlot: 5, slotKind: "secondary" },
      { id: "wand_time_warp", label: "Time Warp", rank: 3, animKey: "magic_cast", effects: ["fx.mage.arcane"], cooldown: 25, power: 0.5, cost: {"stamina":21}, damageType: "physical", description: "Slow time in zone, speed allies", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
  {
    apiId: "SCYTHE",
    type: "sword" as never,
    label: "Scythe",
    baseDamage: 24,
    nodes: [
      { id: "scythe_reap", label: "Reaping Slash", rank: 1, animKey: "venom_attack_a", effects: ["fx.ranger.camouflage"], power: 2.08, cost: {"stamina":6}, damageType: "physical", description: "Wide sweeping arc, builds Soul stacks", hotbarSlot: 1, slotKind: "primary" },
      { id: "scythe_harvest", label: "Soul Harvest", rank: 2, animKey: "venom_attack_b", effects: ["fx.ranger.camouflage"], cooldown: 3, power: 2.92, cost: {"stamina":9}, damageType: "physical", description: "Consume souls for burst damage", hotbarSlot: 2, slotKind: "primary" },
      { id: "scythe_embrace", label: "Death\'s Embrace", rank: 3, animKey: "venom_tentacles_a", effects: ["fx.ranger.camouflage"], cooldown: 5, power: 2.71, cost: {"stamina":12}, damageType: "physical", description: "Pull target in, heavy hit", hotbarSlot: 3, slotKind: "primary" },
      { id: "scythe_shadow_step", label: "Shadow Step", rank: 1, animKey: "venom_symbiote", effects: ["fx.ranger.camouflage"], cooldown: 10, power: 1.67, cost: {"stamina":15}, damageType: "physical", description: "Teleport behind target", hotbarSlot: 4, slotKind: "secondary" },
      { id: "scythe_life_drain", label: "Life Drain", rank: 2, animKey: "venom_attack_c", effects: ["fx.ranger.camouflage"], cooldown: 12, power: 3.33, cost: {"stamina":18}, damageType: "physical", description: "Channeled drain, heals self", hotbarSlot: 5, slotKind: "secondary" },
      { id: "scythe_chains", label: "Spectral Chains", rank: 3, animKey: "unarmed_spin", effects: ["fx.ranger.camouflage"], cooldown: 15, power: 1.25, cost: {"stamina":21}, damageType: "physical", description: "Root multiple targets in area", hotbarSlot: 6, slotKind: "secondary" },
    ],
  },
];

export const API_WEAPON_TREE_BY_ID: Record<ApiWeaponId, WeaponSkillTree> = Object.fromEntries(
  API_WEAPON_SKILL_TREES.map(({ apiId, ...tree }) => [apiId, tree]),
) as Record<ApiWeaponId, WeaponSkillTree>;

/** All 84 hotbar-bound weapon skills from the feed (flat index for VFX + AI). */
export const ALL_API_WEAPON_SKILLS: WeaponSkillNode[] = API_WEAPON_SKILL_TREES.flatMap((t) => t.nodes);
