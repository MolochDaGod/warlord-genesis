import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { EM, type StructureEntity } from "../../game/entities";
import { useGame } from "../../game/store";
import {
  ECONOMY,
  DIFFICULTY,
  MATCH,
  MOMENTUM,
  RELIC,
  COMEBACK,
  AI_MACRO,
  type DifficultyDef,
  type Faction,
} from "../../game/config";
import { enemyEliteType, enemyGrudgeFaction, resolveUnitDef } from "../../engine/grudge6";
import {
  defaultLaneDeployment,
  type LaneDeployment,
  type LaneId,
  waveTypesForLane,
} from "../../game/laneDeployment";
import {
  applySpecToSpawn,
  archeryRecipe,
  barracksRecipe,
  spawnTypeForWave,
  specModifiersFor,
} from "../../game/productionSpecs";
import { countUnitsNear, entityById, isUnit, laneBroken } from "../../game/combat";
import { tickCampRespawn } from "../../game/neutralCamps";

/**
 * Headless match loop: passive income, hero respawn, time-based wave escalation,
 * per-lane momentum, the recurring neutral relic objective, a bounded comeback
 * for the trailing side, and the reactive economy-driven enemy AI macro. Win /
 * lose by core HP is resolved in Structures.
 *
 * Ally reinforcements march on the fixed base cadence (`ECONOMY`) plus their
 * production buildings; the enemy faction is the difficulty knob — its baseline
 * cadence/squad scale from `DIFFICULTY`, and ON TOP of that it banks a treasury
 * it spends reactively (defend a threatened tower, reinforce a losing lane,
 * commit when ahead). Time escalation and lane momentum scale BOTH sides so
 * leads convert into wins and late matches accelerate.
 */
