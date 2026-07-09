// ---------------------------------------------------------------------------
// Hero skill tree — levels 1–10 per match, class-branched picks from GRUDGE6
// trees (compressed from game-content tiers 0/1/5/10/15/20). Resets every game.
// ---------------------------------------------------------------------------

import {
  CLASS_BY_ID,
  classSkillById,
  type ClassId,
  type ClassSkillDef,
} from "@workspace/game-content";

export const MAX_HERO_LEVEL = 10;

/** Cumulative XP required to reach each level (index = level). */
export const HERO_LEVEL_XP: number[] = [
  0, 100, 220, 360, 520, 700, 900, 1120, 1360, 1620, 1900,
];

/** Levels where the player chooses one skill from the class tree. */
export const PICK_LEVELS = [2, 4, 6, 8, 10] as const;

/** Maps pick level → authored tier level in game-content. */
const TIER_FOR_PICK: Record<number, number> = {
  2: 1,
  4: 5,
  6: 10,
  8: 15,
  10: 20,
};

export const HERO_XP_KILL = 80;
export const HERO_XP_TOWER = 120;

export interface HeroSkillBonuses {
  damageMult: number;
  defense: number;
  bonusHp: number;
  attackSpeedMult: number;
  dashCooldownMult: number;
  slamCooldownMult: number;
  slamDamageMult: number;
  lifeSteal: number;
  executeBonus: number;
}

export const EMPTY_HERO_BONUSES: HeroSkillBonuses = {
  damageMult: 0,
  defense: 0,
  bonusHp: 0,
  attackSpeedMult: 0,
  dashCooldownMult: 1,
  slamCooldownMult: 1,
  slamDamageMult: 1,
  lifeSteal: 0,
  executeBonus: 0,
};

/** Mechanical bonuses keyed by authored class skill id. */
const SKILL_BONUSES: Record<string, Partial<HeroSkillBonuses>> = {
  // Mage
  "mage.mana-shield": { defense: 0.06, bonusHp: 18 },
  "mage.magic-missile": { damageMult: 0.1 },
  "mage.heal": { bonusHp: 30, lifeSteal: 0.04 },
  "mage.fireball": { damageMult: 0.14, slamDamageMult: 1.12 },
  "mage.greater-heal": { bonusHp: 45, defense: 0.04 },
  "mage.lightning-chain": { damageMult: 0.16, attackSpeedMult: 0.08 },
  "mage.blink": { dashCooldownMult: 0.72 },
  "mage.group-heal": { bonusHp: 35, defense: 0.05 },
  "mage.meteor": { damageMult: 0.22, slamDamageMult: 1.25 },
  "mage.portal": { dashCooldownMult: 0.65, bonusHp: 25 },
  "mage.archmage": { damageMult: 0.28, slamCooldownMult: 0.8 },
  "mage.reality-tear": { damageMult: 0.32, executeBonus: 0.35 },
  // Warrior
  "warrior.invulnerability": { defense: 0.08, bonusHp: 25 },
  "warrior.taunt": { defense: 0.06, bonusHp: 20 },
  "warrior.quick-strike": { attackSpeedMult: 0.15, damageMult: 0.06 },
  "warrior.damage-surge": { damageMult: 0.2 },
  "warrior.guardians-aura": { defense: 0.1, bonusHp: 30 },
  "warrior.dual-wield": { attackSpeedMult: 0.2, damageMult: 0.08 },
  "warrior.shield-specialist": { defense: 0.12, bonusHp: 35 },
  "warrior.life-drain": { lifeSteal: 0.1, damageMult: 0.06 },
  "warrior.execute": { executeBonus: 0.5, damageMult: 0.1 },
  "warrior.double-strike": { attackSpeedMult: 0.12, damageMult: 0.14 },
  "warrior.avatar-form": { damageMult: 0.22, bonusHp: 50, defense: 0.06 },
  "warrior.perfect-counter": { defense: 0.14, lifeSteal: 0.06 },
  // Ranger
  "ranger.precision": { damageMult: 0.08, attackSpeedMult: 0.06 },
  "ranger.power-shot": { damageMult: 0.14 },
  "ranger.stealth-strike": { damageMult: 0.12, executeBonus: 0.25 },
  "ranger.dire-wolf": { damageMult: 0.08, attackSpeedMult: 0.1 },
  "ranger.great-ape": { bonusHp: 40, defense: 0.06 },
  "ranger.war-kangaroo": { attackSpeedMult: 0.14, dashCooldownMult: 0.82 },
  "ranger.multi-shot": { damageMult: 0.12, attackSpeedMult: 0.08 },
  "ranger.shadow-step": { dashCooldownMult: 0.7 },
  "ranger.explosive-shot": { damageMult: 0.18, slamDamageMult: 1.15 },
  "ranger.poison-blade": { damageMult: 0.1, lifeSteal: 0.08 },
  "ranger.trap-mastery": { defense: 0.05, bonusHp: 20 },
  "ranger.rain-of-arrows": { damageMult: 0.2, attackSpeedMult: 0.1 },
  "ranger.assassinate": { executeBonus: 0.45, damageMult: 0.14 },
  "ranger.storm-of-arrows": { damageMult: 0.26, attackSpeedMult: 0.12 },
  "ranger.shadow-master": { executeBonus: 0.3, dashCooldownMult: 0.68 },
  // Worge
  "worge.bear-form": { bonusHp: 55, defense: 0.1 },
  "worge.howl": { damageMult: 0.08, slamCooldownMult: 0.85 },
  "worge.pack-hunt": { damageMult: 0.14 },
  "worge.feral-rage": { attackSpeedMult: 0.22, damageMult: 0.08 },
  "worge.alpha-call": { bonusHp: 25, damageMult: 0.1 },
  "worge.alpha-bear": { defense: 0.12, bonusHp: 40 },
  "worge.raptor-form": { damageMult: 0.14, executeBonus: 0.2 },
  "worge.blood-frenzy": { damageMult: 0.18, lifeSteal: 0.06 },
  "worge.apex-predator": { executeBonus: 0.35, damageMult: 0.12 },
  "worge.primal-fury": { damageMult: 0.24, attackSpeedMult: 0.15 },
  "worge.worg-lord": { bonusHp: 60, defense: 0.14, damageMult: 0.1 },
  "worge.primal-avatar": { damageMult: 0.2, slamDamageMult: 1.3, bonusHp: 45 },
};

