import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EM, type StructureEntity, type UnitEntity } from "../../game/entities";
import { useGame } from "../../game/store";
import { ENEMY_HERO, DIFFICULTY, type DifficultyDef } from "../../game/config";
import { getPreset } from "../../game/anim/presets";
import { createAnimatedCharacter, Animator } from "../../game/anim";
import { findPath } from "../../game/pathfind";
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
 *  - SIGNATURE: a deterministic ground-slam AoE when surrounded (Normal+).
 */
export function EnemyHero() {
  const { camera } = useThree();
  const animatorRef = useRef<Animator | null>(null);
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
  const slamCd = useRef(0); // signature ground-slam cooldown
  const executing = useRef(false); // currently hunting a low-HP player (for the message)
  const retreating = useRef(false); // committed to a retreat (hysteresis-latched)
  const retreatHold = useRef(0); // min seconds to stay committed to the current retreat decision

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
  const navTo = (hero: UnitEntity, goal: { x: number; z: number }): { x: number; z: number } => {
    const grid = EM.map.grid;
    const moved = navGoal.current
      ? Math.hypot(goal.x - navGoal.current.x, goal.z - navGoal.current.z)
      : Infinity;
    const p0 = navPath.current;
    const needRepath =
      !p0 || navIdx.current >= p0.length || moved > 4 || repathTimer.current <= 0;
    if (needRepath) {
      repathTimer.current = ENEMY_HERO.repathInterval;
      const p = findPath(grid, hero.pos.x, hero.pos.z, goal.x, goal.z);
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
    if (!p) return goal;
    while (
      navIdx.current < p.length - 1 &&
      distXZ(hero.pos, p[navIdx.current].x, p[navIdx.current].z) < 1.6
    ) {
      navIdx.current++;
    }
    return p[navIdx.current];
  };

  // Target head-height for the floating HP bar: the scaled rig height plus
  // clearance, so the boss-tier silhouette and its bar/crown stay aligned.
  const headY = useRef(getPreset(ENEMY_HERO.presetId).height * ENEMY_HERO.rigScale + 1.0);

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

  // Build the procedural animator once; reuse it across matches. The look is the
  // warlord override (not the preset creep look) and the rig is scaled up so the
  // rival hero towers over regular troops.
  useEffect(() => {
    let cancelled = false;
    const preset = getPreset(ENEMY_HERO.presetId);
    createAnimatedCharacter({
      classes: preset.classes,
      weapon: preset.weapon,
      height: preset.height,
      look: ENEMY_HERO.look,
    }).then((a) => {
      if (cancelled) return;
      a.root.visible = false;
      a.root.scale.setScalar(ENEMY_HERO.rigScale);
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
      if (playerD <= reach) {
        attackPlayer = true;
        faceAt = { x: EM.playerPos.x, z: EM.playerPos.z };
      } else {
        // Straight-line when close; A*-path the long execute chase across terrain.
        moveTo =
          playerD > aggro
            ? navTo(hero, { x: EM.playerPos.x, z: EM.playerPos.z })
            : { x: EM.playerPos.x, z: EM.playerPos.z };
      }
    } else if (target) {
      const reach =
        hero.def.attackRange + (isUnit(target) ? target.def.radius : structRadius(target.kind));
      if (targetD <= reach) {
        attackTarget = target;
        faceAt = { x: target.pos.x, z: target.pos.z };
      } else {
        moveTo = { x: target.pos.x, z: target.pos.z };
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
            moveTo = navTo(hero, { x: obj.pos.x, z: obj.pos.z });
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
    if (moveTo) {
      _dir.set(moveTo.x - hero.pos.x, 0, moveTo.z - hero.pos.z);
      const dist = _dir.length();
      if (dist > 0.05) {
        _dir.multiplyScalar(1 / dist);
        const step = speed * dt;
        let nx = hero.pos.x + _dir.x * step;
        let nz = hero.pos.z + _dir.z * step;
        if (!grid.isWalkableWorld(nx, nz)) {
          if (Math.abs(_dir.x) > 1e-5 && grid.isWalkableWorld(nx, hero.pos.z)) {
            nz = hero.pos.z;
          } else if (Math.abs(_dir.z) > 1e-5 && grid.isWalkableWorld(hero.pos.x, nz)) {
            nx = hero.pos.x;
          } else {
            nx = hero.pos.x;
            nz = hero.pos.z;
          }
        }
        hero.pos.x = nx;
        hero.pos.z = nz;
        desiredYaw = Math.atan2(_dir.x, _dir.z);
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

    // Smooth facing toward the intended heading (frame-rate independent).
    let dy = desiredYaw - hero.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    hero.yaw += dy * Math.min(1, dt * 10);

    // --- Signature: Warlord's Wrath ground-slam (deterministic; when surrounded) ---
    let slammed = false;
    if (!moving && diff.heroSlam && slamCd.current <= 0) {
      const reach = hero.def.attackRange + 1.5;
      let surrounded = countUnitsNear("ally", hero.pos.x, hero.pos.z, reach);
      const pSlamD = !g.heroDead ? distXZ(hero.pos, EM.playerPos.x, EM.playerPos.z) : Infinity;
      if (pSlamD <= reach) surrounded++;
      if (surrounded >= ENEMY_HERO.slam.minTargets) {
        slammed = true;
        slamCd.current = ENEMY_HERO.slam.cooldown;
        attackCd.current = hero.def.attackCooldown;
        a.attack();
        hero.swing = 1;
        const dmg =
          hero.def.damage * hero.dmgMult * ENEMY_HERO.slam.damageMult * EM.factionDmgMult(hero.faction);
        EM.addShockwave({
          pos: new THREE.Vector3(hero.pos.x, 0.1, hero.pos.z),
          maxRadius: ENEMY_HERO.slam.radius,
          duration: ENEMY_HERO.slam.duration,
          damage: dmg,
          color: ENEMY_HERO.color,
          faction: hero.faction,
          slow: ENEMY_HERO.slam.slow,
        });
        EM.addFireBurst(
          new THREE.Vector3(hero.pos.x, hero.pos.y + 0.3, hero.pos.z),
          ENEMY_HERO.color,
          8,
          0.8,
        );
        g.pushMessage("THE WARLORD SLAMS THE EARTH", "warn");
        // Shockwaves only damage units/structures; resolve the player hit directly.
        if (pSlamD <= ENEMY_HERO.slam.radius) {
          g.damagePlayer(dmg);
          EM.addSpark(EM.playerPos.clone().setY(1.2), ENEMY_HERO.color);
        }
      }
    }

    // --- Attack (forward melee cone; hits units/structures + the player) ----
    if (!moving && !slammed && (attackTarget || attackPlayer) && attackCd.current <= 0) {
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
    hero.swing = Math.max(0, hero.swing - dt * 4);
    hero.hitFlash = Math.max(0, hero.hitFlash - dt);

    // --- Drive the rig -----------------------------------------------------
    a.root.position.set(hero.pos.x, hero.pos.y + groundCorr.current, hero.pos.z);
    a.root.rotation.y = hero.yaw;
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