export function MatchDirector() {
  const incomeAcc = useRef(0);
  const allyTimer = useRef(4);
  const enemyTimer = useRef(4);
  const enemyPushCount = useRef(0);
  const bldTimer = useRef<{ barracks: number; archery: number }>({ barracks: 10, archery: 12 });
  const lastPhase = useRef<string>("menu");
  const deploymentRoundRef = useRef(0);
  const championsSpawnedRound = useRef(0);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const g = useGame.getState();

    if (g.phase !== "battle") {
      lastPhase.current = g.phase;
      return;
    }
    if (lastPhase.current !== "battle") {
      incomeAcc.current = 0;
      allyTimer.current = 4;
      enemyTimer.current = 4;
      enemyPushCount.current = 0;
      bldTimer.current = { barracks: 10, archery: 12 };
      deploymentRoundRef.current = 0;
      championsSpawnedRound.current = 0;
      lastPhase.current = "battle";
    }

    const diff = DIFFICULTY[g.difficulty];
    const m = EM.match;
    m.clock += dt;

    // Clash Royale–style elixir regen (royale map only).
    if (g.mapSize === "royale") {
      g.tickRoyale(dt);
    }

    // Passive income (whole credits) — player economy, unaffected by difficulty.
    // Comeback scales the trailing player's income.
    incomeAcc.current += ECONOMY.incomePerSec * dt * m.comeback.ally;
    if (incomeAcc.current >= 1) {
      const whole = Math.floor(incomeAcc.current);
      incomeAcc.current -= whole;
      g.addCredits(whole);
    }

    g.tickRespawn(dt);

    // Decay timed buffs + structure under-attack flags decay in Structures.tsx.
    m.buff.ally.timer = Math.max(0, m.buff.ally.timer - dt);
    m.buff.enemy.timer = Math.max(0, m.buff.enemy.timer - dt);

    // Recompute the bounded comeback multipliers from the core-HP deficit.
    updateComeback();
    // Relic objective lifecycle (rise → capture → buff/bounty → cooldown).
    updateRelic(dt, g);
    // Reactive enemy AI macro (treasury accrual, focus, on-demand spends).
    updateAiMacro(dt, diff, g);
    tickCampRespawn(dt);

    const round = Math.floor(m.clock / MATCH.escalationPeriod) + 1;
    if (round > deploymentRoundRef.current) {
      deploymentRoundRef.current = round;
      g.beginDeploymentRound(round);
    }
    if (round > championsSpawnedRound.current) {
      championsSpawnedRound.current = round;
      spawnLaneChampions("ally", g.laneDeployment, round);
      spawnLaneChampions("enemy", defaultLaneDeployment(enemyGrudgeFaction()), round);
    }

    // Ally reinforcements — fixed base cadence, escalation + momentum scaled.
    allyTimer.current -= dt;
    if (allyTimer.current <= 0) {
      allyTimer.current = ECONOMY.creepInterval;
      spawnAllyPush();
    }

    // Production buildings — each ally barracks / archery range auto-spawns its
    // lane creeps on its own tier-scaled cadence (player upgrades raise tier).
    (["barracks", "archery"] as const).forEach((kind) => {
      bldTimer.current[kind] -= dt;
      if (bldTimer.current[kind] <= 0) {
        const lvl = g.buildings[kind];
        const recipe = kind === "barracks" ? barracksRecipe(lvl, g.productionSpecs) : archeryRecipe(lvl, g.productionSpecs);
        bldTimer.current[kind] = recipe.interval;
        spawnBuildingCreeps(kind, recipe, g.productionSpecs);
      }
    });

    // Enemy assault — difficulty-scaled cadence, escalation + momentum stats.
    enemyTimer.current -= dt;
    if (enemyTimer.current <= 0) {
      enemyTimer.current = diff.enemyCreepInterval;
      enemyPushCount.current += 1;
      spawnEnemyPush(diff);
      const elite = enemyPushCount.current % diff.enemyEliteEveryNthPush === 0;
      if (elite) {
        spawnEnemyElite(diff);
        const eliteName = resolveUnitDef(enemyEliteType())?.name?.toUpperCase() ?? "ELITE";
        g.pushMessage(`${eliteName} MARCHES ON YOUR LANE`, "warn");
      } else {
        g.pushMessage("ENEMY REINFORCEMENTS INCOMING", "warn");
      }
    }

    // Mirror the HUD-reactive slice of EM.match into the store (change-guarded).
    const enemyCoreOpen = laneBroken("enemy");
    g.syncMatchHud({
      objectiveLabel: enemyCoreOpen
        ? "RAZE THE ENEMY CITADEL"
        : "DESTROY ENEMY TOWERS TO EXPOSE THE CITADEL",
      enemyCoreOpen,
      allyCoreExposed: laneBroken("ally"),
      relicPhase: m.relic.phase,
      relicTimer: Math.ceil(m.relic.timer),
      relicProgress: Math.round(m.relic.progress * 20) / 20,
      relicCapturer: m.relic.capturer,
      relicOwner: m.relic.owner,
      buffAllyTimer: Math.ceil(m.buff.ally.timer),
      buffEnemyTimer: Math.ceil(m.buff.enemy.timer),
      allyTech: m.allyTech,
      comebackAlly: m.comeback.ally > 1.001,
      comebackEnemy: m.comeback.enemy > 1.001,
    });
  });

  return null;
}

// --- Escalation -------------------------------------------------------------

/** Time-based stat multiplier (HP + damage) applied to BOTH factions' creeps. */
function escalationStat(): number {
  const steps = Math.floor(EM.match.clock / MATCH.escalationPeriod);
  return Math.min(MATCH.escalationStatMax, 1 + steps * MATCH.escalationStatStep);
}

/** Time-based extra creeps per lane applied to BOTH factions' waves. */
function escalationExtraCreeps(): number {
  const steps = Math.floor(EM.match.clock / MATCH.escalationPeriod);
  return Math.min(MATCH.escalationCreepMax, Math.floor(steps / MATCH.escalationStepsPerCreep));
}

/** Per-lane momentum stat bonus for the winning side (1 = none). */
function momentumStat(side: Faction, lane: number): number {
  if (side !== "ally" && side !== "enemy") return 1;
  const mom = EM.match.momentum[side][lane] ?? 0;
  return 1 + mom * MOMENTUM.statPerBreach;
}

