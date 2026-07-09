// ── Prefab Warlords ───────────────────────────────────────────────────────────
//
// The 24 pre-authored GRUDGE heroes — one per (race × class) across the six races
// and four classes. This is the single source of truth shared by the viewer's
// roster front door and the playable game. Each prefab pins a race, class,
// faction, star rating, base stats, canonical API weapon loadout (drives the live
// weapon skill tree) and lore. Usable skills + animations are DERIVED from the
// class tree and the equipped weapon's API tree so a prefab can never drift.

import type { ClassId, ClassSkillDef } from "./classes";
import { CLASS_BY_ID } from "./classes";
import type { ApiWeaponId } from "./apiWeaponMatrix";
import { API_WEAPON_TREE_BY_ID } from "./apiWeaponMatrix";
import type { WeaponType } from "./index";
import type { WeaponSkillNode } from "./weaponSkills";
import { WEAPON_ATTACK_ANIM } from "./animations";
import { grudgeId } from "./ids";
import {
  PREFAB_LOADOUT_BY_ID,
  prefabLoadout,
  type MageSchool,
  type TomeSchool,
} from "./prefabLoadouts";

/** The six playable races (mirrors the viewer's GrudgeRaceId). */
export type PrefabRaceId =
  | "human"
  | "barbarian"
  | "dwarf"
  | "elf"
  | "orc"
  | "undead";

/** The three warring factions the races are grouped under. */
export type FactionId = "crusade" | "fabled" | "legion";

export interface FactionDef {
  id: FactionId;
  name: string;
  motto: string;
  /** Accent color used by the roster UI / card borders. */
  color: string;
  races: PrefabRaceId[];
}

export const FACTIONS: FactionDef[] = [
  { id: "crusade", name: "The Crusade", motto: "By light and steel.", color: "#3b82f6", races: ["human", "barbarian"] },
  { id: "fabled", name: "The Fabled", motto: "Old blood, deep roots.", color: "#22c55e", races: ["dwarf", "elf"] },
  { id: "legion", name: "The Legion", motto: "From death, dominion.", color: "#ef4444", races: ["orc", "undead"] },
];

export const FACTION_BY_ID: Record<FactionId, FactionDef> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
) as Record<FactionId, FactionDef>;

export interface PrefabStats {
  /** Health pool. */
  hp: number;
  /** Attack power. */
  atk: number;
  /** Armor / mitigation. */
  def: number;
  /** Movement / action speed. */
  spd: number;
}

export interface PrefabCharacter {
  /** Stable slug id (never changes once minted). */
  id: string;
  name: string;
  title: string;
  raceId: PrefabRaceId;
  classId: ClassId;
  faction: FactionId;
  /** Rarity, 1–5. */
  stars: number;
  /** Legacy weapon family — mirrors canonical loadout `weapon` field. */
  weapon: WeaponType;
  /** Live API weapon id — selects the weapon skill hotbar tree. */
  apiWeapon: ApiWeaponId;
  /** Off-hand modifier (shield or tome) when applicable. */
  offhand?: ApiWeaponId;
  /** Worge tome school (off-hand coupling). */
  tomeSchool?: TomeSchool;
  /** Mage staff / wand school (VFX + skill flavor). */
  mageSchool?: MageSchool;
  /** Two-handed grip on main-hand (great weapons, 2H mace, etc.). */
  twoHanded?: boolean;
  stats: PrefabStats;
  lore: string;
}

type PrefabSeed = Omit<PrefabCharacter, "weapon" | "apiWeapon" | "offhand" | "tomeSchool" | "mageSchool" | "twoHanded">;

function withLoadout(seed: PrefabSeed): PrefabCharacter {
  const lo = PREFAB_LOADOUT_BY_ID[seed.id];
  if (!lo) throw new Error(`missing loadout for prefab "${seed.id}"`);
  return {
    ...seed,
    weapon: lo.weapon,
    apiWeapon: lo.apiWeapon,
    offhand: lo.offhand,
    tomeSchool: lo.tomeSchool,
    mageSchool: lo.mageSchool,
    twoHanded: lo.twoHanded,
  };
}

