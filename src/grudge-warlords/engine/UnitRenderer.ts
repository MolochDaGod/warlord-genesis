/**
 * Unit render routing — LOWPO Fantasy Army (crusade defaults) + Elf Free (fabled).
 *
 * Local /models/units/*.glb and /models/units/lowpo/** use embedded textures.
 * Legacy CDN palette path still supported via Color_Palette.png.
 *
 * Pack refs:
 *  - https://standout7.itch.io/fantasy-army (Army_Free → crusade)
 *  - Elf_Free.zip → fabled
 */
import {
  DEFAULT_UNIT_URLS,
  type FactionSkin,
  unitGlbsForShop,
  type ShopUnitKey,
} from "./unitCatalog";

export type UnitKind =
  | "footman"
  | "grunt"
  | "archer"
  | "raider"
  | "knight"
  | "ogre"
  | "captain"
  /** Forest / jungle creeps (camp enemies + MOBA jungle). */
  | "forest_bear"
  | "forest_skeleton"
  | "forest_zombie"
  | "forest_zombie_brute"
  | "jungle_orc"
  | "jungle_ogre"
  /** Fabled (Elf Free). */
  | "fabled_elf"
  | "fabled_ice_elf"
  | "fabled_fire_elf";

export function isLocalKayKitUrl(url: string): boolean {
  return /\/models\/units\//.test(url) || /\/models\/kaykit\//.test(url);
}

export function isLowpoUrl(url: string): boolean {
  return /\/models\/units\/lowpo\//.test(url) || /\/lowpo\//.test(url);
}

/** Jungle / forest creep mesh keys (shared with Open forest-creeps catalog). */
export const JUNGLE_UNIT_MESH: Partial<Record<UnitKind, string[]>> = {
  forest_bear: ["models/bear.glb"],
  forest_skeleton: ["models/creatures/skeleton-warrior.glb", "models/skeleton-warrior.glb"],
  forest_zombie: [
    "models/enemies/voxel-zombies/voxel-zombie-1.glb",
    "models/enemies/voxel-zombies/voxel-zombie-2.glb",
  ],
  forest_zombie_brute: ["models/enemies/voxel-zombies/voxel-zombie-3.glb"],
  jungle_orc: ["models/orc.glb", "models/races/orc.glb"],
  jungle_ogre: ["models/ogre.glb"],
};

/** Fabled mesh keys (Elf Free). */
export const FABLED_UNIT_MESH: Partial<Record<UnitKind, string[]>> = {
  fabled_elf: unitGlbsForShop("footman", "fabled"),
  fabled_ice_elf: unitGlbsForShop("archer", "fabled"),
  fabled_fire_elf: unitGlbsForShop("knight", "fabled"),
};

export function isJungleCreepKind(kind: string): boolean {
  return kind in JUNGLE_UNIT_MESH || kind.startsWith("forest_") || kind.startsWith("jungle_");
}

export function isFabledKind(kind: string): boolean {
  return kind in FABLED_UNIT_MESH || kind.startsWith("fabled_");
}

export type UnitLayer = "lowpo" | "kaykit" | "palette" | "jungle_glb" | "fabled_glb";

export function pickUnitLayer(
  kind: UnitKind,
  urls: { footman: string; archer: string; knight: string },
): UnitLayer {
  if (isJungleCreepKind(kind)) return "jungle_glb";
  if (isFabledKind(kind)) return "fabled_glb";
  switch (kind) {
    case "footman":
    case "grunt": {
      const u = urls.footman;
      if (isLowpoUrl(u)) return "lowpo";
      return isLocalKayKitUrl(u) ? "kaykit" : "palette";
    }
    case "archer":
    case "raider":
    case "captain": {
      const u = urls.archer;
      if (isLowpoUrl(u)) return "lowpo";
      return isLocalKayKitUrl(u) ? "kaykit" : "palette";
    }
    case "knight":
    case "ogre": {
      const u = urls.knight;
      if (isLowpoUrl(u)) return "lowpo";
      return isLocalKayKitUrl(u) ? "kaykit" : "palette";
    }
    default:
      return "lowpo";
  }
}

/**
 * Default URL set for crusade (normal units). Prefer lowpo paths so Vercel
 * static `/models/units/lowpo/...` and root aliases resolve first.
 */
export function defaultCrusadeUnitUrls(): {
  footman: string;
  archer: string;
  knight: string;
  palette: string;
} {
  return { ...DEFAULT_UNIT_URLS };
}

/** Map shop/sim key → mesh candidates for a faction skin. */
export function meshCandidatesForUnit(
  key: ShopUnitKey | UnitKind,
  skin: FactionSkin = "crusade",
  side: "ally" | "enemy" = "ally",
): string[] {
  if (key === "footman" || key === "grunt") return unitGlbsForShop("footman", skin, side);
  if (key === "archer" || key === "raider" || key === "captain")
    return unitGlbsForShop("archer", skin, side);
  if (key === "knight" || key === "ogre") return unitGlbsForShop("knight", skin, side);
  if (isFabledKind(key)) return FABLED_UNIT_MESH[key as UnitKind] ?? [];
  if (isJungleCreepKind(key)) return JUNGLE_UNIT_MESH[key as UnitKind] ?? [];
  return [];
}
