/**
 * GRUDGE 6 integration — three factions (Crusade / Fabled / Legion), eight unit
 * archetypes per faction (2 races × 4 classes), and deterministic GRDG ids from
 * the character viewer handoff.
 */

import {
  FACTIONS,
  FACTION_BY_ID,
  PREFABS,
  PREFAB_BY_ID,
  CLASS_BY_ID,
  CLASS_DEFAULT_WEAPON,
  factionOfRace,
  makeEntitySpec,
  prefabVisual,
  specGrudgeId,
  type ClassId,
  type EntityRaceId,
  type FactionId,
  type PrefabCharacter,
  type PrefabRaceId,
} from "@workspace/game-content";
import type { BuildingLevel, UnitDef } from "../game/config";
import { factionMobMesh } from "./factionMobMeshes";
import { RACE_GEAR_PRESETS, type GearPreset } from "./grudge6MeshCatalog";

export type GrudgeFactionId = FactionId;

export const GRUDGE_FACTIONS = FACTIONS;
export const GRUDGE_FACTION_BY_ID = FACTION_BY_ID;
export const GRUDGE_PREFABS = PREFABS;
export const GRUDGE_PREFAB_BY_ID = PREFAB_BY_ID;

export const COMBAT_CLASSES: ClassId[] = ["warrior", "worge", "mage", "ranger"];

/** Viewer repo race folder → CDN asset path segment. */
export const RACE_REPO_ID: Record<PrefabRaceId, string> = {
  human: "western-kingdoms",
  barbarian: "barbarians",
  dwarf: "dwarves",
  elf: "high-elves",
  orc: "orcs",
  undead: "undead",
};

/** Legacy procedural hero preset used until Bip001 FBX heroes land in-match. */
export const RACE_ANIM_PRESET: Record<PrefabRaceId, string> = {
  human: "human",
  barbarian: "drifter",
  dwarf: "construct",
  elf: "sylvan",
  orc: "orc",
  undead: "ender",
};

const FACTION_ORDER: GrudgeFactionId[] = ["crusade", "fabled", "legion"];

/** Deterministic GRDG id — encodes the canonical prefab loadout when present. */
export function makeGrudgeId(raceId: PrefabRaceId, classId: ClassId, level = 20): string {
  const p = prefabFor(raceId, classId);
  return specGrudgeId(
    makeEntitySpec({
      race: raceId as EntityRaceId,
      class: classId,
      level,
      weapon: p?.weapon ?? CLASS_DEFAULT_WEAPON[classId],
      apiWeapon: p?.apiWeapon,
      offhand: p?.offhand,
      faction: factionOfRace(raceId),
    }),
  );
}

export function unitTypeId(raceId: PrefabRaceId, classId: ClassId): string {
  return `${raceId}_${classId}`;
}

export function prefabFor(raceId: PrefabRaceId, classId: ClassId): PrefabCharacter | undefined {
  return PREFABS.find((p) => p.raceId === raceId && p.classId === classId);
}

export function gearPresetFor(raceId: PrefabRaceId, classId: ClassId): GearPreset | undefined {
  const prefab = prefabFor(raceId, classId);
  if (prefab) {
    const vis = prefabVisual(prefab);
    const fac = FACTION_BY_ID[prefab.faction];
    return {
      id: classId,
      label: prefab.name,
      description: prefab.title,
      color: fac?.color ?? "#ffffff",
      animPack: vis.animPack,
      visibleMeshes: vis.visibleMeshes,
    };
  }
  const repo = RACE_REPO_ID[raceId];
  const presets = RACE_GEAR_PRESETS[repo] ?? [];
  const presetId = CLASS_BY_ID[classId]?.presetId ?? "warrior";
  return (
    presets.find((p) => p.id === presetId) ??
    presets.find((p) => p.id === "warrior") ??
    presets.find((p) => p.id === "unarmed")
  );
}

export function skinTintForPrefab(prefabId: string): string {
  const p = PREFAB_BY_ID[prefabId];
  return p ? prefabVisual(p).skinTint : "#ffffff";
}

export function unarmedPresetFor(raceId: PrefabRaceId): GearPreset | undefined {
  const presets = RACE_GEAR_PRESETS[RACE_REPO_ID[raceId]] ?? [];
  return presets.find((p) => p.id === "unarmed");
}

function unitDefFromPrefab(p: PrefabCharacter, factionColor: string): UnitDef {
  const preset = gearPresetFor(p.raceId, p.classId);
  const ranged = p.classId === "mage" || p.classId === "ranger";
  const mesh = factionMobMesh(p.faction, ranged);
  const hp = Math.round(p.stats.hp * 0.55);
  const dmg = Math.round(p.stats.atk * (ranged ? 0.85 : 1));
  const speed = 4.2 + p.stats.spd / 40;
  return {
    id: unitTypeId(p.raceId, p.classId),
    name: `${p.name.split(" ")[0]} ${CLASS_BY_ID[p.classId]?.name ?? p.classId}`,
    line: ranged ? "ranged" : "melee",
    hp,
    speed,
    damage: dmg,
    attackRange: ranged ? 14 + (p.classId === "mage" ? 2 : 0) : 2.2 + (p.classId === "worge" ? 0.4 : 0),
    attackCooldown: ranged ? 1.1 : p.classId === "worge" ? 0.95 : 0.85,
    aggroRange: ranged ? 16 : 9,
    ranged,
    radius: p.classId === "worge" ? 0.58 : 0.52,
    scale: p.classId === "worge" ? 1.05 : 0.95,
    color: preset?.color ?? factionColor,
    accent: factionColor,
    mesh,
    reward: ranged ? 18 : 14,
    grudge: {
      raceId: p.raceId,
      classId: p.classId,
      prefabId: p.id,
      apiWeapon: p.apiWeapon,
      repoRaceId: RACE_REPO_ID[p.raceId],
      grudgeId: makeGrudgeId(p.raceId, p.classId),
      animPack: preset?.animPack ?? "unarmed",
      visibleMeshes: preset?.visibleMeshes ?? [],
      skinTint: skinTintForPrefab(p.id),
    },
  };
}

