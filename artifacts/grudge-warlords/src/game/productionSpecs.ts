/**
 * Production building specializations — barracks (warrior / worge) and archery
 * (ranger / mage). Base units spawn from GRUDGE6 race+class ids; specs layer
 * stat modifiers and active skills on top.
 */

import type { ClassId, PrefabRaceId } from "@workspace/game-content";
import { playerGrudgeFaction, unitTypeId } from "../engine/grudge6";

export type WarriorSpec = "base" | "paladin" | "berserker" | "knight";
export type WorgeSpec = "base" | "pig" | "goat" | "bear";
export type MageSpec = "base" | "healer" | "damage" | "frost";
export type RangerSpec = "base" | "range" | "speed" | "powerShot";

export type UnitSkillId =
  | "powerShot"
  | "healPulse"
  | "frostSlow"
  | "fireBurst"
  | "defendWarlord"
  | "charge"
  | "auraHeal";

export interface SpecModifiers {
  hpMult: number;
  dmgMult: number;
  speedMult: number;
  rangeMult: number;
  attackRateMult: number;
  skills: UnitSkillId[];
  label: string;
  blurb: string;
  cost: number;
}

export interface ProductionSpecs {
  warrior: WarriorSpec;
  worge: WorgeSpec;
  mage: MageSpec;
  ranger: RangerSpec;
}

export const DEFAULT_PRODUCTION_SPECS: ProductionSpecs = {
  warrior: "base",
  worge: "base",
  mage: "base",
  ranger: "base",
};

export const WARRIOR_SPECS: Record<WarriorSpec, SpecModifiers> = {
  base: { hpMult: 1, dmgMult: 1, speedMult: 1, rangeMult: 1, attackRateMult: 1, skills: [], label: "Warrior", blurb: "Balanced melee line.", cost: 0 },
  paladin: {
    hpMult: 1.35, dmgMult: 0.9, speedMult: 0.92, rangeMult: 1, attackRateMult: 1.05,
    skills: ["auraHeal", "defendWarlord"],
    label: "Paladin", blurb: "Holy tank — heals nearby allies, peels to defend you.", cost: 220,
  },
  berserker: {
    hpMult: 0.88, dmgMult: 1.45, speedMult: 1.12, rangeMult: 1, attackRateMult: 0.72,
    skills: ["charge"],
    label: "Berserker", blurb: "Dual-wield fury — fast, brutal melee.", cost: 240,
  },
  knight: {
    hpMult: 1.25, dmgMult: 1.05, speedMult: 0.9, rangeMult: 1.1, attackRateMult: 1,
    skills: ["defendWarlord"],
    label: "Knight", blurb: "Sword & shield — durable frontline.", cost: 200,
  },
};

export const WORGE_SPECS: Record<WorgeSpec, SpecModifiers> = {
  base: { hpMult: 1, dmgMult: 1, speedMult: 1, rangeMult: 1, attackRateMult: 1, skills: [], label: "Worge", blurb: "Primal melee bruiser.", cost: 0 },
  pig: {
    hpMult: 1.15, dmgMult: 1.2, speedMult: 0.85, rangeMult: 1, attackRateMult: 0.95,
    skills: ["charge"],
    label: "Boar", blurb: "Heavy charger — breaks lines on impact.", cost: 210,
  },
  goat: {
    hpMult: 0.9, dmgMult: 0.95, speedMult: 1.35, rangeMult: 1, attackRateMult: 0.88,
    skills: [],
    label: "Goat", blurb: "Swift skirmisher — fastest worge path.", cost: 190,
  },
  bear: {
    hpMult: 1.5, dmgMult: 1.3, speedMult: 0.78, rangeMult: 1, attackRateMult: 1.15,
    skills: ["defendWarlord"],
    label: "Bear", blurb: "Apex tank — soaks damage near the warlord.", cost: 260,
  },
};

export const MAGE_SPECS: Record<MageSpec, SpecModifiers> = {
  base: { hpMult: 1, dmgMult: 1, speedMult: 1, rangeMult: 1, attackRateMult: 1, skills: [], label: "Mage", blurb: "Arcane ranged support.", cost: 0 },
  healer: {
    hpMult: 1.1, dmgMult: 0.55, speedMult: 0.95, rangeMult: 1, attackRateMult: 1.1,
    skills: ["healPulse"],
    label: "Healer", blurb: "Restores nearby allies on cadence.", cost: 230,
  },
  damage: {
    hpMult: 0.9, dmgMult: 1.55, speedMult: 1, rangeMult: 1.05, attackRateMult: 0.92,
    skills: ["fireBurst"],
    label: "War Mage", blurb: "High burst spell damage.", cost: 250,
  },
  frost: {
    hpMult: 1, dmgMult: 0.85, speedMult: 1, rangeMult: 1.1, attackRateMult: 1,
    skills: ["frostSlow"],
    label: "Frost Mage", blurb: "Slows enemies with every bolt.", cost: 220,
  },
};

