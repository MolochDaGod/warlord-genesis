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
  asLaneDeployment,
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
    if (g.mapSize === "royale") g.tickRoyale(dt);
    incomeAcc.current += ECONOMY.incomePerSec * dt * m.comeback.ally;
    if (incomeAcc.current >= 1) {
      const whole = Math.floor(incomeAcc.current);
      incomeAcc.current -= whole;
      g.addCredits(whole);
    }
    g.tickRespawn(dt);
    m.buff.ally.timer = Math.max(0, m.buff.ally.timer - dt);
    m.buff.enemy.timer = Math.max(0, m.buff.enemy.timer - dt);
    updateComeback();
    updateRelic(dt, g);
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

    allyTimer.current -= dt;
    if (allyTimer.current <= 0) {
      allyTimer.current = ECONOMY.creepInterval;
      spawnAllyPush();
    }
    (["barracks", "archery"] as const).forEach((kind) => {
      bldTimer.current[kind] -= dt;
      if (bldTimer.current[kind] <= 0) {
        const lvl = g.buildings[kind];
        const recipe = kind === "barracks" ? barracksRecipe(lvl, g.productionSpecs) : archeryRecipe(lvl, g.productionSpecs);
        bldTimer.current[kind] = recipe.interval;
        spawnBuildingCreeps(kind, recipe, g.productionSpecs);
      }
    });
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

function escalationStat(): number {
  const steps = Math.floor(EM.match.clock / MATCH.escalationPeriod);
  return Math.min(MATCH.escalationStatMax, 1 + steps * MATCH.escalationStatStep);
}
function escalationExtraCreeps(): number {
  const steps = Math.floor(EM.match.clock / MATCH.escalationPeriod);
  return Math.min(MATCH.escalationCreepMax, Math.floor(steps / MATCH.escalationStepsPerCreep));
}
function momentumStat(side: Faction, lane: number): number {
  if (side !== "ally" && side !== "enemy") return 1;
  const mom = EM.match.momentum[side][lane] ?? 0;
  return 1 + mom * MOMENTUM.statPerBreach;
}
function momentumCreeps(side: Faction, lane: number): number {
  if (side !== "ally" && side !== "enemy") return 0;
  const mom = EM.match.momentum[side][lane] ?? 0;
  return mom * MOMENTUM.creepPerBreach;
}

function spawnAllyPush() {
  const g = useGame.getState();
  const stat = escalationStat();
  const extra = escalationExtraCreeps();
  const techHp = EM.allyTechHpMult();
  for (const lane of EM.map.lanes) {
    const mStat = stat * momentumStat("ally", lane.id);
    const count = ECONOMY.creepsPerLane + extra + momentumCreeps("ally", lane.id);
    const pick = asLaneDeployment(g.laneDeployment).lanes[lane.id as LaneId];
    const types = waveTypesForLane(pick, count);
    const start = lane.pts[0];
    for (let i = 0; i < count; i++) {
      const jitter = (i - (count - 1) / 2) * 1.4;
      EM.spawnUnit("ally", types[i] ?? pick.meleeCreep, start.x + jitter, start.z, {
        commandable: false, lane: lane.id, hpMult: mStat * techHp, dmgMult: mStat,
      });
    }
  }
}

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
        commandable: false, lane: lane.id,
        hpMult: diff.enemyHpMult * mStat, dmgMult: diff.enemyDmgMult * mStat,
      });
    }
  }
}

function spawnLaneChampions(side: Faction, dep: LaneDeployment, round: number) {
  const stat = escalationStat() * (1 + (round - 1) * 0.04);
  const techHp = side === "ally" ? EM.allyTechHpMult() : 1;
  const hpMult = 1.7 * stat * techHp;
  const dmgMult = 1.5 * stat;
  const { meleeGuard, rangedGuard } = asLaneDeployment(dep).heroes;
  for (const lane of EM.map.lanes) {
    const anchor = side === "ally" ? lane.pts[0] : lane.pts[lane.pts.length - 1];
    const label = `R${round} Guard`;
    EM.spawnUnit(side, meleeGuard, anchor.x - 2.2, anchor.z, {
      commandable: false, isLaneGuard: true, lane: lane.id, hpMult, dmgMult, specLabel: label,
    });
    EM.spawnUnit(side, rangedGuard, anchor.x + 2.2, anchor.z, {
      commandable: false, isLaneGuard: true, lane: lane.id, hpMult: hpMult * 0.92, dmgMult, specLabel: label,
    });
  }
}

