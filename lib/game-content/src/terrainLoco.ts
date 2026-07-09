// ── Terrain locomotion modes ───────────────────────────────────────────────────
//
// Maps the active traversal context (ground, swim, climb, wall-run, crawl, …)
// to baked locomotion bands and overlay loops. GameCharacter picks a mode each
// frame from physics/volume probes and drives overlays + gait through these tables.
//
// Blend rule: camera-relative WASD always drives physics; terrain overlays use
// partial blend so legs keep move intent and body yaw stays camera-locked during
// aim/strafe (RMB) — never flip facing independently mid-strafe.

import {
  SWIM_LOCO_KEYS,
  TRAVERSAL_DEFAULTS,
  WALL_RUN_BAKED,
  bakedPathForKey,
} from "./animDefaults";
import type { LocoBand } from "./animDefaults";

export type TerrainLocoMode =
  | "ground"
  | "swim"
  | "swim_edge"
  | "ladder"
  | "wall_climb"
  | "wall_run"
  | "wall_hang"
  | "crawl"
  | "slide"
  | "crouch"
  | "cover"
  | "stairs_up"
  | "stairs_down";

export interface TerrainLocoSet {
  /** Optional looping overlay while this mode is active (replaces gait clips). */
  overlay?: string;
  /** Overlay blend 0..1 when layering over a reduced locomotion base. */
  overlayBlend?: number;
  /** Per-band baked paths when no full-body overlay is used. */
  bands?: Partial<Record<LocoBand, string>>;
  /** Gait target override: false = hold idle band under overlay. */
  allowGait?: boolean;
}

function swimBand(band: LocoBand): string {
  const key = SWIM_LOCO_KEYS[band];
  return bakedPathForKey(key) ?? (band === "idle" ? "venom/idle" : "venom/low-crawl");
}

function bandKey(key: string, fallback: string): string {
  return bakedPathForKey(key) ?? fallback;
}

export const TERRAIN_LOCO: Record<TerrainLocoMode, TerrainLocoSet> = {
  ground: { allowGait: true },
  swim: {
    overlayBlend: 0.72,
    allowGait: true,
    bands: {
      idle: swimBand("idle"),
      walk: swimBand("walk"),
      run: swimBand("run"),
      sprint: swimBand("sprint"),
    },
  },
  swim_edge: {
    overlay: bandKey("swim_edge_exit", "uploads/locomotion/Climbing_To_Top"),
    overlayBlend: 0.95,
    allowGait: false,
  },
  ladder: {
    overlay: TRAVERSAL_DEFAULTS.ladder,
    overlayBlend: 1,
    allowGait: false,
  },
  wall_climb: {
    overlay: TRAVERSAL_DEFAULTS.ladder,
    overlayBlend: 1,
    allowGait: false,
  },
  wall_run: {
    overlay: WALL_RUN_BAKED,
    overlayBlend: 0.85,
    allowGait: true,
  },
  wall_hang: {
    overlay: TRAVERSAL_DEFAULTS.wall_hang,
    overlayBlend: 1,
    allowGait: false,
  },
  crawl: {
    overlay: TRAVERSAL_DEFAULTS.crawl,
    overlayBlend: 0.9,
    allowGait: false,
  },
  slide: {
    overlay: TRAVERSAL_DEFAULTS.slide,
    overlayBlend: 0.88,
    allowGait: false,
  },
  crouch: {
    overlay: bandKey("crouch_idle", "uploads/action/Crouch_Idle"),
    overlayBlend: 0.82,
    allowGait: true,
    bands: {
      idle: bandKey("crouch_idle", "uploads/action/Crouch_Idle"),
      walk: bandKey("sneak_l", "uploads/locomotion/crouched_sneaking_left"),
      run: bandKey("sneak_r", "uploads/locomotion/crouched_sneaking_right"),
      sprint: bandKey("sneak_r", "uploads/locomotion/crouched_sneaking_right"),
    },
  },
  cover: {
    overlayBlend: 0.78,
    allowGait: true,
    bands: {
      idle: bandKey("crouch_idle", "uploads/action/Crouch_Idle"),
      walk: bandKey("cover_sneak_l", "uploads/locomotion/left_cover_sneak"),
      run: bandKey("cover_sneak_r", "uploads/locomotion/right_cover_sneak"),
      sprint: bandKey("cover_sneak_r", "uploads/locomotion/right_cover_sneak"),
    },
  },
  stairs_up: {
    overlayBlend: 0.55,
    allowGait: true,
    bands: {
      idle: bandKey("walk", "venom/idle"),
      walk: bandKey("ascend_stairs", "uploads/action/Long_Step_Forward"),
      run: bandKey("ascend_stairs", "uploads/action/Long_Step_Forward"),
      sprint: bandKey("venom_run", "venom/run-forward"),
    },
  },
  stairs_down: {
    overlayBlend: 0.55,
    allowGait: true,
    bands: {
      idle: bandKey("walk", "venom/idle"),
      walk: bandKey("descend_stairs", "uploads_2026_06/locomotion/descending stairs"),
      run: bandKey("descend_stairs", "uploads_2026_06/locomotion/descending stairs"),
      sprint: bandKey("descend_stairs", "uploads_2026_06/locomotion/descending stairs"),
    },
  },
};

/** Resolve a terrain band path, falling back to Venom forward locomotion. */
export function terrainBandBaked(mode: TerrainLocoMode, band: LocoBand): string | undefined {
  const set = TERRAIN_LOCO[mode];
  return set.bands?.[band];
}

/** Overlay loop path for a terrain mode (undefined = use bands / ground gait). */
export function terrainOverlayBaked(mode: TerrainLocoMode): string | undefined {
  return TERRAIN_LOCO[mode].overlay;
}