export const RANGER_SPECS: Record<RangerSpec, SpecModifiers> = {
  base: { hpMult: 1, dmgMult: 1, speedMult: 1, rangeMult: 1, attackRateMult: 1, skills: [], label: "Ranger", blurb: "Steady bow line.", cost: 0 },
  range: {
    hpMult: 1, dmgMult: 1.05, speedMult: 0.95, rangeMult: 1.35, attackRateMult: 1.08,
    skills: [],
    label: "Longshot", blurb: "Extended reach and aggro.", cost: 200,
  },
  speed: {
    hpMult: 0.95, dmgMult: 0.92, speedMult: 1.28, rangeMult: 1, attackRateMult: 0.75,
    skills: [],
    label: "Skirmisher", blurb: "Fast movement and attack cadence.", cost: 210,
  },
  powerShot: {
    hpMult: 1, dmgMult: 1.1, speedMult: 0.9, rangeMult: 1.05, attackRateMult: 1.2,
    skills: ["powerShot"],
    label: "Marksman", blurb: "Heavy power shot every 3s.", cost: 240,
  },
};

/** Barracks spawns warrior + worge; archery spawns ranger + mage. */
export interface ProductionWave {
  classId: ClassId;
  specKey: keyof ProductionSpecs;
  /** Share of each wave (counts should sum to wave size). */
  count: number;
}

export interface ProductionRecipe {
  interval: number;
  waves: ProductionWave[];
  /** HP + damage multiplier from building tier. */
  tierStatMult: number;
}

function primaryRaces(): [PrefabRaceId, PrefabRaceId] {
  const f = playerGrudgeFaction();
  if (f === "crusade") return ["human", "barbarian"];
  if (f === "fabled") return ["dwarf", "elf"];
  return ["orc", "undead"];
}

export function barracksRecipe(level: number, specs: ProductionSpecs): ProductionRecipe {
  const [r0] = primaryRaces();
  const tierMult = 1 + (level - 1) * 0.12;
  const count = level === 1 ? 2 : level === 2 ? 3 : 4;
  const warriorN = Math.ceil(count / 2);
  const worgeN = count - warriorN;
  return {
    interval: level === 1 ? 18 : level === 2 ? 14 : 11,
    tierStatMult: tierMult,
    waves: [
      { classId: "warrior", specKey: "warrior", count: warriorN },
      { classId: "worge", specKey: "worge", count: worgeN },
    ],
  };
}

export function archeryRecipe(level: number, specs: ProductionSpecs): ProductionRecipe {
  const [, r1] = primaryRaces();
  void r1;
  const tierMult = 1 + (level - 1) * 0.14;
  const count = level === 1 ? 2 : level === 2 ? 3 : 4;
  const rangerN = Math.ceil(count / 2);
  const mageN = count - rangerN;
  return {
    interval: level === 1 ? 20 : level === 2 ? 16 : 13,
    tierStatMult: tierMult,
    waves: [
      { classId: "ranger", specKey: "ranger", count: rangerN },
      { classId: "mage", specKey: "mage", count: mageN },
    ],
  };
}

export function spawnTypeForWave(wave: ProductionWave): string {
  const [r0, r1] = primaryRaces();
  const race = wave.classId === "warrior" || wave.classId === "worge" ? r0 : r1;
  return unitTypeId(race, wave.classId);
}

export function specModifiersFor(specs: ProductionSpecs, key: keyof ProductionSpecs): SpecModifiers {
  const v = specs[key];
  if (key === "warrior") return WARRIOR_SPECS[v as WarriorSpec];
  if (key === "worge") return WORGE_SPECS[v as WorgeSpec];
  if (key === "mage") return MAGE_SPECS[v as MageSpec];
  return RANGER_SPECS[v as RangerSpec];
}

export function applySpecToSpawn(
  base: { hpMult: number; dmgMult: number },
  spec: SpecModifiers,
): { hpMult: number; dmgMult: number; specLabel: string; skills: UnitSkillId[] } {
  return {
    hpMult: base.hpMult * spec.hpMult,
    dmgMult: base.dmgMult * spec.dmgMult,
    specLabel: spec.label,
    skills: spec.skills,
  };
}