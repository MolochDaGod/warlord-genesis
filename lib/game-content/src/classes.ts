// ── Classes & class skill trees ───────────────────────────────────────────────
//
// The four GRUDGE Warlords classes and their tiered skill trees. These mirror the
// viewer's authored class selector (character-viewer/src/types/grudgeClasses.ts)
// 1:1 — same classes (mage / warrior / ranger / worge), same six progression
// tiers (levels 0/1/5/10/15/20), same skills, descriptions and stat bags. The lib
// can't import an artifact, so the authored data is duplicated here (the single
// source of truth shared between the viewer and the playable game). Keep the two
// in sync when skills change.
//
// Each class skill carries an optional stat bag + glyph (authored), the effect ids
// it fires (forward hook — empty until the effect system binds them) and an
// optional bound animation key (see animations.ts ANIM_BY_KEY).

import { metaForClassSkill } from "./classSkillMeta";
import { iconPathForClassSkill } from "./skillIcons";
import { toSlug } from "./ids";

export type ClassId = "mage" | "warrior" | "ranger" | "worge";

export interface ClassSkillDef {
  id: string;
  label: string;
  /** Class skill effect ids fired when the skill triggers. */
  effects: string[];
  /** Animation key (animations.ts) played on cast. */
  animKey?: string;
  cooldown?: number;
  /** Glyph fallback from the authored selector. */
  icon?: string;
  /** Root-relative skill icon PNG (`/assets/skills/...`). */
  iconPath?: string;
  /** Loose authored stat bag (Mana / CD / DMG / Range / …). */
  stats?: Record<string, string | number>;
  description: string;
}

export interface ClassTier {
  /** Unlock level: 0 (auto) / 1 / 5 / 10 / 15 / 20. */
  level: number;
  label: string;
  /** How many skills the player picks from this tier (auto = all). */
  picks: number;
  /** Authored hint text, e.g. "Pick 1 of 2" / "Automatic". */
  hint?: string;
  auto?: boolean;
  skills: ClassSkillDef[];
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  /** Theme color used by the UI. */
  color: string;
  /** Gear preset id this class maps onto in the viewer. */
  presetId: string;
  description: string;
  tiers: ClassTier[];
}

// ── Class skill effects ───────────────────────────────────────────────────────
// Placeholder VFX bindings keyed by id; the game's effect system resolves these
// to real shaders/particles later. Shared shape with EffectDef in index.ts.
export interface ClassEffectDef {
  id: string;
  label: string;
  kind: "particle" | "projectile" | "aura" | "impact" | "buff";
  color: string;
  classId: ClassId;
  description: string;
}

export const CLASS_EFFECTS: ClassEffectDef[] = [
  { id: "fx.mage.firebolt", label: "Firebolt", kind: "projectile", color: "#f97316", classId: "mage", description: "Hurled bolt of flame." },
  { id: "fx.mage.frost_nova", label: "Frost Nova", kind: "aura", color: "#38bdf8", classId: "mage", description: "Radial freezing burst." },
  { id: "fx.mage.arcane_shield", label: "Arcane Shield", kind: "buff", color: "#a855f7", classId: "mage", description: "Absorbing ward." },
  { id: "fx.warrior.cleave", label: "Cleave", kind: "impact", color: "#ef4444", classId: "warrior", description: "Wide sweeping strike." },
  { id: "fx.warrior.warcry", label: "War Cry", kind: "aura", color: "#eab308", classId: "warrior", description: "Rallying shout buff." },
  { id: "fx.warrior.ground_slam", label: "Ground Slam", kind: "impact", color: "#a16207", classId: "warrior", description: "Shockwave on impact." },
  { id: "fx.ranger.piercing_shot", label: "Piercing Shot", kind: "projectile", color: "#10b981", classId: "ranger", description: "Armor-piercing arrow." },
  { id: "fx.ranger.volley", label: "Volley", kind: "projectile", color: "#22c55e", classId: "ranger", description: "Arrow rain over an area." },
  { id: "fx.ranger.camouflage", label: "Camouflage", kind: "buff", color: "#15803d", classId: "ranger", description: "Stealth concealment." },
  { id: "fx.worge.maul", label: "Maul", kind: "impact", color: "#f59e0b", classId: "worge", description: "Beast-form rending bite." },
  { id: "fx.worge.howl", label: "Howl", kind: "aura", color: "#d97706", classId: "worge", description: "Fear-inducing howl." },
  { id: "fx.worge.shapeshift", label: "Shapeshift", kind: "buff", color: "#b45309", classId: "worge", description: "Transform into worg form." },
];

