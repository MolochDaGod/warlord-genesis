import * as THREE from "three";
import type { WeaponClass } from "./types";
import type { VoxelCharacter } from "./rig";
import { getWeaponModelProto, type WeaponModelKey } from "./weaponModels";
import type { WeaponTuning } from "../weaponTuning";

/**
 * Procedural, low-poly weapon props mounted on the character's hand bones. They
 * are intentionally simple box/cylinder builds (no external assets) so the
 * library stays self-contained. Each builder returns a group whose origin sits
 * at the grip, oriented so +Y runs along the weapon toward the blade/limb tip.
 */

/**
 * A grip anchor that lives on the weapon mesh. The character's *support* hand is
 * IK-solved onto this each frame so two-handed weapons are held with both hands.
 */
export interface WeaponGrip {
  /** Anchor node parented to the weapon group (drives the support-hand target). */
  node: THREE.Object3D;
  /** Which hand grips here (the OFF hand relative to the weapon's mount). */
  hand: "left" | "right";
  /** Optional local orientation offset applied when aligning the hand to the grip. */
  rotOffset?: THREE.Quaternion;
}

export interface MountedWeapons {
  /** Everything added to the hands, for disposal/removal. */
  objects: THREE.Object3D[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  /** The off-hand (left-hand) prop, if any — toggled when a throwable is thrown. */
  offhand?: THREE.Object3D | null;
  /** Two-handed support grip the off hand locks onto via IK, if any. */
  supportGrip?: WeaponGrip | null;
  /** The real-model key in use (null for procedural props). */
  modelKey?: WeaponModelKey | null;
  /** The tunable holder group for a real model (transform == live tuning). */
  holder?: THREE.Group | null;
  /** The muzzle / tip node where shots originate (real models only). */
  muzzle?: THREE.Object3D | null;
}

const EMPTY: MountedWeapons = { objects: [], geometries: [], materials: [] };

/**
 * Apply a tuning record to a real-model holder + muzzle node. Shared by the
 * initial mount and the live retune path so both stay in sync.
 */
export function applyTuningTo(w: MountedWeapons, t: WeaponTuning): void {
  // Tuning is persisted to localStorage, so a stale/corrupt entry (e.g. a slider
  // dragged to an extreme, or an old schema) could mount a hand weapon at a wild
  // scale or offset — the "giant model floating over the map" on weapon swap.
  // Clamp every field to a sane hand-prop range so bad data can never explode it.
  const sc = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  if (w.holder) {
    w.holder.position.set(sc(t.px, -1, 1), sc(t.py, -1, 1), sc(t.pz, -1, 1));
    w.holder.rotation.set(t.rx, t.ry, t.rz);
    w.holder.scale.setScalar(sc(t.scale, 0.05, 4));
  }
  if (w.muzzle) w.muzzle.position.set(sc(t.mx, -2, 2), sc(t.my, -2, 2), sc(t.mz, -2, 2));
}

/**
 * Mount a loaded real voxel model on the given hand via a tunable holder group.
 * Returns true when the proto was available and mounted; false when it hasn't
 * loaded yet (caller should fall back to a procedural prop).
 */
function mountModel(
  w: MountedWeapons,
  character: VoxelCharacter,
  modelKey: WeaponModelKey,
  tuning: WeaponTuning | undefined,
): boolean {
  const proto = getWeaponModelProto(modelKey);
  if (!proto) return false;
  const holder = new THREE.Group();
  holder.add(proto);
  const muzzle = new THREE.Object3D();
  holder.add(muzzle);
  const hand = modelKey === "bow" ? character.mounts.leftHand : character.mounts.rightHand;
  hand.add(holder);
  w.objects.push(holder);
  w.modelKey = modelKey;
  w.holder = holder;
  w.muzzle = muzzle;
  // Collect the cloned proto's geometries/materials are shared with the cache, so
  // do NOT dispose them on unmount — only detach the holder (handled in unmount).
  if (tuning) applyTuningTo(w, tuning);
  return true;
}

/**
 * Create a grip anchor at a local position/orientation on a weapon group. The node
 * is invisible (an empty Object3D); its world transform is the support-hand IK
 * target and the desired hand orientation.
 */
function addGrip(
  group: THREE.Object3D,
  hand: "left" | "right",
  pos: THREE.Vector3Tuple,
  euler?: THREE.Vector3Tuple,
): WeaponGrip {
  const node = new THREE.Object3D();
  node.position.set(pos[0], pos[1], pos[2]);
  if (euler) node.rotation.set(euler[0], euler[1], euler[2]);
  group.add(node);
  const rotOffset = euler ? new THREE.Quaternion().setFromEuler(node.rotation) : undefined;
  return { node, hand, rotOffset };
}

function track(w: MountedWeapons, obj: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  w.geometries.push(geo);
  w.materials.push(mat);
  obj.add(mesh);
  return mesh;
}

function buildSword(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#cfd6e0", metalness: 0.6, roughness: 0.35 });
  const grip = new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 0.8 });
  const blade = track(w, g, new THREE.BoxGeometry(0.07, 0.95, 0.02), steel);
  blade.position.y = 0.6;
  const guard = track(w, g, new THREE.BoxGeometry(0.28, 0.06, 0.06), steel);
  guard.position.y = 0.12;
  const handle = track(w, g, new THREE.BoxGeometry(0.05, 0.22, 0.05), grip);
  handle.position.y = 0;
  return g;
}

