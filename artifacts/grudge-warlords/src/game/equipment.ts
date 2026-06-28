// Equipment / loadout data layer.
//
// Pulls real items from the Grudge Studio Codex (weapons + armor endpoints) and
// normalizes them into slot-keyed `LoadoutItem`s the loadout screen can browse
// and equip. The equipped weapon drives the in-match hero's weapon CLASS; all
// equipped gear contributes stat bonuses (HP / defense / damage) at match start.
//
// Per the standing rule, the Codex `emoji` field is intentionally dropped here.

import type { WeaponClass } from "./anim/types";

const DATA_BASE = "https://molochdagod.github.io/ObjectStore/api/v1";
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
  const res = await fetch(`${DATA_BASE}/${key}.json`);
  if (!res.ok) throw new Error(`Failed to load ${key} (${res.status})`);
  const raw = (await res.json()) as Record<string, unknown>;
  writeCache(key, raw);
  return raw;
}

let itemsPromise: Promise<LoadoutItem[]> | null = null;

/** Load + normalize every equippable item from the Codex (cached per session). */
export function loadEquipmentItems(): Promise<LoadoutItem[]> {
  if (itemsPromise) return itemsPromise;
  itemsPromise = (async () => {
    const [weapons, armor] = await Promise.all([fetchJson("weapons"), fetchJson("armor")]);
    const items: LoadoutItem[] = [];

    const cats = (weapons["categories"] ?? {}) as Record<string, { items?: RawItem[] }>;
    for (const [catKey, cat] of Object.entries(cats)) {
      const offhand = catKey === "shields" || catKey.endsWith("Tomes");
      for (const it of cat.items ?? []) {
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

    const mats = (armor["materials"] ?? {}) as Record<string, { items?: RawItem[] }>;
    for (const [matKey, mat] of Object.entries(mats)) {
      for (const it of mat.items ?? []) {
        const slot = it.type ? ARMOR_SLOT[it.type] : undefined;
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
  for (const slot of SLOT_IDS) {
    const it = eq[slot];
    if (!it) continue;
    hp += tierVal(it.stats, "hpBase", "hpPerTier", tier);
    def += tierVal(it.stats, "defenseBase", "defensePerTier", tier);
  }
  const w = eq.weapon;
  const wdmg = w ? tierVal(w.stats, "damageBase", "damagePerTier", tier) : 0;
  return {
    bonusHp: Math.round(hp),
    damageMult: wdmg > 0 ? Math.round((wdmg / 50) * 100) / 100 : 1,
    defense: Math.min(0.6, Math.round(def * 0.0015 * 1000) / 1000),
    weaponClass: w?.weaponClass ?? null,
  };
}
