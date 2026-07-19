/**
 * Dungeon / instance scripts — Flare-Boss GameEngine spawn patterns adapted
 * for Warlords Era islands (portal → instanced run → loot → return).
 */

import type { DarkElfUnitDef } from "./darkElves";
import { DARK_ELF_BY_ID } from "./darkElves";

export type DungeonRoomType =
  | "entrance"
  | "combat"
  | "whisp_cage"
  | "elite"
  | "boss"
  | "loot"
  | "exit";

export interface DungeonSpawn {
  templateId: string;
  count: number;
  /** Local room coords (meters) */
  positions?: [number, number, number][];
}

export interface DungeonRoom {
  id: string;
  name: string;
  type: DungeonRoomType;
  size: { w: number; d: number };
  spawns: DungeonSpawn[];
  /** Optional static props (warlords-era paths) */
  props?: { path: string; pos: [number, number, number]; scale?: number }[];
  /** Link to next room ids */
  exits: string[];
  objectiveHint?: string;
}

export interface DungeonDef {
  id: string;
  name: string;
  subtitle: string;
  /** Sector that owns the overworld portal */
  sectorId: string;
  eventSiteId?: string;
  recommendedLevel: number;
  tier: number;
  /** Entry from overworld / home-island portal */
  entry: {
    label: string;
    overworldHint: string;
  };
  rooms: DungeonRoom[];
  bossUnitId: string;
  clearRewards: {
    gold: number;
    xp: number;
    items: [string, number][];
  };
  /** Mission ids that track this dungeon */
  missionIds: string[];
  /** Flare-Boss style enemy mix: procedural tiers + GLB elites */
  spawnPolicy: {
    fillTier: number[];
    alwaysIncludeGlbMonsters: boolean;
    kitMinionsPerCombatRoom: number;
  };
  source: string;
}

/** Monster templates mirrored from Flare-Boss MonsterModels (ids only; GLBs on CDN/public). */
export const FLARE_MONSTER_TEMPLATES = [
  { id: "mon_pincher", name: "Chitin Pincher", tier: 2, hp: 190, damage: 14 },
  { id: "mon_cultist", name: "Armed Cultist", tier: 2, hp: 220, damage: 16 },
  { id: "mon_big_scary_t2", name: "Gloomhulk", tier: 3, hp: 360, damage: 22 },
  { id: "mon_dante_beast", name: "Dante's Beast", tier: 4, hp: 520, damage: 30 },
  { id: "mon_medusa", name: "Medusa", tier: 4, hp: 500, damage: 28 },
  { id: "mon_big_scary_t3", name: "Dread Colossus", tier: 5, hp: 850, damage: 42 },
] as const;

export const FLARE_KIT_TEMPLATES = [
  { id: "kit_skel_minion", name: "Skeleton Minion", tier: 1, hp: 90, damage: 8 },
  { id: "kit_skel_warrior", name: "Skeleton Warrior", tier: 2, hp: 160, damage: 14 },
  { id: "kit_skel_mage", name: "Skeleton Mage", tier: 2, hp: 120, damage: 18 },
  { id: "kit_skel_rogue", name: "Skeleton Rogue", tier: 2, hp: 130, damage: 16 },
] as const;

export const DUNGEON_BRIAR_DEPTHS: DungeonDef = {
  id: "DUNGEON_BRIAR_DEPTHS",
  name: "Briar Depths",
  subtitle: "Thornguard undercroft — dark elves + void beasts",
  sectorId: "e",
  eventSiteId: "event_matriarch_peak",
  recommendedLevel: 14,
  tier: 4,
  entry: {
    label: "Briar Portal",
    overworldHint: "Matriarch's Briar Peak (Starfall Archipelago)",
  },
  rooms: [
    {
      id: "room_entrance",
      name: "Thorn Gate",
      type: "entrance",
      size: { w: 24, d: 24 },
      spawns: [
        { templateId: "dark_elf_raider", count: 2 },
        { templateId: "kit_skel_minion", count: 3 },
      ],
      exits: ["room_cages"],
      objectiveHint: "Push into the briar tunnels",
    },
    {
      id: "room_cages",
      name: "Whisp Cages",
      type: "whisp_cage",
      size: { w: 28, d: 22 },
      spawns: [
        { templateId: "dark_elf_assassin", count: 2 },
        { templateId: "mon_cultist", count: 1 },
      ],
      exits: ["room_hall"],
      objectiveHint: "Free caged whisps (mission free_whisp)",
      props: [
        {
          path: "/models/warlords-era/props",
          pos: [0, 0, 0],
          scale: 1,
        },
      ],
    },
    {
      id: "room_hall",
      name: "Root Hall",
      type: "combat",
      size: { w: 32, d: 18 },
      spawns: [
        { templateId: "dark_elf_raider", count: 3 },
        { templateId: "mon_pincher", count: 1 },
        { templateId: "kit_skel_warrior", count: 2 },
      ],
      exits: ["room_elite"],
    },
    {
      id: "room_elite",
      name: "Sorceress Gallery",
      type: "elite",
      size: { w: 26, d: 26 },
      spawns: [
        { templateId: "dark_elf_sorceress", count: 1 },
        { templateId: "mon_medusa", count: 1 },
        { templateId: "kit_skel_mage", count: 2 },
      ],
      exits: ["room_boss"],
      objectiveHint: "Defeat the gallery guardians",
    },
    {
      id: "room_boss",
      name: "Matriarch Throne",
      type: "boss",
      size: { w: 36, d: 36 },
      spawns: [
        { templateId: "dark_elf_matriarch", count: 1 },
        { templateId: "dark_elf_raider", count: 2 },
        { templateId: "mon_dante_beast", count: 1 },
      ],
      exits: ["room_exit"],
      objectiveHint: "Slay the Thornguard Matriarch",
    },
    {
      id: "room_exit",
      name: "Canopy Gate",
      type: "exit",
      size: { w: 20, d: 16 },
      spawns: [],
      exits: [],
      objectiveHint: "Return to Starfall Archipelago",
    },
  ],
  bossUnitId: "dark_elf_matriarch",
  clearRewards: {
    gold: 500,
    xp: 900,
    items: [
      ["whisp_purple", 2],
      ["ITEM-dark-essence", 5],
      ["cloth-wraithfang-chest", 1],
    ],
  },
  missionIds: ["MISSION_SLAY_MATRIARCH", "DUNGEON_BRIAR_DEPTHS"],
  spawnPolicy: {
    fillTier: [1, 2, 3],
    alwaysIncludeGlbMonsters: true,
    kitMinionsPerCombatRoom: 2,
  },
  source: "Flare-Boss-Arena GameEngine + bosses.ts Thornguard Matriarch",
};

