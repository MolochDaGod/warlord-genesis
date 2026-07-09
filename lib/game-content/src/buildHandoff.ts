/**
 * Viewer → game launch bridge. Pure transforms shared by the character-viewer
 * (serialize) and grudge-game (hydrate panelStore). No DOM / zustand here.
 */

import { CLASS_BY_ID, type ClassId } from "./classes";
import { CLASS_DEFAULT_WEAPON } from "./classSkillMeta";
import {
  encodeSpawnCode,
  makeEntitySpec,
  specGrudgeId,
  type EntityRaceId,
} from "./entitySpec";
import { masteryTreeForApiWeapon } from "./masteryMap";
import { PREFAB_BY_ID, prefabGrudgeId, type PrefabCharacter } from "./prefabs";
import {
  offhandBagForLoadout,
  prefabLoadout,
  weaponBagForLoadout,
} from "./prefabLoadouts";
import { prefabBakedGlbUrl } from "./prefabBaked";
import type { WeaponType } from "./index";
import { raceKitId } from "./raceKitMap";

/** sessionStorage key — one-shot payload written by the viewer, consumed by /world. */
export const VIEWER_LAUNCH_KEY = "grudge:launch-build:v1";

/** Set by the launcher so /world loads the production tutorial HUD preset. */
export const TUTORIAL_MODE_KEY = "grudge:tutorial-mode";

export type ViewerLaunchMode = "world" | "tutorial";

export { GRUDGE_RACE_TO_KIT } from "./raceKitMap";

/** Viewer tier picks: tier level → chosen skill display names. */
export type ViewerClassPicks = Record<string, Record<number, string[]>>;

/** Z / X / C class skill bar slot ids (null = empty). */
export type ClassBarSlots = [string | null, string | null, string | null];

export interface ViewerLaunchBuild {
  v: 1;
  mode: ViewerLaunchMode;
  kitRace: string;
  classId: ClassId | null;
  harvestMode: boolean;
  grudgeId: string | null;
  activePrefabId: string | null;
  /** panelStore skillStore slice (`classId:tier` → skill ids). */
  skillStore: Record<string, string[]>;
  /** panelStore attrStore entry for the active class. */
  attributePoints: Record<string, number> | null;
  /** STARTER_BAG item id to equip as mainhand (from prefab weapon). */
  weaponBagId: string | null;
  /** Optional offhand bag item (tome for casters). */
  offhandBagId: string | null;
  /** Full class starter loadout — bag ids to equip in order (slot from item). */
  gearBagIds: string[];
  /** Suggested player level for skill unlocks in tutorial testing. */
  level: number;
  /** panelStore worldClassBar slice for the active class. */
  worldClassBar: ClassBarSlots | null;
  /** Compact EntitySpec spawn code (`GRDG1.…`) for API / save hydration. */
  spawnCode: string | null;
  /** panelStore activeMasteryTree for the entity's primary weapon. */
  activeMasteryTree: string | null;
  /** Pre-baked hero GLB url when a roster prefab is active. */
  bakedGlbUrl: string | null;
}

/** Map prefab primary weapon → a bag item the game inventory already seeds. */
export const PREFAB_WEAPON_BAG: Partial<Record<WeaponType, string>> = {
  sword: "bag-wraithfang",
  axe: "bag-gorehowl",
  bow: "bag-shadowflight",
  staff: "bag-emberwrath",
  mace: "bag-gorehowl",
  hammer: "bag-gorehowl",
  spear: "bag-wraithfang",
  dagger: "bag-wraithfang",
  shield: "bag-aegis",
  pick: "bag-gorehowl",
  fishing: "bag-shadowflight",
  other: "bag-wraithfang",
};

const CASTER_OFFHAND: Partial<Record<ClassId, string>> = {
  mage: "bag-arcane-grimoire",
};

/**
 * Per-class bag item ids to equip on viewer → game launch. Each id must exist in
 * grudge-game STARTER_BAG; slot is implied by the item definition.
 */
export const CLASS_STARTER_GEAR: Record<ClassId, readonly string[]> = {
  mage: [
    "bag-emberwrath",
    "bag-arcane-grimoire",
    "bag-shadowweave",
    "bag-archergloves",
    "bag-eagleeye",
    "bag-soullantern",
  ],
  warrior: [
    "bag-wraithfang",
    "bag-aegis",
    "bag-ironpauldron",
    "bag-shadowweave",
    "bag-padded",
    "bag-tracker",
    "bag-hawkring",
  ],
  ranger: [
    "bag-shadowflight",
    "bag-camocloak",
    "bag-scouthood",
    "bag-archergloves",
    "bag-padded",
    "bag-tracker",
    "bag-eagleeye",
  ],
  worge: [
    "bag-gorehowl",
    "bag-ironpauldron",
    "bag-shadowweave",
    "bag-padded",
    "bag-tracker",
    "bag-hawkring",
  ],
};

export function kitRaceForGrudgeRace(raceId: string): string {
  return raceKitId(raceId);
}

/** Convert viewer skill *names* into game-content skill *ids* for panelStore. */
const CLASS_BAR_SLOTS = 3;

