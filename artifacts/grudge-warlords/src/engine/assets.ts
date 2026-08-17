import { WARLORD_MANIFEST, ASSET_CDN } from "./warlordManifest";

const LOCAL = import.meta.env.BASE_URL;

/**
 * Unit assets — ONLY two families exist in-game:
 *   1. GRUDGE6 Bip001 heroes / lane guards (see grudge6Character.ts)
 *   2. defaultcreeps pack (melee / wizard / artillery) — all lane minions
 *
 * KayKit, old palette footman/archer/knight, and procedural cubes are gone.
 */

export type DefaultCreepRole = "melee" | "ranged" | "siege";
export type DefaultCreepTeam = "blue" | "red";

const CREEP_FILE: Record<DefaultCreepTeam, Record<DefaultCreepRole, string>> = {
  blue: {
    melee: "blue_melee_minion.glb",
    ranged: "blue_wizard.glb",
    siege: "blue_artillery_carriage.glb",
  },
  red: {
    melee: "red_melee_minion.glb",
    ranged: "red_wizard.glb",
    siege: "red_artillery_carriage.glb",
  },
};

/** Same-origin staged pack under /models/units/defaultcreeps/ */
export function defaultCreepUrl(team: DefaultCreepTeam, role: DefaultCreepRole): string {
  return `${LOCAL}models/units/defaultcreeps/${CREEP_FILE[team][role]}`;
}

/** Map unit mesh kind / combat line → defaultcreep role. */
export function meshToCreepRole(mesh: string, ranged?: boolean): DefaultCreepRole {
  const m = mesh.toLowerCase();
  if (
    m.includes("knight") ||
    m.includes("ogre") ||
    m.includes("artillery") ||
    m.includes("siege") ||
    m.includes("carriage")
  ) {
    return "siege";
  }
  if (
    ranged ||
    m.includes("archer") ||
    m.includes("raider") ||
    m.includes("mage") ||
    m.includes("wizard") ||
    m.includes("ranger") ||
    m.includes("marksman") ||
    m.includes("skirmish")
  ) {
    return "ranged";
  }
  return "melee";
}

export function factionToCreepTeam(faction: string): DefaultCreepTeam {
  return faction === "enemy" ? "red" : "blue";
}

/** @deprecated Legacy palette units — kept only so old imports compile; unused. */
export function unitModelUrl(mesh: string): string {
  return `${WARLORD_MANIFEST.pipeline.r2.units}${mesh}.glb`;
}
export function unitModelUrlLocal(mesh: string): string {
  return `${LOCAL}models/units/${mesh}.glb`;
}
export function unitPaletteUrl(): string {
  return WARLORD_MANIFEST.pipeline.r2.unitPalette;
}
export function unitPaletteUrlLocal(): string {
  return `${LOCAL}models/units/Color_Palette.png`;
}

export function resolveUnitAssets(_cdnOk: boolean): {
  creeps: Record<DefaultCreepTeam, Record<DefaultCreepRole, string>>;
} {
  return {
    creeps: {
      blue: {
        melee: defaultCreepUrl("blue", "melee"),
        ranged: defaultCreepUrl("blue", "ranged"),
        siege: defaultCreepUrl("blue", "siege"),
      },
      red: {
        melee: defaultCreepUrl("red", "melee"),
        ranged: defaultCreepUrl("red", "ranged"),
        siege: defaultCreepUrl("red", "siege"),
      },
    },
  };
}

export { ASSET_CDN };
