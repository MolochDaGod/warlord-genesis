import { create } from "zustand";
import type { ClassId, PrefabRaceId } from "@workspace/game-content";
import type { CharacterLook, WeaponClass } from "./anim/types";
import { getPreset } from "./anim/presets";
import type { Equipment, LoadoutItem, SlotId } from "./equipment";
import {
  MELEE_WEAPONS_CFG,
  RANGED_WEAPONS,
  type MeleeWeaponId,
  type RangedWeaponId,
} from "./config";
import {
  GRUDGE_FACTION_BY_ID,
  GRUDGE_PREFAB_BY_ID,
  RACE_ANIM_PRESET,
  makeGrudgeId,
  prefabFor,
  opposingFaction,
  parseGrudgeHandoff,
  type GrudgeFactionId,
} from "../engine/grudge6";
import {
  defaultLaneHeroPicks,
  factionMeleeIds,
  factionRangedIds,
} from "./laneDeployment";
import { canonicalWeaponsForPrefab } from "./canonicalLoadout";
import { useMeta } from "./metaProgression";
import { consumeViewerLaunchBuild, GRUDGE_RACE_TO_KIT } from "@workspace/game-content";

/** A partial override layered on top of the selected race's default look. */
export type LookPatch = Partial<CharacterLook>;

const PERSIST_KEY = "gw_roster_v2";

interface PersistShape {
  factionId: GrudgeFactionId;
  enemyFactionId: GrudgeFactionId;
  raceId: PrefabRaceId;
  classId: ClassId;
  prefabId: string;
  grudgeId: string;
  heroId: string;
  custom: LookPatch;
  equipment: Equipment;
  gearTier: number;
  meleeId: MeleeWeaponId;
  rangedId: RangedWeaponId;
  /** GRUDGE6 lane-guard hero type ids (melee + ranged) chosen before march. */
  laneMeleeHeroId: string;
  laneRangedHeroId: string;
  loadoutLocked: boolean;
}

