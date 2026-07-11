// ---------------------------------------------------------------------------
// Grudge Warlords — MOBA / RTS configuration.
//
// The match is a single-player lane war: the player commands an allied warband
// against an AI faction. Win by razing the enemy Citadel; lose if your own
// Citadel falls. All tunables (map, lanes, units, structures, economy, shop)
// live here.
// ---------------------------------------------------------------------------

import type { ClassId, PrefabRaceId } from "@workspace/game-content";
import type { WeaponClass } from "./anim/types";
import type { WeaponModelKey } from "./anim/weaponModels";

export type Faction = "ally" | "enemy" | "neutral";

/** GRUDGE 6 identity carried on lane units spawned from faction rosters. */
export interface GrudgeUnitMeta {
  raceId: PrefabRaceId;
  classId: ClassId;
  prefabId?: string;
  apiWeapon?: string;
  repoRaceId: string;
  grudgeId: string;
  animPack: string;
  visibleMeshes: string[];
  skinTint?: string;
}

// The battlefield is now generated procedurally per match — see `mapgen.ts` for
// bounds, lanes, terrain, and placements. The old static `MAP`/`LANES` tables
// have been removed; runtime map data lives on `EM.map`.

export const PLAYER = {
  /** Base HP before gear/skills — high enough that a naked boot still survives creep waves. */
  maxHealth: 420,
  speed: 7.4,
  sprintSpeed: 11.5,
  jumpForce: 6.2,
  radius: 0.4,
  height: 1.2,
  attackRange: 90,
  /** MOBA-style base respawn (seconds). */
  respawnTime: 8,
  // --- Controller feel ---
  /** Ground acceleration toward target velocity (units/s^2). Higher = snappier. */
  groundAccel: 65,
  /** Ground deceleration to a stop when no input (units/s^2). */
  groundDecel: 80,
  /** Air acceleration — limited mid-air steering that preserves jump momentum. */
  airAccel: 16,
  /** How fast the move speed eases between walk and sprint (per second). */
  sprintRamp: 7,
  /** Mouse-look sensitivity multiplier. */
  lookSensitivity: 1,
  /** Look smoothing time constant (seconds); ~0 is raw, higher is smoother. */
  lookSmoothing: 0.06,
  /** Max look pitch up/down (radians) so aim never rolls past vertical. */
  lookPitchMax: 1.2,
  /** Third-person camera follow rate (higher = tighter, less lag). */
  camFollow: 20,
  /** Base field of view (matches the Canvas camera). */
  fov: 72,
  /** Field of view while sprinting (subtle speed kick). */
  sprintFov: 80,
  /** FOV ease rate toward its target. */
  fovEase: 6,
};

export type WeaponId = "rifle";

export const WEAPON = {
  damage: 48,
  fireRate: 0.1,
  magazine: 32,
  reserve: 280,
  reloadTime: 1.25,
  range: 90,
  spread: 0.011,
};

// Hero melee loadouts (Sword & Shield, Two-Handed Hammer, ...). Melee kits do not
// consume ammo; each click is a short-range swing that hits the closest enemy in a
// forward arc. Damage is higher per hit to offset the much shorter reach + cadence.
export const MELEE = {
  // Sword & shield: fast crescent slash projectiles that fly forward and slice
  // through everything in a narrow band.
  slash: {
    swingRate: 0.45,
    damage: 52,
    speed: 44,
    range: 32,
    width: 2.4,
    color: "#cfeaff",
  },
  // Two-handed: a slower, heavier slash plus a ground shockwave ring that
  // expands outward dealing area damage.
  slam: {
    swingRate: 0.85,
    damage: 62,
    speed: 28,
    range: 24,
    width: 3.4,
    shockDamage: 88,
    shockRadius: 10,
    shockDuration: 0.55,
    color: "#ffd0a6",
  },
};

// ---------------------------------------------------------------------------
// Hero arsenals. The hero carries ONE ranged + ONE melee weapon chosen in the
// lobby and toggles the active one with Q. Each weapon is tuned to feel
// distinct. Combat stays primarily hitscan (damage applied at fire/swing time);
// projectiles are visual, except grenades whose AoE is resolved on impact.
// ---------------------------------------------------------------------------

export type RangedWeaponId = "bow" | "rifle" | "shotgun" | "pistol" | "grenade";

/** How a ranged weapon resolves a shot. */
export type RangedMode = "hitscan" | "arrow" | "grenade";

export interface RangedWeaponDef {
  id: RangedWeaponId;
  name: string;
  /** Animator weapon class driven while this weapon is active. */
  animClass: WeaponClass;
  /** Per-pellet hitscan damage (arrow uses it too; grenade ignores it). */
  damage: number;
  /** Seconds between shots. */
  fireRate: number;
  /** Magazine size before a reload is required. */
  magazine: number;
  /** Reserve ammo pool. */
  reserve: number;
  /** Seconds to reload a magazine. */
  reloadTime: number;
  /** Hitscan/lob range in world units. */
  range: number;
  /** Aim cone per pellet (radians of jitter). */
  spread: number;
  /** Pellets fired per shot (shotgun > 1). */
  pellets: number;
  /** hitscan = instant tracer; arrow = hitscan + arcing arrow visual; grenade = lobbed AoE. */
  mode: RangedMode;
  /** Visual projectile model for arrow / grenade modes. */
  projectile?: ProjectileModel;
  /** Lob arc peak height (arrow / grenade). */
  arc?: number;
  /** Grenade impact AoE. */
  splash?: { radius: number; damage: number };
  /** Muzzle / tracer tint. */
  color: string;
  /** Real voxel weapon model mounted in-hand (falls back to the procedural prop when unset). */
  model?: WeaponModelKey;
}

