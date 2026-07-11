// Equipment / loadout data layer.
//
// Pulls real items from the Grudge Studio Codex (weapons + armor endpoints) and
// normalizes them into slot-keyed `LoadoutItem`s the loadout screen can browse
// and equip. The equipped weapon drives the in-match hero's weapon CLASS; all
// equipped gear contributes stat bonuses (HP / defense / damage) at match start.
//
// Per the standing rule, the Codex `emoji` field is intentionally dropped here.

import type { WeaponClass } from "./anim/types";

/** Prefer ObjectStore worker, then same-origin proxy, then Pages mirror (last resort). */
const DATA_BASES = [
  "https://objectstore.grudge-studio.com/api/v1",
  "/api/objectstore/v1",
  "https://assets.grudge-studio.com/api/v1",
  "https://molochdagod.github.io/ObjectStore/api/v1",
] as const;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "gw_equip_";

/** The gear slots a hero can fill (paper-doll). */
export type SlotId =
  | "weapon"
  | "offhand"
  | "helm"
  | "shoulder"
  | "chest"
  | "hands"
  | "legs"
  | "feet"
  | "necklace"
  | "ring"
  | "relic";

export interface SlotDef {
  id: SlotId;
  name: string;
}

export const SLOTS: SlotDef[] = [
  { id: "weapon", name: "Main Hand" },
  { id: "offhand", name: "Off Hand" },
  { id: "helm", name: "Helm" },
  { id: "shoulder", name: "Shoulders" },
  { id: "chest", name: "Chest" },
  { id: "hands", name: "Gauntlets" },
  { id: "legs", name: "Greaves" },
  { id: "feet", name: "Boots" },
  { id: "necklace", name: "Necklace" },
  { id: "ring", name: "Ring" },
  { id: "relic", name: "Relic" },
];

export const SLOT_IDS: SlotId[] = SLOTS.map((s) => s.id);

/** A Codex item normalized for the loadout. `stats` keeps the raw base/perTier fields. */
export interface LoadoutItem {
  id: string;
  name: string;
  slot: SlotId;
  /** Source category (weapon category) or material (armor). */
  category: string;
  lore?: string;
  primaryStat?: string;
  secondaryStat?: string;
  /** Weapon class this item drives when equipped in the main-hand slot. */
  weaponClass?: WeaponClass;
  stats: Record<string, number>;
}

/** The player's equipped items, by slot. */
export type Equipment = Partial<Record<SlotId, LoadoutItem>>;

// Weapon category -> animator weapon class.
const WEAPON_CLASS: Record<string, WeaponClass> = {
  swords: "sword",
  axes1h: "axe",
  daggers: "knife",
  greatswords: "greatsword",
  greataxes: "greataxe",
  hammers1h: "hammer",
  hammers2h: "hammer2h",
  spears: "spear",
  bows: "bow",
  crossbows: "bow",
  guns: "pistol",
  fireStaves: "magic",
  frostStaves: "magic",
  holyStaves: "magic",
  lightningStaves: "magic",
  arcaneStaves: "magic",
  natureStaves: "magic",
  tools: "unarmed",
};

// Armor item `type` (as served by the Codex) -> paper-doll slot.
const ARMOR_SLOT: Record<string, SlotId> = {
  Helm: "helm",
  Shoulder: "shoulder",
  Chest: "chest",
  Hands: "hands",
  Legs: "legs",
  Feet: "feet",
  Offhand: "offhand",
  Ring: "ring",
  Necklace: "necklace",
  Relic: "relic",
};

interface RawItem {
  id: string;
  name: string;
  type?: string;
  category?: string;
  lore?: string;
  primaryStat?: string;
  secondaryStat?: string;
  attribute?: string;
  effect?: string;
  stats?: Record<string, number>;
}

function readCache(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: unknown };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // non-fatal
  }
}