function buildKnife(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#d7dde6", metalness: 0.7, roughness: 0.3 });
  const grip = new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.85 });
  // Short blade running up +Y from the grip, with a stubby guard and handle.
  const blade = track(w, g, new THREE.BoxGeometry(0.05, 0.34, 0.015), steel);
  blade.position.y = 0.27;
  const guard = track(w, g, new THREE.BoxGeometry(0.14, 0.04, 0.05), steel);
  guard.position.y = 0.1;
  const handle = track(w, g, new THREE.BoxGeometry(0.045, 0.18, 0.045), grip);
  handle.position.y = 0;
  return g;
}

function buildShield(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#6b4a2a", roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: "#b9c2cf", metalness: 0.55, roughness: 0.4 });
  const bossMat = new THREE.MeshStandardMaterial({ color: "#cfd6e0", metalness: 0.7, roughness: 0.3 });
  // The board's broad face normal runs along +Y and its long (height) axis along
  // +Z, so mounting with rotation (PI/2,0,0) — the same frame used for the other
  // off-hand props — turns the face to point forward with the shield held upright.
  const board = track(w, g, new THREE.BoxGeometry(0.5, 0.05, 0.62), wood);
  board.position.set(0, 0.02, 0.08);
  // Metal rim sits just behind the board face as a slightly larger backing plate.
  const rim = track(w, g, new THREE.BoxGeometry(0.56, 0.03, 0.68), rimMat);
  rim.position.set(0, -0.01, 0.08);
  // Central boss bulging out of the front face.
  const boss = track(w, g, new THREE.IcosahedronGeometry(0.09, 0), bossMat);
  boss.position.set(0, 0.07, 0.08);
  return g;
}

function buildGreatsword(w: MountedWeapons, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#c2cad6", metalness: 0.65, roughness: 0.32 });
  const grip = new THREE.MeshStandardMaterial({ color: "#4a3220", roughness: 0.82 });
  const blade = track(w, g, new THREE.BoxGeometry(0.11 * scale, 1.55 * scale, 0.03), steel);
  blade.position.y = 0.95 * scale;
  const guard = track(w, g, new THREE.BoxGeometry(0.42 * scale, 0.07, 0.07), steel);
  guard.position.y = 0.16 * scale;
  const handle = track(w, g, new THREE.BoxGeometry(0.055, 0.34 * scale, 0.055), grip);
  handle.position.y = 0;
  return g;
}

function buildAxe(w: MountedWeapons, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#b9c2cf", metalness: 0.6, roughness: 0.4 });
  const wood = new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 0.85 });
  const haft = track(w, g, new THREE.CylinderGeometry(0.035, 0.04, 1.0 * scale, 8), wood);
  haft.position.y = 0.45 * scale;
  // Axe head: a wedge near the top of the haft.
  const head = track(w, g, new THREE.BoxGeometry(0.32 * scale, 0.26 * scale, 0.06), steel);
  head.position.set(0.14 * scale, 0.82 * scale, 0);
  const back = track(w, g, new THREE.BoxGeometry(0.1, 0.18 * scale, 0.06), steel);
  back.position.set(-0.08 * scale, 0.82 * scale, 0);
  return g;
}