// ── Roster (6 races × 4 classes) ──────────────────────────────────────────────
// Canonical weapon spread: warriors (6 melee styles), mages (6 schools), worge
// (6 tome schools + 6 MH weapons), rangers (bow / gun / crossbow rotation).
export const PREFABS: PrefabCharacter[] = [
  // ── Crusade · Human ─────────────────────────────────────────────────────────
  withLoadout({ id: "sir-aldric-valorheart", name: "Sir Aldric Valorheart", title: "The Iron Bastion", raceId: "human", classId: "warrior", faction: "crusade", stars: 1, stats: { hp: 245, atk: 33, def: 19, spd: 57 }, lore: "A sworn knight of the Crusade who has never broken a shield wall. Where Aldric plants his banner, the line holds." }),
  withLoadout({ id: "gareth-moonshadow", name: "Gareth Moonshadow", title: "The Twilight Stalker", raceId: "human", classId: "worge", faction: "crusade", stars: 3, stats: { hp: 235, atk: 28, def: 13, spd: 67 }, lore: "Cursed at birth to walk between man and beast, Gareth hunts the Crusade's enemies under the half-moon and is gone by dawn." }),
  withLoadout({ id: "archmage-elara-brightspire", name: "Archmage Elara Brightspire", title: "The Storm Caller", raceId: "human", classId: "mage", faction: "crusade", stars: 4, stats: { hp: 175, atk: 21, def: 19, spd: 41 }, lore: "First of the Brightspire conclave. She bottles tempests and looses them upon the field, healing her faithful in the same breath." }),
  withLoadout({ id: "kael-shadowblade", name: "Kael Shadowblade", title: "The Silent Arrow", raceId: "human", classId: "ranger", faction: "crusade", stars: 3, stats: { hp: 185, atk: 23, def: 17, spd: 58 }, lore: "A ranger-scout who speaks once and shoots twice. His arrows find the gap in any armor before the warhorn even sounds." }),

  // ── Crusade · Barbarian ─────────────────────────────────────────────────────
  withLoadout({ id: "ulfgar-bonecrusher", name: "Ulfgar Bonecrusher", title: "The Mountain Breaker", raceId: "barbarian", classId: "warrior", faction: "crusade", stars: 5, stats: { hp: 285, atk: 25, def: 14, spd: 68 }, lore: "They say Ulfgar once felled a siege tower with three swings. His warhammer is named Grief, and it has earned the name." }),
  withLoadout({ id: "hrothgar-fangborn", name: "Hrothgar Fangborn", title: "The Beast of the Wilds", raceId: "barbarian", classId: "worge", faction: "crusade", stars: 3, stats: { hp: 245, atk: 28, def: 17, spd: 56 }, lore: "Raised by the wolves that should have eaten him. Hrothgar fights with tooth and axe alike, and answers to no chieftain." }),
  withLoadout({ id: "volka-stormborn", name: "Volka Stormborn", title: "The Frost Witch", raceId: "barbarian", classId: "mage", faction: "crusade", stars: 4, stats: { hp: 165, atk: 23, def: 21, spd: 63 }, lore: "Born in a blizzard that buried her clan, Volka carries the cold inside her. Foes freeze where they stand and shatter where they fall." }),
  withLoadout({ id: "syala-windrider", name: "Syala Windrider", title: "The Silent Huntress", raceId: "barbarian", classId: "ranger", faction: "crusade", stars: 3, stats: { hp: 195, atk: 24, def: 18, spd: 73 }, lore: "Fastest bow north of the spine ridge. Syala runs down cavalry on foot and is already nocking the next arrow when the first lands." }),

  // ── Fabled · Dwarf ──────────────────────────────────────────────────────────
  withLoadout({ id: "thane-ironshield", name: "Thane Ironshield", title: "The Mountain Guardian", raceId: "dwarf", classId: "warrior", faction: "fabled", stars: 3, stats: { hp: 260, atk: 24, def: 13, spd: 47 }, lore: "Last thane of a sealed hold. Ironshield guards the deep roads with a hammer in one hand and a grudge in the other." }),
  withLoadout({ id: "bromm-earthshaker", name: "Bromm Earthshaker", title: "The Stone Beast", raceId: "dwarf", classId: "worge", faction: "fabled", stars: 5, stats: { hp: 250, atk: 26, def: 15, spd: 57 }, lore: "A dwarf who took the primal pact and never quite changed back. The mountain answers when Bromm roars." }),
  withLoadout({ id: "runa-forgekeeper", name: "Runa Forgekeeper", title: "The Flame Smith", raceId: "dwarf", classId: "mage", faction: "fabled", stars: 3, stats: { hp: 190, atk: 24, def: 22, spd: 63 }, lore: "Keeper of the ancestral forge-fire. Runa shapes living flame the way her kin shape steel — patiently, then all at once." }),
  withLoadout({ id: "durin-tunnelwatcher", name: "Durin Tunnelwatcher", title: "The Deep Shot", raceId: "dwarf", classId: "ranger", faction: "fabled", stars: 2, stats: { hp: 200, atk: 22, def: 15, spd: 52 }, lore: "Sentinel of the under-dark crossings. Durin can put a bolt through a cave-spider's eye in pitch black by sound alone." }),

  // ── Fabled · Elf ────────────────────────────────────────────────────────────
  withLoadout({ id: "thalion-bladedancer", name: "Thalion Bladedancer", title: "The Graceful Death", raceId: "elf", classId: "warrior", faction: "fabled", stars: 3, stats: { hp: 190, atk: 21, def: 17, spd: 60 }, lore: "A duelist of the high courts who turned war into choreography. Every parry of Thalion's ends a life — usually two." }),
  withLoadout({ id: "sylara-wildheart", name: "Sylara Wildheart", title: "The Forest Spirit", raceId: "elf", classId: "worge", faction: "fabled", stars: 4, stats: { hp: 220, atk: 21, def: 18, spd: 70 }, lore: "Bonded to the wood itself. Sylara wears the shape of stag, wolf, and thorn, and the forest fights beside her." }),
  withLoadout({ id: "lyra-stormweaver", name: "Lyra Stormweaver", title: "The Tempest", raceId: "elf", classId: "mage", faction: "fabled", stars: 4, stats: { hp: 160, atk: 25, def: 24, spd: 65 }, lore: "She learned magic by listening to thunder. Lyra weaves lightning through ranks of armor like thread through cloth." }),
  withLoadout({ id: "aelindra-swiftbow", name: "Aelindra Swiftbow", title: "The Wind Archer", raceId: "elf", classId: "ranger", faction: "fabled", stars: 2, stats: { hp: 170, atk: 23, def: 18, spd: 78 }, lore: "The wind carries her arrows and hides her steps. Aelindra has emptied a quiver before her targets knew the battle had begun." }),

  // ── Legion · Orc ────────────────────────────────────────────────────────────
  withLoadout({ id: "grommash-ironjaw", name: "Grommash Ironjaw", title: "The Warlord", raceId: "orc", classId: "warrior", faction: "legion", stars: 1, stats: { hp: 250, atk: 31, def: 12, spd: 57 }, lore: "Warchief by right of every skull on his belt. Grommash leads the Legion's vanguard and expects to die last." }),
  withLoadout({ id: "fenris-bloodfang", name: "Fenris Bloodfang", title: "The Alpha", raceId: "orc", classId: "worge", faction: "legion", stars: 4, stats: { hp: 240, atk: 30, def: 14, spd: 62 }, lore: "The largest worg the Legion has ever fielded. Fenris does not command the pack — he is the pack." }),
  withLoadout({ id: "zuejin-the-hexmaster", name: "Zuejin the Hexmaster", title: "The Blood Shaman", raceId: "orc", classId: "mage", faction: "legion", stars: 3, stats: { hp: 180, atk: 26, def: 20, spd: 43 }, lore: "He spends his own blood for power and his enemies' for sport. Zuejin's hexes rot armor and resolve alike." }),
  withLoadout({ id: "razak-deadeye", name: "Razak Deadeye", title: "The Trophy Hunter", raceId: "orc", classId: "ranger", faction: "legion", stars: 3, stats: { hp: 190, atk: 26, def: 13, spd: 67 }, lore: "Razak counts kills in trophies, not numbers. He picks the proudest target on the field and takes their head first." }),

  // ── Legion · Undead ─────────────────────────────────────────────────────────
  withLoadout({ id: "lord-malachar", name: "Lord Malachar", title: "The Deathless Knight", raceId: "undead", classId: "warrior", faction: "legion", stars: 5, stats: { hp: 230, atk: 23, def: 13, spd: 52 }, lore: "Slain at his own coronation and risen the same night. Malachar has fought every war since and intends to fight every war to come." }),
  withLoadout({ id: "the-ghoulfather", name: "The Ghoulfather", title: "The Abomination", raceId: "undead", classId: "worge", faction: "legion", stars: 3, stats: { hp: 235, atk: 30, def: 14, spd: 63 }, lore: "A stitched horror of a dozen beasts and twice as many men. What the Ghoulfather cannot kill, it adds to itself." }),
  withLoadout({ id: "necromancer-vexis", name: "Necromancer Vexis", title: "The Soul Harvester", raceId: "undead", classId: "mage", faction: "legion", stars: 4, stats: { hp: 195, atk: 31, def: 23, spd: 51 }, lore: "Every soul Vexis reaps becomes a soldier. She has lost battles and won the war that followed with the dead of both sides." }),
  withLoadout({ id: "shade-whisper", name: "Shade Whisper", title: "The Phantom Archer", raceId: "undead", classId: "ranger", faction: "legion", stars: 2, stats: { hp: 175, atk: 23, def: 14, spd: 60 }, lore: "Half-here and half-gone. Shade's arrows pass through shields as if they were mist, because so does Shade." }),
];

