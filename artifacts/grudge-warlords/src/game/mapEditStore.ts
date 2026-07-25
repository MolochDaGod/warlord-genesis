/**
 * Map Edit prefs for Warlord Genesis /edit
 * Scales + pathfinding mode per map size, localStorage-backed.
 */

export type PathfindingMode = "auto" | "grid" | "flow";
export type AnchorLevel = "bottom" | "mid" | "top";

export type ScaleKey =
  | "terrain"
  | "towers"
  | "buildings"
  | "trees"
  | "props"
  | "routeLift";

export interface MapEditScales {
  terrain: number;
  towers: number;
  buildings: number;
  trees: number;
  props: number;
  routeLift: number;
}

export interface MapEditPrefs {
  mapSize: "standard" | "large";
  seed: number;
  pathfinding: PathfindingMode;
  scales: MapEditScales;
  /** Per map-size overrides */
  bySize: Partial<Record<"standard" | "large", Partial<MapEditScales>>>;
  layers: Record<AnchorLevel, boolean>;
  showNavGrid: boolean;
  showLanes: boolean;
}

export const DEFAULT_SCALES: MapEditScales = {
  terrain: 1,
  towers: 1,
  buildings: 1,
  trees: 1,
  props: 1,
  routeLift: 0.4,
};

export const SCALE_META: Record<
  ScaleKey,
  { min: number; max: number; step: number; label: string }
> = {
  terrain: { min: 0.25, max: 3, step: 0.05, label: "Terrain height" },
  towers: { min: 0.15, max: 4, step: 0.05, label: "Towers mesh" },
  buildings: { min: 0.15, max: 4, step: 0.05, label: "Buildings" },
  trees: { min: 0.15, max: 4, step: 0.05, label: "Trees" },
  props: { min: 0.15, max: 4, step: 0.05, label: "Props / camps" },
  routeLift: { min: 0, max: 2.5, step: 0.05, label: "Route lift (m)" },
};

const KEY = "wg:map-edit:v1";

export function defaultPrefs(): MapEditPrefs {
  return {
    mapSize: "standard",
    seed: 0x51c0de,
    pathfinding: "auto",
    scales: { ...DEFAULT_SCALES },
    bySize: {},
    layers: { bottom: true, mid: true, top: true },
    showNavGrid: true,
    showLanes: true,
  };
}

export function loadPrefs(): MapEditPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPrefs();
    const p = JSON.parse(raw) as Partial<MapEditPrefs>;
    return {
      ...defaultPrefs(),
      ...p,
      scales: { ...DEFAULT_SCALES, ...p.scales },
      layers: { ...defaultPrefs().layers, ...p.layers },
      bySize: p.bySize ?? {},
    };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(p: MapEditPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function resolveScales(p: MapEditPrefs): MapEditScales {
  return {
    ...DEFAULT_SCALES,
    ...p.scales,
    ...(p.bySize[p.mapSize] ?? {}),
  };
}
