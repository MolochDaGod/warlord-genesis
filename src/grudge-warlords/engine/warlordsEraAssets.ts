/**
 * Warlords-era organized asset library (post 2026-07-18 download wave).
 * Paths under /models/warlords-era/ — stylized/HQ only, NOT voxel packs.
 */
export const WARLORDS_ERA_ROOT = "/models/warlords-era";

export const WARLORDS_ANIMALS = {
  land: {
    bear: `${WARLORDS_ERA_ROOT}/animals/land/bear.glb`,
    bearBaby: `${WARLORDS_ERA_ROOT}/animals/land/bear_baby.glb`,
    wolf: `${WARLORDS_ERA_ROOT}/animals/land/wolf.glb`,
    wolfBaby: `${WARLORDS_ERA_ROOT}/animals/land/wolf_baby.glb`,
    fox: `${WARLORDS_ERA_ROOT}/animals/land/fox.glb`,
    foxBaby: `${WARLORDS_ERA_ROOT}/animals/land/fox_baby.glb`,
    deer: `${WARLORDS_ERA_ROOT}/animals/land/deer.glb`,
    deerBaby: `${WARLORDS_ERA_ROOT}/animals/land/deer_baby.glb`,
    doe: `${WARLORDS_ERA_ROOT}/animals/land/doe.glb`,
    boar: `${WARLORDS_ERA_ROOT}/animals/land/boar.glb`,
    horse: `${WARLORDS_ERA_ROOT}/animals/land/horse.glb`,
  },
  water: {
    shark: `${WARLORDS_ERA_ROOT}/animals/water/shark.glb`,
    seaTurtle: `${WARLORDS_ERA_ROOT}/animals/water/sea_turtle.glb`,
    cavernTurtle: `${WARLORDS_ERA_ROOT}/animals/water/cavern_turtle.glb`,
    turtleEvent: `${WARLORDS_ERA_ROOT}/animals/water/turtle_event.glb`,
  },
  flying: {
    eagle: `${WARLORDS_ERA_ROOT}/animals/flying/eagle.glb`,
    eagleBaby: `${WARLORDS_ERA_ROOT}/animals/flying/eagle_baby.glb`,
    owl: `${WARLORDS_ERA_ROOT}/animals/flying/owl.glb`,
    crow: `${WARLORDS_ERA_ROOT}/animals/flying/crow.glb`,
    crowBaby: `${WARLORDS_ERA_ROOT}/animals/flying/crow_baby.glb`,
    harpia: `${WARLORDS_ERA_ROOT}/animals/flying/harpia.glb`,
  },
} as const;

export const WARLORDS_BUILDINGS = {
  archerTower: `${WARLORDS_ERA_ROOT}/buildings/archertower_modular.glb`,
  fortEntrance: `${WARLORDS_ERA_ROOT}/buildings/entrance_to_fort.glb`,
  skyCastle: `${WARLORDS_ERA_ROOT}/buildings/skycastle.glb`,
  medievalCamp: `${WARLORDS_ERA_ROOT}/buildings/medieval_camp.glb`,
  smeltery: `${WARLORDS_ERA_ROOT}/buildings/smeltery.glb`,
  anglersHouse: `${WARLORDS_ERA_ROOT}/buildings/anglers_house.glb`,
  pirateTavern: `${WARLORDS_ERA_ROOT}/buildings/pirate_tavern.glb`,
  castle: `${WARLORDS_ERA_ROOT}/buildings/castle.glb`,
} as const;

export const WARLORDS_NATURE = {
  rocks70: `${WARLORDS_ERA_ROOT}/nature/rocks/stylized_rocks_70.glb`,
  rocksPack: `${WARLORDS_ERA_ROOT}/nature/rocks/stylised_rocks_pack.glb`,
  treesVol1: `${WARLORDS_ERA_ROOT}/nature/trees/stylized_nature_vol1.glb`,
  redwood: `${WARLORDS_ERA_ROOT}/nature/trees/redwood_lod.glb`,
  autumnForest: `${WARLORDS_ERA_ROOT}/nature/trees/autumn_forest.glb`,
  plantsFree: `${WARLORDS_ERA_ROOT}/nature/plants/stylized_plants_free.glb`,
  plantsSet: `${WARLORDS_ERA_ROOT}/nature/plants/plants_asset_set.glb`,
  grass: `${WARLORDS_ERA_ROOT}/nature/plants/grass.glb`,
  ivy: `${WARLORDS_ERA_ROOT}/nature/plants/ivy.glb`,
  thunderstorm: `${WARLORDS_ERA_ROOT}/nature/vfx/thunderstorm.glb`,
  cloudRing: `${WARLORDS_ERA_ROOT}/nature/vfx/cloud_ring.glb`,
} as const;

/** Voxel kits — Open/Mine-Loader only; never load as Warlords era art. */
export const VOXEL_ONLY_ROOT = "/models/voxel-only";