function spawnBuildingCreeps(
  kind: "barracks" | "archery",
  recipe: ReturnType<typeof barracksRecipe>,
  specs: import("../../game/productionSpecs").ProductionSpecs,
) {
  const b = EM.map.buildings.find((x) => x.faction === "ally" && x.kind === kind);
  if (!b) return;
  const mStat = escalationStat() * momentumStat("ally", b.lane);
  const techHp = EM.allyTechHpMult();
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
        commandable: false, lane: b.lane,
        hpMult: applied.hpMult, dmgMult: applied.dmgMult,
        specLabel: applied.specLabel, skills: applied.skills,
        specSpeedMult: spec.speedMult, specRangeMult: spec.rangeMult,
        specAttackRateMult: spec.attackRateMult,
      });
      idx++;
    }
  }
}

function spawnEnemyElite(diff: DifficultyDef) {
  const lane = EM.map.lanes[1];
  const stat = escalationStat() * momentumStat("enemy", lane.id);
  const end = lane.pts[lane.pts.length - 1];
  EM.spawnUnit("enemy", enemyEliteType(), end.x, end.z, {
    commandable: false, lane: lane.id,
    hpMult: diff.enemyHpMult * stat, dmgMult: diff.enemyDmgMult * stat,
  });
}

function spawnEnemyDefenders(at: StructureEntity, count: number, diff: DifficultyDef) {
  const enemyDep = defaultLaneDeployment(enemyGrudgeFaction());
  const pick = enemyDep.lanes[(at.lane >= 0 ? at.lane : 1) as LaneId];
  const types = waveTypesForLane(pick, count);
  const stat = escalationStat();
  for (let i = 0; i < count; i++) {
    const ang = (i / Math.max(1, count)) * Math.PI * 2;
    EM.spawnUnit("enemy", types[i] ?? pick.meleeCreep, at.pos.x + Math.cos(ang) * 3, at.pos.z + Math.sin(ang) * 3, {
      commandable: false, lane: at.lane >= 0 ? at.lane : 1,
      hpMult: diff.enemyHpMult * stat, dmgMult: diff.enemyDmgMult * stat,
    });
  }
}

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
      commandable: false, lane,
      hpMult: diff.enemyHpMult * stat, dmgMult: diff.enemyDmgMult * stat,
    });
  }
}

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
  EM.match.comeback.ally = comebackMult(e.hp / e.maxHp - a.hp / a.maxHp);
  EM.match.comeback.enemy = comebackMult(a.hp / a.maxHp - e.hp / e.maxHp);
}

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

function updateAiMacro(dt: number, diff: DifficultyDef, g: ReturnType<typeof useGame.getState>) {
  const ai = EM.match.ai;
  ai.treasury += diff.aiTreasuryPerSec * dt * EM.match.comeback.enemy;
  ai.reactionTimer -= dt;
  ai.pushTimer -= dt;
  if (ai.reactionTimer <= 0) {
    ai.reactionTimer = diff.aiReactionTime;
    decideFocus(diff);
  }
  if (ai.pushTimer > 0) return;
  if (ai.defendStructureId != null && ai.treasury >= AI_MACRO.defendCost) {
    const s = entityById(ai.defendStructureId);
    if (s && !isUnit(s) && s.alive && s.faction === "enemy") {
      ai.treasury -= AI_MACRO.defendCost;
      ai.pushTimer = AI_MACRO.reactiveCooldown;
      spawnEnemyDefenders(s, AI_MACRO.defendSquad + Math.round(diff.aiAggression * 2), diff);
      g.pushMessage("THE ENEMY RALLIES TO DEFEND", "warn");
      return;
    }
    ai.defendStructureId = null;
  }
  if (ai.focusLane >= 0 && ai.treasury >= AI_MACRO.pushCost) {
    ai.treasury -= AI_MACRO.pushCost;
    ai.pushTimer = AI_MACRO.reactiveCooldown;
    spawnEnemyFocusPush(ai.focusLane, diff.aiFocusCreeps, diff);
  }
}

function decideFocus(diff: DifficultyDef) {
  const ai = EM.match.ai;
  ai.defendStructureId = null;
  ai.focusLane = -1;
  const threat = mostThreatenedEnemyStructure();
  if (threat && Math.random() < diff.aiDefendBias) {
    ai.defendStructureId = threat.id;
    ai.focusLane = threat.lane;
    return;
  }
  const losing = laneWithMaxMomentum(EM.match.momentum.ally);
  if (losing.value > 0) {
    ai.focusLane = losing.lane;
    return;
  }
  if (enemyIsAhead() && Math.random() < diff.aiAggression) {
    ai.focusLane = weakestAllyLane();
  }
}

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
function enemyIsAhead(): boolean {
  const a = EM.allyCore;
  const e = EM.enemyCore;
  if (!a || !e) return false;
  return e.hp / e.maxHp - a.hp / a.maxHp > 0.1;
}
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
