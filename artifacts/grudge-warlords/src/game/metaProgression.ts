import { create } from "zustand";
import { PREFABS, PREFAB_BY_ID, prefabClassSkills, prefabWeaponSkills } from "@workspace/game-content";
import { defaultLaneHeroPicks } from "./laneDeployment";
import type { GrudgeFactionId } from "../engine/grudge6";
import { canonicalWeaponsForPrefab } from "./canonicalLoadout";
import {
  META_PERSIST_KEY,
  PRODUCTION_SEASON,
  STARTER_CARD_LEVEL,
  STARTER_GBUX,
} from "../lib/productionSeason";

const PERSIST_KEY = META_PERSIST_KEY;

export const SHARDS_TO_UNLOCK = 10;
export const SHARDS_PER_LEVEL = 10;
export const MAX_CARD_LEVEL = 8;
/** Account XP to level (simple curve). */
export const XP_PER_LEVEL = 500;

export const MATCH_REWARDS = {
  victory: { gbux: 85, shards: 2 },
  defeat: { gbux: 30, shards: 1 },
} as const;

export const DAILY_PACK = { gbux: 60, shards: 4 } as const;
export const UPGRADE_PACK_COST = 120;

export type CardKind = "character" | "lane_guard";

export interface CardProgress {
  kind: CardKind;
  /** prefab id or lane-guard unit type id */
  id: string;
  shards: number;
  /** 0 = locked, 1–8 = unlocked level (caps gear tier) */
  level: number;
}

interface PersistShape {
  seasonId: string;
  /** Locked after faction select — only this faction's units/prefabs unlock for play */
  factionId: GrudgeFactionId | null;
  factionChosen: boolean;
  onboardingDone: boolean;
  starterPrefabId: string | null;
  gbux: number;
  /** Account combat level (missions + matches) */
  accountLevel: number;
  accountXp: number;
  cards: CardProgress[];
  lastDailyClaim: string | null;
  lastMatchReward: MatchRewardSnapshot | null;
  /** Mission ids completed this season */
  completedMissions: string[];
}

