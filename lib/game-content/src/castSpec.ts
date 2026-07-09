/**
 * Shared cast timing contract — mirrors `/world` `skillCast` + lab hover-cast.
 * Viewer and game both read the same shape so cast bars, windup stretch, and
 * follow-up chains stay aligned.
 */

export interface CastSpec {
  /** Baked clip path (no `.json`) for the windup / strike animation. */
  rel: string | null;
  /** Stable skill id when known (VFX + extend resolution). */
  skillId: string | null;
  /** Peak overlay blend 0..1 (world AnimationDirector). */
  blend: number;
  /** Windup stretch factor (`> 1` = slowed channel). Clamped 0.1..5. */
  extend: number;
  /** Optional follow-up baked clip chained after windup. */
  followRel: string | null;
  /** Monotonic bump per cast request (async-load guard). */
  token: number;
  /** Bumps when a follow-up strike chains after windup. */
  followToken: number;
  /** Whether the overlay should fire authored VFX. */
  vfx: boolean;
}

export const DEFAULT_CAST_SPEC: CastSpec = {
  rel: null,
  skillId: null,
  blend: 1,
  extend: 1,
  followRel: null,
  token: 0,
  followToken: 0,
  vfx: true,
};

/** Clamp extend to the same bounds as `worldStore.requestSkill`. */
export function normalizeCastExtend(extend: number): number {
  return Math.max(0.1, Math.min(5, extend));
}

/** Lab cast-bar progress 0..1 while channeling. */
export interface CastProgress {
  active: boolean;
  skillName: string | null;
  /** Elapsed channel fraction 0..1. */
  progress: number;
  /** Total channel duration in seconds (UI label). */
  durationSec: number;
  extend: number;
  channeling: boolean;
}

export const IDLE_CAST_PROGRESS: CastProgress = {
  active: false,
  skillName: null,
  progress: 0,
  durationSec: 0,
  extend: 1,
  channeling: false,
};