function buildMace(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#cfd4dc", metalness: 0.55, roughness: 0.45 });
  const wood = new THREE.MeshStandardMaterial({ color: "#4a3220", roughness: 0.85 });
  const haft = track(w, g, new THREE.CylinderGeometry(0.035, 0.04, 0.7, 8), wood);
  haft.position.y = 0.3;
  // Flanged head: a chunky box plus a capping sphere.
  const head = track(w, g, new THREE.BoxGeometry(0.2, 0.22, 0.2), steel);
  head.position.y = 0.74;
  const cap = track(w, g, new THREE.IcosahedronGeometry(0.13, 0), steel);
  cap.position.y = 0.74;
  return g;
}

function buildHammer(w: MountedWeapons, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#aeb6c2", metalness: 0.5, roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: "#4a3220", roughness: 0.85 });
  const haft = track(w, g, new THREE.CylinderGeometry(0.04, 0.045, 0.85 * scale, 8), wood);
  haft.position.y = 0.38 * scale;
  // Big blocky head.
  const head = track(w, g, new THREE.BoxGeometry(0.34 * scale, 0.24 * scale, 0.24 * scale), steel);
  head.position.y = 0.78 * scale;
  return g;
}

function buildSpear(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#cdd4de", metalness: 0.6, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: "#5a3a22", roughness: 0.85 });
  const shaft = track(w, g, new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8), wood);
  shaft.position.y = 0.7;
  // Leaf-shaped tip.
  const tip = track(w, g, new THREE.ConeGeometry(0.07, 0.32, 8), steel);
  tip.position.y = 1.66;
  return g;
}

function buildBow(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#6b4a2a", roughness: 0.8 });
  const string = new THREE.MeshStandardMaterial({ color: "#e8e2d0", roughness: 0.6 });
  const limb = track(w, g, new THREE.BoxGeometry(0.05, 1.2, 0.05), wood);
  limb.position.y = 0.2;
  // Slight recurve by rotating the riser ends.
  const top = track(w, g, new THREE.BoxGeometry(0.04, 0.3, 0.04), wood);
  top.position.set(0.05, 0.78, 0);
  top.rotation.z = 0.5;
  const bot = track(w, g, new THREE.BoxGeometry(0.04, 0.3, 0.04), wood);
  bot.position.set(0.05, -0.38, 0);
  bot.rotation.z = -0.5;
  const bowString = track(w, g, new THREE.BoxGeometry(0.01, 1.25, 0.01), string);
  bowString.position.set(0.09, 0.2, 0);
  return g;
}

function buildStaff(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#6a4a32", roughness: 0.8 });
  const gem = new THREE.MeshStandardMaterial({
    color: "#6fd6ff",
    emissive: "#2aa8ff",
    emissiveIntensity: 1.2,
    metalness: 0.2,
    roughness: 0.25,
  });
  // Shaft runs up +Y from the grip; a glowing orb caps the top.
  const shaft = track(w, g, new THREE.CylinderGeometry(0.035, 0.045, 1.3, 8), wood);
  shaft.position.y = 0.5;
  const orb = track(w, g, new THREE.IcosahedronGeometry(0.12, 0), gem);
  orb.position.y = 1.2;
  return g;
}

function buildRifle(w: MountedWeapons): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: "#33363d", metalness: 0.6, roughness: 0.4 });
  const stock = new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.85 });
  // Rifle lies along +Z (forward) from the grip.
  const body = track(w, g, new THREE.BoxGeometry(0.07, 0.1, 0.6), metal);
  body.position.set(0, 0.02, 0.2);
  const barrel = track(w, g, new THREE.CylinderGeometry(0.02, 0.02, 0.4, 10), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, 0.5);
  const butt = track(w, g, new THREE.BoxGeometry(0.06, 0.14, 0.18), stock);
  butt.position.set(0, -0.02, -0.12);
  return g;
}

/**
 * Build and mount the weapon set for a class onto the character's hands. Returns
 * the created objects/resources so the Animator can dispose them on a swap.
 * Local transforms tuned so the grips sit in the closed fist of each hand.
 */
