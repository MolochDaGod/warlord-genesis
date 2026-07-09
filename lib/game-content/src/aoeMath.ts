// ── AoE / knockback math (headless-testable) ──────────────────────────────────
//
// Pure helpers for radial explosion impulse and slash-wave crescent impulse.
// Shared by /world SkillVfxOverlay and the character-viewer impact lab.

export interface ImpulseVec {
  x: number;
  y: number;
  z: number;
}

/** The slice of a VFX config the AoE impulse depends on. */
export interface AoeParams {
  /** AoE radius (m); clamped to a 0.5 floor like the runtime. */
  radius: number;
  /** Peak outward impulse magnitude at the blast centre. */
  impulse: number;
  /** Extra upward impulse bias (so bodies pop up, not just slide). */
  up: number;
  /** Scale the impulse down with distance from the centre. */
  falloff: boolean;
}

/**
 * Radial explosion impulse for a single body at (bx,bz) from a blast at (cx,cz).
 * Returns null when the body is outside the radius (or fully attenuated).
 */
export function aoeImpulse(
  cx: number,
  cz: number,
  bx: number,
  bz: number,
  mass: number,
  cfg: AoeParams,
): ImpulseVec | null {
  const radius = Math.max(0.5, cfg.radius);
  const dx = bx - cx;
  const dz = bz - cz;
  const dist = Math.hypot(dx, dz);
  if (dist > radius) return null;
  const fall = cfg.falloff ? 1 - dist / radius : 1;
  if (fall <= 0) return null;
  const len = dist || 0.0001;
  const ux = dx / len;
  const uz = dz / len;
  const m = mass || 1;
  return {
    x: ux * cfg.impulse * fall * m,
    y: cfg.up * fall * m,
    z: uz * cfg.impulse * fall * m,
  };
}

/**
 * Slash force-wave impulse for a single body at (bx,bz). The crescent sweeps out
 * from (cx,cz) to `frontR` within a ±`halfAngle` cone about `yaw`.
 */
export function waveImpulse(
  cx: number,
  cz: number,
  bx: number,
  bz: number,
  mass: number,
  frontR: number,
  yaw: number,
  halfAngle: number,
  knock: number,
): ImpulseVec | null {
  if (knock <= 0) return null;
  const fwdX = Math.sin(yaw);
  const fwdZ = Math.cos(yaw);
  const dx = bx - cx;
  const dz = bz - cz;
  const dist = Math.hypot(dx, dz);
  if (dist > frontR || dist < 0.05) return null;
  const dot = (dx * fwdX + dz * fwdZ) / dist;
  if (dot < Math.cos(halfAngle)) return null;
  const ux = dx / dist;
  const uz = dz / dist;
  const m = mass || 1;
  return { x: ux * knock * m, y: 0.35 * knock * m, z: uz * knock * m };
}