export const PREFAB_BY_ID: Record<string, PrefabCharacter> = Object.fromEntries(
  PREFABS.map((p) => [p.id, p]),
);

// ── Derivations ───────────────────────────────────────────────────────────────

/** The faction a race belongs to. */
export function factionOfRace(raceId: PrefabRaceId): FactionId {
  return FACTIONS.find((f) => f.races.includes(raceId))?.id ?? "crusade";
}

/** Prefabs grouped in faction → roster order. */
export function prefabsByFaction(): Array<{ faction: FactionDef; prefabs: PrefabCharacter[] }> {
  return FACTIONS.map((faction) => ({
    faction,
    prefabs: PREFABS.filter((p) => p.faction === faction.id),
  }));
}

/** Flat list of every class-tree skill this prefab can learn. */
export function prefabClassSkills(p: PrefabCharacter): ClassSkillDef[] {
  return CLASS_BY_ID[p.classId].tiers.flatMap((t) => t.skills);
}

/** The equipped weapon's skill nodes from the live API matrix. */
export function prefabWeaponSkills(p: PrefabCharacter): WeaponSkillNode[] {
  return API_WEAPON_TREE_BY_ID[p.apiWeapon]?.nodes ?? [];
}

/** Default light-attack anim for a prefab's API weapon. */
export function prefabAttackAnimKey(p: PrefabCharacter): string {
  const api = p.apiWeapon;
  if (api === "GUN") return "rifle_fire";
  if (api === "WAND") return "magic_cast";
  if (api === "CROSSBOW") return "bow_shot";
  if (api === "SCYTHE") return "venom_attack_a";
  return WEAPON_ATTACK_ANIM[p.weapon] ?? "sword_attack_a";
}

