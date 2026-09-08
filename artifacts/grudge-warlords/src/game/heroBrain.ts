/**
 * AI warlord policy. Uses the same loadout / dash / slam / weapon skills as
 * the player — it only decides *when* to press those buttons. Never invents
 * abilities that are not on the shared 6-slot bar.
 */
import type { LoadoutAbility } from "./abilityLoadout";
import { SLAM } from "./config";

export interface HeroSense {
  hpFrac: number;
  retreating: boolean;
  executing: boolean;
  chasing: boolean;
  /** Distance to the current combat target (player, unit, or structure). */
  targetDist: number;
  /** Target HP fraction (1 if none). */
  targetHpFrac: number;
  targetIsHero: boolean;
  targetIsStructure: boolean;
  hostilesInSlam: number;
  alliesNear: number;
  /** Flat heading toward the current goal / target. */
  towardX: number;
  towardZ: number;
  /** Heading away (retreat / kite). */
  awayX: number;
  awayZ: number;
  /** True when the warlord is currently bursting (don't stack a second dash). */
  dashing: boolean;
}

export type HeroCast =
  | { kind: "slam" }
  | { kind: "dash"; x: number; z: number }
  | { kind: "skill"; ability: LoadoutAbility };

const MELEE_REACH = 6.2;
const RANGED_REACH = 34;

function ready(cd: Record<string, number>, id: string): boolean {
  return (cd[id] ?? 0) <= 0;
}

function hasMobility(loadout: LoadoutAbility[], id: "dash" | "slam"): LoadoutAbility | null {
  return loadout.find((a) => a.kind === "mobility" && a.mobility === id) ?? null;
}

function blobOf(a: LoadoutAbility): string {
  return `${a.id} ${a.label} ${a.animKey ?? ""} ${a.weaponSkill?.animKey ?? ""}`.toLowerCase();
}

/** Effective combat reach of a hotbar ability — same numbers the hit resolver uses. */
export function skillReach(a: LoadoutAbility): number {
  const blob = blobOf(a);
  if (/bow|shot|gun|arrow|missile|fireball|meteor|lightning|rain|precision|magic|volley/.test(blob)) {
    return RANGED_REACH;
  }
  if (/blink|portal|shadow-step/.test(blob)) return 18;
  return MELEE_REACH;
}

export function loadoutHasRanged(loadout: LoadoutAbility[]): boolean {
  return loadout.some((a) => a.kind !== "mobility" && skillReach(a) >= 20);
}

function isExecuteSkill(a: LoadoutAbility): boolean {
  return /execute|assassinate|finisher/.test(blobOf(a));
}

function isAoeSkill(a: LoadoutAbility): boolean {
  return /meteor|rain|storm|chain|burst|cleave|multi|volley|slam/.test(blobOf(a));
}

function norm(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

/**
 * Priority:
 *  1. Dash out when wounded and stacked
 *  2. Warstomp (shared slam) when 2+ hostiles (or the player) sit in the shock
 *  3. Dash in to finish / close a melee gap
 *  4. Best in-range weapon/class skill (range-fit, execute, AoE scoring)
 * Never invents abilities not on the loadout.
 */
export function planHeroCast(
  sense: HeroSense,
  loadout: LoadoutAbility[],
  cd: Record<string, number>,
): HeroCast | null {
  if (sense.dashing) return null;

  const slam = hasMobility(loadout, "slam");
  const dash = hasMobility(loadout, "dash");
  const away = norm(sense.awayX, sense.awayZ);
  const toward = norm(sense.towardX, sense.towardZ);
  const rangedKit = loadoutHasRanged(loadout);
  const slamReach = SLAM.shockRadius * 0.7;

  // 1. Emergency dash — same Warstride the player has.
  if (dash && ready(cd, dash.id)) {
    if (sense.retreating) return { kind: "dash", x: away.x, z: away.z };
    if (sense.hpFrac < 0.32 && sense.targetDist < 6 && sense.hostilesInSlam >= 1) {
      return { kind: "dash", x: away.x, z: away.z };
    }
    // Ranged kit: kite off melee instead of eating auto-attacks.
    if (rangedKit && !sense.executing && sense.hpFrac < 0.7 && sense.targetDist < 5.5) {
      return { kind: "dash", x: away.x, z: away.z };
    }
  }

  // 2. Shared Warstomp — clusters, or a wounded player standing on us.
  if (slam && ready(cd, slam.id)) {
    const playerIn = sense.targetIsHero && sense.targetDist <= slamReach;
    if (sense.hostilesInSlam >= 2 || (playerIn && (sense.executing || sense.hostilesInSlam >= 1))) {
      return { kind: "slam" };
    }
  }

  // 3. Gap-close dash — execute chases and melee kits.
  if (dash && ready(cd, dash.id) && !sense.retreating) {
    const wantClose = !rangedKit || sense.executing;
    if (wantClose && (sense.executing || sense.chasing) && sense.targetDist > 7 && sense.targetDist < 26) {
      return { kind: "dash", x: toward.x, z: toward.z };
    }
  }

  if (sense.retreating) return null;
  if (sense.targetDist > 40) return null;

  // 4. Weapon / class skills from the same hotbar the player uses.
  let best: LoadoutAbility | null = null;
  let bestScore = -1;
  for (const a of loadout) {
    if (a.kind === "mobility") continue;
    if (!ready(cd, a.id)) continue;
    const reach = skillReach(a);
    if (sense.targetDist > reach * 1.12) continue;
    const dmg = a.weaponSkill?.damage ?? 28;
    let score = dmg;
    const rangeFit = 1 - Math.min(1, Math.abs(sense.targetDist - reach * 0.45) / Math.max(4, reach));
    score += rangeFit * 14;
    if (isExecuteSkill(a) && sense.targetHpFrac <= 0.35) score += 42;
    if (isAoeSkill(a) && sense.hostilesInSlam >= 3) score += 20;
    if (isAoeSkill(a) && sense.hostilesInSlam < 2 && !sense.targetIsStructure) score -= 8;
    if (sense.targetIsHero) score += 10;
    if (sense.targetIsStructure && dmg >= 40) score += 8;
    if (reach <= 8 && sense.targetDist > 7.5) score -= 30;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  if (best) return { kind: "skill", ability: best };
  return null;
}

export function tickAbilityCds(cd: Record<string, number>, dt: number): void {
  for (const k of Object.keys(cd)) {
    if (cd[k] > 0) cd[k] = Math.max(0, cd[k] - dt);
  }
}
