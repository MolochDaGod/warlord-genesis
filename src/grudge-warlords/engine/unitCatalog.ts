/**
 * LOWPO Fantasy Army (Standout 7) + Elf Free → Warlord Genesis unit SSOT.
 *
 * Pack: https://standout7.itch.io/fantasy-army
 *  - Blessing of Aurion (free): Captain, Footman, Knight + weapons
 *  - Red vs Blue team recolor via shared palette Texture.png
 *
 * Fabled: D:\Games\Models\Elf_Free.zip → Elf / Fire_Elf / Ice_Elf
 *
 * Default normal **crusade** lane units use LOWPO army.
 * **Fabled** faction/skin uses Elf Free pack.
 */

export type FactionSkin = "crusade" | "fabled";

export type ShopUnitKey = "footman" | "archer" | "knight";

/** Public URL roots (same-origin; Vercel rewrites /models/units → ObjectStore when missing). */
export const UNIT_MODEL_ROOT = "/models/units";
export const LOWPO_ROOT = `${UNIT_MODEL_ROOT}/lowpo`;

export interface UnitVisualDef {
  id: string;
  label: string;
  /** Shop / sim unit key when applicable. */
  shopKey?: ShopUnitKey;
  faction: FactionSkin;
  /** Preferred GLB paths (first existing wins at runtime). */
  glb: string[];
  role: "melee" | "ranged" | "heavy" | "hero_support";
  /** Optional weapon prop paths. */
  weapons?: string[];
  source: string;
}

/** Crusade (default normal units) — LOWPO Army Free. */
export const CRUSADE_UNITS: UnitVisualDef[] = [
  {
    id: "crusade_footman",
    label: "Footman",
    shopKey: "footman",
    faction: "crusade",
    glb: [
      `${LOWPO_ROOT}/crusade/footman.glb`,
      `${UNIT_MODEL_ROOT}/footman.glb`,
    ],
    role: "melee",
    weapons: [`${LOWPO_ROOT}/weapons/sword.glb`, `${LOWPO_ROOT}/weapons/shield.glb`],
    source: "standout7/fantasy-army Army_Free (Footman)",
  },
  {
    id: "crusade_captain",
    label: "Captain",
    shopKey: "archer",
    faction: "crusade",
    // Free pack has no dedicated archer mesh; Captain is the free ranged-capable officer.
    // Premium Archer can replace this path when licensed.
    glb: [
      `${LOWPO_ROOT}/crusade/captain.glb`,
      `${UNIT_MODEL_ROOT}/archer.glb`,
    ],
    role: "ranged",
    weapons: [`${LOWPO_ROOT}/weapons/bow.glb`, `${LOWPO_ROOT}/weapons/arrow.glb`],
    source: "standout7/fantasy-army Army_Free (Captain) + Bow",
  },
  {
    id: "crusade_knight",
    label: "Knight",
    shopKey: "knight",
    faction: "crusade",
    glb: [
      `${LOWPO_ROOT}/crusade/knight.glb`,
      `${UNIT_MODEL_ROOT}/knight.glb`,
    ],
    role: "heavy",
    weapons: [
      `${LOWPO_ROOT}/weapons/sword.glb`,
      `${LOWPO_ROOT}/weapons/big_shield.glb`,
      `${LOWPO_ROOT}/weapons/spear.glb`,
    ],
    source: "standout7/fantasy-army Army_Free (Knight)",
  },
];

/** Enemy-tinted crusade twins (Red army). */
export const CRUSADE_ENEMY_UNITS: UnitVisualDef[] = [
  {
    id: "crusade_footman_enemy",
    label: "Footman (Red)",
    shopKey: "footman",
    faction: "crusade",
    glb: [`${LOWPO_ROOT}/crusade/footman_enemy.glb`, `${LOWPO_ROOT}/crusade/footman.glb`],
    role: "melee",
    source: "standout7/fantasy-army Army_Free (Footman Red)",
  },
  {
    id: "crusade_captain_enemy",
    label: "Captain (Red)",
    shopKey: "archer",
    faction: "crusade",
    glb: [`${LOWPO_ROOT}/crusade/captain_enemy.glb`, `${LOWPO_ROOT}/crusade/captain.glb`],
    role: "ranged",
    source: "standout7/fantasy-army Army_Free (Captain Red)",
  },
  {
    id: "crusade_knight_enemy",
    label: "Knight (Red)",
    shopKey: "knight",
    faction: "crusade",
    glb: [`${LOWPO_ROOT}/crusade/knight_enemy.glb`, `${LOWPO_ROOT}/crusade/knight.glb`],
    role: "heavy",
    source: "standout7/fantasy-army Army_Free (Knight Red)",
  },
];

