// Aethermoor World Map Data — synced from Tactical-Infinity
// Source: https://github.com/MolochDaGod/Tactical-Infinity.git
// File:   client/src/lib/worldMapData.ts
// Run:    pnpm --filter @workspace/world-content sync:ti

export interface Vec2 {
  x: number;
  z: number;
}

// Aethermoor World Map Data - Based on Game Lore
// The world is divided into 3 major faction territories

export type Faction = 'crusade' | 'legion' | 'fabled' | 'neutral' | 'pirate';
export type IslandSize = 'small' | 'medium' | 'large' | 'capital';
export type IslandHostility = 'friendly' | 'neutral' | 'hostile' | 'contested';

export type IslandGameplayType = 'safe' | 'trading_post' | 'hostile' | 'claimable' | 'capital';

export interface IslandEnemyConfig {
  enemyTypes: ('skeleton' | 'goblin' | 'orc' | 'undead_knight' | 'sea_creature' | 'pirate')[];
  enemyCount: number;
  bossType?: 'giant_skeleton' | 'orc_warlord' | 'necromancer' | 'pirate_captain' | 'sea_monster';
  bossHealth?: number;
}

export interface WorldIslandData {
  id: string;
  name: string;
  faction: Faction;
  hostility: IslandHostility;
  size: IslandSize;
  biome: 'tropical' | 'volcanic' | 'arctic' | 'desert' | 'haunted' | 'forest' | 'swamp' | 'mountain';
  position: { x: number; z: number };
  radius: number;
  description: string;
  npcTypes: string[];
  resources: string[];
  hasPort: boolean;
  hasTavern: boolean;
  hasShop: boolean;
  hasTemple: boolean;
  patronGod?: 'odin' | 'madra' | 'omni';
  questGiverIds?: string[];
  tier: 1 | 2 | 3 | 4 | 5;
  // New gameplay features
  gameplayType?: IslandGameplayType;
  hasTradingPost?: boolean;
  isClaimable?: boolean;
  isClaimed?: boolean;
  claimedByFaction?: Faction;
  enemyConfig?: IslandEnemyConfig;
  buildingSlots?: number;
  workerSlots?: number;
}

export interface EnemyShipData {
  id: string;
  name: string;
  faction: Faction;
  shipType: 'small' | 'medium' | 'large' | 'ghost';
  level: number;
  patrolCenter: { x: number; z: number };
  patrolRadius: number;
  aggressive: boolean;
  crewType: string;
}

// World Geography Constants (9000x9000 world)
// SHATTERED WORLD LORE:
// - The world is a shattered realm - no continents, only scattered floating islands
// - All islands drift except the Core Island (the only stationary island, not yet implemented)
// - Volcanic creation on the southern edge (Legion's volcanic birth)
// - The Ethereal Falls mark the world boundary - a terrifying cosmic waterfall
//   where reality ends and the realms of magic and death begin
// - Waterfall Isle is the neutral zone in the center

export const WORLD_SIZE = 9000;
export const WORLD_CENTER = { x: 0, z: 0 };

// The Ethereal Falls - World Edge Boundary
// A mythical and terrifying place bridging our doomed world with the realms of magic and death
export const ETHEREAL_FALLS_BOUNDARY = {
  north: { z: -4200, description: 'Northern Ethereal Falls - Realm of Frozen Spirits' },
  south: { z: 4200, description: 'Southern Ethereal Falls - Volcanic Abyss to Madra\'s Domain' },
  east: { x: 4200, description: 'Eastern Ethereal Falls - Gateway to the Omni\'s Cosmic Balance' },
  west: { x: -4200, description: 'Western Ethereal Falls - The Forgotten Void' },
};

// Faction Territory Centers - Based on Lore
// Waterfall Isle (center) is neutral territory - no PVP allowed
// Crusade controls the northern seas (Odin's realm - humans/barbarians)
// Fabled controls the eastern archipelago (The Omni's blessing - elves/dwarves)  
// Legion controls the southern volcanic regions (Madra's domain - orcs/undead)
// Core Island - the only stationary island (not yet implemented)