export const RANGED_WEAPONS: Record<RangedWeaponId, RangedWeaponDef> = {
  bow: {
    id: "bow", name: "War Bow", animClass: "bow",
    damage: 78, fireRate: 0.82, magazine: 12, reserve: 72, reloadTime: 1.4,
    range: 120, spread: 0.005, pellets: 1, mode: "arrow", projectile: "archer1", arc: 4,
    color: "#cdeac0", model: "bow",
  },
  rifle: {
    id: "rifle", name: "Repeater Rifle", animClass: "ranged",
    damage: 34, fireRate: 0.1, magazine: 30, reserve: 240, reloadTime: 1.4,
    range: 110, spread: 0.014, pellets: 1, mode: "hitscan",
    color: "#ffb24d", model: "rifle",
  },
  shotgun: {
    id: "shotgun", name: "Scattergun", animClass: "ranged",
    damage: 13, fireRate: 0.78, magazine: 6, reserve: 54, reloadTime: 1.9,
    range: 34, spread: 0.085, pellets: 8, mode: "hitscan",
    color: "#ffd27f", model: "sniper",
  },
  pistol: {
    id: "pistol", name: "Sidearm", animClass: "pistol",
    damage: 27, fireRate: 0.2, magazine: 12, reserve: 120, reloadTime: 1.05,
    range: 80, spread: 0.02, pellets: 1, mode: "hitscan",
    color: "#ffe08a", model: "pistol",
  },
  grenade: {
    id: "grenade", name: "Grenade Launcher", animClass: "ranged",
    damage: 0, fireRate: 1.0, magazine: 4, reserve: 24, reloadTime: 2.2,
    range: 80, spread: 0.012, pellets: 1, mode: "grenade", projectile: "fire", arc: 7,
    splash: { radius: 6, damage: 95 },
    color: "#ff7b3a",
  },
};

export type MeleeWeaponId = "knife" | "swordshield" | "warhammer" | "greatsword" | "barehands";

/** Visual + damage flavour of a melee swing. */
export type MeleeArchStyle = "slash" | "jab" | "slam";

export interface MeleeWeaponDef {
  id: MeleeWeaponId;
  name: string;
  /** Animator weapon class driven while this weapon is active. */
  animClass: WeaponClass;
  /** Damage per swing dealt to everything in the forward cone. */
  damage: number;
  /** Seconds between swings. */
  swingRate: number;
  /** Forward reach of the swing cone (short — true melee). */
  reach: number;
  /** Half-angle of the swing cone (radians); wider = sweeps more enemies. */
  halfAngle: number;
  /** Decorative swing flavour. */
  style: MeleeArchStyle;
  /** Whether holding right mouse raises a guard that reduces incoming damage. */
  block: boolean;
  /** Heavy ground shockwave (warhammer slam). */
  shock?: { radius: number; damage: number; duration: number };
  /** Swing arc tint. */
  color: string;
  /** Real voxel weapon model mounted in-hand (falls back to the procedural prop when unset). */
  model?: WeaponModelKey;
}

export const MELEE_WEAPONS_CFG: Record<MeleeWeaponId, MeleeWeaponDef> = {
  knife: {
    id: "knife", name: "Dagger", animClass: "knife",
    damage: 26, swingRate: 0.28, reach: 3.2, halfAngle: 0.5, style: "jab", block: false,
    color: "#dfeffd",
  },
  swordshield: {
    id: "swordshield", name: "Sword & Shield", animClass: "sword",
    damage: 44, swingRate: 0.5, reach: 4.2, halfAngle: 0.7, style: "slash", block: true,
    color: "#cfeaff", model: "sword",
  },
  warhammer: {
    id: "warhammer", name: "Warhammer", animClass: "hammer2h",
    damage: 72, swingRate: 0.95, reach: 4.6, halfAngle: 0.85, style: "slam", block: false,
    shock: { radius: 8, damage: 60, duration: 0.5 },
    color: "#ffd0a6",
  },
  greatsword: {
    id: "greatsword", name: "Greatsword", animClass: "greatsword",
    damage: 60, swingRate: 0.78, reach: 5.2, halfAngle: 1.15, style: "slash", block: false,
    color: "#e8f0ff",
  },
  barehands: {
    id: "barehands", name: "Bare Hands", animClass: "unarmed",
    damage: 16, swingRate: 0.22, reach: 2.6, halfAngle: 0.6, style: "jab", block: false,
    color: "#ffe0c0",
  },
};

export const DEFAULT_RANGED_ID: RangedWeaponId = "rifle";
export const DEFAULT_MELEE_ID: MeleeWeaponId = "swordshield";

// Hero active abilities, independent of the equipped weapon. Bound to Q/E in
// combat mode and gated by cooldowns surfaced on the HUD skills bar.
//   - dash ("Warstride"): a short forward burst that ignores normal movement
//     speed, for closing gaps or escaping.
//   - slam ("Warstomp"): an instant area shockwave centred on the hero, reusing
//     the shared shockwave system (faction-aware area damage to enemies only).
export type AbilityId = "dash" | "slam";

export const ABILITIES: Record<
  AbilityId,
  { name: string; key: string; cooldown: number; color: string }
> = {
  dash: { name: "Warstride", key: "C", cooldown: 6, color: "#9fd8ff" },
  slam: { name: "Warstomp", key: "G", cooldown: 11, color: "#ffb066" },
};

// Tunables specific to each ability's effect.
export const DASH = {
  speed: 28, // horizontal burst velocity
  duration: 0.22, // how long the burst is held before normal control resumes
};
export const SLAM = {
  shockRadius: 11,
  shockDamage: 115,
  shockDuration: 0.6,
};

// ---------------------------------------------------------------------------
// Units — mobile combatants. The same defs drive both factions; faction is set
// per spawned entity. `mesh` selects a procedural model (see UnitMesh).
// ---------------------------------------------------------------------------

export type UnitMeshKind =
  | "footman"
  | "archer"
  | "knight"
  | "grunt"
  | "raider"
  | "ogre"
  | "skeleton_warrior"
  | "skeleton_mage"
  | "kaykit_barbarian"
  | "kaykit_rogue_hooded"
  | "kaykit_knight"
  | "kaykit_ranger";

