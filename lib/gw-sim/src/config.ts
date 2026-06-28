// Sim tunables for PvP. A deliberately compact, headless subset of the
// single-player config (config.ts) — same archetypes and feel, but no render /
// animation / shop-UI concerns. Tuned for a ~4-7 minute lane war.

export type UnitKey =
  | "hero"
  | "creepMelee"
  | "creepRanged"
  | "footman"
  | "archer"
  | "knight";

export interface SimUnitDef {
  key: UnitKey;
  hp: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  aggroRange: number;
  radius: number;
  ranged: boolean;
  /** Gold awarded to the killer when this unit dies. */
  reward: number;
}

export const UNIT_DEFS: Record<UnitKey, SimUnitDef> = {
  hero: {
    key: "hero",
    hp: 900,
    speed: 8.5,
    damage: 46,
    attackRange: 4,
    attackCooldown: 0.7,
    aggroRange: 16,
    radius: 0.7,
    ranged: false,
    reward: 220,
  },
  creepMelee: {
    key: "creepMelee",
    hp: 90,
    speed: 5,
    damage: 11,
    attackRange: 2.1,
    attackCooldown: 1,
    aggroRange: 8,
    radius: 0.5,
    ranged: false,
    reward: 18,
  },
  creepRanged: {
    key: "creepRanged",
    hp: 64,
    speed: 5.1,
    damage: 13,
    attackRange: 12,
    attackCooldown: 1.3,
    aggroRange: 13,
    radius: 0.48,
    ranged: true,
    reward: 22,
  },
  footman: {
    key: "footman",
    hp: 160,
    speed: 5.6,
    damage: 18,
    attackRange: 2.4,
    attackCooldown: 0.85,
    aggroRange: 11,
    radius: 0.55,
    ranged: false,
    reward: 30,
  },
  archer: {
    key: "archer",
    hp: 95,
    speed: 5.2,
    damage: 22,
    attackRange: 15,
    attackCooldown: 1.1,
    aggroRange: 17,
    radius: 0.5,
    ranged: true,
    reward: 30,
  },
  knight: {
    key: "knight",
    hp: 340,
    speed: 4.7,
    damage: 28,
    attackRange: 2.7,
    attackCooldown: 1.1,
    aggroRange: 11,
    radius: 0.65,
    ranged: false,
    reward: 45,
  },
};

export type StructKey = "core" | "tower";

export interface SimStructDef {
  key: StructKey;
  hp: number;
  range: number;
  damage: number;
  fireRate: number;
  radius: number;
}

export const STRUCT_DEFS: Record<StructKey, SimStructDef> = {
  core: { key: "core", hp: 3200, range: 22, damage: 60, fireRate: 0.7, radius: 3 },
  tower: { key: "tower", hp: 1400, range: 18, damage: 40, fireRate: 0.65, radius: 1.6 },
};

/** Summonable units the shop offers, with their gold cost. */
export const SHOP: { unit: UnitKey; name: string; cost: number }[] = [
  { unit: "footman", name: "Footman", cost: 80 },
  { unit: "archer", name: "Archer", cost: 120 },
  { unit: "knight", name: "Knight", cost: 180 },
];

export const ECONOMY = {
  startCredits: 300,
  /** Passive gold per second, per player. */
  incomePerSec: 9,
  /** Seconds between automatic lane-creep waves per team. */
  waveInterval: 22,
  /** Creeps spawned per lane each wave (melee first, then ranged). */
  meleePerWave: 3,
  rangedPerWave: 1,
  /** Hero respawn delay in seconds. */
  heroRespawn: 8,
  /** Max simultaneous summoned units a single player may field. */
  maxSummonsPerPlayer: 14,
};

/** Fixed simulation timestep. Server ticks at this rate; clients predict at it. */
export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;