/** Fabled faction — Elf Free pack. */
export const FABLED_UNITS: UnitVisualDef[] = [
  {
    id: "fabled_elf",
    label: "Elf Warrior",
    shopKey: "footman",
    faction: "fabled",
    glb: [`${LOWPO_ROOT}/fabled/elf.glb`],
    role: "melee",
    weapons: [`${LOWPO_ROOT}/fabled/weapon_sword.glb`],
    source: "Elf_Free (Elf)",
  },
  {
    id: "fabled_ice_elf",
    label: "Ice Elf",
    shopKey: "archer",
    faction: "fabled",
    glb: [`${LOWPO_ROOT}/fabled/ice_elf.glb`],
    role: "ranged",
    weapons: [`${LOWPO_ROOT}/fabled/weapon_crystal_spear.glb`],
    source: "Elf_Free (Ice_Elf)",
  },
  {
    id: "fabled_fire_elf",
    label: "Fire Elf",
    shopKey: "knight",
    faction: "fabled",
    glb: [`${LOWPO_ROOT}/fabled/fire_elf.glb`],
    role: "heavy",
    weapons: [`${LOWPO_ROOT}/fabled/weapon_magma_staff.glb`],
    source: "Elf_Free (Fire_Elf)",
  },
];

/**
 * Dark elves — Flare-Boss island port.
 * Same Elf Free meshes; runtime applies purple/void tint (see world-content flarePort/darkElves).
 */
export const DARK_ELF_UNITS: UnitVisualDef[] = [
  {
    id: "dark_elf_raider",
    label: "Dark Elf Raider",
    shopKey: "footman",
    faction: "fabled",
    glb: [`${LOWPO_ROOT}/fabled/elf.glb`, `${LOWPO_ROOT}/fabled/ice_elf.glb`],
    role: "melee",
    weapons: [`${LOWPO_ROOT}/fabled/weapon_sword.glb`],
    source: "flare-port / Elf_Free (dark tint)",
  },
  {
    id: "dark_elf_assassin",
    label: "Dark Elf Assassin",
    shopKey: "archer",
    faction: "fabled",
    glb: [`${LOWPO_ROOT}/fabled/elf.glb`],
    role: "melee",
    weapons: [`${LOWPO_ROOT}/fabled/weapon_sword.glb`],
    source: "flare-port / Elf_Free (dark tint)",
  },
  {
    id: "dark_elf_sorceress",
    label: "Dark Elf Sorceress",
    shopKey: "knight",
    faction: "fabled",
    glb: [
      `${LOWPO_ROOT}/fabled/ice_elf.glb`,
      `${LOWPO_ROOT}/fabled/fire_elf.glb`,
    ],
    role: "ranged",
    weapons: [
      `${LOWPO_ROOT}/fabled/weapon_crystal_spear.glb`,
      `${LOWPO_ROOT}/fabled/weapon_magma_staff.glb`,
    ],
    source: "flare-port / Ice_Elf + Fire_Elf (dark tint)",
  },
  {
    id: "dark_elf_matriarch",
    label: "Thornguard Matriarch",
    shopKey: "knight",
    faction: "fabled",
    glb: [
      `${LOWPO_ROOT}/fabled/fire_elf.glb`,
      `${LOWPO_ROOT}/fabled/ice_elf.glb`,
    ],
    role: "heavy",
    weapons: [`${LOWPO_ROOT}/fabled/weapon_magma_staff.glb`],
    source: "flare-port / Thornguard Matriarch (Flare-Boss)",
  },
];

export const UNIT_PALETTE_URL = `${UNIT_MODEL_ROOT}/Color_Palette.png`;

/** Resolve shop unit mesh list for a faction skin. */
export function unitGlbsForShop(
  key: ShopUnitKey,
  skin: FactionSkin = "crusade",
  side: "ally" | "enemy" = "ally",
): string[] {
  if (skin === "fabled") {
    const u = FABLED_UNITS.find((x) => x.shopKey === key);
    return u?.glb ?? CRUSADE_UNITS.find((x) => x.shopKey === key)?.glb ?? [];
  }
  if (side === "enemy") {
    const u = CRUSADE_ENEMY_UNITS.find((x) => x.shopKey === key);
    return u?.glb ?? CRUSADE_UNITS.find((x) => x.shopKey === key)?.glb ?? [];
  }
  const u = CRUSADE_UNITS.find((x) => x.shopKey === key);
  return u?.glb ?? [];
}

/** Bundle-compat: single default URL per shop unit (crusade ally). */
export function defaultUnitUrl(key: ShopUnitKey): string {
  const paths = unitGlbsForShop(key, "crusade", "ally");
  return paths[0] ?? `${UNIT_MODEL_ROOT}/${key}.glb`;
}

export const DEFAULT_UNIT_URLS = {
  footman: defaultUnitUrl("footman"),
  archer: defaultUnitUrl("archer"),
  knight: defaultUnitUrl("knight"),
  palette: UNIT_PALETTE_URL,
} as const;