export interface UnitDef {
  id: string;
  name: string;
  /** Barracks/archery tier (1–3) when spawned from production buildings. */
  tier?: 1 | 2 | 3;
  /** Combat line for UI + manifest alignment. */
  line?: "melee" | "ranged";
  hp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  aggroRange: number;
  ranged: boolean;
  radius: number;
  scale: number;
  color: string;
  accent: string;
  mesh: UnitMeshKind;
  /** Credits + score granted to the player when an enemy of this type dies. */
  reward: number;
  /** GRUDGE 6 mesh preset + viewer id when spawned from a faction roster. */
  grudge?: GrudgeUnitMeta;
}

/**
 * Canonical unit definitions for single-player.
 * Shop footman/archer/knight combat stats must match `lib/gw-sim/src/config.ts` UNIT_DEFS.
 * Race ids in roster use short form (human); mesh kits use GRUDGE_RACE_TO_KIT (western-kingdoms…).
 * Docs: docs/GAME_DEFINITIONS.md
 */
export const UNIT_TYPES: Record<string, UnitDef> = {
  // --- Player-summoned, commandable allies ---
  skirmisher: {
    id: "skirmisher",
    name: "Skirmisher",
    tier: 1,
    line: "ranged",
    hp: 72,
    speed: 5.4,
    damage: 14,
    attackRange: 13,
    attackCooldown: 1.05,
    aggroRange: 15,
    ranged: true,
    radius: 0.46,
    scale: 0.84,
    color: "#6a9f4a",
    accent: "#a8e86b",
    mesh: "archer",
    reward: 0,
  },
  marksman: {
    id: "marksman",
    name: "Marksman",
    tier: 3,
    line: "ranged",
    hp: 118,
    speed: 4.8,
    damage: 32,
    attackRange: 18,
    attackCooldown: 1.35,
    aggroRange: 20,
    ranged: true,
    radius: 0.52,
    scale: 1.05,
    color: "#3d6b8f",
    accent: "#7ec8ff",
    mesh: "archer",
    reward: 0,
  },
  footman: {
    id: "footman",
    name: "Footman",
    tier: 2,
    line: "melee",
    hp: 150,
    speed: 5.4,
    damage: 16,
    attackRange: 2.3,
    attackCooldown: 0.85,
    aggroRange: 10,
    ranged: false,
    radius: 0.55,
    scale: 1,
    color: "#cf8a3a",
    accent: "#e8c46b",
    mesh: "footman",
    reward: 0,
  },
  archer: {
    id: "archer",
    name: "Archer",
    tier: 2,
    line: "ranged",
    hp: 90,
    speed: 5,
    damage: 20,
    attackRange: 15,
    attackCooldown: 1.15,
    aggroRange: 17,
    ranged: true,
    radius: 0.5,
    scale: 0.95,
    color: "#5a8f3c",
    accent: "#bdf36b",
    mesh: "archer",
    reward: 0,
  },
  knight: {
    id: "knight",
    name: "Knight",
    tier: 3,
    line: "melee",
    hp: 320,
    speed: 4.6,
    damage: 26,
    attackRange: 2.6,
    attackCooldown: 1.1,
    aggroRange: 10,
    ranged: false,
    radius: 0.65,
    scale: 1.15,
    color: "#b6bcc8",
    accent: "#e0b252",
    mesh: "knight",
    reward: 0,
  },
  // --- Lane creeps ---
  militia: {
    id: "militia",
    name: "Militia",
    tier: 1,
    line: "melee",
    hp: 95,
    speed: 5,
    damage: 10,
    attackRange: 2.1,
    attackCooldown: 1,
    aggroRange: 8,
    ranged: false,
    radius: 0.5,
    scale: 0.9,
    color: "#c98a4a",
    accent: "#e8c46b",
    mesh: "footman",
    reward: 0,
  },
  grunt: {
    id: "grunt",
    name: "Grunt",
    hp: 95,
    speed: 5,
    damage: 10,
    attackRange: 2.1,
    attackCooldown: 1,
    aggroRange: 8,
    ranged: false,
    radius: 0.5,
    scale: 0.9,
    color: "#9a4b3c",
    accent: "#e87d5a",
    mesh: "grunt",
    reward: 16,
  },
  raider: {
    id: "raider",
    name: "Raider",
    hp: 70,
    speed: 5.2,
    damage: 12,
    attackRange: 13,
    attackCooldown: 1.4,
    aggroRange: 15,
    ranged: true,
    radius: 0.48,
    scale: 0.88,
    color: "#8a3da3",
    accent: "#d89bf3",
    mesh: "raider",
    reward: 20,
  },
  // --- Enemy faction warlord (mirrors the player hero) ---
  // Rendered by EnemyHero.tsx via the procedural Animator (not UnitMesh), so the
  // `mesh`/`color`/`accent`/`scale` fields are placeholders the renderer ignores;
  // it lives in EM.units only so all faction-aware targeting/combat applies to it.
  enemyHero: {
    id: "enemyHero",
    name: "Enemy Warlord",
    hp: 1100,
    speed: 5.4,
    damage: 42,
    attackRange: 3.4,
    attackCooldown: 0.85,
    aggroRange: 18,
    ranged: false,
    radius: 0.7,
    scale: 1,
    color: "#7a2a2a",
    accent: "#e0524a",
    mesh: "knight",
    reward: 150,
  },
  // --- Enemy elite (periodic AI push) ---
  ogre: {
    id: "ogre",
    name: "Ogre",
    hp: 460,
    speed: 3.6,
    damage: 34,
    attackRange: 3.2,
    attackCooldown: 1.5,
    aggroRange: 11,
    ranged: false,
    radius: 0.95,
    scale: 1.8,
    color: "#7a3a2e",
    accent: "#f39b5a",
    mesh: "ogre",
    reward: 70,
  },
  // --- Neutral jungle camp defenders ---
  jungle_wolf: {
    id: "jungle_wolf",
    name: "Jungle Wolf",
    hp: 72,
    speed: 6.2,
    damage: 14,
    attackRange: 2.2,
    attackCooldown: 0.75,
    aggroRange: 12,
    ranged: false,
    radius: 0.46,
    scale: 0.82,
    color: "#5a6a4a",
    accent: "#a8c878",
    mesh: "grunt",
    reward: 28,
  },
  jungle_raider: {
    id: "jungle_raider",
    name: "Bandit Archer",
    hp: 88,
    speed: 5,
    damage: 18,
    attackRange: 14,
    attackCooldown: 1.2,
    aggroRange: 16,
    ranged: true,
    radius: 0.48,
    scale: 0.9,
    color: "#6a5a3a",
    accent: "#d4b86a",
    mesh: "raider",
    reward: 34,
  },
  jungle_brute: {
    id: "jungle_brute",
    name: "Jungle Brute",
    hp: 210,
    speed: 4.2,
    damage: 22,
    attackRange: 2.5,
    attackCooldown: 1.05,
    aggroRange: 10,
    ranged: false,
    radius: 0.62,
    scale: 1.12,
    color: "#4a5a38",
    accent: "#8eb86a",
    mesh: "footman",
    reward: 42,
  },
  jungle_shaman: {
    id: "jungle_shaman",
    name: "Grove Shaman",
    hp: 120,
    speed: 4.6,
    damage: 24,
    attackRange: 15,
    attackCooldown: 1.35,
    aggroRange: 17,
    ranged: true,
    radius: 0.52,
    scale: 0.98,
    color: "#3a6a48",
    accent: "#7ee8a0",
    mesh: "raider",
    reward: 48,
  },
};

