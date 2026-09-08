import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EM, type StructureEntity, type UnitEntity } from "../../game/entities";
import { useGame } from "../../game/store";
import { ENEMY_HERO, DIFFICULTY, SLAM, type DifficultyDef } from "../../game/config";
import { Grudge6HeroRig } from "../../engine/grudge6HeroRig";
import { advancePathIndex, findPath, slideStep, type PathCostFn } from "../../game/pathfind";
import { avoidHeading, hostileTowerCost } from "../../game/navSteer";
import {
  type CombatEntity,
  countUnitsNear,
  distXZ,
  entityById,
  findTarget,
  isAttackable,
  isUnit,
  meleeConeHit,
  structRadius,
} from "../../game/combat";
import { abilityPoolForHero, filledLoadout, type LoadoutAbility } from "../../game/abilityLoadout";
import { apiWeaponForLoadout, type WarlordWeaponSkill } from "../../game/warlordWeaponSkills";
import { HERO_DASH, performHeroDashVfx, performHeroSlam, performHeroWeaponSkill } from "../../game/heroActions";
import { loadoutHasRanged, planHeroCast, tickAbilityCds } from "../../game/heroBrain";
import { useRoster } from "../../game/roster";
import { useMeta } from "../../game/metaProgression";
const _dir = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _flow = { x: 0, z: 0 };

/**
 * The enemy faction's warlord — a hero that mirrors the player's. It lives in
 * `EM.units` (faction "enemy", `isHero`) so every faction-aware system already
 * targets and damages it; this component owns its AI, movement, attacks, death/
 * respawn and rendering (Units.tsx skips `isHero` entities in all its passes).
 *
 * It reuses the procedural Animator rig and the shared pathfinding flow-fields.
 * Its behaviour is deterministic (no RNG) so the same controller can later drive
 * a PvP bot. Tactics, in priority order:
 *  - EXECUTE: a wounded player (HP below a difficulty fraction) is hunted beyond
 *    normal aggro and even through a wound that would otherwise force a retreat.
 *  - RETREAT: pull back toward its own core when wounded (below the difficulty
 *    threshold) and not executing a kill.
 *  - ENGAGE: acquire the nearest hostile (units / structures) in aggro range.
 *  - PUSH: with no immediate threat, pick the weakest / most exposed ally lane
 *    structure as an objective, A*-path to it, but COORDINATE first — stage a
 *    short way back and wait for enough friendly creeps to mass before diving a
 *    defended objective (an exposed / undefended one is razed immediately).
 *  - SKILLS: same 6-slot loadout as the player (dash, slam, weapon, class).
 */