export const FACTION_TERRITORIES = {
  crusade: {
    center: { x: -1500, z: -2000 },
    radius: 2500,
    color: 0xFFD700, // Golden (Odin's color)
  },
  fabled: {
    center: { x: 2000, z: -500 },
    radius: 2200,
    color: 0x00CED1, // Turquoise (The Omni's balance)
  },
  legion: {
    center: { x: -500, z: 2500 },
    radius: 2400,
    color: 0x8B0000, // Dark red (Madra's chaos)
  },
  neutral: {
    center: { x: 0, z: 0 },
    radius: 800,
    color: 0x808080, // Gray (contested)
  },
  pirate: {
    center: { x: 3000, z: 2000 },
    radius: 1500,
    color: 0x2F4F4F, // Dark slate (lawless)
  },
};

// Lore-Accurate Island Definitions
export const WORLD_ISLANDS: WorldIslandData[] = [
  // === SANCTUARY ISLE - Central NEUTRAL zone (NO PVP) ===
  {
    id: 'waterfall_isle',
    name: 'Waterfall Isle',
    faction: 'neutral',
    hostility: 'friendly', // Changed from contested - this is a safe neutral zone
    size: 'large',
    biome: 'mountain',
    position: { x: 0, z: 0 },
    radius: 150,
    description: 'The sacred neutral ground where all factions may trade in peace. Home to an epic alien temple, Pirate Pete\'s Docks & Shop, and a waypoint stone circle for world map teleportation. NO PVP ALLOWED.',
    npcTypes: ['merchant', 'healer', 'questgiver'],
    resources: ['mithril', 'worldtree', 'blacklotus'],
    hasPort: true,
    hasTavern: true,
    hasShop: true,
    hasTemple: true,
    questGiverIds: ['hero_aurion'],
    tier: 5,
    gameplayType: 'safe', // Neutral zone - no combat
  },

  // === CRUSADE TERRITORIES (North) ===
  {
    id: 'valheim_port',
    name: 'Valheim Port',
    faction: 'crusade',
    hostility: 'friendly',
    size: 'capital',
    biome: 'forest',
    position: { x: -1800, z: -2200 },
    radius: 200,
    description: 'Capital of the Crusade. Sigurd\'s fortress overlooks the harbor.',
    npcTypes: ['soldier', 'blacksmith', 'trainer', 'merchant'],
    resources: ['iron', 'oak', 'leather'],
    hasPort: true,
    hasTavern: true,
    hasShop: true,
    hasTemple: true,
    patronGod: 'odin',
    questGiverIds: ['hero_sigurd', 'hero_kael'],
    tier: 4,
  },
  {
    id: 'ravens_perch',
    name: 'Raven\'s Perch',
    faction: 'crusade',
    hostility: 'friendly',
    size: 'medium',
    biome: 'mountain',
    position: { x: -2200, z: -1600 },
    radius: 80,
    description: 'Odin\'s ravens Huginn and Muninn roost here. A place of prophecy.',
    npcTypes: ['seer', 'priest'],
    resources: ['gold', 'fadeleaf'],
    hasPort: false,
    hasTavern: false,
    hasShop: false,
    hasTemple: true,
    patronGod: 'odin',
    tier: 3,
  },
  {
    id: 'berserker_bay',
    name: 'Berserker Bay',
    faction: 'crusade',
    hostility: 'friendly',
    size: 'medium',
    biome: 'forest',
    position: { x: -1200, z: -2600 },
    radius: 90,
    description: 'Barbarian tribal grounds. Thrax trains warriors here.',
    npcTypes: ['barbarian', 'trainer', 'shaman'],
    resources: ['thickhide', 'ironwood'],
    hasPort: true,
    hasTavern: true,
    hasShop: false,
    hasTemple: false,
    questGiverIds: ['hero_thrax'],
    tier: 3,
  },
  {
    id: 'golden_shores',
    name: 'Golden Shores',
    faction: 'crusade',
    hostility: 'friendly',
    size: 'small',
    biome: 'tropical',
    position: { x: -2500, z: -2800 },
    radius: 60,
    description: 'Trading outpost for Crusade merchants.',
    npcTypes: ['merchant', 'fisherman'],
    resources: ['salmon', 'copper'],
    hasPort: true,
    hasTavern: false,
    hasShop: true,
    hasTemple: false,
    tier: 2,
  },
  {
    id: 'wildwood_isle',
    name: 'Wildwood Isle',
    faction: 'crusade',
    hostility: 'friendly',
    size: 'medium',
    biome: 'forest',
    position: { x: -800, z: -1800 },
    radius: 100,
    description: 'Theron\'s domain. Dire wolves patrol the ancient woods.',
    npcTypes: ['ranger', 'beast', 'druid'],
    resources: ['worldtree', 'thickhide', 'dreamfoil'],
    hasPort: false,
    hasTavern: false,
    hasShop: false,
    hasTemple: false,
    questGiverIds: ['hero_theron'],
    tier: 3,
  },

  // === FABLED TERRITORIES (East) ===
  {
    id: 'starfall_haven',
    name: 'Starfall Haven',
    faction: 'fabled',
    hostility: 'friendly',
    size: 'capital',
    biome: 'forest',
    position: { x: 2200, z: -800 },
    radius: 180,
    description: 'Elven capital. Ancient trees reach toward the eternal stars.',
    npcTypes: ['elf', 'mage', 'merchant', 'librarian'],
    resources: ['worldtree', 'mageroyal', 'gold'],
    hasPort: true,
    hasTavern: true,
    hasShop: true,
    hasTemple: true,
    patronGod: 'omni',
    tier: 4,
  },
  {
    id: 'deepforge_hold',
    name: 'Deepforge Hold',
    faction: 'fabled',
    hostility: 'friendly',
    size: 'large',
    biome: 'mountain',
    position: { x: 2600, z: -200 },
    radius: 120,
    description: 'Dwarven stronghold. The greatest forges in Aethermoor.',
    npcTypes: ['dwarf', 'blacksmith', 'miner', 'engineer'],
    resources: ['adamantite', 'mithril', 'iron'],
    hasPort: false,
    hasTavern: true,
    hasShop: true,
    hasTemple: true,
    patronGod: 'omni',
    tier: 4,
  },
  {
    id: 'crystal_atoll',
    name: 'Crystal Atoll',
    faction: 'fabled',
    hostility: 'friendly',
    size: 'medium',
    biome: 'tropical',
    position: { x: 1600, z: -1200 },
    radius: 85,
    description: 'Sacred meditation grounds. The Omni\'s temple floats on crystal waters.',
    npcTypes: ['monk', 'healer', 'sage'],
    resources: ['blacklotus', 'seadragon'],
    hasPort: true,
    hasTavern: false,
    hasShop: false,
    hasTemple: true,
    patronGod: 'omni',
    tier: 3,
  },
  {
    id: 'moonlit_grove',
    name: 'Moonlit Grove',
    faction: 'fabled',
    hostility: 'friendly',
    size: 'small',
    biome: 'forest',
    position: { x: 2400, z: 300 },
    radius: 55,
    description: 'Elven druids maintain the sacred moonwell here.',
    npcTypes: ['druid', 'elf'],
    resources: ['dreamfoil', 'fadeleaf'],
    hasPort: false,
    hasTavern: false,
    hasShop: false,
    hasTemple: true,
    tier: 2,
  },
  {
    id: 'ancient_library',
    name: 'Library of Ages',
    faction: 'fabled',
    hostility: 'neutral',
    size: 'medium',
    biome: 'mountain',
    position: { x: 1800, z: 200 },
    radius: 70,
    description: 'Repository of all knowledge. Even enemies may seek wisdom here.',
    npcTypes: ['scholar', 'librarian', 'sage'],
    resources: ['mageroyal'],
    hasPort: true,
    hasTavern: false,
    hasShop: true,
    hasTemple: false,
    tier: 4,
  },

  // === LEGION TERRITORIES (South) ===
  {
    id: 'hellmaw_fortress',
    name: 'Hellmaw Fortress',
    faction: 'legion',
    hostility: 'hostile',
    size: 'capital',
    biome: 'volcanic',
    position: { x: -600, z: 2800 },
    radius: 200,
    description: 'Legion capital. Madra\'s chaos temple dominates the volcano.',
    npcTypes: ['orc', 'undead', 'warlock', 'necromancer'],
    resources: ['adamantite', 'voidhide', 'dragonhide'],
    hasPort: true,
    hasTavern: true,
    hasShop: true,
    hasTemple: true,
    patronGod: 'madra',
    tier: 5,
    gameplayType: 'hostile',
    enemyConfig: {
      enemyTypes: ['orc', 'undead_knight', 'skeleton'],
      enemyCount: 12,
      bossType: 'necromancer',
      bossHealth: 500
    }
  },
  {
    id: 'bone_coast',
    name: 'Bone Coast',
    faction: 'legion',
    hostility: 'hostile',
    size: 'large',
    biome: 'haunted',
    position: { x: -1200, z: 2200 },
    radius: 110,
    description: 'Undead shipyard. Ghost ships are constructed from bones and shadow.',
    npcTypes: ['undead', 'necromancer', 'skeleton'],
    resources: ['voidhide', 'shark'],
    hasPort: true,
    hasTavern: false,
    hasShop: true,
    hasTemple: true,
    patronGod: 'madra',
    tier: 4,
    gameplayType: 'claimable',
    isClaimable: true,
    enemyConfig: {
      enemyTypes: ['skeleton', 'undead_knight'],
      enemyCount: 8,
      bossType: 'giant_skeleton',
      bossHealth: 300
    },
    buildingSlots: 6,
    workerSlots: 4
  },
  {
    id: 'warchief_island',
    name: 'Warchief\'s Domain',
    faction: 'legion',
    hostility: 'hostile',
    size: 'large',
    biome: 'volcanic',
    position: { x: 200, z: 2400 },
    radius: 130,
    description: 'Orc warchief training grounds. Only the strongest survive.',
    npcTypes: ['orc', 'warrior', 'shaman'],
    resources: ['scalehide', 'iron', 'copper'],
    hasPort: true,
    hasTavern: true,
    hasShop: false,
    hasTemple: false,
    tier: 4,
  },
  {
    id: 'shadow_marsh',
    name: 'Shadow Marsh',
    faction: 'legion',
    hostility: 'hostile',
    size: 'medium',
    biome: 'swamp',
    position: { x: -200, z: 1800 },
    radius: 90,
    description: 'Poisonous swamps where undead horrors lurk.',
    npcTypes: ['undead', 'zombie', 'witch'],
    resources: ['blacklotus', 'fadeleaf'],
    hasPort: false,
    hasTavern: false,
    hasShop: false,
    hasTemple: true,
    patronGod: 'madra',
    tier: 3,
    gameplayType: 'hostile',
    enemyConfig: {
      enemyTypes: ['skeleton', 'undead_knight'],
      enemyCount: 5,
    }
  },
  {
    id: 'cinder_peak',
    name: 'Cinder Peak',
    faction: 'legion',
    hostility: 'hostile',
    size: 'medium',
    biome: 'volcanic',
    position: { x: 600, z: 3200 },
    radius: 95,
    description: 'Active volcanic island. Dragons nest in the caldera.',
    npcTypes: ['orc', 'dragon', 'elemental'],
    resources: ['dragonhide', 'adamantite'],
    hasPort: false,
    hasTavern: false,
    hasShop: false,
    hasTemple: false,
    tier: 5,
  },

  // === PIRATE TERRITORIES (Southeast) ===
  {
    id: 'freeport',
    name: 'Freeport',
    faction: 'pirate',
    hostility: 'neutral',
    size: 'large',
    biome: 'tropical',
    position: { x: 3200, z: 1800 },
    radius: 140,
    description: 'Pirate haven. No laws, only gold talks.',
    npcTypes: ['pirate', 'merchant', 'smuggler', 'gambler'],
    resources: ['gold', 'lobster', 'shark'],
    hasPort: true,
    hasTavern: true,
    hasShop: true,
    hasTemple: false,
    tier: 3,
    gameplayType: 'trading_post',
    hasTradingPost: true
  },
  {
    id: 'skull_rock',
    name: 'Skull Rock',
    faction: 'pirate',
    hostility: 'hostile',
    size: 'medium',
    biome: 'desert',
    position: { x: 2800, z: 2400 },
    radius: 75,
    description: 'Notorious pirate captain\'s lair. Treasure buried deep.',
    npcTypes: ['pirate', 'skeleton'],
    resources: ['gold', 'copper'],
    hasPort: true,
    hasTavern: true,
    hasShop: false,
    hasTemple: false,
    tier: 3,
    gameplayType: 'claimable',
    isClaimable: true,
    enemyConfig: {
      enemyTypes: ['pirate', 'skeleton'],
      enemyCount: 6,
      bossType: 'pirate_captain',
      bossHealth: 250
    },
    buildingSlots: 4,
    workerSlots: 3
  },
  {
    id: 'smugglers_cove',
    name: 'Smuggler\'s Cove',
    faction: 'pirate',
    hostility: 'neutral',
    size: 'small',
    biome: 'tropical',
    position: { x: 3400, z: 2600 },
    radius: 50,
    description: 'Hidden cove for illicit trade.',
    npcTypes: ['smuggler', 'merchant'],
    resources: ['lobster', 'salmon'],
    hasPort: true,
    hasTavern: false,
    hasShop: true,
    hasTemple: false,
    tier: 2,
  },

  // === FRONTIER/EXPLORATION ISLANDS ===
  {
    id: 'frozen_reach',
    name: 'Frozen Reach',
    faction: 'neutral',
    hostility: 'hostile',
    size: 'large',
    biome: 'arctic',
    position: { x: 0, z: -3500 },
    radius: 130,
    description: 'Frozen wasteland. Ancient secrets buried in ice.',
    npcTypes: ['frost_giant', 'elemental', 'beast'],
    resources: ['mithril', 'seadragon'],
    hasPort: false,
    hasTavern: false,
    hasShop: false,
    hasTemple: false,
    tier: 5,
  },
  {
    id: 'lost_temple',
    name: 'Lost Temple Isle',
    faction: 'neutral',
    hostility: 'neutral',
    size: 'medium',
    biome: 'tropical',
    position: { x: -3000, z: 500 },
    radius: 85,
    description: 'Ruins of an ancient civilization. Treasure hunters beware.',
    npcTypes: ['guardian', 'trap'],
    resources: ['gold', 'worldtree', 'blacklotus'],
    hasPort: false,
    hasTavern: false,
    hasShop: false,
    hasTemple: true,
    tier: 4,
  },
  {
    id: 'mermaid_reef',
    name: 'Mermaid\'s Reef',
    faction: 'neutral',
    hostility: 'friendly',
    size: 'small',
    biome: 'tropical',
    position: { x: 1000, z: 1200 },
    radius: 45,
    description: 'Peaceful reef. Sea creatures gather here.',
    npcTypes: ['fisherman', 'mermaid'],
    resources: ['seadragon', 'lobster', 'shark'],
    hasPort: true,
    hasTavern: false,
    hasShop: false,
    hasTemple: false,
    tier: 2,
  },
  {
    id: 'storm_watch',
    name: 'Storm Watch',
    faction: 'neutral',
    hostility: 'neutral',
    size: 'small',
    biome: 'mountain',
    position: { x: -1800, z: 800 },
    radius: 55,
    description: 'Lighthouse island. Guides ships through treacherous waters.',
    npcTypes: ['keeper', 'merchant'],
    resources: ['copper', 'iron'],
    hasPort: true,
    hasTavern: true,
    hasShop: false,
    hasTemple: false,
    tier: 2,
  },
];