// ---------------------------------------------------------------------------
// Neutral jungle camps — MOBA-style PvE pockets off the lanes. Clearing a camp
// grants credits, score, and hero XP; the whole camp pays a bonus bounty.
// ---------------------------------------------------------------------------

export type CampTier = 1 | 2 | 3;

export interface NeutralCampTierDef {
  label: string;
  /** Unit spawns: type id + count. */
  spawns: { typeId: string; count: number }[];
  /** Bonus credits when every defender in the camp is slain. */
  clearBonus: number;
  /** Bonus hero XP on full clear. */
  clearXp: number;
}

export const NEUTRAL_CAMPS = {
  /** How far neutral defenders chase before leashing home. */
  leashRadius: 48,
  /** Seconds before a cleared camp repopulates. */
  respawnDelay: 120,
  /** Camps placed per map size (Dota-scale jungle density on 3× maps). */
  countStandard: 9,
  countLarge: 15,
  tiers: {
    1: {
      label: "Wolf Den",
      spawns: [{ typeId: "jungle_wolf", count: 2 }],
      clearBonus: 50,
      clearXp: 70,
    },
    2: {
      label: "Bandit Camp",
      spawns: [
        { typeId: "jungle_raider", count: 2 },
        { typeId: "jungle_brute", count: 1 },
      ],
      clearBonus: 90,
      clearXp: 110,
    },
    3: {
      label: "Ancient Grove",
      spawns: [
        { typeId: "jungle_shaman", count: 1 },
        { typeId: "jungle_brute", count: 2 },
      ],
      clearBonus: 140,
      clearXp: 160,
    },
  } satisfies Record<CampTier, NeutralCampTierDef>,
};

// ---------------------------------------------------------------------------
// Structures — fixed buildings. Cores + lane towers are placed at match start;
// turrets + barriers are built by the player through the shop's ghost placement.
// ---------------------------------------------------------------------------

export type StructureKind = "core" | "tower" | "cannon" | "ballista" | "mage" | "barrier";

export interface StructureStats {
  hp: number;
  range: number;
  damage: number;
  fireRate: number;
}

export const STRUCT: Record<StructureKind, StructureStats> = {
  core: { hp: 3000, range: 20, damage: 36, fireRate: 0.7 },
  tower: { hp: 1300, range: 17, damage: 30, fireRate: 0.65 },
  // Buildable defensive archetypes:
  // Cannon — moderate damage, explosive splash (AoE at impact).
  cannon: { hp: 420, range: 16, damage: 26, fireRate: 0.95 },
  // Ballista — highest single-target DPS, no splash.
  ballista: { hp: 360, range: 20, damage: 48, fireRate: 0.7 },
  // Mage — lower direct damage, slows targets + emits a small AoE pulse.
  mage: { hp: 340, range: 17, damage: 14, fireRate: 1.05 },
  barrier: { hp: 700, range: 0, damage: 0, fireRate: 0 },
};

// ---------------------------------------------------------------------------
// Procedural trees: neutral, destructible jungle cover scattered on the ridges
// between lanes and along the cut-through trails. They block unit pathing (via
// the spatial grid) and the hero (cylinder colliders), and can be chopped down.
// ---------------------------------------------------------------------------

export const TREE = {
  hp: 50,
  /** Trunk collider + foliage visual radius. */
  radius: 0.85,
  /** Grid cells within this radius are marked non-walkable for unit pathing. */
  blockRadius: 1.75,
  /** Tree count per map size — spread across 3× jungle (wider min spacing). */
  countStandard: 720,
  countLarge: 2400,
  /** Minimum trunk spacing so forests read as spread canopy, not solid wall. */
  minSpacing: 4.2,
  trunk: "#4a3526",
  foliage: "#3f6b39",
  foliageAlt: "#4f7d3a",
  // --- Canopy visuals (procedural branching + leaf cards; see treegen.ts).
  // Purely cosmetic — gameplay (collider, block mask, hp) uses the fields above.
  /** Number of distinct pre-baked tree shapes instanced across the forest. */
  archetypeCount: 6,
  /** Recursive branch depth (higher = bushier + more leaves, costlier). */
  branchLevels: 3,
  /** Child branches spawned per node at the trunk. */
  branchesPerNode: 3,
  /** Base leaf-card size in world units (before per-tree scale). */
  leafSize: 0.95,
} as const;

