import { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import {
  PLAYER,
  ABILITIES,
  DASH,
  SLAM,
  RANGED_WEAPONS,
  MELEE_WEAPONS_CFG,
  type RangedWeaponDef,
  type MeleeWeaponDef,
} from "../../game/config";
import { useGame } from "../../game/store";
import { useCommand } from "../../game/command";
import { EM, type TreeEntity } from "../../game/entities";
import {
  heroDealDamage,
  isAttackable,
  isUnit,
  structRadius,
  meleeConeHit,
  type CombatEntity,
} from "../../game/combat";
import { Controls } from "./controls";
import type { ActionKey } from "../../game/anim";
import type { WeaponClass } from "../../game/anim/types";
import { useRoster } from "../../game/roster";
import { Grudge6HeroRig, weaponClassToAnimPack } from "../../engine/grudge6HeroRig";
import { useWeaponTuning } from "../../game/weaponTuning";
import { resolveCameraOcclusion } from "../../game/cameraOcclusion";
import {
  apiWeaponForLoadout,
  warlordSkillsForLoadout,
  type WarlordWeaponSkill,
} from "../../game/warlordWeaponSkills";
import { applyWeaponSkillHit } from "../../game/weaponSkillCombat";

const _dir = new THREE.Vector3();
const _front = new THREE.Vector3();
const _side = new THREE.Vector3();
const _flat = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _ray = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _treeTop = new THREE.Vector3();
const _muz = new THREE.Vector3();
const _head = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _dash = new THREE.Vector3();
/** Extra FOV (deg) added briefly during a Warstride dash so the burst reads as speed. */
const DASH_FOV_KICK = 10;
/** Exponential decay rate (per second) of the camera-shake magnitude. */
const SHAKE_DECAY = 7;
const _aim = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camFinal = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

/** Distance from the capsule centre down to the hero's feet (root y = 0). */
const FEET_OFFSET = PLAYER.height / 2 + PLAYER.radius;
const CAM_HEIGHT = 1.55;

const COMBAT_DIST = 3.6;
const COMBAT_SHOULDER = 0.7;
const COMMAND_DIST = 13;
const COMMAND_LIFT = 13;

/** Mouse-wheel camera zoom: a clamped multiplier on the third-person distance. */
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.12;

/** Numpad camera nudge (command view): 4/6 orbit speed, 8/2 tilt range + speed. */
const CAM_ORBIT_SPEED = 1.7;
const CAM_PITCH_MIN = 0.45;
const CAM_PITCH_MAX = 2.0;
const CAM_PITCH_SPEED = 1.0;

/** Double-tap dodge roll: tap window, evasive burst speed/duration, and cooldown. */
const ROLL_TAP_WINDOW = 0.28;
const ROLL_DURATION = 0.45;
const ROLL_SPEED = 13;
const ROLL_COOLDOWN = 0.85;

/** Hero spawn / respawn point on the current map, resting on the terrain. */
function heroSpawnPos(): { x: number; y: number; z: number } {
  const s = EM.map.heroSpawn;
  return { x: s.x, y: EM.map.heightAt(s.x, s.z) + FEET_OFFSET + 0.2, z: s.z };
}

/**
 * Severity-tiered hero hit reactions. Rather than always playing one flinch
 * (which read as a constant knock-down), each hit draws from a pool scaled to how
 * hard it landed: light chip damage is a quick flinch, a solid hit staggers, and
 * only a heavy burst can knock the hero down — and even then a body-blow stagger
 * (stays on feet) is weighted to dominate so back-to-back knock-downs stay rare.
 * Every key resolves to the staged, class-independent `reactions` pack, so the
 * variety applies to every hero regardless of loadout.
 */
const HIT_LIGHT: ActionKey[] = ["hitHead", "stumble"];
const HIT_LIGHT_MOVING: ActionKey[] = ["jogStumble", "stumble"];
const HIT_MEDIUM: ActionKey[] = ["bigBlow", "stunned", "hitHead"];
const HIT_HEAVY: ActionKey[] = ["bigBlow", "bigBlow", "stunned", "flyingBack", "wallCrash"];

/** Fraction of max health separating a flinch / stagger / knock-down hit. */
const HIT_MEDIUM_FRAC = 0.1;
const HIT_HEAVY_FRAC = 0.25;

/**
 * Pick a hit reaction for a hit of `severity` (damage / maxHealth), biased by
 * whether the hero is moving, and avoiding an immediate repeat of `last` so the
 * reactions read varied. Returns the reaction key plus a crossfade time tuned to
 * its weight (a flinch snaps in fast; a knock-down eases in).
 */
function pickHitReaction(
  severity: number,
  moving: boolean,
  last: ActionKey | null,
): { key: ActionKey; fade: number } {
  const heavy = severity >= HIT_HEAVY_FRAC;
  const medium = !heavy && severity >= HIT_MEDIUM_FRAC;
  const pool = heavy ? HIT_HEAVY : medium ? HIT_MEDIUM : moving ? HIT_LIGHT_MOVING : HIT_LIGHT;
  const fade = heavy ? 0.16 : medium ? 0.12 : 0.08;
  let key = pool[Math.floor(Math.random() * pool.length)];
  for (let guard = 0; key === last && pool.length > 1 && guard < 6; guard++) {
    key = pool[Math.floor(Math.random() * pool.length)];
  }
  return { key, fade };
}

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const { camera, gl, scene } = useThree();
  const [, getKeys] = useKeyboardControls<Controls>();

  const fireCooldown = useRef(0);
  const reloadTimer = useRef(0);
  const firing = useRef(false);
  const melee = useRef(false);
  const blocking = useRef(false);
  const rangedDef = useRef<RangedWeaponDef>(RANGED_WEAPONS.rifle);
  const meleeDef = useRef<MeleeWeaponDef>(MELEE_WEAPONS_CFG.swordshield);
  const activeMode = useRef<"ranged" | "melee">("ranged");
  const grounded = useRef(false);
  const jumping = useRef(false);
  /** Smoothed vertical correction that plants the rig's feet on the terrain. */
  const groundCorr = useRef(0);
  const aiming = useRef(false);
  const dead = useRef(false);
  const hitCooldown = useRef(0);
  const lastHit = useRef<ActionKey | null>(null);
  const prevHealth = useRef(PLAYER.maxHealth);
  const commandYaw = useRef(0);
  const prevMode = useRef<"combat" | "command">("command");
  const dashTimer = useRef(0);
  const dashDir = useRef(new THREE.Vector3());
  /** Smoothed model facing (eased toward the target yaw) for weighted turns. */
  const modelYaw = useRef(0);
  const zoom = useRef(1);
  /** Smoothed 0..1 scale along pivot→desired after occlusion pulls the camera in. */
  const camOcclFrac = useRef(1);
  // Numpad camera adjustments for the command (RTS) view: an orbit offset added
  // to commandYaw (4/6) and a tilt multiplier on the camera lift (8/2).
  const camYaw = useRef(0);
  const camPitch = useRef(1);
  const rollTimer = useRef(0);
  const rollCd = useRef(0);
  const rollDir = useRef(new THREE.Vector3());
  const lastTap = useRef<{ key: string; t: number }>({ key: "", t: 0 });
  // Momentum + mouse-look state. `curSpeed` ramps between walk/sprint; the look
  // refs hold the raw target yaw/pitch (accumulated from mouse deltas) and the
  // smoothed orientation actually applied to the camera each frame.
  const curSpeed = useRef(PLAYER.speed);
  const lookYaw = useRef(0);
  const lookPitch = useRef(0);
  const curYaw = useRef(0);
  const curPitch = useRef(0);

  const animatorRef = useRef<Grudge6HeroRig | null>(null);
  const [animator, setAnimator] = useState<Grudge6HeroRig | null>(null);
  const weaponSkillsRef = useRef<WarlordWeaponSkill[]>([]);
  const spawn0 = useMemo(() => heroSpawnPos(), []);

  const phase = useGame((s) => s.phase);
  const raceId = useRoster((s) => s.raceId);
  const classId = useRoster((s) => s.classId);
  const meleeId = useRoster((s) => s.meleeId);
  const rangedId = useRoster((s) => s.rangedId);
  const heroDead = useGame((s) => s.heroDead);

  useEffect(() => {
    let disposed = false;
    let built: Grudge6HeroRig | null = null;
    const rdef = RANGED_WEAPONS[rangedId] ?? RANGED_WEAPONS.rifle;
    const mdef = MELEE_WEAPONS_CFG[meleeId] ?? MELEE_WEAPONS_CFG.swordshield;
    rangedDef.current = rdef;
    meleeDef.current = mdef;
    activeMode.current = "ranged";
    melee.current = false;
    blocking.current = false;
    EM.heroBlocking = false;
    Grudge6HeroRig.forPlayer({
      raceId,
      classId,
      animPack: weaponClassToAnimPack(rdef.animClass),
    })
      .then((a) => {
        if (disposed) {
          a.dispose();
          return;
        }
        built = a;
        a.root.traverse((o) => {
          o.castShadow = true;
        });
        const rtune = rdef.model ? useWeaponTuning.getState().tuning[rdef.model] : null;
        a.setWeaponFull(rdef.animClass, true, rdef.model ?? null, rtune ?? null);
        useWeaponTuning.getState().setActiveKey(rdef.model ?? null);
        animatorRef.current = a;
        setAnimator(a);
        weaponSkillsRef.current = warlordSkillsForLoadout(meleeId, rangedId, "ranged");
        void a.preloadWeaponSkills(weaponSkillsRef.current);
        useGame.getState().setHeroActiveWeapon("ranged");
      })
      .catch((err) => {
        console.warn("[grudge-warlords] failed to build GRUDGE6 hero", err);
      });
    return () => {
      disposed = true;
      animatorRef.current = null;
      setAnimator(null);
      if (built) built.dispose();
    };
  }, [raceId, classId, meleeId, rangedId]);

  useEffect(() => {
    weaponSkillsRef.current = warlordSkillsForLoadout(meleeId, rangedId, activeMode.current);
    void animatorRef.current?.preloadWeaponSkills(weaponSkillsRef.current);
  }, [meleeId, rangedId, animator]);

  // Mouse fire (LMB) + shield guard (RMB, sword & shield only), combat only.
  useEffect(() => {
    const setBlock = (on: boolean) => {
      blocking.current = on;
      EM.heroBlocking = on;
      animatorRef.current?.block(on);
    };
    const down = (e: MouseEvent) => {
      if (e.button === 0) firing.current = true;
      else if (e.button === 2 && melee.current && meleeDef.current.block) setBlock(true);
    };
    const up = (e: MouseEvent) => {
      if (e.button === 0) firing.current = false;
      else if (e.button === 2) setBlock(false);
    };
    const ctx = (e: MouseEvent) => {
      if (document.pointerLockElement) e.preventDefault();
    };
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("contextmenu", ctx);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("contextmenu", ctx);
    };
  }, []);

  // Reload (R) and control-mode toggle (backtick).
  useEffect(() => {
    const ROLL_KEYS: Record<string, "F" | "B" | "L" | "R"> = {
      KeyW: "F",
      KeyS: "B",
      KeyA: "L",
      KeyD: "R",
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR") startReload();
      if (e.code === "KeyQ") swapWeapon();
      if (e.code === "KeyC") triggerDash();
      if (e.code === "KeyG") triggerSlam();
      if (useCommand.getState().mode === "combat" && /^Digit[1-6]$/.test(e.code) && !e.repeat) {
        castWeaponSkill(parseInt(e.code.slice(5), 10) - 1);
      }
      // Tuning panel toggle (combat only) — P avoids every movement/order hotkey.
      if (e.code === "KeyP" && useCommand.getState().mode === "combat") {
        useWeaponTuning.getState().toggleEditor();
      }
      // Double-tap a movement key (no auto-repeat) to dodge roll in that facing.
      const rd = ROLL_KEYS[e.code];
      if (rd && !e.repeat) {
        const now = performance.now() / 1000;
        const prev = lastTap.current;
        if (prev.key === e.code && now - prev.t <= ROLL_TAP_WINDOW) {
          triggerRoll(rd);
          lastTap.current = { key: "", t: 0 };
        } else {
          lastTap.current = { key: e.code, t: now };
        }
      }
      if (e.code === "Backquote") {
        const g = useGame.getState();
        if (g.phase !== "battle") return;
        const next = useCommand.getState().toggleMode();
        if (next === "combat") {
          gl.domElement.requestPointerLock();
        } else {
          document.exitPointerLock();
          firing.current = false;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mouse-wheel camera zoom (clamped). Scroll up pulls the camera in, scroll
  // down pushes it out; the multiplier is applied to the third-person distance.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (useGame.getState().phase !== "battle") return;
      const dir = Math.sign(e.deltaY);
      zoom.current = THREE.MathUtils.clamp(
        zoom.current + dir * ZOOM_STEP,
        ZOOM_MIN,
        ZOOM_MAX,
      );
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // Mouse-look (combat): accumulate raw pointer deltas into a target yaw/pitch
  // while the pointer is locked. Sensitivity scales the delta; pitch is clamped
  // so aim can't roll past straight up/down. The frame loop eases the applied
  // orientation toward this target for a touch of smoothing.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const s = PLAYER.lookSensitivity * 0.0022;
      lookYaw.current -= e.movementX * s;
      lookPitch.current = THREE.MathUtils.clamp(
        lookPitch.current - e.movementY * s,
        -PLAYER.lookPitchMax,
        PLAYER.lookPitchMax,
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Clicking the engage prompt (#lock-target) captures the mouse for combat.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("#lock-target")) gl.domElement.requestPointerLock();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [gl]);

  // Live-apply weapon tuning edits to the equipped real model (panel -> hand).
  useEffect(() => {
    const unsub = useWeaponTuning.subscribe((state, prev) => {
      const key = state.activeKey;
      if (!key) return;
      if (state.tuning[key] !== prev.tuning[key]) {
        animatorRef.current?.retuneWeapon(state.tuning[key]);
      }
    });
    return unsub;
  }, []);

  // Keep control-mode in sync with the browser pointer-lock (Esc drops lock ->
  // command; locking -> combat). Replaces drei PointerLockControls' events now
  // that mouse-look is driven manually.
  useEffect(() => {
    const onChange = () => {
      if (document.pointerLockElement === gl.domElement) {
        useCommand.getState().setMode("combat");
      } else {
        if (useGame.getState().phase !== "battle") return;
        useCommand.getState().setMode("command");
        firing.current = false;
      }
    };
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, [gl]);

  // Death / revive animation driven by hero death flag + teleport on respawn.
  useEffect(() => {
    const a = animatorRef.current;
    if (heroDead && !dead.current) {
      dead.current = true;
      a?.die();
    } else if (!heroDead && dead.current) {
      dead.current = false;
      a?.revive();
      const s = heroSpawnPos();
      body.current?.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
      body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    if (phase === "menu") prevHealth.current = useGame.getState().health;
  }, [heroDead, animator, phase]);

  // Entering a battle uses a freshly generated map, so drop the hero onto its
  // terrain spawn (the rigidbody is never remounted across matches).
  useEffect(() => {
    if (phase !== "battle") return;
    const s = heroSpawnPos();
    body.current?.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
    body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }, [phase]);

  function startReload() {
    if (melee.current) return;
    const g = useGame.getState();
    if (g.reloading || g.ammo >= g.magazine || g.reserve <= 0) return;
    g.setReloading(true);
    reloadTimer.current = rangedDef.current.reloadTime;
  }

  // Q swaps the active weapon between the two carried arsenals. Melee is
  // ammo-free; switching to ranged tops the magazine for that weapon.
  function setActive(mode: "ranged" | "melee") {
    const a = animatorRef.current;
    activeMode.current = mode;
    melee.current = mode === "melee";
    // Drop any shield guard when leaving (or entering) a mode.
    if (blocking.current) {
      blocking.current = false;
      EM.heroBlocking = false;
      a?.block(false);
    }
    const g = useGame.getState();
    const tune = useWeaponTuning.getState();
    weaponSkillsRef.current = warlordSkillsForLoadout(meleeId, rangedId, mode);
    void animatorRef.current?.preloadWeaponSkills(weaponSkillsRef.current);
    g.setHeroActiveWeapon(mode);
    if (mode === "ranged") {
      const w = rangedDef.current;
      const t = w.model ? tune.tuning[w.model] : null;
      a?.setWeaponFull(w.animClass, true, w.model ?? null, t ?? null);
      tune.setActiveKey(w.model ?? null);
      g.setWeaponAmmo(w.magazine, w.magazine, w.reserve);
      g.pushMessage(w.name.toUpperCase(), "info");
    } else {
      const m = meleeDef.current;
      const t = m.model ? tune.tuning[m.model] : null;
      a?.setWeaponFull(m.animClass, true, m.model ?? null, t ?? null);
      tune.setActiveKey(m.model ?? null);
      g.pushMessage(m.name.toUpperCase(), "info");
    }
    fireCooldown.current = 0.15;
  }

  function swapWeapon() {
    if (useGame.getState().phase !== "battle") return;
    if (useCommand.getState().mode !== "combat" || dead.current) return;
    setActive(activeMode.current === "ranged" ? "melee" : "ranged");
  }

  /** Fire a canonical weapon-skill (Digit1–6) — baked anim + crosshair-centered hit. */
  function castWeaponSkill(slot: number) {
    if (useCommand.getState().mode !== "combat" || dead.current) return;
    const skill = weaponSkillsRef.current[slot];
    if (!skill) return;
    const g = useGame.getState();
    if (!g.weaponSkillReady(skill.id)) return;
    const a = animatorRef.current;
    if (!a?.castWeaponSkill(skill)) return;
    g.startWeaponSkillCooldown(skill.id, skill.cooldown);
    camera.getWorldDirection(_aim);
    _aim.normalize();
    applyWeaponSkillHit(
      skill,
      camera.position,
      _aim,
      apiWeaponForLoadout(meleeId, rangedId, activeMode.current),
      g.damageMult,
    );
    g.pushMessage(skill.label.toUpperCase(), "info");
  }

  // Resolve one hitscan pellet along `_ray` for ranged weapon `w` and draw its
  // tracer (an arcing arrow for bow-type weapons, a straight bolt otherwise).
  function pelletHit(w: RangedWeaponDef, dmgMult: number) {
    let best: CombatEntity | null = null;
    let bestDist = w.range;
    const consider = (ent: CombatEntity, radius: number) => {
      _tmp.copy(ent.pos).sub(_origin);
      const proj = _tmp.dot(_ray);
      if (proj < 0 || proj > bestDist) return;
      _hitPoint.copy(_origin).addScaledVector(_ray, proj);
      if (_hitPoint.distanceTo(ent.pos) <= radius && proj < bestDist) {
        bestDist = proj;
        best = ent;
      }
    };
    for (const u of EM.units) {
      if (!u.alive || (u.faction !== "enemy" && u.faction !== "neutral")) continue;
      consider(u, 0.9 * u.def.scale);
    }
    for (const s of EM.structures) {
      if (!s.alive || s.faction !== "enemy" || !isAttackable(s)) continue;
      consider(s, structRadius(s.kind));
    }
    let bestTree: TreeEntity | null = null;
    for (const tr of EM.trees) {
      if (!tr.alive) continue;
      _tmp.copy(tr.pos).setY(tr.pos.y + 1.4 * tr.scale).sub(_origin);
      const proj = _tmp.dot(_ray);
      if (proj < 0 || proj >= bestDist) continue;
      _hitPoint.copy(_origin).addScaledVector(_ray, proj);
      _treeTop.copy(tr.pos).setY(tr.pos.y + 1.4 * tr.scale);
      if (_hitPoint.distanceTo(_treeTop) <= tr.radius + 0.4) {
        bestDist = proj;
        bestTree = tr;
        best = null;
      }
    }

    const tracer = (target: THREE.Vector3) => {
      if (w.mode === "arrow" && w.projectile) {
        EM.addProjectile(w.projectile, _muz.clone(), target, { arc: w.arc });
      } else {
        EM.addBolt(_muz.clone(), target);
      }
    };

    if (best !== null) {
      const ent = best as CombatEntity;
      const ty = isUnit(ent) ? ent.pos.y + 0.4 * ent.def.scale : ent.pos.y + 1.4;
      const target = ent.pos.clone().setY(ty);
      tracer(target);
      heroDealDamage(ent, w.damage * dmgMult * EM.factionDmgMult("ally"));
    } else if (bestTree !== null) {
      const tr = bestTree as TreeEntity;
      tracer(tr.pos.clone().setY(tr.pos.y + 1.4 * tr.scale));
      EM.damageTree(tr, w.damage);
    } else {
      tracer(_origin.clone().addScaledVector(_ray, w.range));
    }
  }

  // Grenade launcher: lob an arcing AoE projectile that detonates on the first
  // blocker along the aim (or at max range). All damage is its splash.
  function lobGrenade(w: RangedWeaponDef, dmgMult: number) {
    let dist = w.range;
    const scan = (pos: THREE.Vector3, radius: number) => {
      _tmp.copy(pos).sub(_origin);
      const proj = _tmp.dot(_aim);
      if (proj < 0 || proj > dist) return;
      _hitPoint.copy(_origin).addScaledVector(_aim, proj);
      if (_hitPoint.distanceTo(pos) <= radius) dist = proj;
    };
    for (const u of EM.units) {
      if (!u.alive || (u.faction !== "enemy" && u.faction !== "neutral")) continue;
      scan(u.pos, 0.9 * u.def.scale);
    }
    for (const s of EM.structures) {
      if (!s.alive || s.faction !== "enemy" || !isAttackable(s)) continue;
      scan(s.pos, structRadius(s.kind));
    }
    const impact = _origin.clone().addScaledVector(_aim, dist);
    EM.addProjectile(w.projectile ?? "fire", _muz.clone(), impact, {
      faction: "ally",
      splashDamage: (w.splash?.damage ?? 0) * dmgMult * EM.factionDmgMult("ally"),
      splashRadius: w.splash?.radius,
      arc: w.arc,
    });
  }

  function fire() {
    const g = useGame.getState();
    if (g.reloading) return;
    if (g.ammo <= 0) {
      startReload();
      return;
    }
    const w = rangedDef.current;
    g.setAmmo(g.ammo - 1, g.reserve);

    camera.getWorldDirection(_aim);
    _aim.normalize();
    _origin.copy(camera.position);

    const a = animatorRef.current;
    const muzzleNode = a?.weaponMuzzle();
    if (a && muzzleNode) {
      a.root.updateMatrixWorld(true);
      muzzleNode.getWorldPosition(_muz);
    } else if (a) {
      a.root.updateMatrixWorld(true);
      a.character.mounts.rightHand.getWorldPosition(_muz);
      _muz.addScaledVector(_aim, 0.45);
    } else {
      _muz.copy(_origin).addScaledVector(_aim, 0.6);
    }
    EM.addMuzzleFlash(_muz);
    if (Math.random() < 0.5) EM.addSmoke(_muz.clone(), 0.25, new THREE.Vector3(_aim.x, 0.5, _aim.z));

    if (w.mode === "grenade") {
      lobGrenade(w, g.damageMult);
      return;
    }

    for (let p = 0; p < w.pellets; p++) {
      _ray.copy(_aim);
      if (w.spread > 0) {
        _ray.x += (Math.random() - 0.5) * w.spread;
        _ray.y += (Math.random() - 0.5) * w.spread;
        _ray.z += (Math.random() - 0.5) * w.spread;
      }
      _ray.normalize();
      pelletHit(w, g.damageMult);
    }
  }

  // Melee strike: an instant forward-cone hit (meleeConeHit) plus a short visual
  // flourish keyed to the weapon's style. Two-handed kits add a ground shockwave.
  function meleeSwing() {
    camera.getWorldDirection(_ray);
    _ray.y = 0;
    if (_ray.lengthSq() < 1e-6) return;
    _ray.normalize();

    const m = meleeDef.current;
    const a = animatorRef.current;
    a?.attack();

    const muzzleNode = a?.weaponMuzzle();
    if (a && muzzleNode) {
      a.root.updateMatrixWorld(true);
      muzzleNode.getWorldPosition(_muz);
    } else if (a) {
      a.root.updateMatrixWorld(true);
      a.character.mounts.rightHand.getWorldPosition(_muz);
      _muz.addScaledVector(_ray, 0.8);
    } else {
      _muz.copy(camera.position);
      _muz.addScaledVector(_ray, 0.8);
    }

    const dmgMult = useGame.getState().damageMult * EM.factionDmgMult("ally");
    const origin = new THREE.Vector3(EM.playerPos.x, EM.playerPos.y + 1, EM.playerPos.z);
    meleeConeHit(origin, _ray, m.reach, m.halfAngle, m.damage * dmgMult, "ally", m.color, true);

    if (m.style === "jab") {
      EM.addMuzzleFlash(_muz);
      for (let k = 0; k < 5; k++) EM.addEmber(_muz.clone(), m.color);
    } else {
      EM.addSlashWave({
        origin: _muz.clone(),
        dir: _ray.clone(),
        range: m.reach,
        speed: m.style === "slam" ? 26 : 40,
        width: m.reach * 0.5,
        damage: 0,
        color: m.color,
        faction: "ally",
        spawnShock: false,
        shockRadius: 0,
        shockDamage: 0,
        shockDuration: 0,
      });
      for (let k = 0; k < 5; k++) EM.addEmber(_muz.clone(), m.color);
    }
    // Heavy two-handed slams kick the camera; lighter slashes give a faint tap.
    EM.addShake(m.style === "slam" ? 0.14 : 0.05);

    if (m.shock) {
      EM.addShockwave({
        pos: new THREE.Vector3(EM.playerPos.x, 0.1, EM.playerPos.z),
        maxRadius: m.shock.radius,
        duration: m.shock.duration,
        damage: m.shock.damage * dmgMult,
        color: m.color,
        faction: "ally",
      });
      EM.addMuzzleFlash(_muz);
      EM.addShake(0.18);
    }
  }

  // Warstride (Q): a short forward burst. Captures the camera's flat heading and
  // lets the frame loop drive a high-speed dash for DASH.duration seconds.
  function triggerDash() {
    if (useCommand.getState().mode !== "combat" || dead.current) return;
    camera.getWorldDirection(_dash);
    _dash.y = 0;
    if (_dash.lengthSq() < 1e-6) return;
    _dash.normalize();
    if (!useGame.getState().triggerAbility("dash")) return;
    dashDir.current.copy(_dash);
    dashTimer.current = DASH.duration;
    const o = new THREE.Vector3(EM.playerPos.x, 0.4, EM.playerPos.z);
    for (let k = 0; k < 8; k++) EM.addEmber(o.clone(), ABILITIES.dash.color);
  }

  // Double-tap-direction dodge roll: a brief evasive burst in the tapped facing
  // (camera-relative), gated by a cooldown. The roll clip plays on the animator
  // and the frame loop drives the burst velocity for ROLL_DURATION seconds.
  function triggerRoll(dir: "F" | "B" | "L" | "R") {
    if (useGame.getState().phase !== "battle") return;
    if (useCommand.getState().mode !== "combat" || dead.current) return;
    if (rollCd.current > 0 || rollTimer.current > 0) return;
    camera.getWorldDirection(_front);
    _front.y = 0;
    if (_front.lengthSq() < 1e-6) return;
    _front.normalize();
    _side.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _side.y = 0;
    _side.normalize();
    _dash.set(0, 0, 0);
    if (dir === "F") _dash.add(_front);
    else if (dir === "B") _dash.sub(_front);
    else if (dir === "R") _dash.add(_side);
    else _dash.sub(_side);
    if (_dash.lengthSq() < 1e-6) return;
    _dash.normalize();
    rollDir.current.copy(_dash);
    rollTimer.current = ROLL_DURATION;
    rollCd.current = ROLL_COOLDOWN;
    animatorRef.current?.roll(_dash);
    const o = new THREE.Vector3(EM.playerPos.x, 0.3, EM.playerPos.z);
    for (let k = 0; k < 6; k++) EM.addEmber(o.clone(), ABILITIES.dash.color);
  }

  // Warstomp (E): an instant area shockwave centred on the hero, reusing the
  // shared faction-aware shockwave system (damages enemies only, each once).
  function triggerSlam() {
    if (useCommand.getState().mode !== "combat" || dead.current) return;
    const g = useGame.getState();
    if (!g.triggerAbility("slam")) return;
    animatorRef.current?.attack();
    const center = new THREE.Vector3(EM.playerPos.x, 0.1, EM.playerPos.z);
    const slamMult = g.heroBonuses.slamDamageMult;
    EM.addShockwave({
      pos: center,
      maxRadius: SLAM.shockRadius,
      duration: SLAM.shockDuration,
      damage: SLAM.shockDamage * g.damageMult * slamMult * EM.factionDmgMult("ally"),
      color: ABILITIES.slam.color,
      faction: "ally",
    });
    EM.addMuzzleFlash(new THREE.Vector3(EM.playerPos.x, 0.5, EM.playerPos.z));
    EM.addShake(0.24);
    for (let k = 0; k < 16; k++) {
      EM.addEmber(new THREE.Vector3(EM.playerPos.x, 0.3, EM.playerPos.z), ABILITIES.slam.color);
    }
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const g = useGame.getState();
    const a = animatorRef.current;
    const rb = body.current;
    if (!rb) return;

    const playing = g.phase === "battle";
    const mode = useCommand.getState().mode;

    if (playing) g.tickAbilities(dt);

    if (g.reloading) {
      reloadTimer.current -= dt;
      if (reloadTimer.current <= 0) {
        const need = g.magazine - g.ammo;
        const take = Math.min(need, g.reserve);
        g.setAmmo(g.ammo + take, g.reserve - take);
        g.setReloading(false);
      }
    }

    const t = rb.translation();
    EM.playerPos.set(t.x, t.y, t.z);

    _front.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _front.y = 0;
    _front.normalize();
    _side.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _side.y = 0;
    _side.normalize();

    const keys = getKeys();
    _dir.set(0, 0, 0);
    // Hero only walks in combat mode; command mode is for issuing orders.
    const canMove = playing && !dead.current && mode === "combat";
    if (canMove) {
      if (keys.forward) _dir.add(_front);
      if (keys.back) _dir.sub(_front);
      if (keys.right) _dir.add(_side);
      if (keys.left) _dir.sub(_side);
    }
    const moving = _dir.lengthSq() > 1e-4;
    const sprint = keys.sprint && moving;
    // Sprint speed ramps in/out instead of snapping between walk and sprint.
    const targetSpeed = sprint ? PLAYER.sprintSpeed : PLAYER.speed;
    curSpeed.current = THREE.MathUtils.damp(curSpeed.current, targetSpeed, PLAYER.sprintRamp, dt);
    const speed = curSpeed.current;
    if (moving) _dir.normalize();

    const vel = rb.linvel();
    // Warstride / dodge-roll override normal movement with a fixed burst velocity
    // for their brief duration. Resolve the horizontal velocity once here so the
    // terrain-grounding and jump branches below reuse it.
    dashTimer.current -= dt;
    rollTimer.current -= dt;
    rollCd.current -= dt;
    const dashing = dashTimer.current > 0 && canMove;
    const rolling = rollTimer.current > 0 && canMove;

    // Grounded test up front so movement can choose ground vs. air accel; the
    // floor clamp below re-affirms it (the trimesh floor is infinitely thin).
    const floorY = EM.map.heightAt(t.x, t.z) + FEET_OFFSET;
    const onGround = t.y <= floorY + 0.15;

    let hvx: number;
    let hvz: number;
    if (rolling) {
      hvx = rollDir.current.x * ROLL_SPEED;
      hvz = rollDir.current.z * ROLL_SPEED;
    } else if (dashing) {
      hvx = dashDir.current.x * DASH.speed;
      hvz = dashDir.current.z * DASH.speed;
    } else {
      // Momentum: ease the horizontal velocity toward the target rather than
      // snapping, so the hero has weight but still reacts immediately. Ground uses
      // a brisk accel (and a slightly stronger decel to a stop); air uses a soft
      // accel so a jump keeps its momentum yet still allows slight mid-air steering.
      const tvx = _dir.x * speed;
      const tvz = _dir.z * speed;
      const accel = onGround ? (moving ? PLAYER.groundAccel : PLAYER.groundDecel) : PLAYER.airAccel;
      const maxDelta = accel * dt;
      const dvx = tvx - vel.x;
      const dvz = tvz - vel.z;
      const dlen = Math.hypot(dvx, dvz);
      if (dlen <= maxDelta || dlen < 1e-6) {
        hvx = tvx;
        hvz = tvz;
      } else {
        const sc = maxDelta / dlen;
        hvx = vel.x + dvx * sc;
        hvz = vel.z + dvz * sc;
      }
    }
    rb.setLinvel({ x: hvx, y: vel.y, z: hvz }, true);

    // Hard terrain clamp. The trimesh floor collider is infinitely thin, so fast
    // moves (dash/roll), attack one-shots, or steep slopes can tunnel the capsule
    // straight through it and the hero falls out of the world. Rather than trust
    // the collider, pin the capsule to the heightmap every frame: if it has sunk
    // below the terrain surface, lift it back and kill any downward velocity. This
    // keeps the hero grounded deterministically while still allowing jumps/arcs
    // (which raise t.y above the floor, so the clamp is a no-op on the way up).
    if (t.y < floorY) {
      rb.setTranslation({ x: t.x, y: floorY, z: t.z }, true);
      if (vel.y < 0) rb.setLinvel({ x: hvx, y: 0, z: hvz }, true);
      t.y = floorY;
    }

    grounded.current = t.y <= floorY + 0.15;
    if (canMove && keys.jump && grounded.current && !jumping.current) {
      rb.setLinvel({ x: hvx, y: PLAYER.jumpForce, z: hvz }, true);
      jumping.current = true;
      a?.jump();
    }
    if (jumping.current && grounded.current && vel.y <= 0.01) {
      jumping.current = false;
      a?.land();
    }

    let heroYaw: number;
    if (mode === "combat") {
      heroYaw = Math.atan2(_front.x, _front.z);
      commandYaw.current = heroYaw;
    } else if (moving) {
      heroYaw = Math.atan2(_dir.x, _dir.z);
    } else {
      heroYaw = a ? a.root.rotation.y : commandYaw.current;
    }

    if (a) {
      const baseY = t.y - FEET_OFFSET;
      a.root.position.set(t.x, baseY + groundCorr.current, t.z);
      // Ease the model's facing toward the target yaw so turns carry weight.
      // Combat aim stays near-instant; free-move turns are heavier. A large
      // delta (mode flip / respawn / teleport) snaps instead of spinning.
      {
        const turnRate = mode === "combat" ? 22 : 9;
        let d = heroYaw - modelYaw.current;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) > 2.2) modelYaw.current = heroYaw;
        else modelYaw.current += d * (1 - Math.exp(-turnRate * dt));
      }
      a.root.rotation.y = modelYaw.current;

      if (!dead.current && !jumping.current) {
        const intensity = moving ? (sprint ? 0.95 : 0.5) : 0;
        if (mode === "combat") {
          if (!aiming.current) {
            a.aim(true);
            aiming.current = true;
          }
          a.setStrafe(true);
          const fwd = _flat.set(Math.sin(heroYaw), 0, Math.cos(heroYaw));
          const localZ = _dir.x * fwd.x + _dir.z * fwd.z;
          const localX = _dir.x * fwd.z - _dir.z * fwd.x;
          a.setLocomotion({ x: localX, z: localZ, speed: intensity, running: sprint });
        } else {
          if (aiming.current) {
            a.aim(false);
            aiming.current = false;
          }
          a.setStrafe(false);
          a.setLocomotion({ x: 0, z: 0, speed: 0, running: false });
        }
      }

      a.update(dt);

      // Plant the feet on the terrain. The capsule-derived FEET_OFFSET only
      // grounds the rig in its bind pose; idle/stance clips (and per-weapon-class
      // differences in hip baseline) leave the soles hovering. Measure the lowest
      // sole in the live pose and ease the model up/down so it rests on the
      // heightmap. Skipped while airborne (jump/dash/roll) so those arcs keep
      // leaving the ground; the smoothing then re-lands the feet flat.
      const airborne = jumping.current || dashing || rolling;
      let targetCorr = 0;
      if (!airborne && grounded.current && !dead.current) {
        const terrain = EM.map.heightAt(t.x, t.z);
        targetCorr = groundCorr.current + (terrain - a.character.lowestSoleWorldY());
      }
      groundCorr.current += (targetCorr - groundCorr.current) * Math.min(1, 14 * dt);
      a.root.position.y = baseY + groundCorr.current;
    }

    hitCooldown.current -= dt;
    if (g.health < prevHealth.current && g.health > 0 && hitCooldown.current <= 0 && a && !dead.current) {
      const dmg = prevHealth.current - g.health;
      const severity = dmg / Math.max(1, g.maxHealth);
      const { key, fade } = pickHitReaction(severity, moving, lastHit.current);
      lastHit.current = key;
      a.reaction(key, fade);
      // Heavier reactions own the body longer, so gate the next reaction behind a
      // proportional recovery: a flinch frees up fast, a knock-down locks longer.
      hitCooldown.current = severity >= HIT_HEAVY_FRAC ? 1.1 : severity >= HIT_MEDIUM_FRAC ? 0.8 : 0.5;
      aiming.current = false;
    }
    prevHealth.current = g.health;

    // Numpad camera nudge (command view only): 4/6 orbit, 8/2 tilt angle.
    if (keys.camLeft) camYaw.current -= CAM_ORBIT_SPEED * dt;
    if (keys.camRight) camYaw.current += CAM_ORBIT_SPEED * dt;
    if (keys.camUp)
      camPitch.current = THREE.MathUtils.clamp(camPitch.current + CAM_PITCH_SPEED * dt, CAM_PITCH_MIN, CAM_PITCH_MAX);
    if (keys.camDown)
      camPitch.current = THREE.MathUtils.clamp(camPitch.current - CAM_PITCH_SPEED * dt, CAM_PITCH_MIN, CAM_PITCH_MAX);

    _head.set(t.x, t.y - FEET_OFFSET + CAM_HEIGHT, t.z);
    const pcam = camera as THREE.PerspectiveCamera;
    if (mode === "combat") {
      const entering = prevMode.current !== "combat";
      // Custom mouse-look. Entering combat from the command view inherits the flat
      // heading and levels the pitch so the crosshair starts on the horizon; after
      // that the mousemove handler drives lookYaw/lookPitch and we ease the applied
      // orientation toward it for a touch of smoothing.
      if (entering) {
        camera.getWorldDirection(_camDir);
        _camDir.y = 0;
        if (_camDir.lengthSq() > 1e-6) {
          _camDir.normalize();
          lookYaw.current = Math.atan2(-_camDir.x, -_camDir.z);
        }
        lookPitch.current = 0;
        curYaw.current = lookYaw.current;
        curPitch.current = 0;
      }
      const ls = 1 - Math.exp(-dt / Math.max(0.0001, PLAYER.lookSmoothing));
      curYaw.current += (lookYaw.current - curYaw.current) * ls;
      curPitch.current += (lookPitch.current - curPitch.current) * ls;
      _euler.set(curPitch.current, curYaw.current, 0, "YXZ");
      camera.quaternion.setFromEuler(_euler);

      // Third-person orbit: offset the camera back along the FULL look direction
      // (pitch included) around the head pivot. Pitching down lifts the camera
      // up-and-back so the hero never blocks downward aim — the crosshair can sweep
      // the entire lower half of the screen, the way a third-person shooter should.
      _side.set(1, 0, 0).applyQuaternion(camera.quaternion);
      _side.y = 0;
      if (_side.lengthSq() > 1e-6) _side.normalize();
      camera.getWorldDirection(_camDir).normalize();
      _camTarget
        .copy(_head)
        .addScaledVector(_camDir, -COMBAT_DIST * zoom.current)
        .addScaledVector(_side, COMBAT_SHOULDER);
      // Pull the camera in when trees / walls / ridges block the pivot→camera ray
      // so the view and crosshair aim stay stable instead of clipping through geo.
      const occluded = resolveCameraOcclusion(scene, _head, _camTarget, animatorRef.current?.root ?? null);
      const fullLen = _head.distanceTo(_camTarget);
      const safeLen = _head.distanceTo(occluded);
      const wantFrac = fullLen > 1e-4 ? THREE.MathUtils.clamp(safeLen / fullLen, 0.22, 1) : 1;
      const occlEase = entering ? 1 : 1 - Math.exp(-22 * dt);
      camOcclFrac.current += (wantFrac - camOcclFrac.current) * occlEase;
      _camFinal.copy(_head).lerp(_camTarget, camOcclFrac.current);
      // Snap into place on entry, then ease for a smooth-but-tight follow.
      if (entering) {
        camOcclFrac.current = wantFrac;
        camera.position.copy(_camFinal);
      } else {
        camera.position.lerp(_camFinal, 1 - Math.exp(-PLAYER.camFollow * dt));
      }

      // Subtle FOV kick while sprinting (and a stronger one mid-dash) so speed reads.
      const wantFov = (sprint ? PLAYER.sprintFov : PLAYER.fov) + (dashing ? DASH_FOV_KICK : 0);
      if (Math.abs(pcam.fov - wantFov) > 0.02) {
        pcam.fov = THREE.MathUtils.damp(pcam.fov, wantFov, PLAYER.fovEase, dt);
        pcam.updateProjectionMatrix();
      }
    } else {
      const yaw = commandYaw.current + camYaw.current;
      _flat.set(Math.sin(yaw), 0, Math.cos(yaw));
      _camTarget.copy(_head).addScaledVector(_flat, -COMMAND_DIST * zoom.current);
      _camTarget.y += COMMAND_LIFT * zoom.current * camPitch.current;
      camera.position.lerp(_camTarget, 1 - Math.pow(0.001, dt));
      camera.lookAt(_head.x, t.y - FEET_OFFSET + 0.8, _head.z);
      // Restore the base FOV when out of combat.
      if (Math.abs(pcam.fov - PLAYER.fov) > 0.02) {
        pcam.fov = THREE.MathUtils.damp(pcam.fov, PLAYER.fov, PLAYER.fovEase, dt);
        pcam.updateProjectionMatrix();
      }
    }
    // Camera shake: jitter the final camera position by the current magnitude,
    // then decay it. Fed by player hits and heavy hero blows (EM.addShake).
    if (EM.shake > 0.0008) {
      const sk = EM.shake;
      camera.position.x += (Math.random() * 2 - 1) * sk;
      camera.position.y += (Math.random() * 2 - 1) * sk * 0.7;
      camera.position.z += (Math.random() * 2 - 1) * sk;
      EM.shake = sk * Math.exp(-SHAKE_DECAY * dt);
    } else if (EM.shake !== 0) {
      EM.shake = 0;
    }
    prevMode.current = mode;

    // Drop any shield guard the moment the hero leaves combat or dies.
    if ((mode !== "combat" || dead.current || !playing) && blocking.current) {
      blocking.current = false;
      EM.heroBlocking = false;
      animatorRef.current?.block(false);
    }

    fireCooldown.current -= dt;
    if (playing && !dead.current && mode === "combat" && firing.current && fireCooldown.current <= 0) {
      const atkSpd = 1 + g.heroBonuses.attackSpeedMult;
      if (melee.current) {
        meleeSwing();
        fireCooldown.current = meleeDef.current.swingRate / atkSpd;
      } else {
        fire();
        fireCooldown.current = rangedDef.current.fireRate / atkSpd;
      }
    }
  });

  return (
    <>
      {animator && <primitive object={animator.root} />}
      <RigidBody
        ref={body}
        colliders={false}
        mass={1}
        position={[spawn0.x, spawn0.y, spawn0.z]}
        enabledRotations={[false, false, false]}
        canSleep={false}
        linearDamping={0.6}
      >
        <CapsuleCollider args={[PLAYER.height / 2, PLAYER.radius]} />
      </RigidBody>
    </>
  );
}
