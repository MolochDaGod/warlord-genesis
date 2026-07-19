/**
 * Dark Elves — Warlords Era island content (ported from Flare-Boss patterns).
 *
 * Visuals: reuse Elf Free meshes (elf / ice / fire) with dark canopy tints.
 * Placement: Fabled eastern sectors + dark-canopy events on home island / instances.
 */

export type DarkElfRole = "raider" | "assassin" | "sorceress" | "matriarch";

export interface DarkElfUnitDef {
  id: string;
  name: string;
  role: DarkElfRole;
  /** Preferred GLB (same-origin /models/units/lowpo/fabled/…) */
  glb: string[];
  /** Material tint applied after load (RGB 0–1) */
  tint: [number, number, number];
  emissive: [number, number, number];
  level: number;
  hp: number;
  damage: number;
  /** Sector ids that may spawn this unit (see sectors.ts SECTOR_META) */
  sectorIds: string[];
  aggroRange: number;
  attackRange: number;
  speed: number;
  lootTable: string[];
  source: string;
}

/** Canonical dark-elf roster for islands, instances, and lobby previews. */
export const DARK_ELF_UNITS: DarkElfUnitDef[] = [
  {
    id: "dark_elf_raider",
    name: "Dark Elf Raider",
    role: "raider",
    glb: [
      "/models/units/lowpo/fabled/elf.glb",
      "/models/units/lowpo/fabled/ice_elf.glb",
    ],
    tint: [0.22, 0.12, 0.35],
    emissive: [0.08, 0.02, 0.18],
    level: 8,
    hp: 280,
    damage: 18,
    sectorIds: ["e", "ne", "c"],
    aggroRange: 12,
    attackRange: 2.0,
    speed: 3.2,
    lootTable: ["ITEM-dark-essence", "ITEM-shadow-silk", "whisp_purple"],
    source: "flare-boss-port / Elf_Free (tinted)",
  },
  {
    id: "dark_elf_assassin",
    name: "Dark Elf Assassin",
    role: "assassin",
    glb: ["/models/units/lowpo/fabled/elf.glb"],
    tint: [0.12, 0.08, 0.2],
    emissive: [0.15, 0.0, 0.25],
    level: 12,
    hp: 220,
    damage: 32,
    sectorIds: ["e", "se"],
    aggroRange: 10,
    attackRange: 1.6,
    speed: 4.0,
    lootTable: ["ITEM-shadow-silk", "whisp_purple", "ITEM-starter-health-potion"],
    source: "flare-boss-port / Elf_Free (tinted)",
  },
  {
    id: "dark_elf_sorceress",
    name: "Dark Elf Sorceress",
    role: "sorceress",
    glb: [
      "/models/units/lowpo/fabled/ice_elf.glb",
      "/models/units/lowpo/fabled/fire_elf.glb",
    ],
    tint: [0.28, 0.1, 0.42],
    emissive: [0.2, 0.05, 0.45],
    level: 14,
    hp: 340,
    damage: 26,
    sectorIds: ["e", "ne"],
    aggroRange: 16,
    attackRange: 9.0,
    speed: 2.6,
    lootTable: ["whisp_purple", "whisp_blue", "ITEM-dark-essence"],
    source: "flare-boss-port / Ice_Elf + Fire_Elf (tinted)",
  },
  {
    id: "dark_elf_matriarch",
    name: "Thornguard Matriarch",
    role: "matriarch",
    glb: [
      "/models/units/lowpo/fabled/fire_elf.glb",
      "/models/units/lowpo/fabled/ice_elf.glb",
    ],
    tint: [0.18, 0.05, 0.28],
    emissive: [0.35, 0.05, 0.2],
    level: 18,
    hp: 1200,
    damage: 42,
    sectorIds: ["e"],
    aggroRange: 18,
    attackRange: 3.2,
    speed: 2.4,
    lootTable: [
      "ITEM-dark-essence",
      "whisp_purple",
      "whisp_red",
      "cloth-wraithfang-helm",
    ],
    source: "flare-boss bosses.ts Thornguard Matriarch + dark-elf event",
  },
];

export const DARK_ELF_BY_ID = Object.fromEntries(
  DARK_ELF_UNITS.map((u) => [u.id, u]),
) as Record<string, DarkElfUnitDef>;

/** Home-island / sector event landmarks for dark-elf content. */
export interface DarkElfEventSite {
  id: string;
  name: string;
  /** Sector meta id (nw…se) */
  sectorId: string;
  /** Relative placement hint on island (0–1 uv) */
  islandUv: { u: number; v: number };
  landmarkMesh?: string;
  landmarkTint?: [number, number, number];
  spawns: { unitId: string; count: number }[];
  missionIds: string[];
  description: string;
}

export const DARK_ELF_EVENT_SITES: DarkElfEventSite[] = [
  {
    id: "event_dark_canopy_e",
    name: "Dark Canopy Grove",
    sectorId: "e",
    islandUv: { u: 0.62, v: 0.38 },
    landmarkMesh:
      "/models/warlords-era/buildings/skycastle.glb",
    landmarkTint: [0.15, 0.08, 0.22],
    spawns: [
      { unitId: "dark_elf_raider", count: 3 },
      { unitId: "dark_elf_assassin", count: 1 },
      { unitId: "dark_elf_sorceress", count: 1 },
    ],
    missionIds: ["MISSION_DARK_CANOPY", "MISSION_WHISP_RESCUE"],
    description:
      "A fabled island canopy twisted by void-root. Dark elves hunt whisps here.",
  },
  {
    id: "event_matriarch_peak",
    name: "Matriarch's Briar Peak",
    sectorId: "e",
    islandUv: { u: 0.48, v: 0.72 },
    landmarkMesh: "/models/warlords-era/buildings/castle.glb",
    landmarkTint: [0.2, 0.05, 0.12],
    spawns: [
      { unitId: "dark_elf_matriarch", count: 1 },
      { unitId: "dark_elf_raider", count: 4 },
    ],
    missionIds: ["MISSION_SLAY_MATRIARCH", "DUNGEON_BRIAR_DEPTHS"],
    description:
      "Thornguard Matriarch holds a dungeon portal under the briar peak.",
  },
  {
    id: "event_home_shadow_shrine",
    name: "Shadow Shrine (Home Island)",
    sectorId: "c",
    islandUv: { u: 0.55, v: 0.55 },
    landmarkTint: [0.12, 0.1, 0.2],
    spawns: [{ unitId: "dark_elf_assassin", count: 2 }],
    missionIds: ["MISSION_HOME_SHADOW_SHRINE"],
    description:
      "A small dark-elf shrine event on the player home island — tutorial combat.",
  },
];

/** Apply dark-elf tint to a loaded Three.js Object3D (client helper contract). */
export function darkElfTintSpec(unitId: string): {
  color: [number, number, number];
  emissive: [number, number, number];
} | null {
  const u = DARK_ELF_BY_ID[unitId];
  if (!u) return null;
  return { color: u.tint, emissive: u.emissive };
}