// ---------------------------------------------------------------------------
// Shop — purchasable any time with credits. Units summon at the ally base
// rally point; buildings enter ghost placement; repair is an instant effect.
// ---------------------------------------------------------------------------

export type ShopKind = "unit" | "build" | "repair";

export interface ShopItem {
  id: string;
  name: string;
  cost: number;
  kind: ShopKind;
  /** UNIT_TYPES key (unit) or StructureKind (build). */
  ref: string;
  description: string;
}

export const SHOP_UNITS: ShopItem[] = [
  { id: "footman", name: "Footman", cost: 80, kind: "unit", ref: "footman", description: "Sturdy melee line infantry." },
  { id: "archer", name: "Archer", cost: 120, kind: "unit", ref: "archer", description: "Ranged damage from the back line." },
  { id: "knight", name: "Knight", cost: 180, kind: "unit", ref: "knight", description: "Heavy armoured frontline tank." },
];

export const SHOP_BUILDS: ShopItem[] = [
  { id: "cannon", name: "Cannon Turret", cost: 130, kind: "build", ref: "cannon", description: "Lobs cannonballs that explode for splash damage." },
  { id: "ballista", name: "Ballista Turret", cost: 150, kind: "build", ref: "ballista", description: "Highest single-target damage. No splash." },
  { id: "mage", name: "Mage Tower", cost: 160, kind: "build", ref: "mage", description: "Slows enemies it hits and pulses a small AoE." },
  { id: "barrier", name: "Barrier", cost: 60, kind: "build", ref: "barrier", description: "Blocks a lane. Soaks damage." },
  { id: "repair", name: "Repair Citadel", cost: 90, kind: "repair", ref: "core", description: "Restores 400 HP to your Citadel." },
];

export const REPAIR_AMOUNT = 400;

export const ECONOMY = {
  startCredits: 300,
  incomePerSec: 7,
  /** Seconds between AI creep pushes per side. */
  creepInterval: 24,
  /** Base creeps per lane each push (3 melee + 2 ranged; extras from escalation). */
  creepsPerLane: 5,
  /** Enemy elite (ogre) every Nth creep push. */
  eliteEveryNthPush: 3,
};

// ---------------------------------------------------------------------------
// Production buildings — the ally barracks (melee) and archery range (ranged)
// auto-spawn lane reinforcements over time. The player upgrades them L1->L2->L3
// with credits for stronger / more numerous creeps. Only the ally faction's
// buildings produce + upgrade; enemy lane pressure stays governed by DIFFICULTY.
// ---------------------------------------------------------------------------
export interface BuildingLevel {
  /** Seconds between reinforcement waves at this tier. */
  interval: number;
  /** Creeps spawned per wave. */
  count: number;
  /** UNIT_TYPES id of the creep spawned. */
  type: string;
  /** HP + damage multiplier applied to spawned creeps. */
  statMult: number;
  /** Credits to upgrade INTO the next tier (omitted on the final tier). */
  upgradeCost?: number;
}

export const MAX_BUILDING_LEVEL = 3;

export const BUILDINGS: Record<
  "barracks" | "archery",
  { name: string; levels: BuildingLevel[] }