export function EnemyHero() {
  const { camera } = useThree();
  const animatorRef = useRef<Grudge6HeroRig | null>(null);
  const [ready, setReady] = useState(false);
  const barRef = useRef<THREE.Group>(null);
  const fillRef = useRef<THREE.Mesh>(null);

  const heroRef = useRef<UnitEntity | null>(null);
  const targetId = useRef<number | null>(null);
  const attackCd = useRef(0);
  const respawn = useRef(0);
  const dying = useRef(false);
  const lastPhase = useRef<string>("menu");
  const auraRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const crownRef = useRef<THREE.Group>(null);
  const auraClock = useRef(0);
  const groundCorr = useRef(0); // smoothed vertical correction to plant the feet on terrain

  // --- Tactical AI state -------------------------------------------------
  const objectiveId = useRef<number | null>(null); // chosen ally structure to push
  const retargetTimer = useRef(0); // hysteresis: seconds until next objective re-eval
  const committed = useRef(false); // has the warlord committed to diving the objective?
  const stageTimer = useRef(0); // seconds left to wait for the warband before pushing anyway
  const navPath = useRef<{ x: number; z: number }[] | null>(null); // cached A* waypoints
  const navIdx = useRef(0); // current waypoint along navPath
  const navGoal = useRef<{ x: number; z: number } | null>(null); // goal navPath was computed for
  const repathTimer = useRef(0); // throttle A* recomputes
  const slamCd = useRef(0); // kept in sync with loadout slam id
  const skillCd = useRef<Record<string, number>>({});
  const dashTimer = useRef(0);
  const dashDir = useRef({ x: 0, z: 0 });
  const stuckT = useRef(0);
  const lastNavX = useRef(0);
  const lastNavZ = useRef(0);
  const lastCast = useRef(0);
  const executing = useRef(false); // currently hunting a low-HP player (for the message)
  const retreating = useRef(false); // committed to a retreat (hysteresis-latched)
  const retreatHold = useRef(0); // min seconds to stay committed to the current retreat decision
  const loadoutCache = useRef<LoadoutAbility[]>([]);
  const loadoutKey = useRef("");

  /** Reset all per-life tactical state (spawn / respawn). */
  const resetTactics = () => {
    targetId.current = null;
    attackCd.current = 0;
    objectiveId.current = null;
    retargetTimer.current = 0;
    committed.current = false;
    stageTimer.current = 0;
    navPath.current = null;
    navIdx.current = 0;
    navGoal.current = null;
    repathTimer.current = 0;
    slamCd.current = 0;
    skillCd.current = {};
    dashTimer.current = 0;
    stuckT.current = 0;
    lastCast.current = 0;
    executing.current = false;
    retreating.current = false;
    retreatHold.current = 0;
  };

  /**
   * Choose which ally structure to push: the weakest / most exposed lane
   * objective, scored by HP fraction, defender count and distance (lower is more
   * attractive). Hysteresis keeps the current objective until it dies or the
   * re-eval timer elapses, so the warlord doesn't dither between similar towers.
   */
  const pickObjective = (hero: UnitEntity, diff: DifficultyDef): StructureEntity | null => {
    const cur = objectiveId.current != null ? entityById(objectiveId.current) : null;
    const curValid =
      !!cur && cur.alive && !isUnit(cur) && cur.faction === "ally" && isAttackable(cur);
    if (curValid && retargetTimer.current > 0) return cur as StructureEntity;
    retargetTimer.current = ENEMY_HERO.retargetInterval;

    // DEFEND: when the faction AI has flagged one of its own structures as
    // threatened, the warlord prioritises the nearest ATTACKABLE ally structure
    // close to that focus so it joins the defense rather than diving elsewhere.
    const defendId = EM.match.ai.defendStructureId;
    if (defendId != null) {
      const focus = entityById(defendId);
      if (focus && !isUnit(focus) && focus.faction === "enemy") {
        let near: StructureEntity | null = null;
        let nearD = Infinity;
        for (const s of EM.structures) {
          if (!s.alive || s.faction !== "ally" || !isAttackable(s)) continue;
          const d = distXZ(focus.pos, s.pos.x, s.pos.z);
          if (d < nearD) {
            nearD = d;
            near = s;
          }
        }
        if (near && near.id !== objectiveId.current) {
          objectiveId.current = near.id;
          committed.current = false;
          stageTimer.current = diff.heroStageTimeout;
          navPath.current = null;
          navGoal.current = null;
        }
        if (near) return near;
      }
    }

    let best: StructureEntity | null = null;
    let bestScore = Infinity;
    for (const s of EM.structures) {
      if (!s.alive || s.faction !== "ally" || !isAttackable(s)) continue;
      const hpFrac = s.hp / s.maxHp;
      const defenders = countUnitsNear("ally", s.pos.x, s.pos.z, ENEMY_HERO.defenderRadius);
      const dist = distXZ(hero.pos, s.pos.x, s.pos.z);
      const kindBias = s.kind === "core" ? 0.15 : s.kind === "tower" ? 0 : 0.1;
      // Bias toward the faction AI's focus lane so the warlord concentrates force.
      const focusBias = EM.match.ai.focusLane >= 0 && s.lane === EM.match.ai.focusLane ? -0.15 : 0;
      const score = hpFrac + defenders * 0.12 + dist / 120 + kindBias + focusBias;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best && best.id !== objectiveId.current) {
      // New objective — restart the staging / commit cycle.
      objectiveId.current = best.id;
      committed.current = false;
      stageTimer.current = diff.heroStageTimeout;
      navPath.current = null;
      navGoal.current = null;
    }
    return best;
  };

  /**
   * Follow a cached A* path toward `goal`, returning the next waypoint to steer
   * at. Recomputes when the path is missing / consumed, the goal has shifted, or
   * the throttle elapses; falls back to straight-line steering if no path exists
   * (the caller's wall-slide handles obstacles).
   */
  const navTo = (hero: UnitEntity, goal: { x: number; z: number }, diving = false): { x: number; z: number } => {
    const grid = EM.map.grid;
    const moved = navGoal.current
      ? Math.hypot(goal.x - navGoal.current.x, goal.z - navGoal.current.z)
      : Infinity;
    const p0 = navPath.current;
    const stuck = stuckT.current > 0.55;
    const needRepath =
      !p0 || navIdx.current >= p0.length || moved > 4 || repathTimer.current <= 0 || stuck;
    if (needRepath) {
      repathTimer.current = ENEMY_HERO.repathInterval;
      if (stuck) stuckT.current = 0;
      const extra: PathCostFn = hostileTowerCost(hero.faction, diving);
      const snap = grid.nearestWalkable(goal.x, goal.z, 10);
      const p = findPath(grid, hero.pos.x, hero.pos.z, snap.x, snap.z, extra);
      if (p && p.length) {
        navPath.current = p;
        navIdx.current = 0;
        navGoal.current = { x: goal.x, z: goal.z };
      } else {
        navPath.current = null;
        navGoal.current = null;
      }
    }
    const p = navPath.current;
    if (!p) {
      const ff = diving ? EM.map.flowToAllyCore : null;
      if (ff && ff.sampleDir(hero.pos.x, hero.pos.z, _flow)) {
        return { x: hero.pos.x + _flow.x * 3, z: hero.pos.z + _flow.z * 3 };
      }
      return goal;
    }
    navIdx.current = advancePathIndex(grid, hero.pos.x, hero.pos.z, p, navIdx.current);
    return p[navIdx.current];
  };

  /** Same class / weapons / card-level pool as the player; empty slots are filled. */
  const enemyLoadout = (): LoadoutAbility[] => {
    try {
      const r = useRoster.getState();
      const cardLevel = Math.max(1, useMeta.getState().characterLevel(r.prefabId));
      const key = `${r.classId}|${r.meleeId}|${r.rangedId}|${cardLevel}|${(r.abilitySlots ?? []).join(",")}`;
      if (key === loadoutKey.current && loadoutCache.current.length) return loadoutCache.current;
      const pool = abilityPoolForHero({
        classId: r.classId,
        meleeId: r.meleeId,
        rangedId: r.rangedId,
        cardLevel,
      });
      const out = filledLoadout(r.abilitySlots, pool, cardLevel);
      loadoutKey.current = key;
      loadoutCache.current = out.length
        ? out
        : pool.filter((a) => a.kind === "mobility").slice(0, 2);
      return loadoutCache.current;
    } catch {
      return [];
    }
  };

  // Target head-height for the floating HP bar: the scaled rig height plus
  // clearance, so the boss-tier silhouette and its bar/crown stay aligned.
  const headY = useRef(2.35 + 1.0);

  // Soft radial glow sprite texture for the vertical column of dread.
  const glowTex = useMemo(() => {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => glowTex.dispose(), [glowTex]);

  // GRUDGE6 Bip001 warlord — enemy faction worge with gear preset from viewer CDN.
  useEffect(() => {
    let cancelled = false;
    Grudge6HeroRig.forEnemyWarlord("#d65a47").then((a) => {
      if (cancelled) return;
      a.root.visible = false;
      animatorRef.current = a;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Spawn (or re-spawn) the warlord unit at the enemy hero point for this match. */
  const spawnWarlord = (g: ReturnType<typeof useGame.getState>) => {
    const diff = DIFFICULTY[g.difficulty];
    const sp = EM.map.enemyHeroSpawn;
    const u = EM.spawnUnit("enemy", "enemyHero", sp.x, sp.z, {
      isHero: true,
      hpMult: diff.enemyHpMult,
      dmgMult: diff.enemyDmgMult,
    });
    u.pos.y = EM.map.heightAt(sp.x, sp.z);
    heroRef.current = u;
    respawn.current = 0;
    dying.current = false;
    resetTactics();
    animatorRef.current?.revive();
    g.pushMessage("THE ENEMY WARLORD TAKES THE FIELD", "danger");
  };

  /** Sticky nearest-hostile acquisition (units + structures, not the player). */
  const acquire = (hero: UnitEntity, range: number): CombatEntity | null => {
    if (targetId.current != null) {
      const cur = entityById(targetId.current);
      if (
        cur &&
        cur.alive &&
        cur.faction !== hero.faction &&
        distXZ(hero.pos, cur.pos.x, cur.pos.z) <= range + 6
      ) {
        return cur;
      }
      targetId.current = null;
    }
    const t = findTarget(hero.faction, hero.pos.x, hero.pos.z, range);
    targetId.current = t ? t.id : null;
    return t;
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const g = useGame.getState();
    const a = animatorRef.current;

    // Spawn at the start of a fresh battle; hide everything otherwise.
    if (g.phase === "battle" && lastPhase.current !== "battle") {
      spawnWarlord(g);
    }
    lastPhase.current = g.phase;
    if (g.phase !== "battle") {
      if (a) a.root.visible = false;
      if (barRef.current) barRef.current.visible = false;
      if (auraRef.current) auraRef.current.visible = false;
      return;
    }

    const hero = heroRef.current;
    if (!a || !hero) return;
    a.root.visible = true;
    const diff = DIFFICULTY[g.difficulty];
    const grid = EM.map.grid;

    // --- Death + respawn ---------------------------------------------------
    if (!hero.alive) {
      if (!dying.current) {
        dying.current = true;
        respawn.current = diff.heroRespawnTime;
        a.die();
        g.pushMessage("THE ENEMY WARLORD HAS FALLEN", "good");
      }
      respawn.current -= dt;
      a.root.position.set(hero.pos.x, hero.pos.y, hero.pos.z);
      a.update(dt);
      if (barRef.current) barRef.current.visible = false;
      if (auraRef.current) auraRef.current.visible = false;
      if (respawn.current <= 0) {
        const sp = EM.map.enemyHeroSpawn;
        hero.alive = true;
        hero.hp = hero.maxHp;
        hero.pos.set(sp.x, EM.map.heightAt(sp.x, sp.z), sp.z);
        hero.yaw = 0;
        dying.current = false;
        resetTactics();
        a.revive();
        g.pushMessage("THE ENEMY WARLORD RETURNS", "danger");
      }
      return;
    }

    // --- Decide ------------------------------------------------------------
    attackCd.current -= dt;
    slamCd.current -= dt;
    tickAbilityCds(skillCd.current, dt);
    dashTimer.current = Math.max(0, dashTimer.current - dt);
    lastCast.current = Math.max(0, lastCast.current - dt);
    retargetTimer.current -= dt;
    repathTimer.current -= dt;

    const aggro = hero.def.aggroRange * diff.heroAggroMult;

    // EXECUTE: a wounded player is hunted beyond normal aggro and through a wound
    // that would otherwise force a retreat — the warlord goes for the kill.
    const playerHpFrac = g.maxHealth > 0 ? g.health / g.maxHealth : 1;
    const executeRange = aggro * ENEMY_HERO.executeRangeMult;
    const rawPlayerD = !g.heroDead ? distXZ(hero.pos, EM.playerPos.x, EM.playerPos.z) : Infinity;
    const execute =
      !g.heroDead && playerHpFrac <= diff.heroExecuteFrac && rawPlayerD <= executeRange;
    if (execute && !executing.current) {
      g.pushMessage("THE WARLORD SCENTS BLOOD — RUN", "danger");
    }
    executing.current = execute;

    // Retreat with hysteresis so a single tick of damage (or a sliver of healing)
    // never flips the warlord between charging and fleeing. Drop below the retreat
    // fraction to commit to a pull-back, but only re-engage once HP recovers past a
    // higher band; either decision is also held for a minimum duration.
    retreatHold.current -= dt;
    const heroHpFrac = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
    let retreat: boolean;
    if (execute || diff.heroRetreatFrac <= 0) {
      retreat = false;
      retreating.current = false;
    } else if (retreating.current) {
      // Stay retreating until HP climbs past the upper band and the hold elapses.
      retreat = heroHpFrac < diff.heroRetreatFrac + ENEMY_HERO.retreatHysteresis || retreatHold.current > 0;
      retreating.current = retreat;
    } else {
      retreat = heroHpFrac < diff.heroRetreatFrac;
      if (retreat) {
        retreating.current = true;
        retreatHold.current = ENEMY_HERO.retreatCommit;
      }
    }

    const target = retreat ? null : acquire(hero, aggro);
    const targetD = target ? distXZ(hero.pos, target.pos.x, target.pos.z) : Infinity;
    const playerD = retreat ? Infinity : rawPlayerD;
    // Hunt the player when executing, or when they are the closest threat in aggro.
    const goPlayer =
      !retreat && playerD <= (execute ? executeRange : aggro) && (execute || playerD < targetD);

    let moveTo: { x: number; z: number } | null = null;
    let faceAt: { x: number; z: number } | null = null;
    let attackTarget: CombatEntity | null = null;
    let attackPlayer = false;
    let speed = hero.def.speed;
    const loadout = enemyLoadout();
    const rangedKit = loadoutHasRanged(loadout);

    if (retreat) {
      // Pull back toward the enemy's OWN core via its flow-field.
      const ff = EM.map.flowToEnemyCore;
      if (ff.sampleDir(hero.pos.x, hero.pos.z, _flow)) {
        moveTo = { x: hero.pos.x + _flow.x * 3, z: hero.pos.z + _flow.z * 3 };
      } else {
        const sp = EM.map.enemyHeroSpawn;
        moveTo = { x: sp.x, z: sp.z };
      }
      speed *= ENEMY_HERO.retreatSpeedMult;
    } else if (goPlayer) {
      const reach = hero.def.attackRange + 0.9;
      faceAt = { x: EM.playerPos.x, z: EM.playerPos.z };
      if (rangedKit && !execute && playerD < 7 && heroHpFrac < 0.75) {
        const ax = hero.pos.x - EM.playerPos.x;
        const az = hero.pos.z - EM.playerPos.z;
        const al = Math.hypot(ax, az) || 1;
        moveTo = navTo(hero, { x: hero.pos.x + (ax / al) * 6, z: hero.pos.z + (az / al) * 6 });
        if (playerD <= reach) attackPlayer = true;
      } else if (playerD <= reach) {
        attackPlayer = true;
      } else {
        moveTo = playerD > 8 ? navTo(hero, { x: EM.playerPos.x, z: EM.playerPos.z }, true) : { x: EM.playerPos.x, z: EM.playerPos.z };
      }
    } else if (target) {
      const reach =
        hero.def.attackRange + (isUnit(target) ? target.def.radius : structRadius(target.kind));
      faceAt = { x: target.pos.x, z: target.pos.z };
      if (rangedKit && isUnit(target) && targetD < 6.5 && heroHpFrac < 0.8) {
        const ax = hero.pos.x - target.pos.x;
        const az = hero.pos.z - target.pos.z;
        const al = Math.hypot(ax, az) || 1;
        moveTo = { x: hero.pos.x + (ax / al) * 5, z: hero.pos.z + (az / al) * 5 };
        if (targetD <= reach) attackTarget = target;
      } else if (targetD <= reach) {
        attackTarget = target;
      } else {
        moveTo = targetD > 8 ? navTo(hero, { x: target.pos.x, z: target.pos.z }, true) : { x: target.pos.x, z: target.pos.z };
      }
    } else {
      // PUSH: no immediate threat — pick the weakest lane objective and either
      // coordinate (stage back, mass the warband) or commit to razing it.
      const obj = pickObjective(hero, diff);
      if (obj) {
        const objD = distXZ(hero.pos, obj.pos.x, obj.pos.z);
        const reach = hero.def.attackRange + structRadius(obj.kind);
        const exposed =
          obj.hp <= obj.maxHp * ENEMY_HERO.exposedHpFrac ||
          countUnitsNear("ally", obj.pos.x, obj.pos.z, ENEMY_HERO.defenderRadius) === 0;

        if (!committed.current && !exposed) {
          // Coordinate: mass friendly creeps near the warlord before diving.
          const allies = countUnitsNear("enemy", hero.pos.x, hero.pos.z, ENEMY_HERO.groupRadius);
          stageTimer.current -= dt;
          if (allies >= diff.heroGroupMin || stageTimer.current <= 0) {
            committed.current = true;
          } else {
            // Stage a short way back (toward its own core) and wait for the warband.
            const ex = EM.map.enemyCore.x - obj.pos.x;
            const ez = EM.map.enemyCore.z - obj.pos.z;
            const el = Math.hypot(ex, ez) || 1;
            const stage = {
              x: obj.pos.x + (ex / el) * ENEMY_HERO.stageBackoff,
              z: obj.pos.z + (ez / el) * ENEMY_HERO.stageBackoff,
            };
            moveTo = navTo(hero, stage);
          }
        }

        if (committed.current || exposed) {
          if (objD <= reach) {
            attackTarget = obj;
            faceAt = { x: obj.pos.x, z: obj.pos.z };
          } else {
            moveTo = navTo(hero, { x: obj.pos.x, z: obj.pos.z }, true);
          }
        }
      } else {
        // Fallback: generic advance toward the ally core via the shared flow-field.
        const ff = EM.map.flowToAllyCore;
        if (ff.sampleDir(hero.pos.x, hero.pos.z, _flow)) {
          moveTo = { x: hero.pos.x + _flow.x * 3, z: hero.pos.z + _flow.z * 3 };
        } else if (EM.allyCore) {
          moveTo = { x: EM.allyCore.pos.x, z: EM.allyCore.pos.z };
        }
      }
    }

    // --- Move (slide along terrain, clamp to walkable, snap height) ---------
    let desiredYaw = hero.yaw;
    let moving = false;
    if (dashTimer.current > 0) {
      const step = HERO_DASH.speed * dt;
      const steer = avoidHeading(hero.pos.x, hero.pos.z, dashDir.current.x, dashDir.current.z);
      const mv = slideStep(grid, hero.pos.x, hero.pos.z, steer.x * step, steer.z * step);
      hero.pos.x = mv.x;
      hero.pos.z = mv.z;
      desiredYaw = Math.atan2(dashDir.current.x, dashDir.current.z);
      moving = true;
      moveTo = null;
    }
    if (moveTo) {
      _dir.set(moveTo.x - hero.pos.x, 0, moveTo.z - hero.pos.z);
      const dist = _dir.length();
      if (dist > 0.05) {
        _dir.multiplyScalar(1 / dist);
        let sx = _dir.x;
        let sz = _dir.z;
        const steer = avoidHeading(hero.pos.x, hero.pos.z, sx, sz);
        sx = steer.x;
        sz = steer.z;
        if (stuckT.current > 0.35) {
          const a = (hero.id & 1) === 1 ? 0.9 : -0.9;
          const cs = Math.cos(a);
          const sn = Math.sin(a);
          const rx = sx * cs - sz * sn;
          const rz = sx * sn + sz * cs;
          sx = rx;
          sz = rz;
        }
        const step = speed * dt;
        const mv = slideStep(grid, hero.pos.x, hero.pos.z, sx * step, sz * step);
        hero.pos.x = mv.x;
        hero.pos.z = mv.z;
        desiredYaw = Math.atan2(sx, sz);
        moving = true;
      }
    } else if (faceAt) {
      desiredYaw = Math.atan2(faceAt.x - hero.pos.x, faceAt.z - hero.pos.z);
    }

    if (!grid.isWalkableWorld(hero.pos.x, hero.pos.z)) {
      const w = grid.nearestWalkable(hero.pos.x, hero.pos.z);
      hero.pos.x = w.x;
      hero.pos.z = w.z;
    }
    hero.pos.y = EM.map.heightAt(hero.pos.x, hero.pos.z);

    const traveled = Math.hypot(hero.pos.x - lastNavX.current, hero.pos.z - lastNavZ.current);
    if (moveTo && traveled < 0.04) stuckT.current += dt;
    else stuckT.current = Math.max(0, stuckT.current - dt * 0.5);
    lastNavX.current = hero.pos.x;
    lastNavZ.current = hero.pos.z;

    // Smooth facing toward the intended heading (frame-rate independent).
    let dy = desiredYaw - hero.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    hero.yaw += dy * Math.min(1, dt * 10);

    // --- Same loadout as the player: slam / dash / weapon skills ----------
    let slammed = false;
    const hostilesInSlam =
      countUnitsNear("ally", hero.pos.x, hero.pos.z, SLAM.shockRadius * 0.55) +
      (!g.heroDead && distXZ(hero.pos, EM.playerPos.x, EM.playerPos.z) <= SLAM.shockRadius * 0.55 ? 1 : 0);
    const goalPt = faceAt ?? moveTo ?? (goPlayer ? { x: EM.playerPos.x, z: EM.playerPos.z } : null);
    const towardX = goalPt ? goalPt.x - hero.pos.x : Math.sin(hero.yaw);
    const towardZ = goalPt ? goalPt.z - hero.pos.z : Math.cos(hero.yaw);
    const core = EM.map.enemyCore;
    let targetHpFrac = 1;
    if (goPlayer) targetHpFrac = playerHpFrac;
    else if (attackTarget && isUnit(attackTarget)) targetHpFrac = attackTarget.hp / attackTarget.maxHp;
    else if (attackTarget) targetHpFrac = attackTarget.hp / attackTarget.maxHp;
    else if (target && isUnit(target)) targetHpFrac = target.hp / target.maxHp;
    const plan =
      lastCast.current <= 0
        ? planHeroCast(
            {
              hpFrac: heroHpFrac,
              retreating: retreat,
              executing: execute,
              chasing: !!(goPlayer || target || attackTarget),
              targetDist: goPlayer ? playerD : target ? targetD : Infinity,
              targetHpFrac,
              targetIsHero: goPlayer,
              targetIsStructure: !!(attackTarget && !isUnit(attackTarget)),
              hostilesInSlam,
              alliesNear: countUnitsNear("enemy", hero.pos.x, hero.pos.z, ENEMY_HERO.groupRadius),
              towardX,
              towardZ,
              awayX: core.x - hero.pos.x,
              awayZ: core.z - hero.pos.z,
              dashing: dashTimer.current > 0,
            },
            loadout,
            skillCd.current,
          )
        : null;
    if (plan && dashTimer.current <= 0) {
      if (plan.kind === "slam") {
        slammed = true;
        const slamAb = loadout.find((a) => a.mobility === "slam");
        skillCd.current[slamAb?.id ?? "mobility.slam"] = slamAb?.cooldown ?? 11;
        lastCast.current = 0.35;
        attackCd.current = hero.def.attackCooldown;
        a.attack();
        hero.swing = 1;
        performHeroSlam({
          x: hero.pos.x,
          y: hero.pos.y,
          z: hero.pos.z,
          faction: "enemy",
          damageMult: hero.dmgMult * g.damageMult,
        });
        g.pushMessage("THE WARLORD SLAMS THE EARTH", "warn");
      } else if (plan.kind === "dash") {
        const dashAb = loadout.find((a) => a.mobility === "dash");
        skillCd.current[dashAb?.id ?? "mobility.dash"] = dashAb?.cooldown ?? 6;
        lastCast.current = 0.2;
        dashDir.current = { x: plan.x, z: plan.z };
        dashTimer.current = HERO_DASH.duration;
        performHeroDashVfx(hero.pos.x, hero.pos.z);
      } else if (plan.kind === "skill") {
        const ab = plan.ability;
        skillCd.current[ab.id] = ab.cooldown;
        lastCast.current = 0.4;
        attackCd.current = hero.def.attackCooldown * 0.55;
        const skill: WarlordWeaponSkill =
          ab.weaponSkill ??
          ({
            id: ab.id,
            label: ab.label,
            baked: ab.baked ?? "",
            animKey: ab.animKey,
            description: ab.description,
            cooldown: ab.cooldown,
            damage: 28,
            damageType: "physical",
            blend: 0.9,
            hotbarSlot: 1,
            effects: [],
            keyLabel: "1",
          } satisfies WarlordWeaponSkill);
        a.castWeaponSkill?.(skill);
        hero.swing = 1;
        if (faceAt) {
          desiredYaw = Math.atan2(faceAt.x - hero.pos.x, faceAt.z - hero.pos.z);
          hero.yaw = desiredYaw;
        }
        _fwd.set(Math.sin(hero.yaw), 0, Math.cos(hero.yaw)).normalize();
        const origin = new THREE.Vector3(hero.pos.x, hero.pos.y + 1.2, hero.pos.z);
        let api: ReturnType<typeof apiWeaponForLoadout> = "SWORD";
        try {
          const r = useRoster.getState();
          api = apiWeaponForLoadout(r.meleeId, r.rangedId, rangedKit ? "ranged" : "melee");
        } catch {
          /* default sword */
        }
        performHeroWeaponSkill({
          skill,
          origin,
          dir: _fwd,
          apiWeapon: api,
          damageMult: hero.dmgMult * g.damageMult,
          faction: "enemy",
        });
      }
    }

    // --- Attack (forward melee cone; hits units/structures + the player) ----
    if ((!moving || (rangedKit && (attackTarget || attackPlayer))) && !slammed && (attackTarget || attackPlayer) && attackCd.current <= 0) {
      a.attack();
      hero.swing = 1;
      attackCd.current = hero.def.attackCooldown;
      const dmg = hero.def.damage * hero.dmgMult * EM.factionDmgMult(hero.faction);
      const origin = new THREE.Vector3(hero.pos.x, hero.pos.y + 1, hero.pos.z);
      _fwd.set(Math.sin(hero.yaw), 0, Math.cos(hero.yaw)).normalize();
      meleeConeHit(
        origin,
        _fwd,
        hero.def.attackRange,
        ENEMY_HERO.meleeHalfAngle,
        dmg,
        hero.faction,
        ENEMY_HERO.color,
      );
      // The player hero is not a UnitEntity, so resolve a cone hit on it directly.
      if (!g.heroDead) {
        const pdx = EM.playerPos.x - hero.pos.x;
        const pdz = EM.playerPos.z - hero.pos.z;
        const pd = Math.hypot(pdx, pdz);
        if (pd <= hero.def.attackRange + 1) {
          const cosA = pd <= 1e-3 ? 1 : (pdx / pd) * _fwd.x + (pdz / pd) * _fwd.z;
          if (cosA >= Math.cos(ENEMY_HERO.meleeHalfAngle)) {
            g.damagePlayer(dmg);
            EM.addSpark(EM.playerPos.clone().setY(1.2), ENEMY_HERO.color);
          }
        }
      }
    }
    // Hold attack swing ~0.55–0.7s so one-shot attack clips finish cleanly
    hero.swing = Math.max(0, hero.swing - dt * 1.6);
    hero.hitFlash = Math.max(0, hero.hitFlash - dt);

    // --- Drive the rig -----------------------------------------------------
    a.root.position.set(hero.pos.x, hero.pos.y + groundCorr.current, hero.pos.z);
    // faceYawOffset rotates kit +X → world +Z at yaw 0 (do not bake twice)
    a.root.rotation.y = hero.yaw + (a.faceYawOffset ?? 0);
    a.setLocomotion({ x: 0, z: moving ? 1 : 0, speed: moving ? 0.6 : 0, running: false });
    a.update(dt);

    // Plant the feet on the terrain: the rig is only grounded in its bind pose, so
    // idle/stance clips leave the soles hovering. Ease the model up/down so the
    // lowest live sole rests on the heightmap (the warlord never leaves the ground).
    if (!dying.current) {
      const target = groundCorr.current + (hero.pos.y - a.character.lowestSoleWorldY());
      groundCorr.current += (target - groundCorr.current) * Math.min(1, 14 * dt);
      a.root.position.y = hero.pos.y + groundCorr.current;
    }

    // --- HP bar billboard --------------------------------------------------
    const bar = barRef.current;
    if (bar) {
      bar.visible = true;
      bar.position.set(hero.pos.x, hero.pos.y + headY.current, hero.pos.z);
      bar.quaternion.copy(camera.quaternion);
      if (fillRef.current) {
        const frac = Math.max(0.001, hero.hp / hero.maxHp);
        fillRef.current.scale.x = frac;
        fillRef.current.position.x = -(1 - frac) * 1.02;
      }
    }

    // --- Dread aura + crown (pulsing, world-anchored at the warlord) --------
    auraClock.current += dt;
    const aura = auraRef.current;
    if (aura) {
      aura.visible = true;
      aura.position.set(hero.pos.x, hero.pos.y, hero.pos.z);
      // A slow throb so the warlord radiates menace even when idle.
      const pulse = 0.5 + 0.5 * Math.sin(auraClock.current * 2.4);
      if (ringRef.current) {
        const s = 1 + pulse * 0.12;
        ringRef.current.scale.set(s, s, s);
        (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + pulse * 0.35;
      }
      if (ring2Ref.current) {
        // Second ring expands outward on the opposite phase (rippling ground).
        const t = (auraClock.current * 0.5) % 1;
        const s = 1.1 + t * 1.6;
        ring2Ref.current.scale.set(s, s, s);
        (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
      }
      if (glowRef.current) {
        const gs = 3.2 + pulse * 0.5;
        glowRef.current.scale.set(gs, gs * 1.25, 1);
        glowRef.current.position.y = headY.current * 0.55;
        (glowRef.current.material as THREE.SpriteMaterial).opacity = 0.18 + pulse * 0.12;
      }
      if (crownRef.current) {
        crownRef.current.rotation.y += dt * 0.8;
        crownRef.current.position.y = headY.current + 0.55 + pulse * 0.06;
      }
    }
  });

  return (
    <>
      {ready && animatorRef.current && <primitive object={animatorRef.current.root} />}

      {/* Boss-tier floating health bar — larger than a creep's, with a gilded
          frame so it reads as the rival hero even in a chaotic melee. */}
      <group ref={barRef} visible={false}>
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[2.28, 0.42]} />
          <meshBasicMaterial color={ENEMY_HERO.auraColor} transparent opacity={0.5} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[2.18, 0.34]} />
          <meshBasicMaterial color="#0a0604" transparent opacity={0.95} depthTest={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[2.06, 0.22]} />
          <meshBasicMaterial color="#3a1412" depthTest={false} depthWrite={false} />
        </mesh>
        <mesh ref={fillRef} position={[0, 0, 0]}>
          <planeGeometry args={[2.04, 0.2]} />
          <meshBasicMaterial color="#ff5a4a" depthTest={false} depthWrite={false} />
        </mesh>
      </group>

      {/* Dread aura: two ground rings, a vertical glow column, and a slowly
          spinning crown of spikes above the head. World-anchored at the warlord
          (driven in useFrame). Purely cosmetic — no effect on simulation. */}
      <group ref={auraRef} visible={false}>
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[1.15, 1.5, 48]} />
          <meshBasicMaterial
            color={ENEMY_HERO.auraColor}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.35, 1.5, 48]} />
          <meshBasicMaterial
            color={ENEMY_HERO.auraColor}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <sprite ref={glowRef} position={[0, 1.6, 0]}>
          <spriteMaterial
            map={glowTex}
            color={ENEMY_HERO.auraColor}
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <group ref={crownRef} position={[0, 3.2, 0]}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42]}>
                <coneGeometry args={[0.1, 0.42, 4]} />
                <meshBasicMaterial color={ENEMY_HERO.auraColor} />
              </mesh>
            );
          })}
        </group>
      </group>
    </>
  );
}