export function mountWeapons(
  character: VoxelCharacter,
  weapon: WeaponClass,
  modelKey?: WeaponModelKey | null,
  tuning?: WeaponTuning,
): MountedWeapons {
  const w: MountedWeapons = { objects: [], geometries: [], materials: [] };

  // Real voxel model path: when a model key is supplied and the proto is loaded,
  // mount it in-hand. The sword keeps its procedural shield in the off hand so
  // the sword-and-shield loadout still reads correctly.
  if (modelKey && mountModel(w, character, modelKey, tuning)) {
    if (weapon === "sword") {
      const shield = buildShield(w);
      shield.position.set(0, 0.05, 0);
      shield.rotation.set(Math.PI / 2, 0, 0);
      character.mounts.leftHand.add(shield);
      w.objects.push(shield);
    } else if (weapon === "ranged") {
      // Long gun: lock the off hand onto the foregrip ahead of the trigger.
      w.supportGrip = addGrip(w.holder!, "left", [0, 0, 0.18]);
    }
    return w;
  }

  if (weapon === "sword") {
    const sword = buildSword(w);
    sword.position.set(0, 0.05, 0);
    sword.rotation.set(Math.PI / 2, 0, 0);
    character.mounts.rightHand.add(sword);
    // Off-hand: a real shield strapped to the left arm. This is the Sword & Shield
    // loadout (matching the sword-and-shield clip set), so the off-hand carries a
    // guard, not a throwable — w.offhand stays unset so no throw toggle applies.
    const shield = buildShield(w);
    shield.position.set(0, 0.05, 0);
    shield.rotation.set(Math.PI / 2, 0, 0);
    character.mounts.leftHand.add(shield);
    w.objects.push(sword, shield);
  } else if (weapon === "knife") {
    const knife = buildKnife(w);
    knife.position.set(0, 0.05, 0);
    knife.rotation.set(Math.PI / 2, 0, 0);
    character.mounts.rightHand.add(knife);
    w.objects.push(knife);
  } else if (
    weapon === "greatsword" ||
    weapon === "axe" ||
    weapon === "mace" ||
    weapon === "spear" ||
    weapon === "hammer" ||
    weapon === "greataxe" ||
    weapon === "hammer2h"
  ) {
    // Recombined melee roster: simple procedural props so AI duelists visibly
    // hold the right weapon. Two-handed variants are scaled up; all mount to the
    // right hand, grip at base, blade/haft running up +Y (rotate onto the bone).
    let prop: THREE.Group;
    if (weapon === "greatsword") prop = buildGreatsword(w);
    else if (weapon === "axe") prop = buildAxe(w);
    else if (weapon === "mace") prop = buildMace(w);
    else if (weapon === "spear") prop = buildSpear(w);
    else if (weapon === "hammer") prop = buildHammer(w);
    else if (weapon === "greataxe") prop = buildAxe(w, 1.5);
    else prop = buildHammer(w, 1.4); // hammer2h
    prop.position.set(0, 0.05, 0);
    prop.rotation.set(Math.PI / 2, 0, 0);
    character.mounts.rightHand.add(prop);
    w.objects.push(prop);
    // Two-handed variants: lock the left hand a little way up the haft/handle so
    // the off hand grips the shaft instead of dangling. Single-handed melee
    // (axe / mace / hammer) keep one hand and get no support grip.
    const twoHanded =
      weapon === "greatsword" || weapon === "spear" || weapon === "greataxe" || weapon === "hammer2h";
    if (twoHanded) {
      const supY = weapon === "spear" ? 0.5 : weapon === "greataxe" ? 0.34 : weapon === "hammer2h" ? 0.3 : 0.26;
      w.supportGrip = addGrip(prop, "left", [0, supY, 0]);
    }
  } else if (weapon === "bow") {
    const bow = buildBow(w);
    bow.position.set(0, 0.05, 0);
    bow.rotation.set(0, 0, Math.PI / 2);
    character.mounts.leftHand.add(bow);
    w.objects.push(bow);
  } else if (weapon === "ranged") {
    const rifle = buildRifle(w);
    rifle.position.set(0, 0, 0.05);
    character.mounts.rightHand.add(rifle);
    w.objects.push(rifle);
    // Two-handed long gun: the left hand locks onto the handguard ahead of the
    // trigger grip, matching the trigger hand's orientation (identity grip frame).
    w.supportGrip = addGrip(rifle, "left", [0, -0.01, 0.34]);
  } else if (weapon === "magic") {
    const staff = buildStaff(w);
    staff.position.set(0, 0.05, 0);
    staff.rotation.set(Math.PI / 2, 0, 0);
    character.mounts.rightHand.add(staff);
    w.objects.push(staff);
  } else {
    return EMPTY;
  }

  return w;
}

/** Remove and free a previously mounted weapon set. */
export function unmountWeapons(w: MountedWeapons): void {
  for (const o of w.objects) o.removeFromParent();
  for (const g of w.geometries) g.dispose();
  for (const m of w.materials) m.dispose();
  w.objects.length = 0;
  w.geometries.length = 0;
  w.materials.length = 0;
}
