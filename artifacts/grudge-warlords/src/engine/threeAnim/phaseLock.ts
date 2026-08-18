/**
 * Walk is the master gait; run/sprint slave to its normalised phase.
 * Stops the four-legged mid-blend shuffle (Samurai Locomotion._lockPhase).
 */
import type { AnimationAction } from "three";

export function lockGaitPhase(master: AnimationAction | null, slave: AnimationAction | null): void {
  if (!master || !slave) return;
  const md = master.getClip().duration;
  const sd = slave.getClip().duration;
  if (md <= 0 || sd <= 0) return;
  const phase = (master.time % md) / md;
  slave.time = phase * sd;
}

/** Authored clip speeds (m/s) the pose covers at timeScale 1. */
export const CLIP_WALK_SPEED = 1.6;
export const CLIP_RUN_SPEED = 4.4;

/** timeScale so feet match real ground speed (no skating). */
export function strideTimeScale(speedMps: number, toRun: number): number {
  const nominal = CLIP_WALK_SPEED + (CLIP_RUN_SPEED - CLIP_WALK_SPEED) * toRun;
  if (speedMps < 0.12) return 1;
  return Math.min(1.85, Math.max(0.55, speedMps / Math.max(0.01, nominal)));
}