export interface SkillPickOption {
  id: string;
  label: string;
  description: string;
  icon?: string;
  color: string;
}

function mergeBonuses(base: HeroSkillBonuses, add: Partial<HeroSkillBonuses>): void {
  if (add.damageMult) base.damageMult += add.damageMult;
  if (add.defense) base.defense += add.defense;
  if (add.bonusHp) base.bonusHp += add.bonusHp;
  if (add.attackSpeedMult) base.attackSpeedMult += add.attackSpeedMult;
  if (add.dashCooldownMult) base.dashCooldownMult *= add.dashCooldownMult;
  if (add.slamCooldownMult) base.slamCooldownMult *= add.slamCooldownMult;
  if (add.slamDamageMult) base.slamDamageMult *= add.slamDamageMult;
  if (add.lifeSteal) base.lifeSteal += add.lifeSteal;
  if (add.executeBonus) base.executeBonus += add.executeBonus;
}

/** Tier-0 auto skill granted at level 1. */
export function startingSkillId(classId: ClassId): string {
  const tier = CLASS_BY_ID[classId].tiers.find((t) => t.level === 0);
  return tier?.skills[0]?.id ?? "";
}

/** Skill choices offered at a pick level (2 / 4 / 6 / 8 / 10). */
export function skillPickOptions(classId: ClassId, pickLevel: number): ClassSkillDef[] {
  const tierLevel = TIER_FOR_PICK[pickLevel];
  const tier = CLASS_BY_ID[classId].tiers.find((t) => t.level === tierLevel);
  return tier?.skills ?? [];
}

export function toPickOptions(classId: ClassId, pickLevel: number): SkillPickOption[] {
  const color = CLASS_BY_ID[classId].color;
  return skillPickOptions(classId, pickLevel).map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    icon: s.icon,
    color,
  }));
}

/** How many player-chosen skills should exist at this hero level. */
export function requiredPicks(level: number): number {
  return PICK_LEVELS.filter((pl) => pl <= level).length;
}

/** True when the hero has leveled past a pick gate but not chosen yet. */
export function needsSkillPick(level: number, skillPicks: string[]): boolean {
  const choices = Math.max(0, skillPicks.length - 1);
  return choices < requiredPicks(level);
}

/** Next pick level that still needs a choice, or null. */
export function nextPendingPickLevel(level: number, skillPicks: string[]): number | null {
  const choices = Math.max(0, skillPicks.length - 1);
  for (const pl of PICK_LEVELS) {
    if (pl > level) break;
    if (choices < PICK_LEVELS.indexOf(pl) + 1) return pl;
  }
  return null;
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  for (let l = 2; l <= MAX_HERO_LEVEL; l++) {
    if (xp >= HERO_LEVEL_XP[l]) lvl = l;
    else break;
  }
  return lvl;
}

export function xpBar(level: number, xp: number): { cur: number; need: number; pct: number } {
  if (level >= MAX_HERO_LEVEL) return { cur: 0, need: 0, pct: 100 };
  const floor = HERO_LEVEL_XP[level];
  const ceil = HERO_LEVEL_XP[level + 1];
  const cur = xp - floor;
  const need = ceil - floor;
  return { cur, need, pct: need > 0 ? Math.min(100, (cur / need) * 100) : 100 };
}

export function computeHeroBonuses(
  classId: ClassId,
  picks: string[],
  level: number,
): HeroSkillBonuses {
  const out: HeroSkillBonuses = { ...EMPTY_HERO_BONUSES };
  for (const id of picks) {
    const mapped = SKILL_BONUSES[id];
    if (mapped) mergeBonuses(out, mapped);
    else {
      const skill = classSkillById(id);
      if (skill?.stats?.["+DMG"]) {
        const raw = skill.stats["+DMG"];
        const pct = typeof raw === "string" ? parseFloat(raw) / 100 : Number(raw) / 100;
        if (!Number.isNaN(pct)) out.damageMult += pct;
      }
    }
  }
  const steps = Math.max(0, level - 1);
  out.bonusHp += steps * 5;
  out.damageMult += steps * 0.012;
  return out;
}