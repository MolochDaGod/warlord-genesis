import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CharacterLook } from "./types";

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Mount points the Animator/engine can attach weapons to. */
export interface WeaponMounts {
  rightHand: THREE.Object3D;
  leftHand: THREE.Object3D;
}

/**
 * A blocky, recolourable voxel character whose box meshes are rigidly parented
 * to a cloned 25-bone Mixamo skeleton. No skinning is used: each body box is a
 * child of the bone that drives it, so when the AnimationMixer rotates the bones
 * the boxes follow. Box dimensions are derived from the bind-pose joint spacing,
 * so the proportions match the Mixamo rig the clips were authored for.
 */
export class VoxelCharacter {
  /** Engine-facing root; feet rest at local y = 0, centred on x/z. */
  readonly root: THREE.Group;
  /** Cloned bone hierarchy root (the mixer binds clips against this). */
  readonly skeletonRoot: THREE.Object3D;
  readonly mounts: WeaponMounts;

  private readonly bones = new Map<string, THREE.Bone>();
  /** Foot/toe bones used to estimate the planted sole height for terrain grounding. */
  private readonly footBones: THREE.Bone[] = [];
  /**
   * Bind-pose height of the lowest foot/toe bone above the rig's sole (which `fit`
   * drops to root y = 0). Subtracting it from a foot bone's live world Y projects
   * the ankle/toe down to the actual sole so the engine can plant feet on terrain.
   */
  private bindFootOffset = 0;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly mats: Record<"skin" | "shirt" | "pants" | "boot" | "hat" | "eye", THREE.MeshStandardMaterial>;
  /**
   * When built from an external GLB part model the body is authored geometry, not
   * recolourable boxes, so recolor() is a no-op and these meshes are tracked for
   * disposal separately from the procedural box geometries.
   */
  private readonly modelMode: boolean;
  private readonly modelMeshes: THREE.Mesh[] = [];