// Enemy Ship Patrol Data
export const WORLD_ENEMY_SHIPS: EnemyShipData[] = [
  // Crusade Patrols
  { id: 'crusade_patrol_1', name: 'HMS Victory', faction: 'crusade', shipType: 'large', level: 8, patrolCenter: { x: -1500, z: -2000 }, patrolRadius: 600, aggressive: false, crewType: 'soldier' },
  { id: 'crusade_patrol_2', name: 'Odin\'s Wrath', faction: 'crusade', shipType: 'medium', level: 6, patrolCenter: { x: -2000, z: -2500 }, patrolRadius: 400, aggressive: false, crewType: 'soldier' },
  { id: 'crusade_escort_1', name: 'Iron Shield', faction: 'crusade', shipType: 'small', level: 4, patrolCenter: { x: -1200, z: -1600 }, patrolRadius: 300, aggressive: false, crewType: 'soldier' },

  // Fabled Patrols
  { id: 'fabled_patrol_1', name: 'Starweaver', faction: 'fabled', shipType: 'large', level: 7, patrolCenter: { x: 2000, z: -600 }, patrolRadius: 500, aggressive: false, crewType: 'elf' },
  { id: 'fabled_patrol_2', name: 'Moonrise', faction: 'fabled', shipType: 'medium', level: 5, patrolCenter: { x: 2400, z: 0 }, patrolRadius: 400, aggressive: false, crewType: 'dwarf' },
  { id: 'fabled_escort_1', name: 'Balance Keeper', faction: 'fabled', shipType: 'small', level: 3, patrolCenter: { x: 1800, z: -400 }, patrolRadius: 250, aggressive: false, crewType: 'elf' },

  // Legion Raiders (Hostile)
  { id: 'legion_raider_1', name: 'Chaos Bringer', faction: 'legion', shipType: 'large', level: 9, patrolCenter: { x: -400, z: 2600 }, patrolRadius: 700, aggressive: true, crewType: 'orc' },
  { id: 'legion_raider_2', name: 'Bone Crusher', faction: 'legion', shipType: 'medium', level: 7, patrolCenter: { x: -900, z: 2000 }, patrolRadius: 500, aggressive: true, crewType: 'skeleton' },
  { id: 'legion_raider_3', name: 'Death\'s Hand', faction: 'legion', shipType: 'medium', level: 6, patrolCenter: { x: 100, z: 2200 }, patrolRadius: 450, aggressive: true, crewType: 'undead' },
  { id: 'legion_ghost_1', name: 'Phantom Terror', faction: 'legion', shipType: 'ghost', level: 10, patrolCenter: { x: -1000, z: 2400 }, patrolRadius: 800, aggressive: true, crewType: 'ghost' },
  { id: 'legion_hunter_1', name: 'Madra\'s Vengeance', faction: 'legion', shipType: 'small', level: 5, patrolCenter: { x: 300, z: 1800 }, patrolRadius: 400, aggressive: true, crewType: 'orc' },

  // Pirate Raiders
  { id: 'pirate_captain_1', name: 'Black Pearl', faction: 'pirate', shipType: 'large', level: 8, patrolCenter: { x: 3000, z: 2000 }, patrolRadius: 600, aggressive: true, crewType: 'pirate' },
  { id: 'pirate_hunter_1', name: 'Sea Serpent', faction: 'pirate', shipType: 'medium', level: 6, patrolCenter: { x: 2600, z: 2200 }, patrolRadius: 500, aggressive: true, crewType: 'pirate' },
  { id: 'pirate_scout_1', name: 'Swift Blade', faction: 'pirate', shipType: 'small', level: 4, patrolCenter: { x: 3200, z: 2600 }, patrolRadius: 350, aggressive: true, crewType: 'pirate' },
  { id: 'pirate_ghost_1', name: 'Davy Jones', faction: 'pirate', shipType: 'ghost', level: 10, patrolCenter: { x: 2800, z: 1600 }, patrolRadius: 700, aggressive: true, crewType: 'ghost' },

  // Roaming Hostile Ships (contested areas)
  { id: 'rogue_1', name: 'Marauder', faction: 'pirate', shipType: 'medium', level: 5, patrolCenter: { x: 800, z: 800 }, patrolRadius: 500, aggressive: true, crewType: 'pirate' },
  { id: 'rogue_2', name: 'Storm Raider', faction: 'pirate', shipType: 'small', level: 3, patrolCenter: { x: -600, z: 600 }, patrolRadius: 400, aggressive: true, crewType: 'pirate' },
  { id: 'undead_hunter', name: 'Wraith', faction: 'legion', shipType: 'ghost', level: 8, patrolCenter: { x: 500, z: 1000 }, patrolRadius: 600, aggressive: true, crewType: 'ghost' },
];

