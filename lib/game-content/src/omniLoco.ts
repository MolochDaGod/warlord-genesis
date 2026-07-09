// ── Omnidirectional locomotion clip resolver ─────────────────────────────────
//
// Maps 8-way move intent + gait band → baked clip paths for /world. Uses Venom /
// Marvel packs where they exist (verified on disk) and falls back to per-pack
// defaults from animDefaults. Consumed by GameCharacter + AnimationDirector omni
// blend mode.

import { locoBakedForApiWeapon } from "./apiWeaponLoco";
import {
  type AnimPackId,
  type LocoBand,
  bakedPathForKey,
  locoBakedForPack,
} from "./animDefaults";

/** Eight-way locomotion facing (character-local: +Z forward, +X right). */
export type OmniLocoDir =
  | "forward"
  | "forward-left"
  | "forward-right"
  | "backward"
  | "backward-left"
  | "backward-right"
  | "left"
  | "right";

const OMNI_VENOM_FWD = {
  idle: "venom/idle",
  walk: "venom/walk-forward",
  run: "venom/run-forward",
  sprint: "venom/run-forward",
} as const satisfies Record<LocoBand, string>;

const OMNI_MARVEL_BACK = {
  idle: "marvel/idle-hero",
  walk: "marvel/walk-forward",
  run: "marvel/run-forward",
  sprint: "marvel/run-forward",
} as const satisfies Record<LocoBand, string>;

const OMNI_STRAFE = {
  idle: "venom/idle",
  walk: "venom/low-crawl",
  run: "venom/wallrun",
  sprint: "venom/wallrun",
} as const satisfies Record<LocoBand, string>;

const OMNI_DIAG_BACK = {
  idle: "marvel/idle-hero",
  walk: "marvel/walk-forward",
  run: "marvel/run-forward",
  sprint: "marvel/run-forward",
} as const satisfies Record<LocoBand, string>;

function keyOr(path: string, key: string): string {
  return bakedPathForKey(key) ?? path;
}

/** Classify a character-local move vector into one of 8 locomotion sectors. */
export function classifyOmniDir(lx: number, lz: number): OmniLocoDir {
  if (Math.hypot(lx, lz) < 0.08) return "forward";
  const ang = Math.atan2(lx, lz);
  const deg = (ang * 180) / Math.PI;
  if (deg >= -22.5 && deg < 22.5) return "forward";
  if (deg >= 22.5 && deg < 67.5) return "forward-right";
  if (deg >= 67.5 && deg < 112.5) return "right";
  if (deg >= 112.5 && deg < 157.5) return "backward-right";
  if (deg >= 157.5 || deg < -157.5) return "backward";
  if (deg >= -157.5 && deg < -112.5) return "backward-left";
  if (deg >= -112.5 && deg < -67.5) return "left";
  return "forward-left";
}

/** Map gait axis 0..1 (AnimationDirector gait) to a locomotion band. */
export function bandFromGait(gait: number, sprinting: boolean): LocoBand {
  if (gait < 0.12) return "idle";
  if (sprinting && gait > 0.85) return "sprint";
  if (gait < 0.52) return "walk";
  return "run";
}

/**
 * Resolve the baked clip path (no `.json`) for a pack + band + direction.
 * Forward arcs prefer Venom locomotion; backward arcs use Marvel backpedal;
 * pure strafe uses low-crawl / wallrun loops until dedicated strafe clips land.
 */
export function resolveOmniLocoBaked(
  pack: AnimPackId,
  band: LocoBand,
  dir: OmniLocoDir,
): string {
  const fallback = locoBakedForPack(pack, band);
  switch (dir) {
    case "forward":
    case "forward-left":
    case "forward-right":
      return keyOr(OMNI_VENOM_FWD[band], band === "idle" ? "venom_idle" : band === "walk" ? "venom_walk" : "venom_run") ?? fallback;
    case "backward":
    case "backward-left":
    case "backward-right":
      return (
        keyOr(OMNI_DIAG_BACK[band], band === "idle" ? "marvel_idle" : band === "walk" ? "marvel_walk" : "marvel_run") ??
        fallback
      );
    case "left":
    case "right":
      return keyOr(OMNI_STRAFE[band], band === "walk" ? "venom_low_crawl" : "venom_wallrun") ?? fallback;
    default:
      return fallback;
  }
}

/**
 * Omni locomotion for an equipped API weapon — uses weapon MM clips as the
 * forward-arc fallback instead of generic mixamo walk while holding gear.
 */
export function resolveOmniLocoForWeapon(
  apiWeaponId: string | null | undefined,
  pack: AnimPackId,
  band: LocoBand,
  dir: OmniLocoDir,
): string {
  const weaponFwd = locoBakedForApiWeapon(apiWeaponId, band, pack);
  switch (dir) {
    case "forward":
    case "forward-left":
    case "forward-right":
      return weaponFwd;
    case "backward":
    case "backward-left":
    case "backward-right":
      return (
        keyOr(OMNI_DIAG_BACK[band], band === "idle" ? "marvel_idle" : band === "walk" ? "marvel_walk" : "marvel_run") ??
        weaponFwd
      );
    case "left":
    case "right":
      return keyOr(OMNI_STRAFE[band], band === "walk" ? "venom_low_crawl" : "venom_wallrun") ?? weaponFwd;
    default:
      return weaponFwd;
  }
}

/** Normalized move speed 0..1 from planar velocity and nominal run speed. */
export function speed01FromPlanar(speed: number, nominal = 3.4): number {
  return Math.min(1, Math.max(0, speed / nominal));
}