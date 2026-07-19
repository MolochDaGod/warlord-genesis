/**
 * Mission scripts for Warlords Era 3D islands — ported patterns from
 * GrudgeBuilder missionSystem + Flare-Boss dungeon/camp objectives.
 *
 * Server validates completion; client uses this catalog for HUD + spawns.
 */

export type MissionObjectiveType =
  | "reach_location"
  | "kill"
  | "collect"
  | "interact"
  | "escort"
  | "survive"
  | "free_whisp"
  | "clear_dungeon";

export interface IslandMissionObjective {
  id: string;
  description: string;
  type: MissionObjectiveType;
  requiredCount: number;
  optional?: boolean;
  order: number;
  /** World or local island coords */
  targetPosition?: [number, number, number];
  targetRadius?: number;
  targetTemplateIds?: string[];
  targetItemIds?: string[];
  targetNodeId?: string;
  durationSec?: number;
  /** Free N whisps of any / specific element */
  whispIds?: string[];
  dungeonId?: string;
}

export interface IslandMissionReward {
  gold?: number;
  xp?: number;
  items?: [string, number][];
  professionXp?: [string, number][];
  unlocks?: string[];
}

export interface IslandMission {
  id: string;
  title: string;
  description: string;
  flavorText?: string;
  category: "main" | "side" | "daily" | "faction" | "tutorial" | "dungeon";
  difficulty: number;
  recommendedLevel: number;
  objectives: IslandMissionObjective[];
  rewards: IslandMissionReward;
  prerequisites: string[];
  autoActivate: boolean;
  canFail: boolean;
  timeLimitSec: number;
  /** SECTOR_META id or "home" | "any" */
  zoneRestriction?: string;
  /** Surface: where this mission is offered */
  surfaces: Array<
    "lobby" | "home-island" | "sector-map" | "instance" | "dungeon" | "event"
  >;
  eventSiteIds?: string[];
}

