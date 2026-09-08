/**
 * Faction town houses — one GLB pack per faction with healthy / damaged / destroyed.
 *
 * Drop the Windows files here (rename, no spaces):
 *   crusadehomedestructable.glb → models/buildings/houses/crusade.glb
 *   legiondestructablehouse.glb → models/buildings/houses/legion.glb
 *   fableddestructiblehouse.glb → models/buildings/houses/fabled.glb
 */
import type { GrudgeFactionId } from "./grudge6";
import { ASSET_CDN } from "./warlordManifest";

export type HouseStage = "healthy" | "damaged" | "destroyed" | "debris";

export const HOUSE_HP = 380;
export const HOUSE_DAMAGED_FRAC = 0.6;
export const HOUSE_DESTROYED_FRAC = 0.1;

const LOCAL = import.meta.env.BASE_URL;
const LFS = "https://media.githubusercontent.com/media/MolochDaGod/warlord-genesis/main/";

const PACK: Record<GrudgeFactionId, string> = {
  crusade: "crusade",
  fabled: "fabled",
  legion: "legion",
};

export function housePackFile(factionId: GrudgeFactionId): string {
  return PACK[factionId] ?? "crusade";
}

export function housePackUrl(factionId: GrudgeFactionId): string {
  return `${LOCAL}models/buildings/houses/${housePackFile(factionId)}.glb`;
}

export function housePackFallbacks(factionId: GrudgeFactionId): string[] {
  const file = housePackFile(factionId);
  return [
    `${LOCAL}models/buildings/houses/${file}.glb`,
    `${ASSET_CDN}/models/buildings/houses/${file}.glb`,
    `${LFS}models/buildings/houses/${file}.glb`,
  ];
}

export function houseStageForHp(hp: number, maxHp: number): HouseStage {
  if (hp <= 0) return "debris";
  const frac = hp / Math.max(1, maxHp);
  if (frac <= HOUSE_DESTROYED_FRAC) return "destroyed";
  if (frac <= HOUSE_DAMAGED_FRAC) return "damaged";
  return "healthy";
}

export function scoreHouseStage(name: string, stage: Exclude<HouseStage, "debris">): number {
  const n = name.toLowerCase();
  if (stage === "healthy") {
    if (/(healthy|intact|full|pristine|normal|undamaged|good)/.test(n)) return 8;
    if (/(dmg|damag|destroy|ruin|rubble|debris|wreck)/.test(n)) return 0;
    return 1;
  }
  if (stage === "damaged") {
    if (/(damag|dmg|broken|crack|hurt)/.test(n) && !/(destroy|rubble|debris)/.test(n)) return 8;
    return 0;
  }
  if (/(destroy|ruin|rubble|wreck|collapse|burnt|burned)/.test(n)) return 8;
  return 0;
}