/** Per-lane momentum extra creeps for the winning side. */
function momentumCreeps(side: Faction, lane: number): number {
  if (side !== "ally" && side !== "enemy") return 0;
  const mom = EM.match.momentum[side][lane] ?? 0;
  return mom * MOMENTUM.creepPerBreach;
}

// --- Spawns -----------------------------------------------------------------

/**
 * Spawn the player faction's baseline lane reinforcements on every lane (standard
 * and large maps). Each push sends 3 melee + 2 ranged KayKit creeps per lane,
 * scaled by escalation + ally momentum + tech HP.
 */
function spawnAllyPush() {
  const g = useGame.getState();
  const stat = escalationStat();
  const extra = escalationExtraCreeps();
  const techHp = EM.allyTechHpMult();
  for (const lane of EM.map.lanes) {
    const mStat = stat * momentumStat("ally", lane.id);
    const count = ECONOMY.creepsPerLane + extra + momentumCreeps("ally", lane.id);
    const pick = g.laneDeployment.lanes[lane.id as LaneId];
    const types = waveTypesForLane(pick, count);
    const start = lane.pts[0];
    for (let i = 0; i < count; i++) {
      const jitter = (i - (count - 1) / 2) * 1.4;
      EM.spawnUnit("ally", types[i] ?? pick.meleeCreep, start.x + jitter, start.z, {
        commandable: false,
        lane: lane.id,
        hpMult: mStat * techHp,
        dmgMult: mStat,
      });
    }
  }
}

/** Spawn the enemy faction's lane assault: difficulty + escalation + momentum. */
function spawnEnemyPush(diff: DifficultyDef) {
  const enemyDep = defaultLaneDeployment(enemyGrudgeFaction());
  const stat = escalationStat();
  const extra = escalationExtraCreeps();
  for (const lane of EM.map.lanes) {
    const mStat = stat * momentumStat("enemy", lane.id);
    const count = diff.enemyCreepsPerLane + extra + momentumCreeps("enemy", lane.id);
    const pick = enemyDep.lanes[lane.id as LaneId];
    const types = waveTypesForLane(pick, count);
    const end = lane.pts[lane.pts.length - 1];
    for (let i = 0; i < count; i++) {
      const jitter = (i - (count - 1) / 2) * 1.4;
      EM.spawnUnit("enemy", types[i] ?? pick.meleeCreep, end.x + jitter, end.z, {
        commandable: false,
        lane: lane.id,
        hpMult: diff.enemyHpMult * mStat,
        dmgMult: diff.enemyDmgMult * mStat,
      });
    }
  }
}

/** Spawn lane guard champions (1 melee + 1 ranged GRUDGE6 NPC per lane per round). */
function spawnLaneChampions(side: Faction, dep: LaneDeployment, round: number) {
  const stat = escalationStat() * (1 + (round - 1) * 0.04);
  const techHp = side === "ally" ? EM.allyTechHpMult() : 1;
  const hpMult = 1.7 * stat * techHp;
  const dmgMult = 1.5 * stat;
  const { meleeGuard, rangedGuard } = dep.heroes;
  for (const lane of EM.map.lanes) {
    const anchor = side === "ally" ? lane.pts[0] : lane.pts[lane.pts.length - 1];
    const label = `R${round} Guard`;
    EM.spawnUnit(side, meleeGuard, anchor.x - 2.2, anchor.z, {
      commandable: false,
      isLaneGuard: true,
      lane: lane.id,
      hpMult,
      dmgMult,
      specLabel: label,
    });
    EM.spawnUnit(side, rangedGuard, anchor.x + 2.2, anchor.z, {
      commandable: false,
      isLaneGuard: true,
      lane: lane.id,
      hpMult: hpMult * 0.92,
      dmgMult,
      specLabel: label,
    });
  }
}

