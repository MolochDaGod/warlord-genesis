// ── Authored class-skill bindings (anim + VFX) ───────────────────────────────
//
// Canonical animKey + effect ids for every class-tree skill. worldClassSkills and
// skillVfx read these instead of inferring from label heuristics.

import type { ClassId } from "./classes";

export interface ClassSkillMeta {
  animKey: string;
  effects: string[];
}

/** Keyed by skill id (`mage.fireball`, `warrior.execute`, …). */
export const CLASS_SKILL_META: Record<string, ClassSkillMeta> = {
  // mage
  "mage.mana-shield": { animKey: "sword_block", effects: ["fx.mage.arcane_shield"] },
  "mage.magic-missile": { animKey: "magic_cast", effects: ["fx.mage.firebolt"] },
  "mage.heal": { animKey: "venom_symbiote", effects: ["fx.mage.arcane_shield"] },
  "mage.fireball": { animKey: "magic_cast", effects: ["fx.mage.firebolt"] },
  "mage.greater-heal": { animKey: "venom_symbiote", effects: ["fx.mage.arcane_shield"] },
  "mage.lightning-chain": { animKey: "magic_cast", effects: ["fx.mage.firebolt"] },
  "mage.blink": { animKey: "magic_cast", effects: [] },
  "mage.group-heal": { animKey: "venom_symbiote", effects: ["fx.mage.arcane_shield"] },
  "mage.meteor": { animKey: "magic_cast", effects: ["fx.mage.firebolt"] },
  "mage.portal": { animKey: "magic_cast", effects: [] },
  "mage.archmage": { animKey: "magic_cast", effects: ["fx.mage.arcane_shield"] },
  "mage.reality-tear": { animKey: "magic_cast", effects: ["fx.mage.firebolt"] },

  // warrior
  "warrior.invulnerability": { animKey: "sword_block", effects: ["fx.warrior.warcry"] },
  "warrior.taunt": { animKey: "sword_block", effects: ["fx.warrior.warcry"] },
  "warrior.quick-strike": { animKey: "sword_attack_a", effects: ["fx.warrior.cleave"] },
  "warrior.damage-surge": { animKey: "sword_attack_a", effects: ["fx.warrior.cleave"] },
  "warrior.guardian-s-aura": { animKey: "sword_block", effects: ["fx.warrior.warcry"] },
  "warrior.dual-wield": { animKey: "sword_attack_a", effects: ["fx.warrior.cleave"] },
  "warrior.shield-specialist": { animKey: "sword_block", effects: ["fx.warrior.warcry"] },
  "warrior.life-drain": { animKey: "sword_attack_a", effects: ["fx.warrior.cleave"] },
  "warrior.execute": { animKey: "sword_combo_finisher", effects: ["fx.warrior.cleave"] },
  "warrior.double-strike": { animKey: "sword_attack_a", effects: ["fx.warrior.cleave"] },
  "warrior.avatar-form": { animKey: "sword_block", effects: ["fx.warrior.warcry"] },
  "warrior.perfect-counter": { animKey: "sword_block", effects: ["fx.warrior.warcry"] },

  // ranger
  "ranger.precision": { animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"] },
  "ranger.power-shot": { animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"] },
  "ranger.stealth-strike": { animKey: "marvel_stealth", effects: ["fx.ranger.camouflage"] },
  "ranger.dire-wolf": { animKey: "bow_shot", effects: [] },
  "ranger.great-ape": { animKey: "bow_shot", effects: [] },
  "ranger.war-kangaroo": { animKey: "bow_shot", effects: [] },
  "ranger.multi-shot": { animKey: "bow_shot", effects: ["fx.ranger.volley"] },
  "ranger.shadow-step": { animKey: "marvel_stealth", effects: ["fx.ranger.camouflage"] },
  "ranger.explosive-shot": { animKey: "bow_shot", effects: ["fx.ranger.piercing_shot"] },
  "ranger.poison-blade": { animKey: "marvel_melee", effects: ["fx.ranger.piercing_shot"] },
  "ranger.trap-mastery": { animKey: "marvel_melee", effects: [] },
  "ranger.rain-of-arrows": { animKey: "bow_shot", effects: ["fx.ranger.volley"] },
  "ranger.assassinate": { animKey: "marvel_stealth", effects: ["fx.ranger.camouflage"] },
  "ranger.storm-of-arrows": { animKey: "bow_shot", effects: ["fx.ranger.volley"] },
  "ranger.shadow-master": { animKey: "marvel_stealth", effects: ["fx.ranger.camouflage"] },

  // worge
  "worge.bear-form": { animKey: "venom_symbiote", effects: ["fx.worge.shapeshift"] },
  "worge.howl": { animKey: "venom_shackle", effects: ["fx.worge.howl"] },
  "worge.pack-hunt": { animKey: "venom_attack_b", effects: ["fx.worge.maul"] },
  "worge.feral-rage": { animKey: "venom_tentacles_a", effects: ["fx.worge.maul"] },
  "worge.alpha-call": { animKey: "venom_shackle", effects: ["fx.worge.howl"] },
  "worge.alpha-bear": { animKey: "venom_shackle", effects: ["fx.worge.howl"] },
  "worge.raptor-form": { animKey: "venom_symbiote", effects: ["fx.worge.shapeshift"] },
  "worge.blood-frenzy": { animKey: "venom_tentacles_a", effects: ["fx.worge.maul"] },
  "worge.apex-predator": { animKey: "venom_tentacles_a", effects: ["fx.worge.maul"] },
  "worge.primal-fury": { animKey: "venom_tentacles_a", effects: ["fx.worge.maul"] },
  "worge.worg-lord": { animKey: "venom_symbiote", effects: ["fx.worge.shapeshift"] },
  "worge.primal-avatar": { animKey: "venom_symbiote", effects: ["fx.worge.howl"] },
};

export function metaForClassSkill(skillId: string): ClassSkillMeta | undefined {
  return CLASS_SKILL_META[skillId];
}

/** Default primary weapon per class (drives EntitySpec + handoff gear). */
export const CLASS_DEFAULT_WEAPON = {
  mage: "staff",
  warrior: "sword",
  ranger: "bow",
  worge: "axe",
} as const satisfies Record<ClassId, import("./index").WeaponType>;