// Pirate Kit Asset Registry
export const PIRATE_KIT_ASSETS = {
  characters: {
    captain_barbarossa: '/models/pirate_kit/Characters_Captain_Barbarossa.fbx',
    anne: '/models/pirate_kit/Characters_Anne.fbx',
    henry: '/models/pirate_kit/Characters_Henry.fbx',
    sharky: '/models/pirate_kit/Characters_Sharky.fbx',
    mako: '/models/pirate_kit/Characters_Mako.fbx',
    shark: '/models/pirate_kit/Characters_Shark.fbx',
    skeleton: '/models/pirate_kit/Characters_Skeleton.fbx',
    skeleton_headless: '/models/pirate_kit/Characters_Skeleton_Headless.fbx',
    tentacle: '/models/pirate_kit/Characters_Tentacle.fbx',
  },
  environment: {
    palm_1: '/models/pirate_kit/Environment_PalmTree_1.fbx',
    palm_2: '/models/pirate_kit/Environment_PalmTree_2.fbx',
    palm_3: '/models/pirate_kit/Environment_PalmTree_3.fbx',
    rock_1: '/models/pirate_kit/Environment_Rock_1.fbx',
    rock_2: '/models/pirate_kit/Environment_Rock_2.fbx',
    rock_3: '/models/pirate_kit/Environment_Rock_3.fbx',
    rock_4: '/models/pirate_kit/Environment_Rock_4.fbx',
    rock_5: '/models/pirate_kit/Environment_Rock_5.fbx',
    cliff_1: '/models/pirate_kit/Environment_Cliff1.fbx',
    cliff_2: '/models/pirate_kit/Environment_Cliff2.fbx',
    cliff_3: '/models/pirate_kit/Environment_Cliff3.fbx',
    cliff_4: '/models/pirate_kit/Environment_Cliff4.fbx',
    house_1: '/models/pirate_kit/Environment_House1.fbx',
    house_2: '/models/pirate_kit/Environment_House2.fbx',
    house_3: '/models/pirate_kit/Environment_House3.fbx',
    dock: '/models/pirate_kit/Environment_Dock.fbx',
    dock_broken: '/models/pirate_kit/Environment_Dock_Broken.fbx',
    dock_pole: '/models/pirate_kit/Environment_Dock_Pole.fbx',
    sawmill: '/models/pirate_kit/Environment_Sawmill.fbx',
    skulls: '/models/pirate_kit/Environment_Skulls.fbx',
    large_bones: '/models/pirate_kit/Environment_LargeBones.fbx',
  },
  props: {
    barrel: '/models/pirate_kit/Prop_Barrel.fbx',
    cannon: '/models/pirate_kit/Prop_Cannon.fbx',
    cannonball: '/models/pirate_kit/Prop_CannonBall.fbx',
    anchor: '/models/pirate_kit/Prop_Anchor.fbx',
    chest_closed: '/models/pirate_kit/Prop_Chest_Closed.fbx',
    chest_gold: '/models/pirate_kit/Prop_Chest_Gold.fbx',
    coins: '/models/pirate_kit/Prop_Coins.fbx',
    gold_bag: '/models/pirate_kit/Prop_GoldBag.fbx',
    skull: '/models/pirate_kit/Prop_Skull.fbx',
    bomb: '/models/pirate_kit/Prop_Bomb.fbx',
    bucket: '/models/pirate_kit/Prop_Bucket.fbx',
    bucket_fishes: '/models/pirate_kit/Prop_Bucket_Fishes.fbx',
    bottle_1: '/models/pirate_kit/Prop_Bottle_1.fbx',
    bottle_2: '/models/pirate_kit/Prop_Bottle_2.fbx',
    fish_tuna: '/models/pirate_kit/Prop_Fish_Tuna.fbx',
    fish_mackerel: '/models/pirate_kit/Prop_Fish_Mackerel.fbx',
  },
  weapons: {
    cutlass: '/models/pirate_kit/Weapon_Cutlass.fbx',
    sword_1: '/models/pirate_kit/Weapon_Sword_1.fbx',
    sword_2: '/models/pirate_kit/Weapon_Sword_2.fbx',
    axe: '/models/pirate_kit/Weapon_Axe.fbx',
    double_axe: '/models/pirate_kit/Weapon_DoubleAxe.fbx',
    dagger: '/models/pirate_kit/Weapon_Dagger.fbx',
    pistol: '/models/pirate_kit/Weapon_Pistol.fbx',
    rifle: '/models/pirate_kit/Weapon_Rifle.fbx',
    double_shotgun: '/models/pirate_kit/Weapon_DoubleShotgun.fbx',
    axe_rifle: '/models/pirate_kit/Weapon_AxeRifle.fbx',
    lute: '/models/pirate_kit/Weapon_Lute.fbx',
  },
  ships: {
    small: '/models/pirate_kit/Ship_Small.fbx',
    large: '/models/pirate_kit/Ship_Large.fbx',
  },
};

