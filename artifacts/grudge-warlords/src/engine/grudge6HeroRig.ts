/**
 * GRUDGE6 Bip001 warlord rig — player + enemy hero visuals (viewer pipeline).
 * Drop-in subset of the legacy voxel Animator API used by Player/EnemyHero.
 */

import * as THREE from "three";
import type { AnimPackId } from "@workspace/game-content";
import type { ActionKey, MoveInput, WeaponClass } from "../game/anim/types";
import {
  CAMERA_OCCLUDE_SKIP,
} from "../game/cameraOcclusion";
import type { WarlordWeaponSkill } from "../game/warlordWeaponSkills";
import {
  GRUDGE6_FACE_YAW,
  loadBakedClipByRel,
  loadGrudge6CharacterInstance,
  type PreparedGrudge6Character,
} from "./grudge6Character";
import { findNativeClip } from "./sourceClips";
export { GRUDGE6_FACE_YAW };
import { resolveHandBoneName } from "./mixamoRetarget";
import {
  enemyWarlordTypeId,
  gearPresetFor,
  playerWarlordTypeId,
  resolveUnitDef,
} from "./grudge6";

/** Map carried weapon anim classes to baked Bip001 stance packs. */
export function weaponClassToAnimPack(wc: WeaponClass): AnimPackId {
  switch (wc) {
    case "bow":
      return "longbow";
    case "ranged":
      return "rifle";
    case "pistol":
      return "pistol";
    case "magic":
      return "magic";
    case "sword":
    case "greatsword":
    case "greataxe":
    case "hammer":
    case "hammer2h":
    case "axe":
    case "spear":
    case "mace":
    case "knife":
      return "sword_shield";
    default:
      return "unarmed";
  }
}

/** Minimal character facade so Player can call recolor / mounts without voxel rig. */
class Grudge6CharacterFacade {
  constructor(private rig: Grudge6HeroRig) {}
  recolor(look: unknown): void {
    // Only armor/cloth — skin + weapons keep real atlas colors
    const hex =
      look && typeof look === "object" && look !== null && "color" in look
        ? String((look as { color?: string }).color ?? "")
        : typeof look === "string"
          ? look
          : "";
    if (!hex) return;
    void import("./grudge6Character").then(({ applyFactionGearColors }) => {
      applyFactionGearColors(this.rig.root, hex);
    });
  }
  lowestSoleWorldY(): number {
    return this.rig.lowestSoleWorldY();
  }
  get mounts() {
    const hand = this.rig.weaponMuzzle() ?? this.rig.root;
    return { rightHand: hand, leftHand: hand };
  }
}

export class Grudge6HeroRig {
  readonly root: THREE.Group;
  readonly character: Grudge6CharacterFacade;
  private prepared: PreparedGrudge6Character;
  private handBone: THREE.Object3D | null = null;
  private _lowestSole = 0;
  private moving = false;
  private sprinting = false;
  private skillClips = new Map<string, THREE.AnimationClip>();
  private skillLoadGen = 0;

  private disposePrepared: (() => void) | null = null;

  private constructor(
    prepared: PreparedGrudge6Character,
    disposePrepared?: () => void,
  ) {
    this.prepared = prepared;
    this.disposePrepared = disposePrepared ?? null;
    this.root = prepared.root;
    this.root.userData[CAMERA_OCCLUDE_SKIP] = true;
    this.character = new Grudge6CharacterFacade(this);
    const handName = resolveHandBoneName(this.root, "R");
    this.handBone = this.root.getObjectByName(handName) ?? null;
    this.refreshSoleY();
  }

  static async create(opts: {
    typeId: string;
    fitHeight?: number;
    tint?: string;
    animPack?: AnimPackId;
  }): Promise<Grudge6HeroRig> {
    // Independent instance — never mount the shared cache root (stolen mesh / T-pose).
    const prepared = await loadGrudge6CharacterInstance(opts.typeId, {
      // ~1.85 m humanoid — matches PLAYER capsule + grudge6 TARGET height
      fitHeight: opts.fitHeight ?? 1.85,
      tint: opts.tint,
      animPack: opts.animPack,
    });
    const rig = new Grudge6HeroRig(prepared, prepared.dispose);
    try {
      prepared.director.setGaitTarget(false, false);
      const idle = prepared.actions.idle ?? prepared.actions.walk;
      idle?.reset?.().setEffectiveWeight?.(1).fadeIn?.(0.12).play?.();
    } catch {
      /* ignore */
    }
    try {
      rig.refreshSoleY();
    } catch {
      /* ignore */
    }
    return rig;
  }