> = {
  barracks: {
    name: "Barracks",
    levels: [
      { interval: 18, count: 2, type: "militia", statMult: 1, upgradeCost: 250 },
      { interval: 15, count: 3, type: "footman", statMult: 1, upgradeCost: 450 },
      { interval: 12, count: 3, type: "knight", statMult: 1 },
    ],
  },
  archery: {
    name: "Archery Range",
    levels: [
      { interval: 21, count: 2, type: "skirmisher", statMult: 1, upgradeCost: 280 },
      { interval: 17, count: 3, type: "archer", statMult: 1.15, upgradeCost: 480 },
      { interval: 14, count: 4, type: "marksman", statMult: 1.25 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Difficulty — chosen in the lobby (persisted) and applied at match start. It
// scales the enemy faction only (the player's stats / income are unchanged):
// enemy unit + warlord HP and damage, enemy creep pressure (count + cadence +
// how often an elite marches), and how aggressively the enemy warlord pushes
// vs. retreats. All values are data here so there are no magic numbers in the
// director / hero AI; the multipliers feed `spawnUnit` opts + EnemyHero.
// ---------------------------------------------------------------------------

export type Difficulty = "easy" | "normal" | "hard" | "brutal";

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  blurb: string;
  /** Multiplier on enemy unit + warlord max HP. */
  enemyHpMult: number;
  /** Multiplier on enemy unit + warlord attack damage. */
  enemyDmgMult: number;
  /** Enemy creeps spawned per lane on each enemy push. */
  enemyCreepsPerLane: number;
  /** Seconds between enemy creep pushes. */
  enemyCreepInterval: number;
  /** Enemy elite (ogre) marches every Nth enemy push. */
  enemyEliteEveryNthPush: number;
  /** Multiplier on the enemy warlord's aggro range (higher = roams further to engage). */
  heroAggroMult: number;
  /** HP fraction below which the warlord retreats toward its core (0 = never retreats). */
  heroRetreatFrac: number;
  /** Enemy warlord respawn delay after it falls (seconds). */
  heroRespawnTime: number;
  /** Player HP fraction at/below which the warlord abandons other targets to chase the kill. */
  heroExecuteFrac: number;
  /** Friendly creeps the warlord wants massed nearby before committing to a defended objective. */
  heroGroupMin: number;
  /** Max seconds the warlord stages waiting for its warband before pushing anyway (0 = never waits). */
  heroStageTimeout: number;
  /** Whether the warlord can use its signature ground-slam ability. */
  heroSlam: boolean;
  // --- Reactive macro AI (faction-level economy + decision making) ----------
  /** Credits/sec the AI banks to fund reactive reinforcement (on top of base waves). */
  aiTreasuryPerSec: number;
  /** Seconds the AI takes to notice + respond to a new threat or lane swing (lower = sharper). */
  aiReactionTime: number;
  /** 0..1 — how strongly the AI diverts forces to defend a structure under attack. */
  aiDefendBias: number;
  /** 0..1 — how hard the AI presses when ahead (extra focus-lane mass, dive commitment). */
  aiAggression: number;
  /** Extra creeps the AI pours into its chosen focus lane on a reactive push. */
  aiFocusCreeps: number;
}

/** First campaign boot defaults to Skirmish so new players learn without a wall. */
export const DEFAULT_DIFFICULTY: Difficulty = "easy";
export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "normal", "hard", "brutal"];

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: "easy",
    name: "Skirmish",
    blurb: "Forgiving foes for learning the ropes.",
    enemyHpMult: 0.75,
    enemyDmgMult: 0.7,
    enemyCreepsPerLane: 5,
    enemyCreepInterval: 30,
    enemyEliteEveryNthPush: 4,
    heroAggroMult: 0.8,
    heroRetreatFrac: 0.35,
    heroRespawnTime: 16,
    heroExecuteFrac: 0.15,
    heroGroupMin: 0,
    heroStageTimeout: 0,
    heroSlam: false,
    aiTreasuryPerSec: 3,
    aiReactionTime: 6,
    aiDefendBias: 0.2,
    aiAggression: 0.2,
    aiFocusCreeps: 1,
  },
  normal: {
    id: "normal",
    name: "Warband",
    blurb: "A fair, balanced campaign.",
    // Slightly softer than 1.0 so full warcamp kit stays heroic without trivializing hard/brutal.
    enemyHpMult: 0.95,
    enemyDmgMult: 0.92,
    enemyCreepsPerLane: 5,
    enemyCreepInterval: 26,
    enemyEliteEveryNthPush: 3,
    heroAggroMult: 1,
    heroRetreatFrac: 0.25,
    heroRespawnTime: 12,
    heroExecuteFrac: 0.25,
    heroGroupMin: 1,
    heroStageTimeout: 4,
    heroSlam: true,
    aiTreasuryPerSec: 5,
    aiReactionTime: 4,
    aiDefendBias: 0.5,
    aiAggression: 0.5,
    aiFocusCreeps: 2,
  },
  hard: {
    id: "hard",
    name: "Warlord",
    blurb: "Tougher armies that strike hard.",
    enemyHpMult: 1.3,
    enemyDmgMult: 1.25,
    enemyCreepsPerLane: 5,
    enemyCreepInterval: 19,
    enemyEliteEveryNthPush: 3,
    heroAggroMult: 1.25,
    heroRetreatFrac: 0.15,
    heroRespawnTime: 9,
    heroExecuteFrac: 0.35,
    heroGroupMin: 2,
    heroStageTimeout: 5,
    heroSlam: true,
    aiTreasuryPerSec: 7,
    aiReactionTime: 2.5,
    aiDefendBias: 0.75,
    aiAggression: 0.75,
    aiFocusCreeps: 3,
  },
  brutal: {
    id: "brutal",
    name: "Cataclysm",
    blurb: "Relentless, overwhelming, unforgiving.",
    enemyHpMult: 1.7,
    enemyDmgMult: 1.6,
    enemyCreepsPerLane: 5,
    enemyCreepInterval: 15,
    enemyEliteEveryNthPush: 2,
    heroAggroMult: 1.5,
    heroRetreatFrac: 0,
    heroRespawnTime: 6,
    heroExecuteFrac: 0.5,
    heroGroupMin: 3,
    heroStageTimeout: 6,
    heroSlam: true,
    aiTreasuryPerSec: 10,
    aiReactionTime: 1.2,
    aiDefendBias: 1.0,
    aiAggression: 1.0,
    aiFocusCreeps: 4,
  },
};

// ---------------------------------------------------------------------------
// Enemy warlord — the AI faction's hero. Reuses the procedural Animator rig and
// the shared pathfinding flow-fields; its combat stats live in UNIT_TYPES
// (`enemyHero`). These are the renderer/AI tunables that have no unit-stat home.
// ---------------------------------------------------------------------------

export const ENEMY_HERO = {
  /** Animator preset driving its model + clips (an enemy-role unarmed bruiser). */
  presetId: "warbrute",
  /** Half-angle (radians) of its forward melee swing cone. */
  meleeHalfAngle: 0.85,
  /** Swing arc / impact tint. */
  color: "#ff7a4a",
  /** Movement speed while retreating toward its core, relative to base speed. */
  retreatSpeedMult: 1.1,
  /** Extra HP fraction the warlord must recover ABOVE the retreat threshold before re-engaging (hysteresis band, prevents dithering). */
  retreatHysteresis: 0.15,
  /** Minimum seconds the warlord commits to a retreat once begun. */
  retreatCommit: 2.5,
  /** Radius (world units) within which friendly creeps count toward a coordinated push. */
  groupRadius: 15,
  /** How far back (toward its own core) the warlord stages while massing its warband. */
  stageBackoff: 13,
  /** Ally structures at/below this HP fraction are "exposed" — the warlord dives to raze them solo. */
  exposedHpFrac: 0.5,
  /** Radius around an ally structure used to count its defenders. */
  defenderRadius: 12,
  /** Aggro-range multiplier when hunting a low-HP player for the kill. */
  executeRangeMult: 1.7,
  /** Minimum seconds between A* re-paths toward the current objective. */
  repathInterval: 0.7,
  /** Seconds between objective re-evaluations (lane / structure choice hysteresis). */
  retargetInterval: 1.5,
  /** Signature ground-slam: a deterministic AoE shockwave used when surrounded. */
  slam: {
    /** Hostiles within melee reach required to trigger the slam. */
    minTargets: 2,
    /** Cooldown between slams (seconds). */
    cooldown: 9,
    /** Shockwave radius (world units). */
    radius: 7,
    /** Expansion duration (seconds). */
    duration: 0.5,
    /** Slam damage as a multiple of the warlord's melee damage. */
    damageMult: 1.5,
    /** Movement slow applied to caught units. */
    slow: { factor: 0.5, duration: 1.6 },
  },
  /**
   * Boss-tier visual scale applied to the procedural rig so the warlord towers
   * over regular troops (a buffed creep reads as ~1x; this hero reads bigger).
   * Visual only — combat radius/reach come from UNIT_TYPES.enemyHero.
   */
  rigScale: 1.3,
  /**
   * A distinct, unmistakable look override for the rig (dark crimson warlord with
   * glowing eyes), so the rival hero never blends in with the olive warbrute creep
   * silhouette. Overrides the preset's `look` at build time.
   */
  look: {
    skin: "#5a2a2a",
    shirt: "#2a0a0a",
    pants: "#190707",
    hat: "horns",
    hatColor: "#1a1414",
    eyeColor: "#ff2e1e",
  },
  /** Dread aura / crown colour (ground ring, glow, overhead sigil). */
  auraColor: "#ff2a18",
} as const;

