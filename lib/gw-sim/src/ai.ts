// Headless bot brain for PvP fill — ally bots support human teammates; enemy bots
// press lanes with macro summons and hero attack-move.

import type { Rng } from "./rng";
import type { SimMap } from "./map";
import { teamSize } from "./mode";
import type { GameMode, Team } from "./types";

export type BotOrder = "idle" | "move" | "attackMove";

export interface BotHeroCommand {
  order: BotOrder;
  destX: number;
  destZ: number;
}

export interface BotTickInput {
  slot: number;
  team: Team;
  bot: boolean;
  credits: number;
  rallyLane: number;
  heroAlive: boolean;
  heroX: number;
  heroZ: number;
  /** true when this bot fills an ally seat while a human is on the same team */
  allySupport: boolean;
  /** human teammate rally lane when allySupport */
  humanRallyLane: number;
  humanHeroX: number;
  humanHeroZ: number;
  hasHumanHero: boolean;
}

export interface BotTickPlan {
  summon?: { unit: "footman" | "archer" | "knight"; lane: number };
  hero?: BotHeroCommand;
  setRallyLane?: number;
}

export interface LanePressure {
  lane: number;
  allyTowerHp: number;
  enemyTowerHp: number;
}

const COST = { footman: 80, archer: 120, knight: 180 } as const;

export function lanePressures(
  map: SimMap,
  team: Team,
  structHp: (team: Team, lane: number) => number,
): LanePressure[] {
  const out: LanePressure[] = [];
  for (let lane = 0; lane < 3; lane++) {
    const enemy: Team = team === 0 ? 1 : 0;
    out.push({
      lane,
      allyTowerHp: structHp(team, lane),
      enemyTowerHp: structHp(enemy, lane),
    });
  }
  return out;
}

/** Pick the lane to press (lowest enemy tower HP) or defend (lowest ally tower HP). */
export function pickFocusLane(pressures: LanePressure[], defend: boolean): number {
  let best = 1;
  let bestScore = defend ? Infinity : -Infinity;
  for (const p of pressures) {
    const score = defend ? p.allyTowerHp : p.enemyTowerHp;
    if (defend ? score < bestScore : score > bestScore) {
      bestScore = score;
      best = p.lane;
    }
  }
  return best;
}

export function planBotTurn(
  input: BotTickInput,
  map: SimMap,
  mode: GameMode,
  tick: number,
  rng: Rng,
  pressures: LanePressure[],
  nearestEnemy: { x: number; z: number } | undefined,
): BotTickPlan {
  const plan: BotTickPlan = {};
  const enemyTeam: Team = input.team === 0 ? 1 : 0;
  const enemyCore = map.cores[enemyTeam];

  let summonLane = input.rallyLane;
  let heroLane = input.rallyLane;

  if (input.allySupport && input.hasHumanHero) {
    summonLane = input.humanRallyLane;
    heroLane = input.humanRallyLane;
    plan.setRallyLane = input.humanRallyLane;
  } else {
    const attackLane = pickFocusLane(pressures, false);
    const defendLane = pickFocusLane(pressures, true);
    const underPressure = pressures.some((p) => p.allyTowerHp < 600);
    heroLane = underPressure ? defendLane : attackLane;
    summonLane = heroLane;
    plan.setRallyLane = heroLane;
  }

  const afford = (u: keyof typeof COST) => input.credits >= COST[u];
  const wave = Math.floor(tick / (20 * 22));
  const choices: ("footman" | "archer" | "knight")[] =
    input.allySupport
      ? ["footman", "archer", "footman"]
      : wave % 3 === 0
        ? ["knight", "archer", "footman"]
        : wave % 3 === 1
          ? ["archer", "archer", "footman"]
          : ["footman", "footman", "knight"];

  for (const unit of choices) {
    if (afford(unit)) {
      plan.summon = { unit, lane: summonLane };
      break;
    }
  }

  if (!input.heroAlive) return plan;

  let destX = enemyCore.x;
  let destZ = enemyCore.z;

  if (input.allySupport && input.hasHumanHero) {
    const dx = input.humanHeroX - input.heroX;
    const dz = input.humanHeroZ - input.heroZ;
    const d = Math.hypot(dx, dz);
    if (d > 14) {
      destX = input.humanHeroX + (dx / (d || 1)) * -4;
      destZ = input.humanHeroZ + (dz / (d || 1)) * -4;
    } else if (nearestEnemy) {
      destX = nearestEnemy.x;
      destZ = nearestEnemy.z;
    } else {
      const lx = map.laneX[heroLane] ?? 0;
      destX = lx;
      destZ = enemyCore.z * 0.55;
    }
  } else if (nearestEnemy) {
    destX = nearestEnemy.x;
    destZ = nearestEnemy.z;
  } else {
    const lx = map.laneX[heroLane] ?? 0;
    destX = lx + (rng() - 0.5) * 2;
    destZ = enemyCore.z * (input.team === 0 ? 0.62 : 0.62) * (input.team === 0 ? 1 : -1);
  }

  const wp = map.grid.nearestWalkable(destX, destZ);
  plan.hero = { order: "attackMove", destX: wp.x, destZ: wp.z };
  void mode;
  void teamSize;

  return plan;
}