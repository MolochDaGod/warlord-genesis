/**
 * Jungle camps for Warlords Genesis MOBA mode.
 * Forest creeps grant XP + temporary buffs when camps are cleared.
 *
 * Catalog mirrors gameopen content/enemies/forest-creeps.json so both
 * Open voxel camps and Genesis jungle share unit ids / meshes.
 */

export type JungleBuffId = "blue_haste" | "red_rage" | "green_regen" | "purple_might";

export type JungleCreepUnitId =
  | "forest_bear"
  | "forest_skeleton"
  | "forest_zombie"
  | "forest_zombie_brute"
  | "jungle_orc"
  | "jungle_ogre";

export type JungleCreepDef = {
  id: JungleCreepUnitId;
  name: string;
  /** Relative mesh keys (fleet resolve). */
  meshKeys: string[];
  heightM: number;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  tags: string[];
};

export type JungleCampId = "jungle_blue" | "jungle_red" | "jungle_green" | "jungle_epic";

export type JungleCampDef = {
  id: JungleCampId;
  label: string;
  /** Map-space camp center (lane map coordinates). */
  x: number;
  z: number;
  buffOnClear: JungleBuffId;
  xpBonus: number;
  /** unitId + count for this camp. */
  roster: Array<{ unitId: JungleCreepUnitId; count: number; radius: number }>;
};

export const JUNGLE_CREEPS: Record<JungleCreepUnitId, JungleCreepDef> = {
  forest_bear: {
    id: "forest_bear",
    name: "Forest Bear",
    meshKeys: ["models/bear.glb"],
    heightM: 1.6,
    hp: 120,
    damage: 18,
    speed: 2.4,
    xp: 85,
    tags: ["jungle", "elite"],
  },
  forest_skeleton: {
    id: "forest_skeleton",
    name: "Forest Skeleton",
    meshKeys: ["models/creatures/skeleton-warrior.glb", "models/skeleton-warrior.glb"],
    heightM: 1.85,
    hp: 70,
    damage: 14,
    speed: 2.8,
    xp: 40,
    tags: ["jungle"],
  },
  forest_zombie: {
    id: "forest_zombie",
    name: "Moss Zombie",
    meshKeys: [
      "models/enemies/voxel-zombies/voxel-zombie-1.glb",
      "models/enemies/voxel-zombies/voxel-zombie-2.glb",
    ],
    heightM: 1.7,
    hp: 45,
    damage: 10,
    speed: 2.1,
    xp: 22,
    tags: ["jungle", "voxel"],
  },
  forest_zombie_brute: {
    id: "forest_zombie_brute",
    name: "Brute Zombie",
    meshKeys: ["models/enemies/voxel-zombies/voxel-zombie-3.glb"],
    heightM: 1.85,
    hp: 90,
    damage: 16,
    speed: 2.0,
    xp: 50,
    tags: ["jungle", "voxel"],
  },
  jungle_orc: {
    id: "jungle_orc",
    name: "Jungle Orc",
    meshKeys: ["models/orc.glb", "models/races/orc.glb"],
    heightM: 1.95,
    hp: 100,
    damage: 17,
    speed: 2.5,
    xp: 65,
    tags: ["jungle"],
  },
  jungle_ogre: {
    id: "jungle_ogre",
    name: "Jungle Ogre",
    meshKeys: ["models/ogre.glb"],
    heightM: 2.4,
    hp: 220,
    damage: 28,
    speed: 1.9,
    xp: 180,
    tags: ["jungle", "elite"],
  },
};