function loadPersisted(): Partial<PersistShape> {
  try {
    const raw = localStorage.getItem(PERSIST_KEY) ?? localStorage.getItem("gw_roster_v1");
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

const DEFAULT_FACTION: GrudgeFactionId = "crusade";
const DEFAULT_RACE: PrefabRaceId = "human";
const DEFAULT_CLASS: ClassId = "warrior";
const DEFAULT_PREFAB = "sir-aldric-valorheart";
const META_PERSIST_KEY = "gw_meta_v1";

function readMetaBoot(): { onboardingDone: boolean; starterPrefabId: string | null } {
  try {
    const raw = localStorage.getItem(META_PERSIST_KEY);
    if (!raw) return { onboardingDone: false, starterPrefabId: null };
    const m = JSON.parse(raw) as { onboardingDone?: boolean; starterPrefabId?: string | null };
    return {
      onboardingDone: Boolean(m.onboardingDone),
      starterPrefabId: m.starterPrefabId ?? null,
    };
  } catch {
    return { onboardingDone: false, starterPrefabId: null };
  }
}

function resolveSelection(
  partial: Partial<PersistShape>,
): Pick<PersistShape, "factionId" | "enemyFactionId" | "raceId" | "classId" | "prefabId" | "grudgeId" | "heroId"> {
  const metaBoot = readMetaBoot();
  const classId = partial.classId ?? DEFAULT_CLASS;

  let prefab =
    (partial.prefabId && GRUDGE_PREFAB_BY_ID[partial.prefabId]
      ? GRUDGE_PREFAB_BY_ID[partial.prefabId]
      : null) ??
    (metaBoot.starterPrefabId && GRUDGE_PREFAB_BY_ID[metaBoot.starterPrefabId]
      ? GRUDGE_PREFAB_BY_ID[metaBoot.starterPrefabId]
      : null);

  if (!prefab) {
    const raceId =
      partial.raceId && prefabFor(partial.raceId, classId) ? partial.raceId : DEFAULT_RACE;
    prefab = prefabFor(raceId, classId) ?? GRUDGE_PREFAB_BY_ID[DEFAULT_PREFAB]!;
  }
  return {
    factionId: prefab.faction as GrudgeFactionId,
    enemyFactionId:
      partial.enemyFactionId && partial.enemyFactionId !== prefab.faction
        ? partial.enemyFactionId
        : opposingFaction(prefab.faction as GrudgeFactionId),
    raceId: prefab.raceId,
    classId: prefab.classId,
    prefabId: prefab.id,
    grudgeId: partial.grudgeId ?? makeGrudgeId(prefab.raceId, prefab.classId),
    heroId: RACE_ANIM_PRESET[prefab.raceId],
  };
}

/**
 * Player roster: GRUDGE 6 faction + race + class, deterministic GRDG id, and
 * carried melee/ranged weapons chosen in the lobby before each round. The hero
 * deploys unarmed in the warcamp UI and enters battle with the locked loadout.
 */
interface RosterState {
  factionId: GrudgeFactionId;
  enemyFactionId: GrudgeFactionId;
  raceId: PrefabRaceId;
  classId: ClassId;
  prefabId: string;
  grudgeId: string;
  heroId: string;
  custom: LookPatch;
  equipment: Equipment;
  gearTier: number;
  meleeId: MeleeWeaponId;
  rangedId: RangedWeaponId;
  /** GRUDGE6 heroes that march lanes as NPC guards (1 melee + 1 ranged). */
  laneMeleeHeroId: string;
  laneRangedHeroId: string;
  /** True once the player confirms melee + ranged before marching. */
  loadoutLocked: boolean;
  setFaction: (id: GrudgeFactionId) => void;
  setEnemyFaction: (id: GrudgeFactionId) => void;
  setRace: (id: PrefabRaceId) => void;
  setClass: (id: ClassId) => void;
  /** Select a canonical prefab from the GRUDGE6 roster (viewer characters). */
  setPrefab: (prefabId: string) => void;
  setGrudgeHandoff: (search: string) => void;
  setHero: (id: string) => void;
  setCustom: (patch: LookPatch) => void;
  resetCustom: () => void;
  equip: (slot: SlotId, item: LoadoutItem) => void;
  unequip: (slot: SlotId) => void;
  setGearTier: (tier: number) => void;
  setMelee: (id: MeleeWeaponId) => void;
  setRanged: (id: RangedWeaponId) => void;
  setLaneMeleeHero: (typeId: string) => void;
  setLaneRangedHero: (typeId: string) => void;
  lockLoadout: () => void;
}

/** Canonical melee/ranged for a prefab; persisted values only apply when they match. */
function weaponKitForPrefab(
  prefabId: string,
  partial?: Partial<Pick<PersistShape, "meleeId" | "rangedId">>,
): Pick<PersistShape, "meleeId" | "rangedId"> {
  const canonical = canonicalWeaponsForPrefab(prefabId);
  const melee =
    partial?.meleeId &&
    partial.meleeId === canonical.melee &&
    MELEE_WEAPONS_CFG[partial.meleeId]
      ? partial.meleeId
      : canonical.melee;
  const ranged =
    partial?.rangedId &&
    partial.rangedId === canonical.ranged &&
    RANGED_WEAPONS[partial.rangedId]
      ? partial.rangedId
      : canonical.ranged;
  return { meleeId: melee, rangedId: ranged };
}

const persisted = loadPersisted();
const selection = resolveSelection(persisted);
const bootWeapons = weaponKitForPrefab(selection.prefabId, persisted);
const defaultHeroes = defaultLaneHeroPicks(selection.factionId);
const factionMelee = factionMeleeIds(selection.factionId);
const factionRanged = factionRangedIds(selection.factionId);
const validLaneMelee =
  persisted.laneMeleeHeroId && factionMelee.includes(persisted.laneMeleeHeroId)
    ? persisted.laneMeleeHeroId
    : defaultHeroes.meleeGuard;
const validLaneRanged =
  persisted.laneRangedHeroId && factionRanged.includes(persisted.laneRangedHeroId)
    ? persisted.laneRangedHeroId
    : defaultHeroes.rangedGuard;

export const useRoster = create<RosterState>((set, get) => ({
  ...selection,
  custom: persisted.custom ?? {},
  equipment: persisted.equipment ?? {},
  gearTier: persisted.gearTier ?? 1,
  meleeId: bootWeapons.meleeId,
  rangedId: bootWeapons.rangedId,
  laneMeleeHeroId: validLaneMelee,
  laneRangedHeroId: validLaneRanged,
  loadoutLocked: persisted.loadoutLocked ?? false,

  setFaction: (factionId) => {
    const classId = get().classId;
    const races = GRUDGE_FACTION_BY_ID[factionId].races;
    const current = prefabFor(get().raceId, classId);
    const raceId = current?.faction === factionId ? get().raceId : races[0];
    const p = prefabFor(raceId, classId)!;
    const heroes = defaultLaneHeroPicks(factionId);
    const kit = canonicalWeaponsForPrefab(p.id);
    const tier = useMeta.getState().maxGearTierForPrefab(p.id);
    set({
      factionId,
      enemyFactionId: opposingFaction(factionId),
      raceId: p.raceId,
      classId: p.classId,
      prefabId: p.id,
      grudgeId: makeGrudgeId(p.raceId, p.classId),
      heroId: RACE_ANIM_PRESET[p.raceId],
      meleeId: kit.melee,
      rangedId: kit.ranged,
      gearTier: tier,
      laneMeleeHeroId: heroes.meleeGuard,
      laneRangedHeroId: heroes.rangedGuard,
      custom: {},
      loadoutLocked: false,
    });
  },

  setEnemyFaction: (enemyFactionId) => {
    if (enemyFactionId === get().factionId) return;
    set({ enemyFactionId });
  },

  setRace: (raceId) => {
    const p = prefabFor(raceId, get().classId);
    if (!p || p.faction !== get().factionId) return;
    const kit = canonicalWeaponsForPrefab(p.id);
    const tier = useMeta.getState().maxGearTierForPrefab(p.id);
    set({
      raceId,
      prefabId: p.id,
      grudgeId: makeGrudgeId(p.raceId, p.classId),
      heroId: RACE_ANIM_PRESET[p.raceId],
      meleeId: kit.melee,
      rangedId: kit.ranged,
      gearTier: tier,
      custom: {},
      loadoutLocked: false,
    });
  },

  setClass: (classId) => {
    const p = prefabFor(get().raceId, classId);
    if (!p) return;
    const kit = canonicalWeaponsForPrefab(p.id);
    const tier = useMeta.getState().maxGearTierForPrefab(p.id);
    set({
      classId,
      prefabId: p.id,
      grudgeId: makeGrudgeId(p.raceId, p.classId),
      meleeId: kit.melee,
      rangedId: kit.ranged,
      gearTier: tier,
      loadoutLocked: false,
    });
  },

  setPrefab: (prefabId) => {
    const p = GRUDGE_PREFAB_BY_ID[prefabId];
    if (!p || p.faction !== get().factionId) return;
    const kit = canonicalWeaponsForPrefab(p.id);
    const tier = useMeta.getState().maxGearTierForPrefab(p.id);
    set({
      raceId: p.raceId,
      classId: p.classId,
      prefabId: p.id,
      grudgeId: makeGrudgeId(p.raceId, p.classId),
      heroId: RACE_ANIM_PRESET[p.raceId],
      meleeId: kit.melee,
      rangedId: kit.ranged,
      gearTier: tier,
      custom: {},
      loadoutLocked: false,
    });
  },

  setGrudgeHandoff: (search) => {
    const handoff = parseGrudgeHandoff(search);
    const raceId = handoff.raceId ?? get().raceId;
    const classId = handoff.classId ?? get().classId;
    const p = prefabFor(raceId, classId);
    if (!p) return;
    const kit = canonicalWeaponsForPrefab(p.id);
    const tier = useMeta.getState().maxGearTierForPrefab(p.id);
    set({
      factionId: p.faction,
      enemyFactionId: opposingFaction(p.faction),
      raceId: p.raceId,
      classId: p.classId,
      prefabId: p.id,
      grudgeId: handoff.grudgeId ?? makeGrudgeId(p.raceId, p.classId),
      heroId: RACE_ANIM_PRESET[p.raceId],
      meleeId: kit.melee,
      rangedId: kit.ranged,
      gearTier: tier,
      custom: {},
      loadoutLocked: false,
    });
  },

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
  setMelee: (id) => set({ meleeId: id, loadoutLocked: false }),
  setRanged: (id) => set({ rangedId: id, loadoutLocked: false }),
  setLaneMeleeHero: (typeId) => {
    if (!factionMeleeIds(get().factionId).includes(typeId)) return;
    set({ laneMeleeHeroId: typeId, loadoutLocked: false });
  },
  setLaneRangedHero: (typeId) => {
    if (!factionRangedIds(get().factionId).includes(typeId)) return;
    set({ laneRangedHeroId: typeId, loadoutLocked: false });
  },
  lockLoadout: () => set({ loadoutLocked: true }),
}));

useRoster.subscribe((s) =>
  savePersisted({
    factionId: s.factionId,
    enemyFactionId: s.enemyFactionId,
    raceId: s.raceId,
    classId: s.classId,
    prefabId: s.prefabId,
    grudgeId: s.grudgeId,
    heroId: s.heroId,
    custom: s.custom,
    equipment: s.equipment,
    gearTier: s.gearTier,
    meleeId: s.meleeId,
    rangedId: s.rangedId,
    laneMeleeHeroId: s.laneMeleeHeroId,
    laneRangedHeroId: s.laneRangedHeroId,
    loadoutLocked: s.loadoutLocked,
  }),
);

function syncCanonicalWeaponsFromPrefab(): void {
  const state = useRoster.getState();
  const kit = canonicalWeaponsForPrefab(state.prefabId);
  const tier = useMeta.getState().maxGearTierForPrefab(state.prefabId);
  if (
    state.meleeId !== kit.melee ||
    state.rangedId !== kit.ranged ||
    state.gearTier > tier
  ) {
    useRoster.setState({
      meleeId: kit.melee,
      rangedId: kit.ranged,
      gearTier: Math.min(state.gearTier, tier),
    });
  }
}

const viewerLaunch = consumeViewerLaunchBuild();
if (viewerLaunch?.activePrefabId && GRUDGE_PREFAB_BY_ID[viewerLaunch.activePrefabId]) {
  queueMicrotask(() => useRoster.getState().setPrefab(viewerLaunch.activePrefabId!));
} else if (viewerLaunch?.classId) {
  const kitRace = viewerLaunch.kitRace;
  const mappedRace = (Object.entries(GRUDGE_RACE_TO_KIT).find(([, kit]) => kit === kitRace)?.[0] ??
    Object.keys(GRUDGE_RACE_TO_KIT).find((r) => kitRace.includes(r))) as PrefabRaceId | undefined;
  const raceCandidates = GRUDGE_FACTION_BY_ID[useRoster.getState().factionId].races;
  const raceId =
    (mappedRace && raceCandidates.includes(mappedRace) ? mappedRace : undefined) ??
    raceCandidates[0];
  queueMicrotask(() => {
    const store = useRoster.getState();
    store.setRace(raceId);
    store.setClass(viewerLaunch.classId!);
    if (viewerLaunch.grudgeId) {
      useRoster.setState({ grudgeId: viewerLaunch.grudgeId });
    }
    syncCanonicalWeaponsFromPrefab();
  });
}

queueMicrotask(() => syncCanonicalWeaponsFromPrefab());

/** The race's default look merged with any custom-skinning overrides. */
export function effectiveLook(heroId: string, custom: LookPatch): CharacterLook {
  return { ...getPreset(heroId).look, ...custom };
}

/** Active weapon class from equipped main-hand or the carried melee/ranged kit. */
export function effectiveWeaponClass(
  heroId: string,
  equipment: Equipment,
  meleeId: MeleeWeaponId,
  rangedId: RangedWeaponId,
  active: "melee" | "ranged" = "ranged",
): WeaponClass {
  if (equipment.weapon?.weaponClass) return equipment.weapon.weaponClass;
  if (active === "melee") {
    return MELEE_WEAPONS_CFG[meleeId]?.animClass ?? "unarmed";
  }
  return RANGED_WEAPONS[rangedId]?.animClass ?? getPreset(heroId).weapon;
}

/** Whether the lobby loadout matches the prefab's canonical melee + ranged kit. */
export function isLoadoutReady(
  meleeId: MeleeWeaponId,
  rangedId: RangedWeaponId,
  prefabId: string,
): boolean {
  const kit = canonicalWeaponsForPrefab(prefabId);
  return (
    meleeId === kit.melee &&
    rangedId === kit.ranged &&
    Boolean(MELEE_WEAPONS_CFG[meleeId] && RANGED_WEAPONS[rangedId])
  );
}