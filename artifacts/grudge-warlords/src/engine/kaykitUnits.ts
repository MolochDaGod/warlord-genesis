/**
 * KayKit lane-guard rendering — Rig_Medium hero GLBs, shared animation library,
 * and Fantasy Weapons Bits mounted on hand / handslot bones.
 */

import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
export type KayKitGuardHero =
  | "knight"
  | "barbarian"
  | "mage"
  | "ranger"
  | "rogue_hooded"
  | "skeleton_warrior"
  | "skeleton_mage";

export type KayKitGuardWeapon = "club" | "hammer" | "axe" | "sword" | "bow" | "wand" | "none";

const BASE = import.meta.env.BASE_URL;

const ANIM_FILES = [
  "anim/general.glb",
  "anim/movement.glb",
  "anim/combat.glb",
  "anim-ext/movement_advanced.glb",
  "anim-ext/combat_ranged.glb",
  "anim-ext/special.glb",
];

const WEAPON_GLTF: Partial<Record<KayKitGuardWeapon, string>> = {
  club: "fistweapon_B",
  hammer: "hammer_A",
  axe: "axe_A",
  sword: "sword_A",
  bow: "bow_A_withString",
  wand: "wand_A",
};

export function kaykitGuardHeroUrl(hero: KayKitGuardHero): string {
  if (hero === "skeleton_warrior" || hero === "skeleton_mage") {
    return `${BASE}models/kaykit/enemies/${hero}.glb`;
  }
  return `${BASE}models/kaykit/heroes/${hero}.glb`;
}

let animClipsPromise: Promise<THREE.AnimationClip[]> | null = null;

export function loadKayKitAnimClips(): Promise<THREE.AnimationClip[]> {
  if (animClipsPromise) return animClipsPromise;
  animClipsPromise = (async () => {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    const byName = new Map<string, THREE.AnimationClip>();
    await Promise.all(
      ANIM_FILES.map(
        (file) =>
          new Promise<void>((resolve) => {
            loader.load(
              `${BASE}models/kaykit/${file}`,
              (g) => {
                for (const clip of g.animations) {
                  const key = clip.name.toLowerCase();
                  if (!byName.has(key)) byName.set(key, clip);
                }
                resolve();
              },
              undefined,
              () => resolve(),
            );
          }),
      ),
    );
    return [...byName.values()];
  })();
  animClipsPromise.catch(() => {
    animClipsPromise = null;
  });
  return animClipsPromise;
}

export function pickKayKitClip(
  clips: THREE.AnimationClip[],
  candidates: string[],
): THREE.AnimationClip | undefined {
  for (const cand of candidates) {
    const c = cand.toLowerCase();
    const hit = clips.find((clip) => clip.name.toLowerCase().includes(c));
    if (hit) return hit;
  }
  return clips[0];
}

const LOCO = {
  idle: ["idle_a", "idle"],
  walk: ["walking_c", "walking", "walk"],
  meleeAttack: ["melee_1h_attack_chop", "1h_melee_attack_chop", "chop"],
  rangedAttack: ["shoot", "bow", "ranged", "throw"],
} as const;

export function kaykitLocoClips(
  clips: THREE.AnimationClip[],
  weapon: KayKitGuardWeapon,
): { idle?: THREE.AnimationClip; walk?: THREE.AnimationClip; attack?: THREE.AnimationClip } {
  const attackPool = weapon === "bow" ? LOCO.rangedAttack : LOCO.meleeAttack;
  return {
    idle: pickKayKitClip(clips, [...LOCO.idle]),
    walk: pickKayKitClip(clips, [...LOCO.walk]),
    attack: pickKayKitClip(clips, [...attackPool]),
  };
}

export function findKayKitHand(root: THREE.Object3D, side: "right" | "left" = "right"): THREE.Object3D | null {
  const names =
    side === "right"
      ? ["handslot.r", "hand.r", "hand_r", "righthand"]
      : ["handslot.l", "hand.l", "hand_l", "lefthand"];
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found) return;
    const n = o.name.toLowerCase();
    if (names.some((want) => n === want || n.includes(want))) found = o;
  });
  return found;
}

