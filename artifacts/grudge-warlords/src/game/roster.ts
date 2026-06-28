import { create } from "zustand";
import type { CharacterLook, WeaponClass } from "./anim/types";
import { DEFAULT_HERO_ID, getPreset, HERO_PRESETS } from "./anim/presets";
import type { Equipment, LoadoutItem, SlotId } from "./equipment";
import {
  DEFAULT_MELEE_ID,
  DEFAULT_RANGED_ID,
  MELEE_WEAPONS_CFG,
  RANGED_WEAPONS,
  type MeleeWeaponId,
  type RangedWeaponId,
} from "./config";

/** A partial override layered on top of the selected race's default look. */
export type LookPatch = Partial<CharacterLook>;

const PERSIST_KEY = "gw_roster_v1";

interface PersistShape {
  heroId: string;
  custom: LookPatch;
  equipment: Equipment;
  gearTier: number;
  meleeId: MeleeWeaponId;
  rangedId: RangedWeaponId;
}

function loadPersisted(): Partial<PersistShape> {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistShape>;
  } catch {
    return {};
  }
}

function savePersisted(s: PersistShape) {
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(s));
  } catch {
    // non-fatal
  }
}

/**
 * Which hero the player has selected, their gear loadout, a global gear tier
 * (1-8 quality used to scale equipped-item stats), and any custom-skin overrides
 * applied to the in-match procedural hero. Persisted to localStorage so the
 * selection and loadout survive a reload. The Player rebuilds its Animator when
 * `heroId`, the headgear silhouette, or the equipped weapon changes.
 */
interface RosterState {
  heroId: string;
  custom: LookPatch;
  equipment: Equipment;
  gearTier: number;
  /** Chosen melee weapon archetype (one of two carried weapons; Q swaps). */
  meleeId: MeleeWeaponId;
  /** Chosen ranged weapon archetype (one of two carried weapons; Q swaps). */
  rangedId: RangedWeaponId;
  setHero: (id: string) => void;
  setCustom: (patch: LookPatch) => void;
  resetCustom: () => void;
  equip: (slot: SlotId, item: LoadoutItem) => void;
  unequip: (slot: SlotId) => void;
  setGearTier: (tier: number) => void;
  setMelee: (id: MeleeWeaponId) => void;
  setRanged: (id: RangedWeaponId) => void;
}

const persisted = loadPersisted();
const validHero =
  persisted.heroId && HERO_PRESETS.some((p) => p.id === persisted.heroId)
    ? persisted.heroId
    : DEFAULT_HERO_ID;
const validMelee =
  persisted.meleeId && MELEE_WEAPONS_CFG[persisted.meleeId] ? persisted.meleeId : DEFAULT_MELEE_ID;
const validRanged =
  persisted.rangedId && RANGED_WEAPONS[persisted.rangedId]
    ? persisted.rangedId
    : DEFAULT_RANGED_ID;

export const useRoster = create<RosterState>((set) => ({
  heroId: validHero,
  custom: persisted.custom ?? {},
  equipment: persisted.equipment ?? {},
  gearTier: persisted.gearTier ?? 1,
  meleeId: validMelee,
  rangedId: validRanged,
  // Switching race clears overrides so the new race shows its own defaults.
  setHero: (id) => set({ heroId: id, custom: {} }),
  setCustom: (patch) => set((s) => ({ custom: { ...s.custom, ...patch } })),
  resetCustom: () => set({ custom: {} }),
  equip: (slot, item) => set((s) => ({ equipment: { ...s.equipment, [slot]: item } })),
  unequip: (slot) =>
    set((s) => {
      const next = { ...s.equipment };
      delete next[slot];
      return { equipment: next };
    }),
  setGearTier: (tier) => set({ gearTier: Math.max(1, Math.min(8, Math.round(tier))) }),
  setMelee: (id) => set({ meleeId: id }),
  setRanged: (id) => set({ rangedId: id }),
}));

// Persist the selection + loadout on every change.
useRoster.subscribe((s) =>
  savePersisted({
    heroId: s.heroId,
    custom: s.custom,
    equipment: s.equipment,
    gearTier: s.gearTier,
    meleeId: s.meleeId,
    rangedId: s.rangedId,
  }),
);

/** The race's default look merged with any custom-skinning overrides. */
export function effectiveLook(heroId: string, custom: LookPatch): CharacterLook {
  return { ...getPreset(heroId).look, ...custom };
}

/** The weapon class the hero fights with: equipped main-hand overrides the preset. */
export function effectiveWeaponClass(heroId: string, equipment: Equipment): WeaponClass {
  return equipment.weapon?.weaponClass ?? getPreset(heroId).weapon;
}
