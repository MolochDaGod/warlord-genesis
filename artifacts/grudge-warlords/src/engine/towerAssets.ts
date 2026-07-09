/**
 * Lane tower GLBs — Craftpix map packs keyed to GRUDGE6 faction races.
 *
 * Each faction fields two races; outer / inner lane towers use each race's look:
 *   Crusade — human (outer) · barbarian (inner)  → medieval stone keeps
 *   Fabled  — elf (outer) · dwarf (inner)        → elven then medieval stone
 *   Legion  — orc (outer) · undead (inner)     → orc then ruins / necropolis
 */

import type { GrudgeFactionId } from "./grudge6";
import { ASSET_CDN, WARLORD_MANIFEST } from "./warlordManifest";

export type TowerPack = "medieval" | "elven" | "orc" | "ruins";
export type TowerTier = "outer" | "inner";

const LOCAL = import.meta.env.BASE_URL;

/** Canonical two-race roster per faction (matches game-content prefabs). */
export const FACTION_RACES: Record<GrudgeFactionId, readonly [string, string]> = {
  crusade: ["human", "barbarian"],
  fabled: ["elf", "dwarf"],
  legion: ["orc", "undead"],
};

/** GLB basename per atlas pack × lane tier. */
export const TOWER_MODEL: Record<TowerPack, Record<TowerTier, string>> = {
  medieval: { outer: "tower_02_1", inner: "tower_03_1_full" },
  elven: { outer: "tower_2", inner: "tower_3_full" },
  orc: { outer: "tower_02", inner: "tower_3_full" },
  /** Undead / Legion inner garrison — ruined spire props from the ruins pack. */
  ruins: { outer: "ruin_11", inner: "ruin_15" },
};

/**
 * Which Craftpix atlas + mesh set to use per faction lane tier.
 * Outer = first race aesthetic; inner = second race.
 */
export const FACTION_TOWER_PACK: Record<GrudgeFactionId, Record<TowerTier, TowerPack>> = {
  crusade: { outer: "medieval", inner: "medieval" },
  fabled: { outer: "elven", inner: "medieval" },
  legion: { outer: "orc", inner: "ruins" },
};

export const FACTION_TOWER_LABEL: Record<GrudgeFactionId, string> = {
  crusade: "Crusade — Human · Barbarian",
  fabled: "Fabled — Elf · Dwarf",
  legion: "Legion — Orc · Undead",
};

export function towerPackForFactionTier(factionId: GrudgeFactionId, tier: TowerTier): TowerPack {
  return FACTION_TOWER_PACK[factionId][tier];
}

/** @deprecated Use towerPackForFactionTier — outer pack only. */
export function towerPackForFaction(factionId: GrudgeFactionId): TowerPack {
  return towerPackForFactionTier(factionId, "outer");
}

export function towerModelUrl(pack: TowerPack, tier: TowerTier, cdnOk: boolean): string {
  const file = TOWER_MODEL[pack][tier];
  if (cdnOk) {
    return `${WARLORD_MANIFEST.pipeline.r2.mapTowers}${pack}/${file}.glb`;
  }
  return `${LOCAL}models/towers/${pack}/${file}.glb`;
}

export function towerAtlasUrl(pack: TowerPack, cdnOk: boolean): string {
  if (cdnOk) {
    return `${WARLORD_MANIFEST.pipeline.r2.mapTowerAtlases}${pack}/atlas.png`;
  }
  return `${LOCAL}models/towers/${pack}/atlas.png`;
}

export function allTowerUrls(cdnOk: boolean): string[] {
  const out: string[] = [];
  for (const pack of ["medieval", "elven", "orc", "ruins"] as const) {
    out.push(towerAtlasUrl(pack, cdnOk));
    for (const tier of ["outer", "inner"] as const) {
      out.push(towerModelUrl(pack, tier, cdnOk));
    }
  }
  return out;
}

export { ASSET_CDN };