/** Home-island micro-dungeon for early combat tutorial. */
export const DUNGEON_HOME_SHADOW_CRYPT: DungeonDef = {
  id: "DUNGEON_HOME_SHADOW_CRYPT",
  name: "Shadow Crypt",
  subtitle: "Home-island instance — short dark-elf scouting den",
  sectorId: "c",
  eventSiteId: "event_home_shadow_shrine",
  recommendedLevel: 3,
  tier: 1,
  entry: {
    label: "Shadow Shrine Door",
    overworldHint: "Home island shrine",
  },
  rooms: [
    {
      id: "crypt_entry",
      name: "Mossy Stairs",
      type: "entrance",
      size: { w: 16, d: 16 },
      spawns: [{ templateId: "kit_skel_minion", count: 2 }],
      exits: ["crypt_hall"],
    },
    {
      id: "crypt_hall",
      name: "Scout Den",
      type: "combat",
      size: { w: 20, d: 18 },
      spawns: [
        { templateId: "dark_elf_assassin", count: 2 },
        { templateId: "kit_skel_rogue", count: 1 },
      ],
      exits: ["crypt_cage"],
    },
    {
      id: "crypt_cage",
      name: "Cage Alcove",
      type: "whisp_cage",
      size: { w: 14, d: 14 },
      spawns: [{ templateId: "dark_elf_raider", count: 1 }],
      exits: ["crypt_exit"],
      objectiveHint: "Free the whisp",
    },
    {
      id: "crypt_exit",
      name: "Shore Exit",
      type: "exit",
      size: { w: 12, d: 12 },
      spawns: [],
      exits: [],
    },
  ],
  bossUnitId: "dark_elf_assassin",
  clearRewards: {
    gold: 60,
    xp: 120,
    items: [["whisp_purple", 1]],
  },
  missionIds: ["MISSION_HOME_SHADOW_SHRINE"],
  spawnPolicy: {
    fillTier: [1],
    alwaysIncludeGlbMonsters: false,
    kitMinionsPerCombatRoom: 1,
  },
  source: "flare-port home tutorial instance",
};

export const DUNGEON_CATALOG: Record<string, DungeonDef> = {
  [DUNGEON_BRIAR_DEPTHS.id]: DUNGEON_BRIAR_DEPTHS,
  [DUNGEON_HOME_SHADOW_CRYPT.id]: DUNGEON_HOME_SHADOW_CRYPT,
};

export function getDungeon(id: string): DungeonDef | undefined {
  return DUNGEON_CATALOG[id];
}

export function dungeonsForSector(sectorId: string): DungeonDef[] {
  return Object.values(DUNGEON_CATALOG).filter((d) => d.sectorId === sectorId);
}

/** Resolve a spawn template to dark-elf combat stats when applicable. */
export function resolveSpawnCombat(templateId: string): {
  hp: number;
  damage: number;
  name: string;
  darkElf?: DarkElfUnitDef;
} | null {
  const de = DARK_ELF_BY_ID[templateId];
  if (de) {
    return { hp: de.hp, damage: de.damage, name: de.name, darkElf: de };
  }
  const mon = FLARE_MONSTER_TEMPLATES.find((m) => m.id === templateId);
  if (mon) return { hp: mon.hp, damage: mon.damage, name: mon.name };
  const kit = FLARE_KIT_TEMPLATES.find((m) => m.id === templateId);
  if (kit) return { hp: kit.hp, damage: kit.damage, name: kit.name };
  return null;
}

/**
 * Flare-style initial spawn mix for a combat room.
 * Mirrors GameEngine.spawnInitialEnemies tier pick + guaranteed GLB/kit adds.
 */
export function buildRoomSpawnList(room: DungeonRoom, policy: DungeonDef["spawnPolicy"]): DungeonSpawn[] {
  const list = [...room.spawns];
  if (room.type === "combat" || room.type === "elite") {
    if (policy.kitMinionsPerCombatRoom > 0) {
      list.push({
        templateId: "kit_skel_minion",
        count: policy.kitMinionsPerCombatRoom,
      });
    }
  }
  return list;
}
