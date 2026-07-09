// ── Class skill icon paths (canonical) ────────────────────────────────────────
//
// Relative paths under /assets/skills/skillsicons/<set>/<Name>_<n>.png.
// Consumers resolve with their asset base (viewer uiAssetUrl, game grudgeAssetUrl).

import type { ClassId } from "./classes";

const ICON_DIR: Record<string, string> = {
  earth: "/assets/skills/skillsicons/earth/EarthMage",
  fire: "/assets/skills/skillsicons/fire/FireMage",
  frost: "/assets/skills/skillsicons/frost/FrostMage",
  hunter: "/assets/skills/skillsicons/hunter/Hunter",
  necro: "/assets/skills/skillsicons/necro/Necromancer",
};

function px(set: keyof typeof ICON_DIR, n: number): string {
  return `${ICON_DIR[set]}_${n}.png`;
}

/** Skill display name → root-relative icon path, keyed by class. */
export const CLASS_SKILL_ICON_PATHS: Record<ClassId, Record<string, string>> = {
  mage: {
    "Mana Shield": px("frost", 21),
    "Magic Missile": px("frost", 14),
    Heal: px("fire", 13),
    Fireball: px("fire", 28),
    "Greater Heal": px("earth", 10),
    "Lightning Chain": px("fire", 25),
    Blink: px("frost", 19),
    "Group Heal": px("fire", 22),
    Meteor: px("fire", 35),
    Portal: px("fire", 30),
    Archmage: px("fire", 40),
    "Reality Tear": px("fire", 20),
  },
  warrior: {
    Invulnerability: px("earth", 25),
    Taunt: px("earth", 13),
    "Quick Strike": px("fire", 2),
    "Damage Surge": px("fire", 26),
    "Guardian's Aura": px("earth", 31),
    "Dual Wield": px("hunter", 15),
    "Shield Specialist": px("earth", 4),
    "Life Drain": px("necro", 16),
    Execute: px("fire", 19),
    "Double Strike": px("fire", 17),
    "Avatar Form": px("fire", 33),
    "Perfect Counter": px("earth", 26),
  },
  ranger: {
    "Dire Wolf": px("hunter", 6),
    "Great Ape": px("hunter", 8),
    "War Kangaroo": px("hunter", 9),
    Precision: px("hunter", 4),
    "Power Shot": px("hunter", 24),
    "Stealth Strike": px("hunter", 14),
    "Multi Shot": px("hunter", 8),
    "Shadow Step": px("hunter", 6),
    "Explosive Shot": px("hunter", 17),
    "Poison Blade": px("hunter", 25),
    "Trap Mastery": px("hunter", 16),
    "Rain of Arrows": px("hunter", 22),
    Assassinate: px("hunter", 15),
    "Storm of Arrows": px("hunter", 18),
    "Shadow Master": px("hunter", 21),
  },
  worge: {
    "Bear Form": px("earth", 20),
    Howl: px("hunter", 9),
    "Pack Hunt": px("hunter", 1),
    "Feral Rage": px("fire", 14),
    "Alpha Call": px("hunter", 20),
    "Alpha Bear": px("earth", 31),
    "Raptor Form": px("fire", 36),
    "Blood Frenzy": px("fire", 3),
    "Apex Predator": px("hunter", 7),
    "Primal Fury": px("fire", 34),
    "Worg Lord": px("necro", 5),
    "Primal Avatar": px("fire", 33),
  },
};

/** Root-relative PNG path for a class skill, or "" when unmapped. */
export function iconPathForClassSkill(classId: ClassId, skillLabel: string): string {
  return CLASS_SKILL_ICON_PATHS[classId]?.[skillLabel] ?? "";
}