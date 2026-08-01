/**
 * Fleet neutral creeps (R2) for Genesis island enemyTypes.
 *
 * SSOT catalog: https://objectstore.grudge-studio.com/api/v1/neutral-creeps.json
 * Binaries: https://assets.grudge-studio.com/models/creeps/threejs-games/…
 *
 * Maps IslandEnemyConfig.enemyTypes → model URL + combat stats.
 */

export type GenesisEnemyType =
  | "skeleton"
  | "goblin"
  | "orc"
  | "undead_knight"
  | "sea_creature"
  | "pirate"
  | "demon"
  | "troll"
  | "witch"
  | "zombie"
  | "golem"
  | "ogre";

export interface NeutralCreepModel {
  id: string;
  label: string;
  /** Full R2 URL (FBX until baked to GLB) */
  modelUrl: string;
  fallbackUrl: string;
  heightM: number;
  hp: number;
  damage: number;
  speed: number;
  tier: number;
}

const R2 = "https://assets.grudge-studio.com/models/creeps/threejs-games";
const FB = "https://threejs-games.github.io/assets/models/character";

function creep(
  id: string,
  label: string,
  slug: string,
  file: string,
  heightM: number,
  hp: number,
  damage: number,
  speed: number,
  tier: number,
): NeutralCreepModel {
  return {
    id,
    label,
    modelUrl: `${R2}/${slug}/${file}`,
    fallbackUrl: `${FB}/${slug}/${file}`,
    heightM,
    hp,
    damage,
    speed,
    tier,
  };
}

/** All mirrored creeps */
export const NEUTRAL_CREEP_MODELS: NeutralCreepModel[] = [
  creep("creep_goblin", "Goblin", "goblin", "model.fbx", 1.35, 35, 6, 3.2, 1),
  creep("creep_orc", "Orc", "orc", "model.fbx", 1.85, 55, 10, 2.6, 2),
  creep("creep_skeleton", "Skeleton", "skeleton", "model.fbx", 1.8, 40, 8, 2.3, 1),
  creep("creep_troll", "Troll", "troll", "model.fbx", 2.3, 110, 13, 2.0, 3),
  creep("creep_golem", "Golem", "golem", "model.fbx", 2.4, 140, 16, 1.6, 4),
  creep("creep_demon", "Demon", "demon", "model.fbx", 2.2, 90, 14, 2.4, 3),
  creep("creep_witch", "Witch", "witch", "model.fbx", 1.7, 48, 11, 2.4, 2),
  creep("creep_sorceress", "Sorceress", "sorceress", "model.fbx", 1.75, 45, 12, 2.5, 2),
  creep("creep_orc_ogre", "Orc Ogre", "orc-ogre", "model.fbx", 2.5, 120, 18, 1.8, 3),
  creep("creep_zombie", "Zombie", "zombie", "zombie-barefoot.fbx", 1.75, 50, 9, 1.5, 1),
  creep("creep_zombie_guard", "Zombie Guard", "zombie", "zombie-guard.fbx", 1.85, 70, 11, 1.6, 2),
  creep("creep_zombie_cop", "Zombie Cop", "zombie", "zombie-cop.fbx", 1.8, 60, 10, 1.7, 2),
];

const BY_ID = new Map(NEUTRAL_CREEP_MODELS.map((c) => [c.id, c]));

/** Map aethermoor IslandEnemyConfig.enemyTypes → creep model */
export const ENEMY_TYPE_TO_CREEP_ID: Record<string, string> = {
  skeleton: "creep_skeleton",
  goblin: "creep_goblin",
  orc: "creep_orc",
  undead_knight: "creep_zombie_guard",
  sea_creature: "creep_golem",
  pirate: "creep_orc",
  demon: "creep_demon",
  troll: "creep_troll",
  witch: "creep_witch",
  zombie: "creep_zombie",
  golem: "creep_golem",
  ogre: "creep_orc_ogre",
};

export function resolveEnemyTypeModel(
  type: string,
): NeutralCreepModel | null {
  const id = ENEMY_TYPE_TO_CREEP_ID[type] || ENEMY_TYPE_TO_CREEP_ID[type.toLowerCase()];
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

/** Pick models for an island enemyConfig */
export function modelsForEnemyTypes(
  types: string[],
): NeutralCreepModel[] {
  const out: NeutralCreepModel[] = [];
  for (const t of types) {
    const m = resolveEnemyTypeModel(t);
    if (m) out.push(m);
  }
  return out;
}

/** Random creep for open-world camps */
export function pickNeutralCreep(rng = Math.random): NeutralCreepModel {
  return NEUTRAL_CREEP_MODELS[
    Math.floor(rng() * NEUTRAL_CREEP_MODELS.length)
  ]!;
}