// Helper functions
export function getIslandsByFaction(faction: Faction): WorldIslandData[] {
  return WORLD_ISLANDS.filter(i => i.faction === faction);
}

// A trimmed island shape used by the landing/explore phases. The full
// WorldIslandData carries a lot of world-map-only fields; the on-foot scenes
// only need this subset.
export interface LandedIsland {
  id: string;
  name: string;
  biome: string;
  radius: number;
  hasPort: boolean;
  isOwned: boolean;
  resources: string[];
}

// Resolve the `?island=` query value into a LandedIsland. Returns null when the
// id is missing, malformed, or points at an island that no longer exists. The
// landing/explore pages treat a null result as "bad/stale link" and fall back
// to the sea view so a shared/bookmarked link never strands the player on a
// blank screen.
export function resolveLandedIsland(islandId: string | null | undefined): LandedIsland | null {
  if (!islandId) return null;
  const data = WORLD_ISLANDS.find((i) => i.id === islandId);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    biome: data.biome,
    radius: data.radius,
    hasPort: data.hasPort,
    isOwned: !!data.isClaimed,
    resources: data.resources,
  };
}

export function getHostileIslands(): WorldIslandData[] {
  return WORLD_ISLANDS.filter(i => i.hostility === 'hostile');
}

export function getFriendlyIslands(): WorldIslandData[] {
  return WORLD_ISLANDS.filter(i => i.hostility === 'friendly');
}