export const CLASS_EFFECT_BY_ID: Record<string, ClassEffectDef> = Object.fromEntries(
  CLASS_EFFECTS.map((e) => [e.id, e]),
);

// ── Class trees (authored) ─────────────────────────────────────────────────────
// Raw authored tiers (auto tier => picks = skill count; otherwise explicit picks
// or 1). Mirrors the viewer's RAW_CLASSES so the two never drift apart.
interface RawSkill {
  n: string;
  i: string;
  d: string;
  stats: Record<string, string | number>;
}
interface RawTier {
  lvl: number;
  label: string;
  hint: string;
  auto?: boolean;
  picks?: number;
  skills: RawSkill[];
}
interface RawClass {
  id: ClassId;
  name: string;
  role: string;
  color: string;
  presetId: string;
  description: string;
  tiers: RawTier[];
}

const RAW_CLASSES: RawClass[] = [
  {
    id: "mage", name: "Mage Priest", role: "Primary Healer · Magic DPS · Utility",
    color: "#8b5cf6", presetId: "mage",
    description: "Mana Shield & Mobility — mana-based shield, Blink teleport, and portals.",
    tiers: [
      { lvl: 0, label: "Arcane Affinity", hint: "Automatic", auto: true, skills: [
        { n: "Mana Shield", i: "◈", d: "Passive shield based on mana %. Active: 15s massive crit/spell boost.", stats: { Mana: 20, CD: "30s", Duration: "15s", Range: "10y" } },
      ] },
      { lvl: 1, label: "Basic Arts", hint: "Pick 1 of 2", skills: [
        { n: "Magic Missile", i: "✶", d: "Multi-projectile damage. Fast, cheap, reliable.", stats: { Mana: 5, CD: "0.5s", DMG: 10, Range: "25y" } },
        { n: "Heal", i: "✚", d: "Direct single-target healing spell.", stats: { Mana: 15, CD: "8s", Duration: "3s", Range: "20y" } },
      ] },
      { lvl: 5, label: "Specialization", hint: "Pick 1 of 2", skills: [
        { n: "Fireball", i: "🔥", d: "AoE fire damage. Explodes on impact.", stats: { Mana: 20, CD: "6s", DMG: 25, AoE: "Yes" } },
        { n: "Greater Heal", i: "✦", d: "Powerful single-target heal with +50% healing power.", stats: { Mana: 30, CD: "12s", Duration: "5s", Range: "25y" } },
      ] },
      { lvl: 10, label: "Advanced Magic", hint: "Pick 1 of 3", skills: [
        { n: "Lightning Chain", i: "⚝", d: "Chains to up to 5 targets for multi-target damage.", stats: { Mana: 35, CD: "10s", DMG: 30, Range: "30y" } },
        { n: "Blink", i: "⚡", d: "10-yard directional teleport. Instant movement.", stats: { Mana: 20, CD: "15s", Range: "10y" } },
        { n: "Group Heal", i: "✧", d: "AoE heal for party. Restores nearby allies.", stats: { Mana: 40, CD: "20s", Duration: "5s", Range: "15y" } },
      ] },
      { lvl: 15, label: "Master Tier", hint: "Pick 1 of 2", skills: [
        { n: "Meteor", i: "☄", d: "Delayed massive AoE damage. Massive destruction.", stats: { Mana: 60, CD: "45s", DMG: 100, AoE: "Yes" } },
        { n: "Portal", i: "◉", d: "Place/connect portals for team teleportation.", stats: { Mana: 50, CD: "120s", Duration: "30s", Range: "10y" } },
      ] },
      { lvl: 20, label: "Legendary Magic", hint: "Pick 1 of 2", skills: [
        { n: "Archmage", i: "✪", d: "+40% Spell Power. Reduced costs & cooldowns. Ultimate power.", stats: { Mana: 80, CD: "180s", Duration: "30s", "+SP": "40%" } },
        { n: "Reality Tear", i: "✺", d: "Devastating line-of-effect reality-warping damage.", stats: { Mana: 90, CD: "150s", DMG: 180, AoE: "Line" } },
      ] },
    ],
  },
  {
    id: "warrior", name: "Warrior", role: "Tank · DPS · Paladin",
    color: "#ef4444", presetId: "warrior",
    description: "Flexible fighter — can spec tank, DPS, or paladin support.",
    tiers: [
      { lvl: 0, label: "Invincibility", hint: "Automatic", auto: true, skills: [
        { n: "Invulnerability", i: "⛨", d: "Temporary immunity (1–4s). Scales with trait level.", stats: { Mana: 30, CD: "60s", Duration: "1s", Range: "Self" } },
      ] },
      { lvl: 1, label: "Combat Basics", hint: "Pick 1 of 2", skills: [
        { n: "Taunt", i: "❢", d: "Force enemies to target you. Threat generation.", stats: { Mana: 10, CD: "15s", Duration: "5s", Range: "10y" } },
        { n: "Quick Strike", i: "⚔", d: "Fast attack with +15% attack speed bonus.", stats: { Mana: 5, CD: "3s", DMG: 8, Range: "3y" } },
      ] },
      { lvl: 5, label: "Specialization", hint: "Pick 1 of 2", skills: [
        { n: "Damage Surge", i: "↑", d: "+25% damage for 5s. Temporary damage boost.", stats: { Mana: 15, CD: "20s", Duration: "5s", "+DMG": "25%" } },
        { n: "Guardian's Aura", i: "◎", d: "+15% party defense within range. Ally buff.", stats: { Mana: 20, CD: "45s", Duration: "30s", Range: "15y" } },
      ] },
      { lvl: 10, label: "Advanced Combat", hint: "Pick 1 of 3", skills: [
        { n: "Dual Wield", i: "✕", d: "Attack speed and multi-hit capability.", stats: { Passive: "Yes", "+AS": "20%", Hits: "2", Range: "3y" } },
        { n: "Shield Specialist", i: "✜", d: "Increases block chance and defense.", stats: { Passive: "Yes", Block: "+15%", Def: "+10%" } },
        { n: "Life Drain", i: "♡", d: "Damage heals you for 10% of damage dealt.", stats: { Mana: 15, CD: "15s", DMG: 20, Heal: "10%" } },
      ] },
      { lvl: 15, label: "Master Warrior", hint: "Pick 1 of 2", skills: [
        { n: "Execute", i: "⚒", d: "+50% damage vs enemies below 30% HP.", stats: { Mana: 25, CD: "20s", DMG: 40, Bonus: "+50% <30%" } },
        { n: "Double Strike", i: "✖", d: "Two consecutive attacks for 2× damage.", stats: { Mana: 12, CD: "8s", DMG: "15×2", Range: "3y" } },
      ] },
      { lvl: 20, label: "Legendary Warrior", hint: "Pick 1 of 2", skills: [
        { n: "Avatar Form", i: "✪", d: "All stats boosted + increased size. Ultimate transformation.", stats: { Mana: 50, CD: "120s", Duration: "15s", "+All": "30%" } },
        { n: "Perfect Counter", i: "◈", d: "Chance to fully counter incoming attacks and retaliate.", stats: { Passive: "Yes", Chance: "25%", Counter: "+100%" } },
      ] },
    ],
  },
  {
    id: "ranger", name: "Ranger Scout", role: "Primary DPS · Utility · Off-Tank",
    color: "#22c55e", presetId: "ranger",
    description: "Dual specialization — ranged master or melee assassin with traps and mobility.",
    tiers: [
      { lvl: 0, label: "Hunter's Instinct", hint: "Automatic", auto: true, skills: [
        { n: "Precision", i: "◇", d: "Passive accuracy/crit bonus & movement speed in natural terrain.", stats: { Mana: 15, CD: "45s", Duration: "30s", "+Acc": "10%" } },
      ] },
      { lvl: 1, label: "Basic Training", hint: "Pick 1 of 2", skills: [
        { n: "Power Shot", i: "➤", d: "High damage ranged attack. +25% ranged damage.", stats: { Mana: 5, CD: "0.5s", DMG: 15, Range: "30y" } },
        { n: "Stealth Strike", i: "✦", d: "Melee attack from stealth — guaranteed crit.", stats: { Mana: 10, CD: "10s", DMG: 20, Range: "3y" } },
      ] },
      { lvl: 3, label: "Nimble Fingers", hint: "Pick 1 of 3", skills: [
        { n: "Dire Wolf", i: "❖", d: "Tame a swift arcane wolf that hunts at your side.", stats: { Type: "Companion", Role: "Skirmisher" } },
        { n: "Great Ape", i: "❖", d: "Bond a hulking ape guardian to lumber beside you.", stats: { Type: "Companion", Role: "Bruiser" } },
        { n: "War Kangaroo", i: "❖", d: "Train a boxing kangaroo that bounds into the fray.", stats: { Type: "Companion", Role: "Brawler" } },
      ] },
      { lvl: 5, label: "Specialization", hint: "Pick 1 of 2", skills: [
        { n: "Multi Shot", i: "⋯", d: "Fire multiple arrows. Hits up to 3 targets.", stats: { Mana: 15, CD: "8s", DMG: 12, Targets: 3 } },
        { n: "Shadow Step", i: "➶", d: "Short-range teleport behind enemy. Instant reposition.", stats: { Mana: 12, CD: "12s", Duration: "3s", Range: "10y" } },
      ] },
      { lvl: 10, label: "Advanced Techniques", hint: "Pick 1 of 3", skills: [
        { n: "Explosive Shot", i: "✺", d: "AoE ranged damage. Explodes on impact.", stats: { Mana: 25, CD: "15s", DMG: 35, AoE: "Yes" } },
        { n: "Poison Blade", i: "☠", d: "Melee attacks apply a poison DoT.", stats: { Mana: 10, CD: "6s", DMG: 10, DoT: "Yes" } },
        { n: "Trap Mastery", i: "◈", d: "Deploy and upgrade multiple trap types.", stats: { Mana: 20, CD: "30s", Duration: "60s" } },
      ] },
      { lvl: 15, label: "Master Hunter", hint: "Pick 1 of 2", skills: [
        { n: "Rain of Arrows", i: "⇊", d: "Massive AoE ranged barrage.", stats: { Mana: 40, CD: "30s", DMG: 60, AoE: "Yes" } },
        { n: "Assassinate", i: "✖", d: "High-damage stealth execution. +200% stealth damage.", stats: { Mana: 30, CD: "25s", DMG: 50, Bonus: "+200% stealth" } },
      ] },
      { lvl: 20, label: "Legendary Skills", hint: "Pick 1 of 2", skills: [
        { n: "Storm of Arrows", i: "✪", d: "Ultimate ranged devastation. Massive AoE damage.", stats: { Mana: 60, CD: "60s", DMG: 120, AoE: "Yes" } },
        { n: "Shadow Master", i: "◆", d: "Enhanced stealth: multiple strikes, perma-stealth.", stats: { Mana: 50, CD: "120s", Duration: "20s" } },
      ] },
    ],
  },
  {
    id: "worge", name: "Worg Shapeshifter", role: "Primary Tank · Burst DPS · Utility",
    color: "#f59e0b", presetId: "warrior",
    description: "Shapeshifting: become different animal forms with unique stats and roles.",
    tiers: [
      { lvl: 0, label: "Primal Shift", hint: "Automatic", auto: true, skills: [
        { n: "Bear Form", i: "🐻", d: "Transform into WorgBear: massive HP/Defense, threat generation, damage reduction.", stats: { Mana: 25, CD: "30s", Duration: "60s", "+HP": "50%" } },
      ] },
      { lvl: 1, label: "Pack Instincts", hint: "Pick 1 of 2", skills: [
        { n: "Howl", i: "♪", d: "AoE fear + debuff enemies around you.", stats: { Mana: 15, CD: "20s", Duration: "3s", Range: "10y" } },
        { n: "Pack Hunt", i: "◉", d: "Damage bonus when near allied units.", stats: { Mana: 15, CD: "25s", Duration: "20s", "+DMG": "20%" } },
      ] },
      { lvl: 5, label: "Primal Mastery", hint: "Pick 1 of 2", skills: [
        { n: "Feral Rage", i: "✱", d: "+25% attack speed for duration.", stats: { Mana: 20, CD: "30s", Duration: "10s", "+AS": "25%" } },
        { n: "Alpha Call", i: "✦", d: "Summon 2 temporary wolf allies.", stats: { Mana: 30, CD: "60s", Duration: "30s", Summons: 2 } },
      ] },
      { lvl: 10, label: "Advanced", hint: "Pick 1 of 3", skills: [
        { n: "Alpha Bear", i: "✜", d: "AoE taunt + tanking buffs while in Bear form.", stats: { Mana: 25, CD: "30s", Duration: "10s", Range: "15y" } },
        { n: "Raptor Form", i: "🦖", d: "Stealth DPS form. Crit strike bonus.", stats: { Mana: 25, CD: "30s", Duration: "45s" } },
        { n: "Blood Frenzy", i: "♥", d: "Damage increases as health decreases.", stats: { Mana: 20, CD: "45s", Duration: "15s", "+DMG": "50% lowHP" } },
      ] },
      { lvl: 15, label: "Apex Predator", hint: "Pick 1 of 2", skills: [
        { n: "Apex Predator", i: "◆", d: "Enhanced tracking. +30% damage vs wounded targets.", stats: { Mana: 35, CD: "60s", Duration: "20s", "+DMG": "30%" } },
        { n: "Primal Fury", i: "⚡", d: "+100% all stats, costs HP/s while active.", stats: { Mana: 40, CD: "90s", Duration: "10s", "+All": "100%" } },
      ] },
      { lvl: 20, label: "Legendary Choices", hint: "Pick 2 of 2", picks: 2, skills: [
        { n: "Worg Lord", i: "✪", d: "Ultimate tank form. Pack summoning + ultimate power.", stats: { Mana: 60, CD: "180s", Duration: "30s", "+HP": "+100%" } },
        { n: "Primal Avatar", i: "☽", d: "Colossal form: huge stat increase and fear aura.", stats: { Mana: 70, CD: "180s", Duration: "25s", "+Size": "Yes" } },
      ] },
    ],
  },
];