// ---------------------------------------------------------------------------
// Projectiles — flying shell meshes used purely as the VISUAL for ranged
// attacks. Combat itself stays hitscan: damage is applied instantly at fire
// time, exactly as before. These meshes only travel from muzzle to impact so
// shots read as real arrows / cannonballs / bolts instead of instant tracers.
// Models are static FBX under `public/models/projectiles/<file>.fbx`.
// ---------------------------------------------------------------------------

export type ProjectileModel =
  | "archer1"
  | "archer2"
  | "archer3"
  | "archer4"
  | "ballista"
  | "cannon"
  | "fire"
  | "wizard";

/**
 * Surface material intent for a shell. Data-driven so `prepareProto` can dress
 * each FBX with a real PBR texture (from `public/textures/`) instead of a flat
 * tint. `texture` selects which diffuse(+normal) map set to apply; the optional
 * `color` multiplies the map for per-shell hue (e.g. dark iron cannonballs).
 */
export interface ProjectileMaterial {
  /** PBR map set to apply: solid iron ("metal") or matte grain ("concrete"). */
  texture: "metal" | "concrete";
  /** Tint multiplied over the diffuse map. */
  color?: string;
  roughness?: number;
  metalness?: number;
}

/** Area-of-effect explosion profile carried by heavy shells (cannon/fire/wizard). */
export interface ProjectileSplash {
  /** World-unit blast radius at impact. */
  radius: number;
  /** Fallback splash damage if the attacker does not pass its own. */
  damage: number;
  /** Optional movement slow applied to units caught in the blast. */
  slow?: { factor: number; duration: number };
}

export interface ProjectileDef {
  /** File stem under public/models/projectiles/. */
  file: string;
  /** Target longest-dimension in world units (the raw FBX is auto-normalised). */
  size: number;
  /** Travel speed in units/second. */
  speed: number;
  /** Roll spin around the travel axis, rad/second (0 for arrows). */
  spin: number;
  /** Optional emissive tint for magical / fiery shells (glows over the texture). */
  tint?: string;
  /** Surface material intent (PBR texture); flat-tinted only if omitted. */
  material?: ProjectileMaterial;
  /** Explosion profile — heavy shells only (arrows / ballista get none). */
  splash?: ProjectileSplash;
}

export const PROJECTILES: Record<ProjectileModel, ProjectileDef> = {
  archer1: { file: "archer-1", size: 1.2, speed: 55, spin: 0, material: { texture: "concrete", color: "#b8915a", roughness: 0.8, metalness: 0.1 } },
  archer2: { file: "archer-2", size: 1.2, speed: 55, spin: 0, material: { texture: "concrete", color: "#b8915a", roughness: 0.8, metalness: 0.1 } },
  archer3: { file: "archer-3", size: 1.2, speed: 55, spin: 0, material: { texture: "concrete", color: "#b8915a", roughness: 0.8, metalness: 0.1 } },
  archer4: { file: "archer-4", size: 1.2, speed: 55, spin: 0, material: { texture: "concrete", color: "#b8915a", roughness: 0.8, metalness: 0.1 } },
  ballista: { file: "ballista", size: 1.8, speed: 62, spin: 0, material: { texture: "metal", color: "#9a8b6b", roughness: 0.55, metalness: 0.6 } },
  cannon: {
    file: "cannon", size: 0.95, speed: 52, spin: 7, tint: "#ffcaa0",
    material: { texture: "metal", color: "#33343a", roughness: 0.35, metalness: 0.95 },
    splash: { radius: 4, damage: 26 },
  },
  fire: {
    file: "fire", size: 1.1, speed: 46, spin: 5, tint: "#ff7b3a",
    material: { texture: "metal", color: "#5a2a18", roughness: 0.5, metalness: 0.3 },
    splash: { radius: 4.5, damage: 36 },
  },
  wizard: {
    file: "wizard", size: 1.05, speed: 50, spin: 4, tint: "#c9a3ff",
    material: { texture: "metal", color: "#6a4a8a", roughness: 0.45, metalness: 0.4 },
    splash: { radius: 3.2, damage: 16, slow: { factor: 0.5, duration: 2.5 } },
  },
};

/** Archer shells cycle through their four variants for visual variety. */
export const ARCHER_SHELLS: ProjectileModel[] = ["archer1", "archer2", "archer3", "archer4"];

/** Which shell each firing structure lobs (barriers never fire). */
export const STRUCT_PROJECTILE: Record<StructureKind, ProjectileModel | null> = {
  core: "fire",
  tower: "ballista",
  cannon: "cannon",
  ballista: "ballista",
  mage: "wizard",
  barrier: null,
};

// ---------------------------------------------------------------------------
// Match flow & escalation — time-based wave ramp so games trend to a decisive
// end instead of stalemating. Applied symmetrically to BOTH factions' creeps.
// ---------------------------------------------------------------------------

export const MATCH = {
  /** Seconds per escalation step. */
  escalationPeriod: 60,
  /** Stat (HP + damage) multiplier added per step. */
  escalationStatStep: 0.12,
  /** Cap on the time-escalation stat multiplier. */
  escalationStatMax: 2.2,
  /** Escalation steps between each extra creep-per-lane. */
  escalationStepsPerCreep: 2,
  /** Cap on extra creeps per lane from time escalation. */
  escalationCreepMax: 4,
} as const;