async function fetchJson(key: string): Promise<Record<string, unknown>> {
  const cached = readCache(key);
  if (cached) return cached as Record<string, unknown>;
  let lastErr: Error | null = null;
  for (const base of DATA_BASES) {
    try {
      const res = await fetch(`${base}/${key}.json`, { credentials: "omit" });
      if (!res.ok) {
        lastErr = new Error(`Failed to load ${key} from ${base} (${res.status})`);
        continue;
      }
      const raw = (await res.json()) as Record<string, unknown>;
      writeCache(key, raw);
      return raw;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`Failed to load ${key}`);
}

/**
 * Full warcamp paper-doll kit — strong enough for first-match lane combat.
 * Tuned so tier-1 aggregate ≈ +450 HP, ~0.35 defense, ≥1.3× damage mult.
 */
export function starterFallbackItems(): LoadoutItem[] {
  return [
    {
      id: "starter-blade",
      name: "Warcamp Blade",
      slot: "weapon",
      category: "swords",
      weaponClass: "sword",
      lore: "Issue steel from the warcamp armory — campaign-ready edge.",
      stats: {
        damageBase: 95,
        damagePerTier: 14,
        hpBase: 40,
        hpPerTier: 12,
        defenseBase: 8,
        defensePerTier: 2,
      },
    },
    {
      id: "starter-shield",
      name: "Warcamp Shield",
      slot: "offhand",
      category: "shields",
      lore: "Reinforced kite shield for the opening march.",
      stats: { defenseBase: 48, defensePerTier: 10, hpBase: 55, hpPerTier: 16 },
    },
    {
      id: "starter-helm",
      name: "Warcamp Helm",
      slot: "helm",
      category: "iron",
      stats: { defenseBase: 28, defensePerTier: 6, hpBase: 50, hpPerTier: 14 },
    },
    {
      id: "starter-shoulder",
      name: "Warcamp Pauldrons",
      slot: "shoulder",
      category: "iron",
      stats: { defenseBase: 22, defensePerTier: 5, hpBase: 35, hpPerTier: 10 },
    },
    {
      id: "starter-chest",
      name: "Warcamp Hauberk",
      slot: "chest",
      category: "iron",
      stats: { defenseBase: 52, defensePerTier: 10, hpBase: 90, hpPerTier: 22 },
    },
    {
      id: "starter-hands",
      name: "Warcamp Gauntlets",
      slot: "hands",
      category: "iron",
      stats: { defenseBase: 18, defensePerTier: 4, hpBase: 28, hpPerTier: 8 },
    },
    {
      id: "starter-legs",
      name: "Warcamp Greaves",
      slot: "legs",
      category: "iron",
      stats: { defenseBase: 32, defensePerTier: 6, hpBase: 48, hpPerTier: 12 },
    },
    {
      id: "starter-feet",
      name: "Warcamp Boots",
      slot: "feet",
      category: "iron",
      stats: { defenseBase: 16, defensePerTier: 4, hpBase: 24, hpPerTier: 7 },
    },
    {
      id: "starter-ring",
      name: "Signet of the March",
      slot: "ring",
      category: "jewelry",
      stats: { damageBase: 18, damagePerTier: 4, hpBase: 35, hpPerTier: 10, defenseBase: 8, defensePerTier: 2 },
    },
    {
      id: "starter-neck",
      name: "Campaign Torc",
      slot: "necklace",
      category: "jewelry",
      stats: { defenseBase: 16, defensePerTier: 4, hpBase: 40, hpPerTier: 10, damageBase: 10, damagePerTier: 2 },
    },
    {
      id: "starter-relic",
      name: "Relic of First Blood",
      slot: "relic",
      category: "relics",
      lore: "Standard issue campaign relic — first deployment.",
      stats: { damageBase: 22, damagePerTier: 5, hpBase: 45, hpPerTier: 12, defenseBase: 12, defensePerTier: 3 },
    },
  ];
}

/** Equip every starter slot into an Equipment bag (overwrites empty slots only if fillEmpty). */
export function buildStarterEquipment(fillEmptyOnly = false, existing: Equipment = {}): Equipment {
  const next: Equipment = fillEmptyOnly ? { ...existing } : {};
  for (const item of starterFallbackItems()) {
    if (fillEmptyOnly && next[item.slot]) continue;
    next[item.slot] = item;
  }
  return next;
}

/** True when fewer than half the paper-doll slots are filled (weak / naked start). */
export function equipmentIsWeak(eq: Equipment): boolean {
  let n = 0;
  for (const slot of SLOT_IDS) if (eq[slot]) n += 1;
  return n < 6;
}

function normalizeCatalog(
  weapons: Record<string, unknown>,
  armor: Record<string, unknown>,
): LoadoutItem[] {
  const items: LoadoutItem[] = [];

  const cats = (weapons["categories"] ?? {}) as Record<string, { items?: RawItem[] }>;
  for (const [catKey, cat] of Object.entries(cats)) {
    const offhand = catKey === "shields" || catKey.endsWith("Tomes") || catKey.toLowerCase().includes("tome");
    for (const it of cat.items ?? []) {
      if (!it?.id || !it?.name) continue;
      items.push({
        id: it.id,
        name: it.name,
        slot: offhand ? "offhand" : "weapon",
        category: catKey,
        lore: it.lore,
        primaryStat: it.primaryStat,
        secondaryStat: it.secondaryStat,
        weaponClass: offhand ? undefined : WEAPON_CLASS[catKey] ?? "unarmed",
        stats: it.stats ?? {},
      });
    }
  }

  const mats = (armor["materials"] ?? armor["categories"] ?? {}) as Record<
    string,
    { items?: RawItem[] }
  >;
  for (const [matKey, mat] of Object.entries(mats)) {
    for (const it of mat.items ?? []) {
      if (!it?.id || !it?.name) continue;
      const typeKey = it.type ?? (it as RawItem & { slot?: string }).slot;
      const slot =
        (typeKey && ARMOR_SLOT[typeKey]) ||
        (typeKey && ARMOR_SLOT[typeKey.charAt(0).toUpperCase() + typeKey.slice(1)]) ||
        undefined;
      if (!slot) continue;
      items.push({
        id: it.id,
        name: it.name,
        slot,
        category: matKey,
        lore: it.lore,
        primaryStat: it.attribute,
        secondaryStat: it.effect,
        stats: it.stats ?? {},
      });
    }
  }

  return items;
}

let itemsPromise: Promise<LoadoutItem[]> | null = null;

/** Load + normalize every equippable item from the Codex (cached per session). */
export function loadEquipmentItems(): Promise<LoadoutItem[]> {
  if (itemsPromise) return itemsPromise;
  itemsPromise = (async () => {
    try {
      const [weapons, armor] = await Promise.all([fetchJson("weapons"), fetchJson("armor")]);
      const items = normalizeCatalog(weapons, armor);
      if (items.length === 0) return starterFallbackItems();
      // Ensure every paper-doll slot has at least one option.
      const slots = new Set(items.map((i) => i.slot));
      for (const fb of starterFallbackItems()) {
        if (!slots.has(fb.slot)) items.push(fb);
      }
      return items;
    } catch {
      return starterFallbackItems();
    }
  })();
  return itemsPromise;
}

/** A stat value scaled to gear tier (1-8): base + perTier * (tier - 1). */
function tierVal(stats: Record<string, number>, base: string, per: string, tier: number): number {
  return (stats[base] ?? 0) + (stats[per] ?? 0) * (tier - 1);
}

/** Display the tier-scaled value of a single base/perTier stat pair. */
export function statAtTier(
  item: LoadoutItem,
  base: string,
  per: string,
  tier: number,
): number {
  return Math.round(tierVal(item.stats, base, per, tier));
}

export interface LoadoutStats {
  /** Bonus max HP added on top of the hero base. */
  bonusHp: number;
  /** Multiplier applied to hero weapon/melee damage (1 = unchanged). */
  damageMult: number;
  /** Incoming-damage reduction fraction (0..0.6). */
  defense: number;
  /** Weapon class forced by the equipped main-hand (null = use preset default). */
  weaponClass: WeaponClass | null;
}

/** Aggregate the equipped gear into the bonuses applied to the hero at match start. */
export function computeLoadoutStats(eq: Equipment, tier: number): LoadoutStats {
  let hp = 0;
  let def = 0;
  let dmg = 0;
  for (const slot of SLOT_IDS) {
    const it = eq[slot];
    if (!it) continue;
    hp += tierVal(it.stats, "hpBase", "hpPerTier", tier);
    def += tierVal(it.stats, "defenseBase", "defensePerTier", tier);
    dmg += tierVal(it.stats, "damageBase", "damagePerTier", tier);
  }
  // Never reduce base weapon damage: 0 gear → 1.0×; full warcamp kit → ~1.5–2.2×.
  const damageMult = Math.max(1, Math.round((1 + dmg / 120) * 100) / 100);
  // Defense scales to a meaningful mitigation band (~0.25–0.55 with full kit).
  const defense = Math.min(0.55, Math.round(def * 0.0018 * 1000) / 1000);
  return {
    bonusHp: Math.round(hp),
    damageMult,
    defense,
    weaponClass: eq.weapon?.weaponClass ?? null,
  };
}