export function getNearestIsland(position: Vec2): WorldIslandData | null {
  let nearest: WorldIslandData | null = null;
  let minDist = Infinity;

  for (const island of WORLD_ISLANDS) {
    const dx = position.x - island.position.x;
    const dz = position.z - island.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < minDist) {
      minDist = dist;
      nearest = island;
    }
  }

  return nearest;
}

export function getEnemyShipsInArea(center: Vec2, radius: number): EnemyShipData[] {
  return WORLD_ENEMY_SHIPS.filter((ship) => {
    const dx = center.x - ship.patrolCenter.x;
    const dz = center.z - ship.patrolCenter.z;
    return Math.hypot(dx, dz) < radius + ship.patrolRadius;
  });
}

export function getCapitalIsland(faction: Faction): WorldIslandData | undefined {
  return WORLD_ISLANDS.find((i) => i.faction === faction && i.size === "capital");
}

export function islandAtPosition(position: Vec2): WorldIslandData | null {
  for (const island of WORLD_ISLANDS) {
    const dx = position.x - island.position.x;
    const dz = position.z - island.position.z;
    if (Math.hypot(dx, dz) <= island.radius + 40) return island;
  }
  return null;
}

export function getPlayerFactionStanding(playerFaction: Faction, targetFaction: Faction): 'friendly' | 'neutral' | 'hostile' {
  if (playerFaction === targetFaction) return 'friendly';
  
  const alliances: Record<Faction, { friendly: Faction[]; hostile: Faction[] }> = {
    crusade: { friendly: [], hostile: ['legion'] },
    fabled: { friendly: [], hostile: ['legion'] },
    legion: { friendly: [], hostile: ['crusade', 'fabled'] },
    pirate: { friendly: [], hostile: [] },
    neutral: { friendly: [], hostile: [] },
  };
  
  if (alliances[playerFaction].hostile.includes(targetFaction)) return 'hostile';
  if (alliances[playerFaction].friendly.includes(targetFaction)) return 'friendly';
  return 'neutral';
}