/** All 24 GRUDGE6 lane units (6 races × 4 classes). */
export const GRUDGE6_UNIT_TYPES: Record<string, UnitDef> = (() => {
  const out: Record<string, UnitDef> = {};
  for (const p of PREFABS) {
    const fac = FACTION_BY_ID[p.faction];
    out[unitTypeId(p.raceId, p.classId)] = unitDefFromPrefab(p, fac.color);
  }
  return out;
})();

export function resolveUnitDef(typeId: string): UnitDef | undefined {
  return GRUDGE6_UNIT_TYPES[typeId];
}

/** Eight unit type ids for a faction (2 races × warrior/worge/mage/ranger). */
export function factionUnitIds(factionId: GrudgeFactionId): string[] {
  const races = FACTION_BY_ID[factionId].races;
  const ids: string[] = [];
  for (const race of races) {
    for (const cls of COMBAT_CLASSES) ids.push(unitTypeId(race, cls));
  }
  return ids;
}

/** Default lane wave: two melee + one ranged from the faction's primary race. */
export function factionWaveCreeps(factionId: GrudgeFactionId): [string, string, string] {
  const primary = FACTION_BY_ID[factionId].races[0];
  return [
    unitTypeId(primary, "warrior"),
    unitTypeId(primary, "warrior"),
    unitTypeId(primary, "ranger"),
  ];
}

/** Faction-scoped production building creep tables (8 units across tiers). */
export function factionBuildingLevels(factionId: GrudgeFactionId): {
  barracks: BuildingLevel[];
  archery: BuildingLevel[];
} {
  const [r0, r1] = FACTION_BY_ID[factionId].races;
  return {
    barracks: [
      { interval: 18, count: 2, type: unitTypeId(r0, "warrior"), statMult: 1, upgradeCost: 250 },
      { interval: 15, count: 3, type: unitTypeId(r0, "worge"), statMult: 1, upgradeCost: 450 },
      { interval: 12, count: 3, type: unitTypeId(r1, "warrior"), statMult: 1 },
    ],
    archery: [
      { interval: 21, count: 2, type: unitTypeId(r0, "ranger"), statMult: 1, upgradeCost: 280 },
      { interval: 17, count: 3, type: unitTypeId(r1, "ranger"), statMult: 1.15, upgradeCost: 480 },
      { interval: 14, count: 4, type: unitTypeId(r1, "mage"), statMult: 1.25 },
    ],
  };
}

/** Elite push unit — heavy worge from the faction's second race. */
export function factionEliteType(factionId: GrudgeFactionId): string {
  const r1 = FACTION_BY_ID[factionId].races[1];
  return unitTypeId(r1, "worge");
}

/** Rotate to the next faction for a 3-team roster (single-player opponent). */
export function opposingFaction(player: GrudgeFactionId): GrudgeFactionId {
  const i = FACTION_ORDER.indexOf(player);
  return FACTION_ORDER[(i + 1) % FACTION_ORDER.length] ?? "legion";
}

/** Parse viewer URL params (?race=human&class=warrior or ?grudgeId=GRDG-…). */
export function parseGrudgeHandoff(search: string): {
  raceId?: PrefabRaceId;
  classId?: ClassId;
  grudgeId?: string;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const grudgeId = params.get("grudgeId") ?? undefined;
  const race = params.get("race") as PrefabRaceId | null;
  const cls = params.get("class") as ClassId | null;
  const out: { raceId?: PrefabRaceId; classId?: ClassId; grudgeId?: string } = {};
  if (grudgeId) out.grudgeId = grudgeId;
  if (race && RACE_REPO_ID[race]) out.raceId = race;
  if (cls && COMBAT_CLASSES.includes(cls)) out.classId = cls;
  return out;
}

// --- Live match faction config (set at deploy from roster) --------------------

let _playerFaction: GrudgeFactionId = "crusade";
let _enemyFaction: GrudgeFactionId = "legion";

export function configureMatchFactions(player: GrudgeFactionId, enemy?: GrudgeFactionId) {
  _playerFaction = player;
  _enemyFaction = enemy ?? opposingFaction(player);
}

export function playerGrudgeFaction(): GrudgeFactionId {
  return _playerFaction;
}

export function enemyGrudgeFaction(): GrudgeFactionId {
  return _enemyFaction;
}

export function allyWaveCreeps(): [string, string, string] {
  return factionWaveCreeps(_playerFaction);
}

export function enemyWaveCreeps(): [string, string, string] {
  return factionWaveCreeps(_enemyFaction);
}

export function allyBuildingLevels() {
  return factionBuildingLevels(_playerFaction);
}

export function enemyEliteType(): string {
  return factionEliteType(_enemyFaction);
}

/** Playable warlord unit type from lobby race + class. */
export function playerWarlordTypeId(raceId: PrefabRaceId, classId: ClassId): string {
  return unitTypeId(raceId, classId);
}

/** Enemy warlord — heavy worge from the opponent faction's second race. */
export function enemyWarlordTypeId(factionId: GrudgeFactionId = _enemyFaction): string {
  const r1 = FACTION_BY_ID[factionId].races[1];
  return unitTypeId(r1, "worge");
}