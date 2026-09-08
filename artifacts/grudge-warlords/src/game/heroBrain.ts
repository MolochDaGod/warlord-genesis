/**
 * AI warlord policy. Uses the same loadout / dash / slam / weapon skills as
 * the player — it only decides *when* to press those buttons.
 */
import type { LoadoutAbility } from "./abilityLoadout";
import { SLAM } from "./config";

export interface HeroSense {
  hpFrac: number;
  retreating: boolean;
  executing: boolean;
  chasing: boolean;
  targetDist: number;
  hostilesInSlam: number;
  towardX: number;
  towardZ: number;
  awayX: number;
  awayZ: number;
}

export type HeroCast =
  | { kind: "slam" }
  | { kind: "dash"; x: number; z: number }
  | { kind: "skill"; ability: LoadoutAbility };

function ready(cd: Record<string, number>, id: string): boolean {
  return (cd[id] ?? 0) <= 0;
}

function hasMobility(loadout: LoadoutAbility[], id: "dash" | "slam"): LoadoutAbility | null {
  return loadout.find((a) => a.kind === "mobility" && a.mobility === id) ?? null;
}

export function planHeroCast(
  sense: HeroSense,
  loadout: LoadoutAbility[],
  cd: Record<string, number>,
): HeroCast | null {
  const slam = hasMobility(loadout, "slam");
  if (slam && ready(cd, slam.id) && sense.hostilesInSlam >= 2) {
    return { kind: "slam" };
  }
  const dash = hasMobility(loadout, "dash");
  if (dash && ready(cd, dash.id)) {
    const lenAway = Math.hypot(sense.awayX, sense.awayZ) || 1;
    const lenTo = Math.hypot(sense.towardX, sense.towardZ) || 1;
    if (sense.retreating) {
      return { kind: "dash", x: sense.awayX / lenAway, z: sense.awayZ / lenAway };
    }
    if ((sense.executing || sense.chasing) && sense.targetDist > 8 && sense.targetDist < 24) {
      return { kind: "dash", x: sense.towardX / lenTo, z: sense.towardZ / lenTo };
    }
    if (sense.hpFrac < 0.35 && sense.targetDist < 5 && sense.hostilesInSlam >= 1) {
      return { kind: "dash", x: sense.awayX / lenAway, z: sense.awayZ / lenAway };
    }
  }
  if (sense.targetDist > SLAM.shockRadius + 8 && sense.targetDist > 14) return null;
  let best: LoadoutAbility | null = null;
  let bestDmg = -1;
  for (const a of loadout) {
    if (a.kind === "mobility") continue;
    if (!ready(cd, a.id)) continue;
    const dmg = a.weaponSkill?.damage ?? 28;
    if (a.kind === "weapon" && sense.targetDist > 32) continue;
    if (dmg > bestDmg) {
      bestDmg = dmg;
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