export const CLASSES: ClassDef[] = RAW_CLASSES.map((c) => ({
  id: c.id,
  name: c.name,
  role: c.role,
  color: c.color,
  presetId: c.presetId,
  description: c.description,
  tiers: c.tiers.map((t) => ({
    level: t.lvl,
    label: t.label,
    hint: t.hint,
    auto: t.auto,
    picks: t.auto ? t.skills.length : t.picks ?? 1,
    skills: t.skills.map((s) => {
      const id = `${c.id}.${toSlug(s.n)}`;
      const meta = metaForClassSkill(id);
      return {
        id,
        label: s.n,
        icon: s.i,
        iconPath: iconPathForClassSkill(c.id, s.n) || undefined,
        description: s.d,
        stats: s.stats,
        animKey: meta?.animKey,
        effects: meta?.effects ?? [],
      };
    }),
  })),
}));

export const CLASS_BY_ID: Record<ClassId, ClassDef> = Object.fromEntries(
  CLASSES.map((c) => [c.id, c]),
) as Record<ClassId, ClassDef>;

export function classSkillById(id: string): ClassSkillDef | undefined {
  for (const c of CLASSES) {
    for (const t of c.tiers) {
      const s = t.skills.find((s) => s.id === id);
      if (s) return s;
    }
  }
  return undefined;
}

/** Stable digest of the authored class trees (drift detection across apps). */
export function classTreeDigest(): string {
  const rows: string[] = [];
  for (const c of RAW_CLASSES) {
    for (const t of c.tiers) {
      for (const s of t.skills) {
        rows.push(
          `${c.id}|${t.lvl}|${s.n}|${s.d}|${JSON.stringify(s.stats)}`,
        );
      }
    }
  }
  return rows.join("\n");
}