/** Spawn one wave from an ally production building down its own lane. */
function spawnBuildingCreeps(
  kind: "barracks" | "archery",
  recipe: ReturnType<typeof barracksRecipe>,
  specs: import("../../game/productionSpecs").ProductionSpecs,
) {
  const b = EM.map.buildings.find((x) => x.faction === "ally" && x.kind === kind);
  if (!b) return;
  const mStat = escalationStat() * momentumStat("ally", b.lane);
  const techHp = EM.allyTechHpMult();
  // Spawn at the lane mouth (walkable) — building GLBs may sit on a ridge shoulder.
  const lane = EM.map.lanes[b.lane];
  const spawn = lane ? lane.pts[0] : { x: b.x, z: b.z };
  let idx = 0;
  for (const wave of recipe.waves) {
    const spec = specModifiersFor(specs, wave.specKey);
    const typeId = spawnTypeForWave(wave);
    for (let n = 0; n < wave.count; n++) {
      const jitter = (idx - (recipe.waves.reduce((a, w) => a + w.count, 0) - 1) / 2) * 1.4;
      const applied = applySpecToSpawn(
        { hpMult: recipe.tierStatMult * mStat * techHp, dmgMult: recipe.tierStatMult * mStat },
        spec,
      );
      EM.spawnUnit("ally", typeId, spawn.x + jitter, spawn.z, {
        commandable: false,
        lane: b.lane,
        hpMult: applied.hpMult,
        dmgMult: applied.dmgMult,
        specLabel: applied.specLabel,
        skills: applied.skills,
        specSpeedMult: spec.speedMult,
        specRangeMult: spec.rangeMult,
        specAttackRateMult: spec.attackRateMult,
      });
      idx++;
    }
  }
}

/** Spawn a single enemy elite down the center lane: difficulty + escalation. */
function spawnEnemyElite(diff: DifficultyDef) {
  const lane = EM.map.lanes[1]; // center
  const stat = escalationStat() * momentumStat("enemy", lane.id);
  const end = lane.pts[lane.pts.length - 1];
  EM.spawnUnit("enemy", enemyEliteType(), end.x, end.z, {
    commandable: false,
    lane: lane.id,
    hpMult: diff.enemyHpMult * stat,
    dmgMult: diff.enemyDmgMult * stat,
  });
}

/** Spawn an on-demand enemy defensive squad clustered at a threatened structure. */
function spawnEnemyDefenders(at: StructureEntity, count: number, diff: DifficultyDef) {
  const enemyDep = defaultLaneDeployment(enemyGrudgeFaction());
  const pick = enemyDep.lanes[(at.lane >= 0 ? at.lane : 1) as LaneId];
  const types = waveTypesForLane(pick, count);
  const stat = escalationStat();
  for (let i = 0; i < count; i++) {
    const ang = (i / Math.max(1, count)) * Math.PI * 2;
    const ox = Math.cos(ang) * 3;
    const oz = Math.sin(ang) * 3;
    EM.spawnUnit("enemy", types[i] ?? pick.meleeCreep, at.pos.x + ox, at.pos.z + oz, {
      commandable: false,
      lane: at.lane >= 0 ? at.lane : 1,
      hpMult: diff.enemyHpMult * stat,
      dmgMult: diff.enemyDmgMult * stat,
    });
  }
}

/** Spawn an extra enemy push concentrated in the AI's focus lane. */
function spawnEnemyFocusPush(lane: number, count: number, diff: DifficultyDef) {
  const laneDef = EM.map.lanes[lane];
  if (!laneDef) return;
  const enemyDep = defaultLaneDeployment(enemyGrudgeFaction());
  const pick = enemyDep.lanes[lane as LaneId];
  const types = waveTypesForLane(pick, count);
  const stat = escalationStat() * momentumStat("enemy", lane);
  const end = laneDef.pts[laneDef.pts.length - 1];
  for (let i = 0; i < count; i++) {
    const jitter = (i - (count - 1) / 2) * 1.4;
    EM.spawnUnit("enemy", types[i] ?? pick.meleeCreep, end.x + jitter, end.z, {
      commandable: false,
      lane,
      hpMult: diff.enemyHpMult * stat,
      dmgMult: diff.enemyDmgMult * stat,
    });
  }
}

