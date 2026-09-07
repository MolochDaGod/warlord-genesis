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
  weaponTypeFromModel3d,
  type PreparedGrudge6Character,
} from "./grudge6Character";
export { weaponTypeFromModel3d };
import { findNativeClip } from "./sourceClips";
import { conceptClip, type ConceptId } from "./threeAnim";
export { GRUDGE6_FACE_YAW };
import { resolveHandBoneName } from "./mixamoRetarget";
import {
  enemyWarlordTypeId,
  gearPresetFor,
  playerWarlordTypeId,
  resolveUnitDef,
} from "./grudge6";

/**
 * characterTruth: anim set from equipped weapon, not class.
 * Six baked loco packs on assets.grudge-studio.com/anims/baked.
 */
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
      return "sword_shield";
    case "knife":
      return "unarmed";
    default:
      return "unarmed";
  }
}