/**
 * Every animation key this prefab needs, de-duplicated: base locomotion + the
 * weapon's light attack + all class-skill and weapon-skill bound clips.
 */
export function prefabAnimationKeys(p: PrefabCharacter): string[] {
  const keys = [
    "idle",
    "run",
    "jump",
    "dodge",
    prefabAttackAnimKey(p),
    ...prefabClassSkills(p).map((s) => s.animKey),
    ...prefabWeaponSkills(p).map((n) => n.animKey),
  ].filter((k): k is string => Boolean(k));
  return Array.from(new Set(keys));
}

/** Deterministic GRUDGE code for a prefab (stable across viewer and game). */
export function prefabGrudgeId(p: PrefabCharacter): string {
  return grudgeId(`prefab:${p.id}`);
}

// ── Content invariants ────────────────────────────────────────────────────────
const ALL_RACES: PrefabRaceId[] = ["human", "barbarian", "dwarf", "elf", "orc", "undead"];
const ALL_CLASSES: ClassId[] = ["mage", "warrior", "ranger", "worge"];

(function assertRosterIntegrity() {
  const errs: string[] = [];

  const expected = ALL_RACES.length * ALL_CLASSES.length;
  if (PREFABS.length !== expected) {
    errs.push(`expected ${expected} prefabs (${ALL_RACES.length} races × ${ALL_CLASSES.length} classes), found ${PREFABS.length}`);
  }

  const ids = new Set<string>();
  for (const p of PREFABS) {
    if (ids.has(p.id)) errs.push(`duplicate prefab id "${p.id}"`);
    ids.add(p.id);
    const faction = FACTIONS.find((f) => f.id === p.faction);
    if (!faction) errs.push(`prefab "${p.id}" has unknown faction "${p.faction}"`);
    else if (!faction.races.includes(p.raceId)) {
      errs.push(`prefab "${p.id}" race "${p.raceId}" does not belong to faction "${p.faction}"`);
    }
    const lo = prefabLoadout(p);
    if (lo.weapon !== p.weapon) {
      errs.push(`prefab "${p.id}" weapon "${p.weapon}" drifts from loadout "${lo.weapon}"`);
    }
    if (lo.apiWeapon !== p.apiWeapon) {
      errs.push(`prefab "${p.id}" apiWeapon "${p.apiWeapon}" drifts from loadout`);
    }
    const tree = API_WEAPON_TREE_BY_ID[p.apiWeapon];
    if (!tree) errs.push(`prefab "${p.id}" apiWeapon "${p.apiWeapon}" has no API tree`);
    else if (p.apiWeapon !== "SHIELD" && tree.nodes.length === 0) {
      errs.push(`prefab "${p.id}" apiWeapon "${p.apiWeapon}" has empty skill tree`);
    }
  }

  for (const race of ALL_RACES) {
    for (const cls of ALL_CLASSES) {
      const n = PREFABS.filter((p) => p.raceId === race && p.classId === cls).length;
      if (n !== 1) errs.push(`expected exactly 1 prefab for ${race}/${cls}, found ${n}`);
    }
  }

  if (errs.length) {
    throw new Error("Prefab roster integrity failed:\n  - " + errs.join("\n  - "));
  }
})();