// ---------------------------------------------------------------------------
// Momentum — losing structures escalates the pressure the WINNING side applies
// in that lane, so leads convert into wins. Counted per lane, per faction: each
// razed structure boosts the opponent's creeps in that lane.
// ---------------------------------------------------------------------------

export const MOMENTUM = {
  /** Stat multiplier bonus to the winning side's creeps in a lane per razed structure. */
  statPerBreach: 0.18,
  /** Extra creeps to the winning side in that lane per razed structure. */
  creepPerBreach: 1,
  /** Cap on stacked breaches counted per lane. */
  maxBreaches: 3,
} as const;

// ---------------------------------------------------------------------------
// Relic — a recurring neutral mid-map objective. It rises periodically; hold
// the centre uncontested to claim a timed army-wide damage buff plus a bounty
// (credits/score for the player, treasury for the AI). Telegraphed on the HUD
// and by a world beacon (Relic.tsx).
// ---------------------------------------------------------------------------

export const RELIC = {
  /** Seconds after battle start before the first relic rises. */
  firstDelay: 45,
  /** Seconds of cooldown between one relic resolving and the next rising. */
  interval: 75,
  /** Seconds a risen relic stays capturable before it withers if unclaimed. */
  activeTimeout: 45,
  /** Capture radius around the relic (world units). */
  radius: 12,
  /** Seconds of uncontested presence required to fully capture. */
  captureTime: 6,
  /** Army-wide outgoing-damage multiplier granted to the claimer. */
  buffDmgMult: 1.35,
  /** Seconds the claim buff lasts. */
  buffDuration: 30,
  /** Credits + score awarded when the ALLY claims it. */
  allyBounty: 220,
  /** Treasury awarded to the AI when the ENEMY claims it. */
  enemyTreasury: 180,
} as const;

// ---------------------------------------------------------------------------
// Ally tech — a mid-match credit sink beyond unit spam. Each tier permanently
// strengthens the whole ally army (live damage multiplier; HP multiplier on
// newly-spawned reinforcements). Tiers are bought in order from the shop.
// ---------------------------------------------------------------------------

export interface AllyTechTier {
  name: string;
  description: string;
  cost: number;
  /** Absolute outgoing-damage multiplier at this tier (not cumulative). */
  dmgMult: number;
  /** Absolute spawn HP multiplier at this tier (not cumulative). */
  hpMult: number;
}

/** Index 0 = first purchasable tier. Tech level 0 means no tech (mult 1). */
export const ALLY_TECH: AllyTechTier[] = [
  { name: "Sharpened Steel", description: "+10% army damage & HP.", cost: 220, dmgMult: 1.1, hpMult: 1.1 },
  { name: "Forged Plate", description: "+20% army damage, +25% HP.", cost: 380, dmgMult: 1.2, hpMult: 1.25 },
  { name: "Warpriest Blessing", description: "+32% army damage, +45% HP.", cost: 600, dmgMult: 1.32, hpMult: 1.45 },
];

export const MAX_ALLY_TECH = ALLY_TECH.length;

// ---------------------------------------------------------------------------
// Comeback — a light, bounded catch-up for the trailing side: bonus income +
// bounty scaling with the core-HP deficit, capped so it never erases a real
// lead. Symmetric (ally bonus → income/bounty; enemy bonus → AI treasury).
// ---------------------------------------------------------------------------

export const COMEBACK = {
  /** Core-HP-fraction deficit beyond which catch-up begins. */
  threshold: 0.12,
  /** Deficit at which the bonus reaches its maximum. */
  fullDeficit: 0.6,
  /** Maximum income/bounty multiplier for the trailing side. */
  maxMult: 1.6,
} as const;

// ---------------------------------------------------------------------------
// Reactive AI macro — shared constants for the faction-level economy AI in
// MatchDirector (per-difficulty intensity lives on DifficultyDef).
// ---------------------------------------------------------------------------

export const AI_MACRO = {
  /** Treasury cost of a reactive reinforcement push. */
  pushCost: 60,
  /** Treasury cost of an on-demand defensive squad at a threatened structure. */
  defendCost: 45,
  /** Defenders spawned per reactive defense response (scaled up by aggression). */
  defendSquad: 2,
  /** Seconds a structure stays flagged "under attack" after taking a hit. */
  underAttackLinger: 5,
  /** Min seconds between reactive pushes (floor so spends don't spam). */
  reactiveCooldown: 8,
} as const;

// ---------------------------------------------------------------------------
// Lane creep tactical AI — wave staging, tower-danger awareness, and target
// scoring (consumed by Units.tsx `decide`). Stops creeps from trickling into
// tower fire one at a time: they pile up just outside an enemy tower's range
// until a wave of support forms, then commit (dive) together. They also pick
// smarter targets than pure nearest — finishing wounded foes and the enemies
// actually attacking them instead of blindly aggroing into a tower.
// ---------------------------------------------------------------------------

/** Ally units peel to protect the warlord when foes close in. */
export const AI_DEFEND = {
  /** Radius within which a unit considers defending the hero. */
  radius: 20,
  /** Enemies this close to the hero trigger a defend response. */
  threatRadius: 11,
} as const;

export const AI_LANE = {
  /** Friendly units nearby (within `waveRadius`) needed to commit to a tower dive. */
  waveSize: 3,
  /** Radius used to count nearby friendly support when forming a wave. */
  waveRadius: 9,
  /** Extra distance beyond a tower's range where staged creeps hold the line. */
  stageMargin: 2.5,
  /** Max seconds a creep will stage before committing anyway (anti-stall). */
  maxStageTime: 6,
  /** Target scoring: bonus weight for finishing wounded enemies (× missing-HP fraction). */
  lowHpWeight: 8,
  /** Target scoring: bonus for an enemy that is already attacking this unit. */
  threatSelfBonus: 6,
} as const;