  static async forPlayer(opts: {
    raceId: Parameters<typeof playerWarlordTypeId>[0];
    classId: Parameters<typeof playerWarlordTypeId>[1];
    animPack: AnimPackId;
    tint?: string;
  }): Promise<Grudge6HeroRig> {
    try {
      let race = opts.raceId || "human";
      let cls = opts.classId || "warrior";
      let typeId = playerWarlordTypeId(race, cls);
      if (!resolveUnitDef(typeId)?.grudge) typeId = "human_warrior";
      const pack = opts.animPack || "sword_shield";
      return await Grudge6HeroRig.create({
        typeId,
        animPack: pack,
        tint: opts.tint,
        fitHeight: 1.85,
      });
    } catch (err) {
      console.warn("[grudge-warlords] forPlayer fallback human_warrior", err);
      return Grudge6HeroRig.create({
        typeId: "human_warrior",
        animPack: "sword_shield",
        fitHeight: 1.85,
      });
    }
  }

  static async forEnemyWarlord(tint = "#d65a47"): Promise<Grudge6HeroRig> {
    const typeId = enemyWarlordTypeId();
    const def = resolveUnitDef(typeId);
    const pack = def?.grudge
      ? (gearPresetFor(def.grudge.raceId, def.grudge.classId)?.animPack ?? "sword_shield")
      : "sword_shield";
    return Grudge6HeroRig.create({
      typeId,
      fitHeight: 2.35,
      tint,
      animPack: pack as AnimPackId,
    });
  }

  lowestSoleWorldY(): number {
    return this._lowestSole;
  }

  private refreshSoleY(): void {
    this.root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(this.root);
    this._lowestSole = box.min.y;
  }

  async setWeapon(animClass: WeaponClass): Promise<void> {
    const pack = weaponClassToAnimPack(animClass);
    await this.prepared.swapAnimPack(pack);
  }

  /** Legacy signature — model/tuning ignored; gear is on the Bip001 preset meshes. */
  setWeaponFull(
    animClass: WeaponClass,
    _instant?: boolean,
    _model?: string | null,
    _tuning?: unknown,
  ): void {
    void this.setWeapon(animClass);
  }

  /** Rooted / moving melee — returns clip duration (seconds) for combat lock. */
  attack(): number {
    const clip = this.prepared.attackClip;
    const dur = Math.max(0.35, clip?.duration ?? 0.55);
    this.prepared.director.requestOneShot(clip, { fade: 0.08, timeScale: 1 });
    return dur;
  }

  /** World yaw offset so kit +X faces movement (+Z at yaw 0). */
  get faceYawOffset(): number {
    return GRUDGE6_FACE_YAW;
  }

  /** Preload skill clips — native file clips first, baked JSON only as fill. */
  async preloadWeaponSkills(skills: WarlordWeaponSkill[]): Promise<void> {
    const gen = ++this.skillLoadGen;
    const native = this.prepared.sourceClips ?? [];
    await Promise.all(
      skills.map(async (sk) => {
        const key = sk.baked || sk.id;
        if (this.skillClips.has(key)) return;
        const fromFile = findNativeClip(native, sk.animKey, sk.label, sk.id, key);
        if (fromFile) {
          this.skillClips.set(key, fromFile);
          this.skillClips.set(sk.id, fromFile);
          return;
        }
        if (!sk.baked) return;
        const clip = await loadBakedClipByRel(sk.baked, this.root);
        if (clip && gen === this.skillLoadGen) {
          this.skillClips.set(key, clip);
          this.skillClips.set(sk.id, clip);
        }
      }),
    );
  }

  /** Play a skill clip through the AnimationDirector overlay channel. */
  castWeaponSkill(skill: WarlordWeaponSkill): boolean {
    const clip =
      this.skillClips.get(skill.baked) ??
      this.skillClips.get(skill.id) ??
      findNativeClip(this.prepared.sourceClips ?? [], skill.animKey, skill.label, skill.id) ??
      this.prepared.attackClip;
    if (!clip) return false;
    this.prepared.director.requestOneShot(clip, { fade: 0.1, blend: skill.blend ?? 0.92 });
    return true;
  }

  setLocomotion(input: MoveInput): void {
    this.moving = input.speed > 0.08;
    this.sprinting = input.running && this.moving;
    this.prepared.director.setGaitTarget(this.moving, this.sprinting);
  }

  aim(_on: boolean): void {}
  setStrafe(_on: boolean): void {}
  block(_on: boolean): void {}
  reaction(_key: ActionKey, _fade?: number): void {}
  roll(_dir: THREE.Vector3): void {
    this.attack();
  }
  jump(): void {}
  land(): void {}
  die(): void {
    this.root.visible = false;
  }
  revive(): void {
    this.root.visible = true;
    this.prepared.director.setGaitTarget(false, false);
  }
  update(dt: number): void {
    this.prepared.director.update(dt);
    this.refreshSoleY();
  }
  weaponMuzzle(): THREE.Object3D | null {
    return this.handBone;
  }
  /** Legacy voxel weapon tuner — gear weapons are on the Bip001 preset meshes. */
  retuneWeapon(_tuning: unknown): void {}
  dispose(): void {
    if (this.disposePrepared) {
      try {
        this.disposePrepared();
      } catch {
        /* ignore */
      }
      this.disposePrepared = null;
      return;
    }
    try {
      this.prepared.director.dispose();
    } catch {
      /* ignore */
    }
    this.prepared.mixer.stopAllAction();
  }
}