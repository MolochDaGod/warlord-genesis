// ---------------------------------------------------------------------------
// Neutral jungle camps — spawn, leash AI hooks, kill rewards, and respawn.
// ---------------------------------------------------------------------------

import { EM, type UnitEntity } from "./entities";
import { NEUTRAL_CAMPS, type CampTier } from "./config";
import { useGame } from "./store";
import type { CampPlacement } from "./mapgen";

export interface NeutralCampState {
  id: number;
  x: number;
  z: number;
  tier: CampTier;
  label: string;
  cleared: boolean;
  /** Counts down to respawn after the camp is cleared. */
  respawnTimer: number;
  unitIds: number[];
}

function tierDef(tier: CampTier) {
  return NEUTRAL_CAMPS.tiers[tier];
}

/** Spawn all map camps at match start (called from EntityManager.buildBattlefield). */
export function spawnMapCamps(placements: CampPlacement[]): void {
  EM.match.camps = [];
  for (const p of placements) {
    spawnCamp(p.x, p.z, p.tier);
  }
}

/** Spawn or repopulate one camp and its defenders. */
export function spawnCamp(x: number, z: number, tier: CampTier): NeutralCampState {
  const def = tierDef(tier);
  const camp: NeutralCampState = {
    id: EM.id(),
    x,
    z,
    tier,
    label: def.label,
    cleared: false,
    respawnTimer: 0,
    unitIds: [],
  };
  EM.match.camps.push(camp);

  const rnd = (n: number) => ((camp.id * 17 + n * 31) % 100) / 100;
  let slot = 0;
  for (const wave of def.spawns) {
    for (let i = 0; i < wave.count; i++) {
      const ang = rnd(slot++) * Math.PI * 2;
      const rad = 2.2 + rnd(slot) * 2.8;
      const ux = x + Math.cos(ang) * rad;
      const uz = z + Math.sin(ang) * rad;
      const wx = EM.map.grid.nearestWalkable(ux, uz);
      const u = EM.spawnUnit("neutral", wave.typeId, wx.x, wx.z, {
        lane: -1,
        campId: camp.id,
      });
      camp.unitIds.push(u.id);
    }
  }
  return camp;
}

export function campById(id: number | undefined): NeutralCampState | undefined {
  if (id == null) return undefined;
  return EM.match.camps.find((c) => c.id === id);
}

/** Called when a neutral defender dies — per-kill loot + camp-clear bounty. */
export function onNeutralKilled(unit: UnitEntity): void {
  const g = useGame.getState();
  if (g.phase !== "battle") return;

  const reward = Math.round(unit.def.reward * EM.match.comeback.ally);
  g.addCredits(reward);
  g.addScore(reward);
  g.addHeroXp(Math.round(reward * 0.75));

  const camp = campById(unit.campId);
  if (!camp || camp.cleared) return;

  camp.unitIds = camp.unitIds.filter((id) => {
    const u = EM.units.find((e) => e.id === id);
    return u?.alive;
  });

  if (camp.unitIds.length > 0) return;

  const def = tierDef(camp.tier);
  camp.cleared = true;
  camp.respawnTimer = NEUTRAL_CAMPS.respawnDelay;
  const bonus = Math.round(def.clearBonus * EM.match.comeback.ally);
  g.addCredits(bonus);
  g.addScore(bonus);
  g.addHeroXp(def.clearXp);
  g.pushMessage(`${def.label.toUpperCase()} CLEARED — +${bonus} ◈`, "good");
}

/** Advance respawn timers; repopulate cleared camps after the delay. */
export function tickCampRespawn(dt: number): void {
  for (const camp of EM.match.camps) {
    if (!camp.cleared) continue;
    camp.respawnTimer -= dt;
    if (camp.respawnTimer > 0) continue;
    camp.cleared = false;
    camp.unitIds = [];
    const def = tierDef(camp.tier);
    let slot = 0;
    const rnd = (n: number) => ((camp.id * 13 + n * 29 + Math.floor(EM.match.clock)) % 100) / 100;
    for (const wave of def.spawns) {
      for (let i = 0; i < wave.count; i++) {
        const ang = rnd(slot++) * Math.PI * 2;
        const rad = 2.2 + rnd(slot) * 2.8;
        const ux = camp.x + Math.cos(ang) * rad;
        const uz = camp.z + Math.sin(ang) * rad;
        const wx = EM.map.grid.nearestWalkable(ux, uz);
        const u = EM.spawnUnit("neutral", wave.typeId, wx.x, wx.z, {
          lane: -1,
          campId: camp.id,
        });
        camp.unitIds.push(u.id);
      }
    }
  }
}