// Biome-specific decoration configurations
export const BIOME_DECORATIONS: Record<string, { trees: string[]; rocks: string[]; props: string[]; colors: { ground: number; accent: number } }> = {
  tropical: {
    trees: ['palm_1', 'palm_2', 'palm_3'],
    rocks: ['rock_1', 'rock_2', 'rock_3'],
    props: ['barrel', 'chest_closed', 'bucket_fishes'],
    colors: { ground: 0xF4D03F, accent: 0x27AE60 },
  },
  volcanic: {
    trees: [],
    rocks: ['rock_4', 'rock_5', 'cliff_1', 'cliff_2'],
    props: ['skull', 'large_bones', 'bomb'],
    colors: { ground: 0x2C2C2C, accent: 0xE74C3C },
  },
  arctic: {
    trees: [],
    rocks: ['rock_1', 'rock_3', 'cliff_3'],
    props: ['barrel', 'chest_closed'],
    colors: { ground: 0xECF0F1, accent: 0x3498DB },
  },
  desert: {
    trees: ['palm_1'],
    rocks: ['rock_2', 'rock_4', 'rock_5'],
    props: ['skull', 'chest_gold', 'coins'],
    colors: { ground: 0xE67E22, accent: 0xD35400 },
  },
  haunted: {
    trees: [],
    rocks: ['cliff_4', 'rock_5'],
    props: ['skull', 'large_bones', 'skulls'],
    colors: { ground: 0x1A1A2E, accent: 0x9B59B6 },
  },
  forest: {
    trees: ['palm_2', 'palm_3'],
    rocks: ['rock_1', 'rock_2', 'rock_3'],
    props: ['barrel', 'bucket', 'sawmill'],
    colors: { ground: 0x228B22, accent: 0x2ECC71 },
  },
  swamp: {
    trees: ['palm_1'],
    rocks: ['rock_3', 'rock_4'],
    props: ['skull', 'bottle_1', 'bottle_2'],
    colors: { ground: 0x556B2F, accent: 0x6B8E23 },
  },
  mountain: {
    trees: [],
    rocks: ['cliff_1', 'cliff_2', 'cliff_3', 'cliff_4', 'rock_5'],
    props: ['barrel', 'cannon', 'anchor'],
    colors: { ground: 0x696969, accent: 0x4A4A4A },
  },
};