  constructor(
    skeletonSource: THREE.Object3D,
    look: CharacterLook,
    targetHeight = 2,
    /**
     * Optional GLB part model (the loaded scene of `character-X.glb`). Its 6 static
     * part meshes (head/torso/arm-left/arm-right/leg-left/leg-right) are attached to
     * the matching skeleton bones so the rig animates the authored model instead of
     * the procedural boxes. Omit for the classic voxel-box avatar.
     */
    model?: THREE.Object3D,
  ) {
    this.root = new THREE.Group();
    this.root.name = "VoxelCharacter";

    // Independent bone hierarchy for this instance.
    this.skeletonRoot = cloneSkeleton(skeletonSource);
    this.root.add(this.skeletonRoot);
    this.root.updateMatrixWorld(true);

    this.skeletonRoot.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o as THREE.Bone);
    });

    this.mats = {
      skin: this.material(look.skin),
      shirt: this.material(look.shirt),
      pants: this.material(look.pants),
      boot: this.material("#2a2a32"),
      hat: this.material(look.hatColor),
      eye: this.material(look.eyeColor ?? "#15151b"),
    };

    this.modelMode = !!model;
    if (model) {
      this.attachModel(model);
      this.buildModelFrame();
    } else {
      this.buildBody(look);
    }

    // Weapon mounts ride the hand bones.
    this.mounts = {
      rightHand: this.addMount("mixamorigRightHand"),
      leftHand: this.addMount("mixamorigLeftHand"),
    };

    this.fit(targetHeight);
    this.measureFootGrounding();
  }

  /** Look up a bone by its sanitised Mixamo name (e.g. `mixamorigHips`). */
  getBone(name: string): THREE.Bone | undefined {
    return this.bones.get(name);
  }

  /** Recolour the avatar in place (shared materials, so this is cheap). */
  recolor(look: CharacterLook): void {
    // GLB models carry their own authored textures/materials — there is nothing
    // to tint, so live recolour is a no-op for model-backed characters.
    if (this.modelMode) return;
    this.mats.skin.color.set(look.skin);
    this.mats.shirt.color.set(look.shirt);
    this.mats.pants.color.set(look.pants);
    this.mats.hat.color.set(look.hatColor);
    this.mats.eye.color.set(look.eyeColor ?? "#15151b");
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
    for (const mesh of this.modelMeshes) {
      mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
    this.root.removeFromParent();
  }

  // --------------------------------------------------------------------- build

  private material(color: string): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0 });
  }

  /**
   * Attach the 6 static part meshes of a GLB character model onto the cloned
   * skeleton bones. The models are NOT skinned, so each whole-limb part is parented
   * rigidly to the bone that drives it (whole arm -> upper-arm bone, whole leg ->
   * upper-leg bone, etc.) exactly like the procedural boxes. We first scale + centre
   * the authored model to match the skeleton's bind-pose height and footing, then
   * use `bone.attach()` (which preserves each part's world transform) so the bind
   * pose lines up; once a clip plays, the parts ride their bones. Parts are matched
   * to bones by name, with a nearest-bone fallback for unrecognised names.
   */
  private attachModel(model: THREE.Object3D): void {
    const src = model.clone(true);
    src.scale.setScalar(1);
    src.position.set(0, 0, 0);
    src.rotation.set(0, 0, 0);

    // Skeleton bind-pose vertical span (foot -> head) to size the model against.
    this.root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const head = this.bones.get("mixamorigHead");
    const foot = this.bones.get("mixamorigLeftFoot") ?? this.bones.get("mixamorigLeftToeBase");
    const headY = head ? head.getWorldPosition(v.clone()).y : 1.6;
    const footY = foot ? foot.getWorldPosition(v.clone()).y : 0;
    const skelHeight = Math.max(0.2, headY - footY);

    // Size the authored model to the skeleton's bind height, then align feet to the
    // foot bone and centre it on x/z so the parts overlay their bones.
    this.root.add(src);
    this.root.updateMatrixWorld(true);
    let mbox = new THREE.Box3().setFromObject(src);
    const modelHeight = Math.max(1e-3, mbox.max.y - mbox.min.y);
    src.scale.setScalar(skelHeight / modelHeight);
    this.root.updateMatrixWorld(true);
    mbox = new THREE.Box3().setFromObject(src);
    const center = mbox.getCenter(new THREE.Vector3());
    src.position.x += -center.x;
    src.position.z += -center.z;
    src.position.y += footY - mbox.min.y;
    this.root.updateMatrixWorld(true);

    // Collect the part meshes (the leaf geometry) before reparenting mutates the tree.
    const parts: THREE.Mesh[] = [];
    src.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) parts.push(m);
    });

    // Side bones, resolved once. We disambiguate Left/Right by the part's actual
    // world-X position, NOT by the model's name token: these models label sides
    // from the viewer's perspective (both "*-left" parts sit on +X), which is the
    // mirror of Mixamo's anatomical Left/Right. Trusting the name attaches each
    // arm/leg to the opposite-side bone, so they animate the wrong way.
    const leftArm = this.bones.get("mixamorigLeftArm");
    const rightArm = this.bones.get("mixamorigRightArm");
    const leftLeg = this.bones.get("mixamorigLeftUpLeg");
    const rightLeg = this.bones.get("mixamorigRightUpLeg");
    const spine = this.bones.get("mixamorigSpine1");
    const boneX = (b?: THREE.Bone) =>
      b ? b.getWorldPosition(new THREE.Vector3()).x : 0;
    const nearerInX = (a: THREE.Bone | undefined, b: THREE.Bone | undefined, x: number) => {
      if (!a) return b;
      if (!b) return a;
      return Math.abs(x - boneX(a)) <= Math.abs(x - boneX(b)) ? a : b;
    };

    const boneFor = (rawName: string, partX: number): THREE.Bone | undefined => {
      const n = rawName.toLowerCase();
      if (n.includes("head") || n.includes("face") || n.includes("skull"))
        return head;
      if (n.includes("arm") || n.includes("hand"))
        return nearerInX(leftArm, rightArm, partX);
      if (n.includes("leg") || n.includes("foot") || n.includes("thigh"))
        return nearerInX(leftLeg, rightLeg, partX);
      if (n.includes("torso") || n.includes("chest") || n.includes("body") || n.includes("spine") || n.includes("pelvis") || n.includes("hip"))
        return spine;
      return undefined;
    };

    const nearestBone = (worldPos: THREE.Vector3): THREE.Bone | undefined => {
      let best: THREE.Bone | undefined;
      let bestD = Infinity;
      for (const b of this.bones.values()) {
        const d = b.getWorldPosition(new THREE.Vector3()).distanceToSquared(worldPos);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      return best;
    };

    for (const part of parts) {
      const worldPos = part.getWorldPosition(new THREE.Vector3());
      const named =
        boneFor(part.name, worldPos.x) ??
        (part.parent ? boneFor(part.parent.name, worldPos.x) : undefined);
      const bone = named ?? nearestBone(worldPos);
      if (!bone) continue;
      bone.attach(part); // preserves world transform; part now rides the bone
      part.castShadow = true;
      part.receiveShadow = true;
      this.modelMeshes.push(part);
    }

    src.removeFromParent();
  }

  /**
   * GLB part models ship only 6 chunky pieces (head/torso/2 arms/2 legs) with NO
   * pelvis, so the legs (parented to the UpLeg bones) and the torso (driven by the
   * spine) leave an open gap at the hips, and the head can float off the chest when
   * the spine bends. Build a small connective voxel frame on the bones the parts
   * don't cover: a pelvis block bridging the hips to the lower spine, short struts
   * tying each thigh back to the pelvis, and a neck strut. These are parented to
   * their bones so they animate with the model and keep the figure visually whole.
   * The dark boot material reads as articulation rather than clashing with the
   * model's own authored colours.
   */
  private buildModelFrame(): void {
    const joint = this.mats.boot;
    // Pelvis: fill the hips -> lower-spine gap left by the missing pelvis part.
    this.segment("mixamorigHips", "mixamorigSpine1", { w: 0.5, d: 0.3 }, joint, 1.1);
    // Tie each thigh top back to the pelvis so the legs don't detach at the hip.
    this.segment("mixamorigHips", "mixamorigLeftUpLeg", { w: 0.22, d: 0.22 }, joint);
    this.segment("mixamorigHips", "mixamorigRightUpLeg", { w: 0.22, d: 0.22 }, joint);
    // Neck: bridge the chest to the head so it stays seated when the spine bends.
    this.segment("mixamorigNeck", "mixamorigHead", { w: 0.16, d: 0.16 }, joint);
  }

  private buildBody(look: CharacterLook): void {
    // Torso: pelvis (pants) + chest (shirt), each spanning a spine segment so the
    // body bends naturally with the spine bones.
    this.segment("mixamorigHips", "mixamorigSpine1", { w: 0.46, d: 0.26 }, this.mats.pants, 1.25);
    this.segment("mixamorigSpine1", "mixamorigNeck", { w: 0.54, d: 0.32 }, this.mats.shirt, 1.1);

    // Arms: upper (sleeve) + fore (skin), per side.
    for (const side of ["Left", "Right"] as const) {
      this.segment(`mixamorig${side}Arm`, `mixamorig${side}ForeArm`, { w: 0.18, d: 0.18 }, this.mats.shirt);
      this.segment(`mixamorig${side}ForeArm`, `mixamorig${side}Hand`, { w: 0.16, d: 0.16 }, this.mats.skin);
      this.cap(`mixamorig${side}Hand`, { w: 0.16, h: 0.16, d: 0.18 }, this.mats.skin, new THREE.Vector3(side === "Left" ? 0.07 : -0.07, 0, 0));

      // Legs: thigh + shin (pants) + foot (boot).
      this.segment(`mixamorig${side}UpLeg`, `mixamorig${side}Leg`, { w: 0.22, d: 0.24 }, this.mats.pants);
      this.segment(`mixamorig${side}Leg`, `mixamorig${side}Foot`, { w: 0.2, d: 0.22 }, this.mats.pants);
      this.cap(`mixamorig${side}Foot`, { w: 0.2, h: 0.12, d: 0.3 }, this.mats.boot, new THREE.Vector3(0, -0.04, 0.08));
    }

    // Head + face + optional hat.
    const head = this.cap("mixamorigHead", { w: 0.44, h: 0.44, d: 0.44 }, this.mats.skin, new THREE.Vector3(0, 0.12, 0));
    if (head) {
      const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.04);
      this.geometries.push(eyeGeo);
      for (const dx of [-0.1, 0.1]) {
        const eye = new THREE.Mesh(eyeGeo, this.mats.eye);
        eye.position.set(dx, 0.03, 0.22);
        head.add(eye);
      }
      this.addHat(head, look.hat);
    }
  }

  private addHat(head: THREE.Mesh, hat: CharacterLook["hat"]): void {
    const add = (geo: THREE.BufferGeometry) => {
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, this.mats.hat);
      head.add(mesh);
      return mesh;
    };
    switch (hat) {
      case "none":
        return;
      case "cap": {
        add(new THREE.BoxGeometry(0.48, 0.2, 0.48)).position.set(0, 0.3, 0);
        add(new THREE.BoxGeometry(0.5, 0.05, 0.28)).position.set(0, 0.22, 0.32);
        return;
      }
      case "horns": {
        for (const dx of [-0.16, 0.16]) {
          const horn = add(new THREE.BoxGeometry(0.08, 0.24, 0.08));
          horn.position.set(dx, 0.32, 0);
          horn.rotation.z = dx < 0 ? 0.3 : -0.3;
        }
        return;
      }
      case "hood": {
        // A bulky cowl wrapping the back and crown of the head.
        add(new THREE.BoxGeometry(0.54, 0.5, 0.54)).position.set(0, 0.16, -0.06);
        add(new THREE.BoxGeometry(0.5, 0.22, 0.16)).position.set(0, -0.04, 0.22);
        return;
      }
      case "crest": {
        // A mohawk-style fin running front-to-back along the crown.
        add(new THREE.BoxGeometry(0.06, 0.22, 0.5)).position.set(0, 0.34, 0);
        return;
      }
      case "antenna": {
        // Two slender stalks rising from the crown (insectoid / void look).
        for (const dx of [-0.12, 0.12]) {
          const stalk = add(new THREE.BoxGeometry(0.04, 0.34, 0.04));
          stalk.position.set(dx, 0.4, 0);
          const tip = add(new THREE.BoxGeometry(0.08, 0.08, 0.08));
          tip.position.set(dx, 0.58, 0);
        }
        return;
      }
    }
  }

  /**
   * Add a box spanning the bind-pose distance between two bones, parented to the
   * first bone so it inherits that bone's animation. The box's +Y is aligned to
   * the bone direction in the parent's local frame.
   */
  private segment(
    parentName: string,
    childName: string,
    cross: { w: number; d: number },
    mat: THREE.Material,
    lengthScale = 1,
  ): void {
    const parent = this.bones.get(parentName);
    const child = this.bones.get(childName);
    if (!parent || !child) return;

    const head = parent.getWorldPosition(new THREE.Vector3());
    const tail = child.getWorldPosition(new THREE.Vector3());
    const len = head.distanceTo(tail) * lengthScale;
    if (len < 1e-4) return;

    const worldCenter = head.clone().lerp(tail, 0.5);
    const localCenter = parent.worldToLocal(worldCenter.clone());

    const parentQ = parent.getWorldQuaternion(new THREE.Quaternion());
    const localDir = tail.clone().sub(head).normalize().applyQuaternion(parentQ.invert());

    const geo = new THREE.BoxGeometry(cross.w, len, cross.d);
    this.geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(localCenter);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, localDir);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  /**
   * Add a fixed-size box at an end bone (head/hand/foot). The box is built
   * WORLD-axis-aligned in bind pose (counter-rotating the bone) so faces like
   * the eyes point straight forward; it still follows the bone once animated.
   * `localOffset` nudges the box along world axes from the bone position.
   */
  private cap(
    boneName: string,
    size: { w: number; h: number; d: number },
    mat: THREE.Material,
    localOffset: THREE.Vector3,
  ): THREE.Mesh | undefined {
    const bone = this.bones.get(boneName);
    if (!bone) return undefined;

    const boneQ = bone.getWorldQuaternion(new THREE.Quaternion());
    const worldPos = bone.getWorldPosition(new THREE.Vector3()).add(localOffset);

    const geo = new THREE.BoxGeometry(size.w, size.h, size.d);
    this.geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(bone.worldToLocal(worldPos.clone()));
    mesh.quaternion.copy(boneQ.clone().invert());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    bone.add(mesh);
    return mesh;
  }

  /** Empty mount node, world-aligned in bind pose, parented to a hand bone. */
  private addMount(boneName: string): THREE.Object3D {
    const node = new THREE.Object3D();
    node.name = `${boneName}.mount`;
    const bone = this.bones.get(boneName);
    if (bone) {
      node.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
      bone.add(node);
    } else {
      this.root.add(node);
    }
    return node;
  }

  /** Scale the whole rig to a target height and drop the feet to y = 0. */
  private fit(targetHeight: number): void {
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    const height = box.max.y - box.min.y;
    if (height > 1e-3) {
      const s = targetHeight / height;
      this.skeletonRoot.scale.multiplyScalar(s);
      this.root.updateMatrixWorld(true);
    }
    const fitted = new THREE.Box3().setFromObject(this.root);
    const center = fitted.getCenter(new THREE.Vector3());
    this.skeletonRoot.position.x -= center.x;
    this.skeletonRoot.position.z -= center.z;
    this.skeletonRoot.position.y -= fitted.min.y;
    this.root.updateMatrixWorld(true);
  }

  /**
   * Cache the foot/toe bones and the bind-pose gap between the lowest of them and
   * the rig's sole (root y = 0 after {@link fit}). At runtime {@link lowestSoleWorldY}
   * uses this to project the live foot bones down to the sole, so the engine can
   * rest the feet on the terrain instead of trusting the fixed capsule offset
   * (which leaves idle/stance clips visibly hovering).
   */
  private measureFootGrounding(): void {
    this.root.updateMatrixWorld(true);
    const names = [
      "mixamorigLeftToeBase",
      "mixamorigRightToeBase",
      "mixamorigLeftFoot",
      "mixamorigRightFoot",
    ];
    const v = new THREE.Vector3();
    let minY = Infinity;
    for (const n of names) {
      const b = this.bones.get(n);
      if (!b) continue;
      this.footBones.push(b);
      minY = Math.min(minY, b.getWorldPosition(v.clone()).y);
    }
    const rootY = this.root.getWorldPosition(v.clone()).y;
    this.bindFootOffset = Number.isFinite(minY) ? minY - rootY : 0;
  }

  /**
   * Estimated world Y of the lowest planted sole in the CURRENT pose, derived from
   * the foot/toe bones (a low-held weapon never drags the estimate down). The
   * engine grounds the model so this sits on the terrain, planting the feet for
   * any idle/locomotion clip across weapon classes. Returns the root world Y when
   * no foot bones exist (e.g. a degenerate rig).
   */
  lowestSoleWorldY(): number {
    if (this.footBones.length === 0) {
      return this.root.getWorldPosition(new THREE.Vector3()).y;
    }
    const v = new THREE.Vector3();
    let minY = Infinity;
    for (const b of this.footBones) minY = Math.min(minY, b.getWorldPosition(v.clone()).y);
    return minY - this.bindFootOffset;
  }
}
