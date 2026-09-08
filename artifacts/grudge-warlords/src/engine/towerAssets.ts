/**
 * Lane + town towers.
 * Play kit: models/towers/medieval/3_medieval_towers.glb
 * (rename from `3_medieval_towers (2).glb`) + medieval/atlas.png
 */

import type { GrudgeFactionId } from "./grudge6";
import { ASSET_CDN } from "./warlordManifest";

export type TowerPack = "medieval" | "elven" | "orc" | "ruins";
export type TowerTier = "outer" | "inner" | "town";
export type MedievalKitRole = "cannon" | "keep" | "mage";

const LOCAL = import.meta.env.BASE_URL;

export const FACTION_RACES: Record<GrudgeFactionId, readonly [string, string]> = {
  crusade: ["human", "barbarian"],
  fabled: ["elf", "dwarf"],
  legion: ["orc", "undead"],
};

export const TOWER_MODEL: Record<TowerPack, Record<"outer" | "inner", string>> = {
  medieval: { outer: "tower_02_1", inner: "tower_03_1_full" },
  elven: { outer: "tower_2", inner: "tower_3_full" },
  orc: { outer: "tower_02", inner: "tower_3_full" },
  ruins: { outer: "ruin_11", inner: "ruin_15" },
};

export const FACTION_TOWER_PACK: Record<GrudgeFactionId, Record<"outer" | "inner", TowerPack>> = {
  crusade: { outer: "medieval", inner: "medieval" },
  fabled: { outer: "elven", inner: "medieval" },
  legion: { outer: "orc", inner: "ruins" },
};

export function kitRoleForTier(tier: TowerTier): MedievalKitRole {
  if (tier === "town") return "mage";
  if (tier === "inner") return "keep";
  return "cannon";
}

const LFS = "https://media.githubusercontent.com/media/MolochDaGod/warlord-genesis/main/";

export function medievalKitUrl(): string {
  return `${LOCAL}models/towers/medieval/3_medieval_towers.glb`;
}

export function medievalKitFallbacks(): string[] {
  return [
    `${LOCAL}models/towers/medieval/3_medieval_towers.glb`,
    `${ASSET_CDN}/models/towers/medieval/3_medieval_towers.glb`,
    `${LFS}models/towers/medieval/3_medieval_towers.glb`,
    `${LOCAL}models/towers/medieval/bashnia.glb`,
    `${LFS}models/towers/medieval/bashnia.glb`,
  ];
}

export function medievalKitTextureUrl(): string {
  return `${LOCAL}models/towers/medieval/atlas.png`;
}

export const FACTION_TOWER_LABEL: Record<GrudgeFactionId, string> = {
  crusade: "Crusade — Human · Barbarian",
  fabled: "Fabled — Elf · Dwarf",
  legion: "Legion — Orc · Undead",
};

export function towerPackForFactionTier(
  factionId: GrudgeFactionId,
  tier: Exclude<TowerTier, "town">,
): TowerPack {
  return FACTION_TOWER_PACK[factionId][tier];
}

export function towerPackForFaction(factionId: GrudgeFactionId): TowerPack {
  return towerPackForFactionTier(factionId, "outer");
}

export function towerModelUrl(
  pack: TowerPack,
  tier: Exclude<TowerTier, "town">,
  _cdnOk?: boolean,
): string {
  const file = TOWER_MODEL[pack][tier];
  return `${LOCAL}models/towers/${pack}/${file}.glb`;
}

export function towerAtlasUrl(pack: TowerPack, _cdnOk?: boolean): string {
  return `${LOCAL}models/towers/${pack}/atlas.png`;
}

export function allTowerUrls(_cdnOk: boolean): string[] {
  const out: string[] = [];
  for (const pack of ["medieval", "elven", "orc", "ruins"] as const) {
    out.push(towerAtlasUrl(pack));
    for (const tier of ["outer", "inner"] as const) out.push(towerModelUrl(pack, tier));
  }
  out.push(medievalKitUrl(), medievalKitTextureUrl());
  return out;
}

export { ASSET_CDN };