/** First N playable class skills for the Z/X/C bar from picks + unlock level. */
export function defaultClassBarForBuild(
  classId: ClassId,
  skillStore: Record<string, string[]>,
  entityLevel: number,
): ClassBarSlots {
  const cls = CLASS_BY_ID[classId];
  const playable: string[] = [];
  for (const tier of cls.tiers) {
    if (entityLevel < tier.level) continue;
    for (const sk of tier.skills) {
      if (!sk.animKey) continue;
      if (tier.auto) {
        playable.push(sk.id);
      } else {
        const key = `${classId}:${tier.level}`;
        const chosen = skillStore[key];
        if (chosen?.includes(sk.id)) playable.push(sk.id);
      }
      if (playable.length >= CLASS_BAR_SLOTS) break;
    }
    if (playable.length >= CLASS_BAR_SLOTS) break;
  }
  return [
    playable[0] ?? null,
    playable[1] ?? null,
    playable[2] ?? null,
  ];
}

export function viewerPicksToSkillStore(
  classId: ClassId,
  picks: Record<number | string, string[]> | undefined,
): Record<string, string[]> {
  const cls = CLASS_BY_ID[classId];
  const out: Record<string, string[]> = {};
  if (!picks) return out;
  for (const tier of cls.tiers) {
    const names = picks[tier.level] ?? picks[String(tier.level)];
    if (!names?.length) continue;
    const ids = names.map((name) => {
      const sk = tier.skills.find((s) => s.label === name);
      return sk?.id ?? name.toLowerCase().replace(/\s+/g, "-");
    });
    out[`${classId}:${tier.level}`] = ids;
  }
  return out;
}

export interface ViewerBuildInput {
  mode: ViewerLaunchMode;
  raceId: string;
  classId: ClassId | null;
  harvestMode: boolean;
  picks: ViewerClassPicks;
  attributePoints: Record<string, number>;
  grudgeId: string | null;
  activePrefabId: string | null;
}

export function buildLaunchPayload(input: ViewerBuildInput): ViewerLaunchBuild {
  const kitRace = kitRaceForGrudgeRace(input.raceId);
  const classId = input.harvestMode ? null : input.classId;
  const prefab = input.activePrefabId ? PREFAB_BY_ID[input.activePrefabId] : undefined;

  let grudgeId = input.grudgeId;
  if (prefab && !grudgeId) grudgeId = prefabGrudgeId(prefab);

  const level = 20;
  const skillStore = classId
    ? viewerPicksToSkillStore(classId, input.picks[classId])
    : {};

  const loadout = prefab ? prefabLoadout(prefab) : null;
  const primaryWeapon =
    loadout?.weapon ?? (classId ? CLASS_DEFAULT_WEAPON[classId] : "sword");
  const apiWeapon = loadout?.apiWeapon ?? null;
  let spawnCode: string | null = null;
  let activeMasteryTree: string | null = null;

  if (classId && input.raceId) {
    const spec = makeEntitySpec({
      race: input.raceId as EntityRaceId,
      class: classId,
      level,
      weapon: primaryWeapon,
      apiWeapon: apiWeapon ?? undefined,
      offhand: loadout?.offhand,
    });
    if (!grudgeId) grudgeId = specGrudgeId(spec);
    spawnCode = encodeSpawnCode(spec);
    activeMasteryTree = masteryTreeForApiWeapon(apiWeapon) ?? null;
  }

  const weaponBagId = loadout
    ? weaponBagForLoadout(loadout)
    : classId === "mage"
    ? "bag-emberwrath"
    : classId === "ranger"
    ? "bag-shadowflight"
    : classId === "worge"
    ? "bag-gorehowl"
    : "bag-wraithfang";

  const offhandBagId = loadout
    ? offhandBagForLoadout(loadout)
    : classId
    ? (CASTER_OFFHAND[classId] ?? null)
    : null;

  const gearBagIds = classId ? [...CLASS_STARTER_GEAR[classId]] : [];
  if (weaponBagId && !gearBagIds.includes(weaponBagId)) {
    gearBagIds.unshift(weaponBagId);
  }
  if (offhandBagId && !gearBagIds.includes(offhandBagId)) {
    gearBagIds.push(offhandBagId);
  }

  return {
    v: 1,
    mode: input.mode,
    kitRace,
    classId,
    harvestMode: input.harvestMode,
    grudgeId,
    activePrefabId: input.activePrefabId,
    skillStore,
    attributePoints: classId ? input.attributePoints : null,
    weaponBagId,
    offhandBagId,
    gearBagIds,
    level,
    worldClassBar: classId
      ? defaultClassBarForBuild(classId, skillStore, level)
      : null,
    spawnCode,
    activeMasteryTree,
    bakedGlbUrl: prefab ? prefabBakedGlbUrl(prefab.id) : null,
  };
}

export function weaponBagForPrefab(p: PrefabCharacter): string {
  return weaponBagForLoadout(prefabLoadout(p));
}

/** Read one-shot viewer → warlords launch payload from sessionStorage. */
export function consumeViewerLaunchBuild(): ViewerLaunchBuild | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(VIEWER_LAUNCH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(VIEWER_LAUNCH_KEY);
    const parsed = JSON.parse(raw) as ViewerLaunchBuild;
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}