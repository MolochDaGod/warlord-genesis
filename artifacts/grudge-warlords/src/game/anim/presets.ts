import type { WeaponClass, CharacterLook } from "./types";

/**
 * Roster of selectable / spawnable animated characters. Each preset is a
 * combination the procedural Animator can build directly: a set of weapon
 * `classes` whose motion clips to preload, the initially equipped `weapon` (the
 * character's tool), a recolourable `look`, and a target `height`. Only classes
 * whose clip packs are staged under `public/anim/animations` animate well, so
 * tools are restricted to rifle / bow / pistol / unarmed.
 */
export type CharacterRole = "hero" | "enemy";

export interface CharacterPreset {
  id: string;
  name: string;
  role: CharacterRole;
  blurb: string;
  /** Short human-readable tool name for UI. */
  weaponLabel: string;
  /** Weapon classes whose clips to preload (always include "unarmed"). */
  classes: WeaponClass[];
  /** Initially equipped class — the character's tool. */
  weapon: WeaponClass;
  look: CharacterLook;
  /** Target world-space height in metres. */
  height: number;
  /** UI accent colour for the select card. */
  accent: string;
  /**
   * Optional GLB character model id (`character-a` .. `character-r`). When set,
   * the animated rig is built from that authored model; the procedural box avatar
   * is used otherwise (and as a fallback if the model fails to load).
   */
  model?: string;
}

/** The six player-selectable races, each with its own tool. */
export const HERO_PRESETS: CharacterPreset[] = [
  {
    id: "human",
    name: "Human",
    role: "hero",
    blurb: "Colony marine — balanced rifle infantry with steady fire and mobility.",
    weaponLabel: "Rifle",
    classes: ["unarmed", "ranged"],
    weapon: "ranged",
    look: { skin: "#c98c5a", shirt: "#3a5a8c", pants: "#22303f", hat: "cap", hatColor: "#26344a", eyeColor: "#3a6ea5" },
    height: 1.85,
    accent: "#5aa0ff",
    model: "character-a",
  },
  {
    id: "sylvan",
    name: "Sylvan",
    role: "hero",
    blurb: "Forest-born archer — agile skirmisher with the deepest animation set.",
    weaponLabel: "Bow",
    classes: ["unarmed", "bow"],
    weapon: "bow",
    look: { skin: "#caa06a", shirt: "#2f5d3a", pants: "#23351f", hat: "hood", hatColor: "#1c3322", eyeColor: "#5fae6b" },
    height: 1.82,
    accent: "#5fd08a",
    model: "character-b",
  },
  {
    id: "drifter",
    name: "Drifter",
    role: "hero",
    blurb: "Wasteland gunslinger — fast draw and close-quarters flourishes.",
    weaponLabel: "Pistol",
    classes: ["unarmed", "pistol"],
    weapon: "pistol",
    look: { skin: "#b9835a", shirt: "#7a3b2e", pants: "#2b2622", hat: "cap", hatColor: "#3a2018", eyeColor: "#c9a227" },
    height: 1.8,
    accent: "#e0915a",
    model: "character-c",
  },
  {
    id: "orc",
    name: "Orc",
    role: "hero",
    blurb: "Tusked bruiser — unarmed close-combat pressure and brute footwork.",
    weaponLabel: "Unarmed",
    classes: ["unarmed"],
    weapon: "unarmed",
    look: { skin: "#6f8a52", shirt: "#5a2420", pants: "#2e211c", hat: "horns", hatColor: "#d8c9b0", eyeColor: "#c0392b" },
    height: 2.0,
    accent: "#9bd05a",
    model: "character-d",
  },
  {
    id: "ender",
    name: "Ender",
    role: "hero",
    blurb: "Void-touched stalker — long-range bow flanker that fights from the dark.",
    weaponLabel: "Bow",
    classes: ["unarmed", "bow"],
    weapon: "bow",
    look: { skin: "#26222e", shirt: "#1a1622", pants: "#120f18", hat: "antenna", hatColor: "#7a4fb0", eyeColor: "#9b59b6" },
    height: 1.95,
    accent: "#a878ff",
    model: "character-e",
  },
  {
    id: "construct",
    name: "Construct",
    role: "hero",
    blurb: "Salvaged sentinel — armoured rifle platform built to hold the line.",
    weaponLabel: "Rifle",
    classes: ["unarmed", "ranged"],
    weapon: "ranged",
    look: { skin: "#9aa3ad", shirt: "#5b6470", pants: "#33383f", hat: "crest", hatColor: "#c9a227", eyeColor: "#c0392b" },
    height: 1.9,
    accent: "#cdd3df",
    model: "character-f",
  },
  {
    id: "templar",
    name: "Templar",
    role: "hero",
    blurb: "Shieldbearer vanguard — sword-and-shield duelist who holds the front with guarded slashes.",
    weaponLabel: "Sword & Shield",
    classes: ["unarmed", "sword"],
    weapon: "sword",
    look: { skin: "#caa06a", shirt: "#43618f", pants: "#2a3340", hat: "crest", hatColor: "#c9a227", eyeColor: "#3a6ea5" },
    height: 1.88,
    accent: "#7fb0ff",
    model: "character-g",
  },
  {
    id: "breaker",
    name: "Breaker",
    role: "hero",
    blurb: "Siege-breaker — cleaves with a massive two-handed greatsword in crushing arcs.",
    weaponLabel: "Greatsword",
    classes: ["unarmed", "greatsword"],
    weapon: "greatsword",
    look: { skin: "#b9835a", shirt: "#5a3a22", pants: "#2e241c", hat: "horns", hatColor: "#8a6a3a", eyeColor: "#c0392b" },
    height: 2.05,
    accent: "#d08a4a",
    model: "character-h",
  },
];