// --- Comeback ---------------------------------------------------------------

/** Map a core-HP-fraction deficit to a bounded catch-up multiplier (>= 1). */
function comebackMult(deficit: number): number {
  if (deficit <= COMEBACK.threshold) return 1;
  const span = COMEBACK.fullDeficit - COMEBACK.threshold;
  const t = Math.min(1, (deficit - COMEBACK.threshold) / Math.max(1e-3, span));
  return 1 + t * (COMEBACK.maxMult - 1);
}

function updateComeback() {
  const a = EM.allyCore;
  const e = EM.enemyCore;
  if (!a || !e) return;
  const allyFrac = a.hp / a.maxHp;
  const enemyFrac = e.hp / e.maxHp;
  EM.match.comeback.ally = comebackMult(enemyFrac - allyFrac);
  EM.match.comeback.enemy = comebackMult(allyFrac - enemyFrac);
}

// --- Relic ------------------------------------------------------------------

function updateRelic(dt: number, g: ReturnType<typeof useGame.getState>) {
  const r = EM.match.relic;
  if (r.phase === "dormant" || r.phase === "cooldown") {
    r.timer -= dt;
    if (r.timer <= 0) {
      r.phase = "active";
      r.timer = RELIC.activeTimeout;
      r.progress = 0;
      r.capturer = null;
      g.pushMessage("A RELIC HAS RISEN AT THE CENTER", "good");
    }
    return;
  }

  // Active: tally uncontested presence and accrue / decay capture.
  r.timer -= dt;
  let allyNear = countUnitsNear("ally", r.pos.x, r.pos.z, RELIC.radius);
  const enemyNear = countUnitsNear("enemy", r.pos.x, r.pos.z, RELIC.radius);
  if (!g.heroDead) {
    const dx = EM.playerPos.x - r.pos.x;
    const dz = EM.playerPos.z - r.pos.z;
    if (dx * dx + dz * dz <= RELIC.radius * RELIC.radius) allyNear++;
  }
  const contender: Faction | null =
    allyNear > 0 && enemyNear === 0 ? "ally" : enemyNear > 0 && allyNear === 0 ? "enemy" : null;

  if (contender) {
    if (r.capturer !== contender) {
      r.capturer = contender;
      r.progress = 0;
    }
    r.progress += dt / RELIC.captureTime;
    if (r.progress >= 1) {
      claimRelic(contender, g);
      return;
    }
  } else {
    r.capturer = null;
    r.progress = Math.max(0, r.progress - dt / RELIC.captureTime);
  }

  if (r.timer <= 0) {
    r.phase = "cooldown";
    r.timer = RELIC.interval;
    r.progress = 0;
    r.capturer = null;
    g.pushMessage("THE RELIC HAS FADED", "warn");
  }
}

function claimRelic(faction: Faction, g: ReturnType<typeof useGame.getState>) {
  const r = EM.match.relic;
  r.phase = "cooldown";
  r.timer = RELIC.interval;
  r.progress = 0;
  r.capturer = null;
  r.owner = faction;
  if (faction !== "ally" && faction !== "enemy") return;
  const buff = EM.match.buff[faction];
  buff.mult = RELIC.buffDmgMult;
  buff.timer = RELIC.buffDuration;
  if (faction === "ally") {
    const bounty = Math.round(RELIC.allyBounty * EM.match.comeback.ally);
    g.addCredits(bounty);
    g.addScore(bounty);
    g.pushMessage("RELIC CLAIMED — YOUR ARMY IS EMPOWERED", "good");
  } else {
    EM.match.ai.treasury += RELIC.enemyTreasury * EM.match.comeback.enemy;
    g.pushMessage("THE ENEMY SEIZED THE RELIC", "danger");
  }
}

// --- Reactive AI macro ------------------------------------------------------