const weaponProtoCache = new Map<string, Promise<THREE.Object3D>>();

async function loadWeaponProto(weapon: KayKitGuardWeapon): Promise<THREE.Object3D | null> {
  const file = WEAPON_GLTF[weapon];
  if (!file) return null;
  let cached = weaponProtoCache.get(file);
  if (!cached) {
    cached = (async () => {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(`${BASE}models/kaykit/weapons/${file}.gltf`);
      const root = gltf.scene;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const target = weapon === "bow" ? 0.55 : weapon === "club" ? 0.38 : 0.42;
      root.scale.setScalar(target / maxDim);
      const box2 = new THREE.Box3().setFromObject(root);
      const center = box2.getCenter(new THREE.Vector3());
      root.position.sub(center);
      return root;
    })();
    weaponProtoCache.set(file, cached);
  }
  return cached;
}

export async function attachKayKitWeapon(
  hand: THREE.Object3D,
  weapon: KayKitGuardWeapon,
): Promise<THREE.Object3D | null> {
  const proto = await loadWeaponProto(weapon);
  if (!proto) return null;
  const mount = proto.clone(true);
  mount.name = `KayKitWeapon_${weapon}`;
  if (weapon === "bow") {
    mount.rotation.set(0, Math.PI * 0.5, Math.PI * 0.12);
    mount.position.set(0, 0.03, 0.02);
  } else if (weapon === "club") {
    mount.rotation.set(Math.PI * 0.42, 0, -Math.PI * 0.3);
    mount.position.set(0, 0.02, 0.05);
  } else {
    mount.rotation.set(Math.PI * 0.35, 0, -Math.PI * 0.25);
    mount.position.set(0, 0.02, 0.04);
  }
  hand.add(mount);
  return mount;
}

export interface PreparedKayKitGuard {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
  weapon: KayKitGuardWeapon;
}

/** Clone, fit height, faction tint, and mount weapon on hand bone. */
export async function prepareKayKitGuard(
  scene: THREE.Object3D,
  embeddedClips: THREE.AnimationClip[],
  opts: {
    fitHeight: number;
    scale?: number;
    tint?: string;
    weapon: KayKitGuardWeapon;
  },
): Promise<PreparedKayKitGuard> {
  const lib = await loadKayKitAnimClips();
  const clips = lib.length ? lib : embeddedClips;
  const root = cloneSkeleton(scene);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).frustumCulled = false;
    if (opts.tint && opts.tint !== "#ffffff") {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm?.color) sm.color.multiply(new THREE.Color(opts.tint));
      }
    }
  });

  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.updateWorldMatrix(true, true);
  let box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  let hy = Math.max(size.y, 0.001);
  if (hy > 8) {
    const decade = Math.pow(10, Math.round(Math.log10(hy / opts.fitHeight)));
    if (decade > 1) {
      root.scale.setScalar(1 / decade);
      root.updateWorldMatrix(true, true);
      box = new THREE.Box3().setFromObject(root);
      box.getSize(size);
      hy = Math.max(size.y, 0.001);
    }
  }
  // Parent may apply def.scale — keep mesh fit independent of opts.scale when >1×
  const extra = opts.scale && opts.scale !== 1 ? opts.scale : 1;
  const s = Math.min(Math.max((opts.fitHeight / hy) * extra, 0.002), 6);
  root.scale.setScalar(s);
  root.updateWorldMatrix(true, true);
  box = new THREE.Box3().setFromObject(root);
  root.position.y = -box.min.y;
  root.position.x = -((box.min.x + box.max.x) / 2);
  root.position.z = -((box.min.z + box.max.z) / 2);

  if (opts.weapon !== "none") {
    const handSide = opts.weapon === "bow" ? "left" : "right";
    const hand = findKayKitHand(root, handSide) ?? findKayKitHand(root, "right");
    if (hand) await attachKayKitWeapon(hand, opts.weapon);
  }

  return { root, clips, weapon: opts.weapon };
}