/** Canonical game types — mirrors bundle stores BI / XI / Z (lane MOBA). */

export type GamePhase = "menu" | "battle" | "victory" | "defeat";

export type CommandMode = "command" | "combat";

export type LaneId = 0 | 1 | 2;

export type LanePick = {
  meleeCreep: string;
  rangedCreep: string;
};

export type LaneDeployment = {
  lanes: Record<LaneId, LanePick>;
};

export type GrudgeRaceId =
  | "western-kingdoms"
  | "barbarians"
  | "dwarves"
  | "high-elves"
  | "orcs"
  | "undead";

export type WeaponType =
  | "sword"
  | "bow"
  | "ranged"
  | "pistol"
  | "magic"
  | "greatsword"
  | "greataxe"
  | "hammer"
  | "axe"
  | "spear"
  | "mace"
  | "knife";

export type AnimPack =
  | "sword_shield"
  | "longbow"
  | "rifle"
  | "pistol"
  | "magic"
  | "unarmed";

export type Grudge6Visual = {
  animPack: AnimPack;
  skinTint: string;
  visibleMeshes: string[];
};

export type HeroLoadout = {
  prefabId: string;
  raceId: GrudgeRaceId;
  classId: string;
  factionId: string;
  meleeId: WeaponType;
  rangedId: WeaponType;
};