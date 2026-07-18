// Live game data from the Grudge Studio ObjectStore catalog.
// Cached in localStorage for 24h per the ObjectStore caching guidance.
// SSOT path is /api/v1/*.json on the Worker (NOT root /weapons.json).

const DATA_BASES = [
  "https://objectstore.grudge-studio.com/api/v1",
  "https://info.grudge-studio.com/api/v1",
  "https://molochdagod.github.io/ObjectStore/api/v1",
] as const;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "gw_codex_";

export interface TierColor {
  name: string;
  hex: string;
  label: string;
}

export const TIER_COLORS: Record<number, TierColor> = {
  1: { name: "Bronze", hex: "#8b7355", label: "Common" },
  2: { name: "Silver", hex: "#a8a8a8", label: "Uncommon" },
  3: { name: "Blue", hex: "#4a9eff", label: "Rare" },
  4: { name: "Purple", hex: "#9d4dff", label: "Epic" },
  5: { name: "Red", hex: "#ff4d4d", label: "Heroic" },
  6: { name: "Orange", hex: "#ffaa00", label: "Mythic" },
  7: { name: "Gold", hex: "#d4a84b", label: "Ancient" },
  8: { name: "Shimmer", hex: "#f0d890", label: "Legendary" },
};

export function getTierColor(tier: number | undefined): TierColor {
  return TIER_COLORS[tier ?? 1] ?? TIER_COLORS[1]!;
}

export interface GrudgeItem {
  id: string;
  name: string;
  tier?: number;
  category?: string;
  type?: string;
  lore?: string;
  primaryStat?: string;
  secondaryStat?: string;
  [key: string]: unknown;
}

export interface DataCategory {
  name?: string;
  items: GrudgeItem[];
}

export interface GrudgeDataset {
  version?: string;
  updated?: string;
  total?: number;
  tiers?: number;
  categories: Record<string, DataCategory>;
}

export type DatasetKey =
  | "weapons"
  | "armor"
  | "consumables"
  | "enemies"
  | "bosses"
  | "skills"
  | "materials";

export const DATASETS: { key: DatasetKey; label: string }[] = [
  { key: "weapons", label: "Weapons" },
  { key: "armor", label: "Armor" },
  { key: "enemies", label: "Enemies" },
  { key: "bosses", label: "Bosses" },
  { key: "consumables", label: "Consumables" },
  { key: "skills", label: "Skills" },
  { key: "materials", label: "Materials" },
];

interface Cached {
  at: number;
  data: GrudgeDataset;
}

function readCache(key: DatasetKey): GrudgeDataset | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key: DatasetKey, data: GrudgeDataset) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ at: Date.now(), data } satisfies Cached),
    );
  } catch {
    // Storage full or unavailable — non-fatal, we just refetch next time.
  }
}

// Some datasets (e.g. materials) use a flat `materials` array instead of
// `categories`. Normalize everything into the categories shape.
function normalize(key: DatasetKey, raw: Record<string, unknown>): GrudgeDataset {
  if (raw["categories"] && typeof raw["categories"] === "object") {
    return raw as unknown as GrudgeDataset;
  }
  const flat = (raw[key] ?? raw["items"]) as GrudgeItem[] | undefined;
  if (Array.isArray(flat)) {
    const byCategory: Record<string, DataCategory> = {};
    for (const item of flat) {
      const cat = item.category ?? "all";
      (byCategory[cat] ??= { items: [] }).items.push(item);
    }
    return {
      version: raw["version"] as string | undefined,
      updated: raw["updated"] as string | undefined,
      total: flat.length,
      categories: byCategory,
    };
  }
  return { categories: {} };
}

export async function loadDataset(key: DatasetKey): Promise<GrudgeDataset> {
  const cached = readCache(key);
  if (cached) return cached;
  let lastErr: Error | null = null;
  for (const base of DATA_BASES) {
    try {
      const res = await fetch(`${base}/${key}.json`, { credentials: "omit" });
      if (!res.ok) {
        lastErr = new Error(`Failed to load ${key} from ${base} (${res.status})`);
        continue;
      }
      const raw = (await res.json()) as Record<string, unknown>;
      const data = normalize(key, raw);
      writeCache(key, data);
      return data;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`Failed to load ${key}`);
}

export function flattenItems(data: GrudgeDataset): GrudgeItem[] {
  return Object.values(data.categories).flatMap((c) => c.items ?? []);
}