/**
 * Hostile-faction variants, ready for the unit/enemy spawner to consume. Kept in
 * data form (not yet rendered as enemies) so the in-flight match/unit system can
 * adopt them without a content rewrite.
 */
export const ENEMY_PRESETS: CharacterPreset[] = [
  {
    id: "raider",
    name: "Raider",
    role: "enemy",
    blurb: "Hostile rifle infantry.",
    weaponLabel: "Rifle",
    classes: ["unarmed", "ranged"],
    weapon: "ranged",
    look: { skin: "#8a9a6a", shirt: "#2a2a2a", pants: "#1b1b1b", hat: "none", hatColor: "#222222", eyeColor: "#c0392b" },
    height: 1.84,
    accent: "#b0c060",
  },
  {
    id: "stalker",
    name: "Stalker",
    role: "enemy",
    blurb: "Bow-armed flanker.",
    weaponLabel: "Bow",
    classes: ["unarmed", "bow"],
    weapon: "bow",
    look: { skin: "#7a8a9a", shirt: "#222a33", pants: "#161b22", hat: "antenna", hatColor: "#1a2028", eyeColor: "#9b59b6" },
    height: 1.86,
    accent: "#7aa0c0",
  },
  {
    id: "warbrute",
    name: "Warbrute",
    role: "enemy",
    blurb: "Towering horned bruiser.",
    weaponLabel: "Unarmed",
    classes: ["unarmed"],
    weapon: "unarmed",
    look: { skin: "#6a7a5a", shirt: "#3a2a2a", pants: "#241c1c", hat: "horns", hatColor: "#caa98a", eyeColor: "#c0392b" },
    height: 2.25,
    accent: "#d06a4a",
  },
];

/** Every preset (heroes + enemies). */
export const CHARACTER_PRESETS: CharacterPreset[] = [...HERO_PRESETS, ...ENEMY_PRESETS];

export const DEFAULT_HERO_ID = "human";

/** Look up a preset by id, falling back to the default hero. */
export function getPreset(id: string): CharacterPreset {
  return CHARACTER_PRESETS.find((p) => p.id === id) ?? HERO_PRESETS[0];
}

/** Weapon classes that fight at melee range (short swing, no ammo) rather than firing. */
export const MELEE_WEAPONS: ReadonlySet<WeaponClass> = new Set<WeaponClass>([
  "sword",
  "knife",
  "greatsword",
  "axe",
  "mace",
  "spear",
  "hammer",
  "greataxe",
  "hammer2h",
]);

/** Whether a weapon class is a melee loadout (close-range swing, ammo-free). */
export function isMeleeWeapon(weapon: WeaponClass): boolean {
  return MELEE_WEAPONS.has(weapon);
}

/** The two flavours of melee ranged attack effect. */
export type MeleeStyle = "slash" | "slam";

/** Heavy two-handed classes slam (shockwave); lighter classes hurl fast slashes. */
const SLAM_WEAPONS: ReadonlySet<WeaponClass> = new Set<WeaponClass>([
  "greatsword",
  "greataxe",
  "hammer",
  "hammer2h",
  "mace",
]);

/** Pick the ranged-effect style for a melee weapon class. */
export function meleeStyle(weapon: WeaponClass): MeleeStyle {
  return SLAM_WEAPONS.has(weapon) ? "slam" : "slash";
}