function updateAiMacro(dt: number, diff: DifficultyDef, g: ReturnType<typeof useGame.getState>) {
  const ai = EM.match.ai;
  // Bank treasury; comeback boosts the trailing AI.
  ai.treasury += diff.aiTreasuryPerSec * dt * EM.match.comeback.enemy;
  ai.reactionTimer -= dt;
  ai.pushTimer -= dt;

  if (ai.reactionTimer <= 0) {
    ai.reactionTimer = diff.aiReactionTime;
    decideFocus(diff);
  }

  if (ai.pushTimer > 0) return;

  // On-demand defenders for a flagged threatened structure.
  if (ai.defendStructureId != null && ai.treasury >= AI_MACRO.defendCost) {
    const s = entityById(ai.defendStructureId);
    if (s && !isUnit(s) && s.alive && s.faction === "enemy") {
      ai.treasury -= AI_MACRO.defendCost;
      ai.pushTimer = AI_MACRO.reactiveCooldown;
      const squad = AI_MACRO.defendSquad + Math.round(diff.aiAggression * 2);
      spawnEnemyDefenders(s, squad, diff);
      g.pushMessage("THE ENEMY RALLIES TO DEFEND", "warn");
      return;
    }
    ai.defendStructureId = null;
  }

  // Otherwise commit a concentrated push down the focus lane.
  if (ai.focusLane >= 0 && ai.treasury >= AI_MACRO.pushCost) {
    ai.treasury -= AI_MACRO.pushCost;
    ai.pushTimer = AI_MACRO.reactiveCooldown;
    spawnEnemyFocusPush(ai.focusLane, diff.aiFocusCreeps, diff);
  }
}

/** Re-evaluate the AI's lane focus + defend target from the current board. */
function decideFocus(diff: DifficultyDef) {
  const ai = EM.match.ai;
  ai.defendStructureId = null;
  ai.focusLane = -1;

  // Priority 1 — DEFEND the most-threatened enemy structure (chance ∝ defendBias).
  const threat = mostThreatenedEnemyStructure();
  if (threat && Math.random() < diff.aiDefendBias) {
    ai.defendStructureId = threat.id;
    ai.focusLane = threat.lane;
    return;
  }

  // Priority 2 — REINFORCE the lane we're losing (the player has razed towers).
  const losing = laneWithMaxMomentum(EM.match.momentum.ally);
  if (losing.value > 0) {
    ai.focusLane = losing.lane;
    return;
  }

  // Priority 3 — COMMIT when ahead: press the weakest ally lane (chance ∝ aggression).
  if (enemyIsAhead() && Math.random() < diff.aiAggression) {
    ai.focusLane = weakestAllyLane();
  }
}

/** Lowest-HP-fraction alive enemy structure currently flagged under attack. */
function mostThreatenedEnemyStructure(): StructureEntity | null {
  let best: StructureEntity | null = null;
  let bestFrac = Infinity;
  for (const s of EM.structures) {
    if (!s.alive || s.faction !== "enemy" || s.underAttack <= 0) continue;
    const frac = s.hp / s.maxHp;
    if (frac < bestFrac) {
      bestFrac = frac;
      best = s;
    }
  }
  return best;
}

function laneWithMaxMomentum(arr: number[]): { lane: number; value: number } {
  let lane = -1;
  let value = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > value) {
      value = arr[i];
      lane = i;
    }
  }
  return { lane, value };
}

/** True when the enemy's Citadel is healthier than the player's by a clear margin. */
function enemyIsAhead(): boolean {
  const a = EM.allyCore;
  const e = EM.enemyCore;
  if (!a || !e) return false;
  return e.hp / e.maxHp - a.hp / a.maxHp > 0.1;
}

/** The ally lane with the least surviving tower HP (most pressed / broken). */
function weakestAllyLane(): number {
  let lane = 0;
  let least = Infinity;
  for (let i = 0; i < EM.match.gate.ally.length; i++) {
    const gate = EM.match.gate.ally[i];
    let hp = 0;
    if (gate.outer && gate.outer.alive) hp += gate.outer.hp;
    if (gate.inner && gate.inner.alive) hp += gate.inner.hp;
    if (hp < least) {
      least = hp;
      lane = i;
    }
  }
  return lane;
}