/** Default jungle layout between 3 lanes (map center offsets). */
export const DEFAULT_JUNGLE_CAMPS: JungleCampDef[] = [
  {
    id: "jungle_blue",
    label: "Blue Camp",
    x: -18,
    z: 8,
    buffOnClear: "blue_haste",
    xpBonus: 40,
    roster: [
      { unitId: "forest_skeleton", count: 2, radius: 3 },
      { unitId: "forest_zombie", count: 2, radius: 3.5 },
    ],
  },
  {
    id: "jungle_red",
    label: "Red Camp",
    x: 18,
    z: 8,
    buffOnClear: "red_rage",
    xpBonus: 55,
    roster: [
      { unitId: "jungle_orc", count: 2, radius: 3 },
      { unitId: "forest_zombie_brute", count: 1, radius: 2.5 },
    ],
  },
  {
    id: "jungle_green",
    label: "Green Camp",
    x: -14,
    z: -14,
    buffOnClear: "green_regen",
    xpBonus: 45,
    roster: [
      { unitId: "forest_zombie", count: 3, radius: 3.2 },
      { unitId: "forest_skeleton", count: 1, radius: 2.8 },
    ],
  },
  {
    id: "jungle_epic",
    label: "Epic Ogre",
    x: 14,
    z: -16,
    buffOnClear: "purple_might",
    xpBonus: 120,
    roster: [
      { unitId: "jungle_ogre", count: 1, radius: 0 },
      { unitId: "forest_zombie", count: 2, radius: 4 },
    ],
  },
];

export type JungleBuffDef = {
  id: JungleBuffId;
  name: string;
  durationSec: number;
  effects: {
    moveSpeedMul?: number;
    atkSpeedMul?: number;
    damageMul?: number;
    maxHpMul?: number;
    hpRegenPerSec?: number;
  };
  color: string;
};

export const JUNGLE_BUFFS: Record<JungleBuffId, JungleBuffDef> = {
  blue_haste: {
    id: "blue_haste",
    name: "Blue Haste",
    durationSec: 45,
    effects: { moveSpeedMul: 1.12, atkSpeedMul: 1.08 },
    color: "#4fc3ff",
  },
  red_rage: {
    id: "red_rage",
    name: "Red Rage",
    durationSec: 40,
    effects: { damageMul: 1.15 },
    color: "#ff5a4a",
  },
  green_regen: {
    id: "green_regen",
    name: "Green Regen",
    durationSec: 50,
    effects: { hpRegenPerSec: 2.5 },
    color: "#6ee7a0",
  },
  purple_might: {
    id: "purple_might",
    name: "Purple Might",
    durationSec: 60,
    effects: { damageMul: 1.2, maxHpMul: 1.1 },
    color: "#b48cff",
  },
};

export type JungleSpawnRequest = {
  campId: JungleCampId;
  unitId: JungleCreepUnitId;
  x: number;
  z: number;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  meshKeys: string[];
  heightM: number;
  faction: "neutral";
};

/** Expand all camps into spawn requests for the battle engine. */
export function buildJungleSpawnList(
  camps: JungleCampDef[] = DEFAULT_JUNGLE_CAMPS,
): JungleSpawnRequest[] {
  const out: JungleSpawnRequest[] = [];
  for (const camp of camps) {
    for (const line of camp.roster) {
      const def = JUNGLE_CREEPS[line.unitId];
      if (!def) continue;
      for (let i = 0; i < line.count; i++) {
        const a = (i / Math.max(1, line.count)) * Math.PI * 2;
        const r = line.radius * (0.35 + (i % 3) * 0.2);
        out.push({
          campId: camp.id,
          unitId: line.unitId,
          x: camp.x + Math.cos(a) * r,
          z: camp.z + Math.sin(a) * r,
          hp: def.hp,
          damage: def.damage,
          speed: def.speed,
          xp: def.xp,
          meshKeys: def.meshKeys,
          heightM: def.heightM,
          faction: "neutral",
        });
      }
    }
  }
  return out;
}

/** XP + buff when a camp is fully cleared. */
export function campClearReward(campId: JungleCampId): {
  xpBonus: number;
  buff: JungleBuffDef;
} {
  const camp = DEFAULT_JUNGLE_CAMPS.find((c) => c.id === campId);
  const buffId = camp?.buffOnClear ?? "blue_haste";
  return {
    xpBonus: camp?.xpBonus ?? 30,
    buff: JUNGLE_BUFFS[buffId],
  };
}