export interface MatchRewardSnapshot {
  won: boolean;
  gbux: number;
  shardGrants: Array<{ kind: CardKind; id: string; label: string }>;
  at: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
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

function cardKey(kind: CardKind, id: string): string {
  return `${kind}:${id}`;
}

function ensureCard(cards: CardProgress[], kind: CardKind, id: string): CardProgress {
  const found = cards.find((c) => c.kind === kind && c.id === id);
  if (found) return found;
  const next = { kind, id, shards: 0, level: 0 };
  cards.push(next);
  return next;
}

function allCharacterIds(): string[] {
  return PREFABS.map((p) => p.id);
}

function allLaneGuardIds(factionId: GrudgeFactionId): string[] {
  const defaults = defaultLaneHeroPicks(factionId);
  const races = PREFABS.filter((p) => p.faction === factionId).map((p) => p.raceId);
  const uniq = new Set<string>();
  for (const race of races) {
    for (const cls of ["warrior", "worge", "mage", "ranger"] as const) {
      uniq.add(`${race}_${cls}`);
    }
  }
  uniq.add(defaults.meleeGuard);
  uniq.add(defaults.rangedGuard);
  return [...uniq];
}

function pickRandomShardTarget(
  cards: CardProgress[],
  factionId: GrudgeFactionId | null,
): { kind: CardKind; id: string } {
  const pool: Array<{ kind: CardKind; id: string }> = [];
  for (const p of PREFABS) {
    if (factionId && p.faction !== factionId) continue;
    const c = cards.find((x) => x.kind === "character" && x.id === p.id);
    if (!c || c.level < MAX_CARD_LEVEL) pool.push({ kind: "character", id: p.id });
  }
  for (const c of cards) {
    if (c.kind === "lane_guard" && c.level < MAX_CARD_LEVEL) {
      pool.push({ kind: "lane_guard", id: c.id });
    }
  }
  if (pool.length === 0) {
    const facPrefabs = factionId
      ? PREFABS.filter((p) => p.faction === factionId)
      : PREFABS;
    const p = facPrefabs[Math.floor(Math.random() * facPrefabs.length)] ?? PREFABS[0]!;
    return { kind: "character", id: p.id };
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function applyShards(cards: CardProgress[], kind: CardKind, id: string, count: number): CardProgress {
  const c = ensureCard(cards, kind, id);
  if (c.level >= MAX_CARD_LEVEL) {
    c.shards = Math.min(c.shards + count, SHARDS_PER_LEVEL - 1);
    return c;
  }
  c.shards += count;
  while (c.level < MAX_CARD_LEVEL && c.shards >= (c.level === 0 ? SHARDS_TO_UNLOCK : SHARDS_PER_LEVEL)) {
    const cost = c.level === 0 ? SHARDS_TO_UNLOCK : SHARDS_PER_LEVEL;
    c.shards -= cost;
    c.level += 1;
  }
  return c;
}

function cardLabel(kind: CardKind, id: string): string {
  if (kind === "character") {
    return PREFAB_BY_ID[id]?.name ?? id.replace(/-/g, " ");
  }
  return id.replace(/_/g, " ");
}

interface MetaState {
  seasonId: string;
  factionId: GrudgeFactionId | null;
  factionChosen: boolean;
  onboardingDone: boolean;
  starterPrefabId: string | null;
  gbux: number;
  accountLevel: number;
  accountXp: number;
  cards: CardProgress[];
  lastDailyClaim: string | null;
  lastMatchReward: MatchRewardSnapshot | null;
  completedMissions: string[];

  isCharacterUnlocked: (prefabId: string) => boolean;
  isLaneGuardUnlocked: (unitId: string, factionId: GrudgeFactionId) => boolean;
  characterLevel: (prefabId: string) => number;
  laneGuardLevel: (unitId: string) => number;
  maxGearTierForPrefab: (prefabId: string) => number;
  shardProgress: (kind: CardKind, id: string) => { shards: number; need: number; level: number };
  canPlayPrefab: (prefabId: string) => boolean;

  chooseFaction: (factionId: GrudgeFactionId) => void;
  completeStarterPick: (prefabId: string) => void;
  grantMatchRewards: (won: boolean) => MatchRewardSnapshot;
  grantMissionRewards: (missionId: string, xp: number, gold: number) => void;
  claimDailyPack: () => boolean;
  buyUpgradePack: () => boolean;
  addGbux: (amount: number) => void;
  syncGbuxFromAccount: (balance: number) => void;
  clearLastMatchReward: () => void;
  seedDefaultLaneGuards: (factionId: GrudgeFactionId) => void;
  /** Repair server/local desync — starter marked done but card missing. */
  ensureStarterUnlocked: () => void;
  hardResetLocal: () => void;
}

const rawPersisted = loadPersisted();
/** Drop stale season data — fresh production game. */
const persisted: Partial<PersistShape> =
  rawPersisted.seasonId === PRODUCTION_SEASON ? rawPersisted : {};

const bootMeta = persisted;

export const useMeta = create<MetaState>((set, get) => ({
  seasonId: PRODUCTION_SEASON,
  factionId: bootMeta.factionId ?? null,
  factionChosen: bootMeta.factionChosen ?? false,
  onboardingDone: bootMeta.onboardingDone ?? false,
  starterPrefabId: bootMeta.starterPrefabId ?? null,
  gbux: bootMeta.gbux ?? STARTER_GBUX,
  accountLevel: bootMeta.accountLevel ?? 1,
  accountXp: bootMeta.accountXp ?? 0,
  cards: bootMeta.cards ?? [],
  lastDailyClaim: bootMeta.lastDailyClaim ?? null,
  lastMatchReward: bootMeta.lastMatchReward ?? null,
  completedMissions: bootMeta.completedMissions ?? [],

  isCharacterUnlocked: (prefabId) => {
    const p = PREFAB_BY_ID[prefabId];
    if (!p) return false;
    const fac = get().factionId;
    if (fac && p.faction !== fac) return false;
    const c = get().cards.find((x) => x.kind === "character" && x.id === prefabId);
    return (c?.level ?? 0) > 0;
  },

  canPlayPrefab: (prefabId) => get().isCharacterUnlocked(prefabId),

  isLaneGuardUnlocked: (unitId, factionId) => {
    const locked = get().factionId;
    if (locked && locked !== factionId) return false;
    const defaults = defaultLaneHeroPicks(factionId);
    if (unitId === defaults.meleeGuard || unitId === defaults.rangedGuard) return true;
    const c = get().cards.find((x) => x.kind === "lane_guard" && x.id === unitId);
    return (c?.level ?? 0) > 0;
  },

  characterLevel: (prefabId) =>
    get().cards.find((c) => c.kind === "character" && c.id === prefabId)?.level ?? 0,

  laneGuardLevel: (unitId) =>
    get().cards.find((c) => c.kind === "lane_guard" && c.id === unitId)?.level ?? 0,

  maxGearTierForPrefab: (prefabId) => {
    const lvl = get().characterLevel(prefabId);
    return Math.max(1, Math.min(MAX_CARD_LEVEL, lvl || 1));
  },

  shardProgress: (kind, id) => {
    const c = get().cards.find((x) => x.kind === kind && x.id === id);
    const level = c?.level ?? 0;
    const shards = c?.shards ?? 0;
    const need = level === 0 ? SHARDS_TO_UNLOCK : SHARDS_PER_LEVEL;
    return { shards, need, level };
  },

  chooseFaction: (factionId) => {
    set({
      factionId,
      factionChosen: true,
      // Selecting faction does not finish onboarding — still pick starter warlord
      onboardingDone: false,
      starterPrefabId: null,
    });
    get().seedDefaultLaneGuards(factionId);
  },

  completeStarterPick: (prefabId) => {
    const p = PREFAB_BY_ID[prefabId];
    if (!p) return;
    const fac = get().factionId;
    if (fac && p.faction !== fac) return;
    const cards = [...get().cards];
    const c = ensureCard(cards, "character", prefabId);
    c.level = Math.max(c.level, STARTER_CARD_LEVEL);
    c.shards = 0;
    set({
      onboardingDone: true,
      starterPrefabId: prefabId,
      factionId: (fac ?? p.faction) as GrudgeFactionId,
      factionChosen: true,
      cards,
    });
    get().seedDefaultLaneGuards((fac ?? p.faction) as GrudgeFactionId);
  },

  grantMatchRewards: (won) => {
    const pack = won ? MATCH_REWARDS.victory : MATCH_REWARDS.defeat;
    const cards = [...get().cards];
    const fac = get().factionId;
    const shardGrants: MatchRewardSnapshot["shardGrants"] = [];
    for (let i = 0; i < pack.shards; i++) {
      const target = pickRandomShardTarget(cards, fac);
      applyShards(cards, target.kind, target.id, 1);
      shardGrants.push({
        kind: target.kind,
        id: target.id,
        label: cardLabel(target.kind, target.id),
      });
    }
    const xpGain = won ? 120 : 40;
    let accountXp = get().accountXp + xpGain;
    let accountLevel = get().accountLevel;
    while (accountXp >= XP_PER_LEVEL) {
      accountXp -= XP_PER_LEVEL;
      accountLevel += 1;
    }
    const snapshot: MatchRewardSnapshot = {
      won,
      gbux: pack.gbux,
      shardGrants,
      at: Date.now(),
    };
    set({
      gbux: get().gbux + pack.gbux,
      cards,
      accountXp,
      accountLevel,
      lastMatchReward: snapshot,
    });
    return snapshot;
  },

  grantMissionRewards: (missionId, xp, gold) => {
    if (get().completedMissions.includes(missionId)) return;
    let accountXp = get().accountXp + xp;
    let accountLevel = get().accountLevel;
    while (accountXp >= XP_PER_LEVEL) {
      accountXp -= XP_PER_LEVEL;
      accountLevel += 1;
    }
    set({
      gbux: get().gbux + gold,
      accountXp,
      accountLevel,
      completedMissions: [...get().completedMissions, missionId],
    });
  },

  claimDailyPack: () => {
    const today = todayKey();
    if (get().lastDailyClaim === today) return false;
    const cards = [...get().cards];
    const fac = get().factionId;
    const grants: MatchRewardSnapshot["shardGrants"] = [];
    for (let i = 0; i < DAILY_PACK.shards; i++) {
      const target = pickRandomShardTarget(cards, fac);
      applyShards(cards, target.kind, target.id, 1);
      grants.push({ kind: target.kind, id: target.id, label: cardLabel(target.kind, target.id) });
    }
    set({
      gbux: get().gbux + DAILY_PACK.gbux,
      cards,
      lastDailyClaim: today,
      lastMatchReward: {
        won: true,
        gbux: DAILY_PACK.gbux,
        shardGrants: grants,
        at: Date.now(),
      },
    });
    return true;
  },

  buyUpgradePack: () => {
    if (get().gbux < UPGRADE_PACK_COST) return false;
    const cards = [...get().cards];
    const fac = get().factionId;
    const grants: MatchRewardSnapshot["shardGrants"] = [];
    for (let i = 0; i < 3; i++) {
      const target = pickRandomShardTarget(cards, fac);
      applyShards(cards, target.kind, target.id, 1);
      grants.push({ kind: target.kind, id: target.id, label: cardLabel(target.kind, target.id) });
    }
    set({
      gbux: get().gbux - UPGRADE_PACK_COST,
      cards,
      lastMatchReward: {
        won: true,
        gbux: -UPGRADE_PACK_COST,
        shardGrants: grants,
        at: Date.now(),
      },
    });
    return true;
  },

  addGbux: (amount) => set({ gbux: Math.max(0, get().gbux + amount) }),

  syncGbuxFromAccount: (balance) => {
    if (Number.isFinite(balance) && balance > get().gbux) {
      set({ gbux: balance });
    }
  },

  clearLastMatchReward: () => set({ lastMatchReward: null }),

  seedDefaultLaneGuards: (factionId) => {
    const cards = [...get().cards];
    const defaults = defaultLaneHeroPicks(factionId);
    let changed = false;
    for (const id of [defaults.meleeGuard, defaults.rangedGuard]) {
      const existing = cards.find((c) => c.kind === "lane_guard" && c.id === id);
      if (existing && existing.level >= 1) continue;
      const c = ensureCard(cards, "lane_guard", id);
      if (c.level < 1) {
        c.level = 1;
        c.shards = 0;
        changed = true;
      }
    }
    if (changed) set({ cards });
  },

  ensureStarterUnlocked: () => {
    const s = get();
    if (!s.onboardingDone && !s.starterPrefabId) return;
    const prefabId = s.starterPrefabId;
    if (!prefabId || !PREFAB_BY_ID[prefabId]) return;
    const cards = [...s.cards];
    const c = ensureCard(cards, "character", prefabId);
    if (c.level < STARTER_CARD_LEVEL) {
      c.level = STARTER_CARD_LEVEL;
      c.shards = 0;
      const fac = (s.factionId ?? PREFAB_BY_ID[prefabId]!.faction) as GrudgeFactionId;
      set({
        cards,
        onboardingDone: true,
        starterPrefabId: prefabId,
        factionId: fac,
        factionChosen: true,
      });
      get().seedDefaultLaneGuards(fac);
    }
  },

  hardResetLocal: () => {
    set({
      seasonId: PRODUCTION_SEASON,
      factionId: null,
      factionChosen: false,
      onboardingDone: false,
      starterPrefabId: null,
      gbux: STARTER_GBUX,
      accountLevel: 1,
      accountXp: 0,
      cards: [],
      lastDailyClaim: null,
      lastMatchReward: null,
      completedMissions: [],
    });
  },
}));

useMeta.subscribe((s) =>
  savePersisted({
    seasonId: PRODUCTION_SEASON,
    factionId: s.factionId,
    factionChosen: s.factionChosen,
    onboardingDone: s.onboardingDone,
    starterPrefabId: s.starterPrefabId,
    gbux: s.gbux,
    accountLevel: s.accountLevel,
    accountXp: s.accountXp,
    cards: s.cards,
    lastDailyClaim: s.lastDailyClaim,
    lastMatchReward: s.lastMatchReward,
    completedMissions: s.completedMissions,
  }),
);

/** Skill count for character card display. */
export function skillCountForPrefab(prefabId: string): number {
  const p = PREFAB_BY_ID[prefabId];
  if (!p) return 0;
  return prefabClassSkills(p).length + prefabWeaponSkills(p).length;
}

export function applyCanonicalLoadoutToRoster(
  prefabId: string,
  setMelee: (id: import("./config").MeleeWeaponId) => void,
  setRanged: (id: import("./config").RangedWeaponId) => void,
  setGearTier: (tier: number) => void,
) {
  const pair = canonicalWeaponsForPrefab(prefabId);
  setMelee(pair.melee);
  setRanged(pair.ranged);
  const tier = useMeta.getState().maxGearTierForPrefab(prefabId);
  setGearTier(tier);
}

/**
 * Fleet SSOT captain → Warlords recruit card.
 * Ensures march is allowed when roster was hydrated from `/api/characters`.
 */
export function unlockFleetWarlord(prefabId: string): void {
  const p = PREFAB_BY_ID[prefabId];
  if (!p) return;

  const state = useMeta.getState();
  const cards = [...state.cards];
  const c = ensureCard(cards, "character", prefabId);
  // Campaign-ready floor so fleet-hydrated captains are not under-geared on /play.
  if (c.level < 3) {
    c.level = 3;
    c.shards = 0;
  }

  useMeta.setState({
    cards,
    onboardingDone: true,
    starterPrefabId: state.starterPrefabId ?? prefabId,
  });
  useMeta.getState().seedDefaultLaneGuards(p.faction as GrudgeFactionId);
}

export { allCharacterIds, allLaneGuardIds, cardLabel };