export const ISLAND_MISSIONS: IslandMission[] = [
  {
    id: "MISSION_SAFEHOUSE",
    title: "Find Shelter",
    description:
      "You awaken on a strange shore. Find the nearest safe house before nightfall.",
    flavorText: '"Keep your head down and find shelter."',
    category: "tutorial",
    difficulty: 1,
    recommendedLevel: 1,
    objectives: [
      {
        id: "reach_safehouse",
        description: "Reach the safe house",
        type: "reach_location",
        requiredCount: 1,
        order: 1,
        targetRadius: 5,
      },
    ],
    rewards: {
      gold: 50,
      xp: 100,
      items: [
        ["ITEM-starter-health-potion", 3],
        ["ITEM-starter-bread", 5],
      ],
      unlocks: ["crafting_tab", "inventory_full"],
    },
    prerequisites: [],
    autoActivate: true,
    canFail: false,
    timeLimitSec: 0,
    zoneRestriction: "home",
    surfaces: ["home-island", "lobby"],
  },
  {
    id: "MISSION_FIRST_HARVEST",
    title: "First Harvest",
    description: "Gather wood and stone on your home island.",
    category: "tutorial",
    difficulty: 1,
    recommendedLevel: 1,
    objectives: [
      {
        id: "harvest_wood",
        description: "Harvest wood (0/3)",
        type: "collect",
        targetItemIds: ["Pine Log", "Oak Log", "Birch Log"],
        requiredCount: 3,
        order: 1,
      },
      {
        id: "harvest_stone",
        description: "Mine stone (0/2)",
        type: "collect",
        targetItemIds: ["Iron Ore", "Copper Ore", "Rough Stone"],
        requiredCount: 2,
        order: 2,
      },
    ],
    rewards: {
      gold: 25,
      xp: 75,
      professionXp: [
        ["Mining", 10],
        ["Logging", 10],
      ],
    },
    prerequisites: ["MISSION_SAFEHOUSE"],
    autoActivate: true,
    canFail: false,
    timeLimitSec: 0,
    zoneRestriction: "home",
    surfaces: ["home-island"],
  },
  {
    id: "MISSION_HOME_SHADOW_SHRINE",
    title: "Shadows on the Shore",
    description:
      "Dark elf scouts raised a shrine on your home island. Destroy them and free a caged whisp.",
    flavorText: '"They hunt whisps… and captains who get in the way."',
    category: "side",
    difficulty: 2,
    recommendedLevel: 3,
    objectives: [
      {
        id: "kill_scouts",
        description: "Defeat dark elf scouts (0/2)",
        type: "kill",
        targetTemplateIds: ["dark_elf_assassin", "dark_elf_raider"],
        requiredCount: 2,
        order: 1,
      },
      {
        id: "free_whisp",
        description: "Free a caged whisp",
        type: "free_whisp",
        whispIds: ["whisp_purple", "whisp_green"],
        requiredCount: 1,
        order: 2,
      },
    ],
    rewards: {
      gold: 80,
      xp: 150,
      items: [["whisp_purple", 1]],
      unlocks: ["event_dark_canopy_e"],
    },
    prerequisites: ["MISSION_FIRST_HARVEST"],
    autoActivate: false,
    canFail: false,
    timeLimitSec: 0,
    zoneRestriction: "home",
    surfaces: ["home-island", "lobby", "event"],
    eventSiteIds: ["event_home_shadow_shrine"],
  },
  {
    id: "MISSION_WHISP_RESCUE",
    title: "Whisps in the Canopy",
    description:
      "Sail to Starfall Archipelago and free three arcane whisps from dark-elf cages.",
    category: "faction",
    difficulty: 4,
    recommendedLevel: 8,
    objectives: [
      {
        id: "sail_e",
        description: "Enter Starfall Archipelago (sector E)",
        type: "reach_location",
        requiredCount: 1,
        order: 1,
        targetRadius: 200,
      },
      {
        id: "free_3",
        description: "Free whisps (0/3)",
        type: "free_whisp",
        whispIds: ["whisp_purple", "whisp_green", "whisp_blue"],
        requiredCount: 3,
        order: 2,
      },
      {
        id: "kill_raiders",
        description: "Defeat dark elf raiders (0/5)",
        type: "kill",
        targetTemplateIds: ["dark_elf_raider"],
        requiredCount: 5,
        order: 3,
      },
    ],
    rewards: {
      gold: 200,
      xp: 400,
      items: [
        ["whisp_purple", 2],
        ["whisp_green", 1],
      ],
      unlocks: ["MISSION_DARK_CANOPY"],
    },
    prerequisites: ["MISSION_HOME_SHADOW_SHRINE"],
    autoActivate: false,
    canFail: false,
    timeLimitSec: 0,
    zoneRestriction: "e",
    surfaces: ["sector-map", "event", "lobby"],
    eventSiteIds: ["event_dark_canopy_e"],
  },
  {
    id: "MISSION_DARK_CANOPY",
    title: "Dark Canopy",
    description:
      "Clear the Dark Canopy Grove of assassins and sorceresses. Open the path to Briar Peak.",
    category: "main",
    difficulty: 5,
    recommendedLevel: 10,
    objectives: [
      {
        id: "kill_assassin",
        description: "Slay a Dark Elf Assassin",
        type: "kill",
        targetTemplateIds: ["dark_elf_assassin"],
        requiredCount: 1,
        order: 1,
      },
      {
        id: "kill_sorceress",
        description: "Slay a Dark Elf Sorceress",
        type: "kill",
        targetTemplateIds: ["dark_elf_sorceress"],
        requiredCount: 1,
        order: 2,
      },
      {
        id: "interact_portal",
        description: "Investigate the briar portal",
        type: "interact",
        targetNodeId: "poi_briar_portal",
        requiredCount: 1,
        order: 3,
      },
    ],
    rewards: {
      gold: 350,
      xp: 600,
      items: [["ITEM-dark-essence", 3]],
      unlocks: ["DUNGEON_BRIAR_DEPTHS", "MISSION_SLAY_MATRIARCH"],
    },
    prerequisites: ["MISSION_WHISP_RESCUE"],
    autoActivate: false,
    canFail: false,
    timeLimitSec: 0,
    zoneRestriction: "e",
    surfaces: ["sector-map", "event", "instance"],
    eventSiteIds: ["event_dark_canopy_e"],
  },
  {
    id: "MISSION_SLAY_MATRIARCH",
    title: "Queen of the Briar",
    description:
      "Challenge the Thornguard Matriarch at Briar Peak. Clear the dungeon instance to finish her.",
    flavorText: '"The canopy bows to her. Make her kneel."',
    category: "main",
    difficulty: 7,
    recommendedLevel: 14,
    objectives: [
      {
        id: "enter_dungeon",
        description: "Enter Briar Depths dungeon",
        type: "clear_dungeon",
        dungeonId: "DUNGEON_BRIAR_DEPTHS",
        requiredCount: 1,
        order: 1,
      },
      {
        id: "kill_matriarch",
        description: "Defeat Thornguard Matriarch",
        type: "kill",
        targetTemplateIds: ["dark_elf_matriarch"],
        requiredCount: 1,
        order: 2,
      },
    ],
    rewards: {
      gold: 800,
      xp: 1500,
      items: [
        ["whisp_red", 1],
        ["whisp_purple", 2],
        ["cloth-wraithfang-helm", 1],
      ],
      unlocks: ["dark_elf_fabled_skin", "sector_e_safe_route"],
    },
    prerequisites: ["MISSION_DARK_CANOPY"],
    autoActivate: false,
    canFail: true,
    timeLimitSec: 0,
    zoneRestriction: "e",
    surfaces: ["dungeon", "instance", "lobby", "event"],
    eventSiteIds: ["event_matriarch_peak"],
  },
];

export const ISLAND_MISSION_BY_ID = Object.fromEntries(
  ISLAND_MISSIONS.map((m) => [m.id, m]),
) as Record<string, IslandMission>;

export function missionsForSurface(
  surface: IslandMission["surfaces"][number],
): IslandMission[] {
  return ISLAND_MISSIONS.filter((m) => m.surfaces.includes(surface));
}

export function missionsForSector(sectorId: string): IslandMission[] {
  return ISLAND_MISSIONS.filter(
    (m) =>
      !m.zoneRestriction ||
      m.zoneRestriction === "any" ||
      m.zoneRestriction === sectorId ||
      (sectorId === "c" && m.zoneRestriction === "home"),
  );
}

export type MissionRunState = "not_started" | "active" | "completed" | "failed";

export interface PlayerMissionRun {
  missionId: string;
  state: MissionRunState;
  objectiveProgress: Record<string, number>;
  activatedAt: number;
  completedAt: number;
}

export function createMissionRun(missionId: string): PlayerMissionRun {
  const m = ISLAND_MISSION_BY_ID[missionId];
  const objectiveProgress: Record<string, number> = {};
  if (m) {
    for (const o of m.objectives) objectiveProgress[o.id] = 0;
  }
  return {
    missionId,
    state: "active",
    objectiveProgress,
    activatedAt: Date.now(),
    completedAt: 0,
  };
}

export function isMissionRunComplete(
  mission: IslandMission,
  run: PlayerMissionRun,
): boolean {
  for (const o of mission.objectives) {
    if (o.optional) continue;
    if ((run.objectiveProgress[o.id] ?? 0) < o.requiredCount) return false;
  }
  return true;
}
