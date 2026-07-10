/**
 * GRUDGE6 Bip001 lane-guard loader — race FBX from CDN, gear presets, baked clips.
 * Mirrors character.grudge-studio.com/viewer pipeline (no KayKit hero bodies).
 */

import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  LOCO_BAKED_BY_PACK,
  asAnimPackId,
  prefabBakedAsset,
  type AnimPackId,
} from "@workspace/game-content";
import { AnimationDirector, type LocoClips } from "../game/animDirector";
import {
  getTrackBindingStats,
  normalizeBakedBip001Clip,
  toRotationOnlyClip,
} from "./mixamoRetarget";
import { ASSET_CDN } from "./warlordManifest";
import { gearPresetFor, resolveUnitDef } from "./grudge6";

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

type AnimPack = AnimPackId;

const ATTACK_BY_PACK: Record<AnimPack, string> = {
  unarmed: "unarmed/punching",
  magic: "magic/standing 1h cast spell 01",
  sword_shield: "sword_shield/sword and shield attack",
  longbow: "longbow/standing aim recoil",
  rifle: "rifle/firing",
  pistol: "pistol/gunplay",
};

const RACE_CDN: Record<
  string,
  { modelFile: string; textureFile: string; folder: string }
> = {
  barbarians: {
    folder: "barbarians",
    modelFile: "BRB_Characters_customizable.FBX",
    textureFile: "BRB_StandardUnits_texture.webp",
  },
  dwarves: {
    folder: "dwarves",
    modelFile: "DWF_Characters_customizable.FBX",
    textureFile: "DWF_Standard_Units.webp",
  },
  "high-elves": {
    folder: "elves",
    modelFile: "ELF_Characters_customizable.FBX",
    textureFile: "ELF_HighElves_Texture.webp",
  },
  orcs: {
    folder: "orcs",
    modelFile: "ORC_Characters_Customizable.FBX",
    textureFile: "ORC_StandardUnits.webp",
  },
  undead: {
    folder: "undead",
    modelFile: "UD_Characters_customizable.FBX",
    textureFile: "UD_Standard_Units.webp",
  },
  "western-kingdoms": {
    folder: "western-kingdoms",
    modelFile: "WK_Characters_customizable.FBX",
    textureFile: "WK_Standard_Units.webp",
  },
};

function raceModelUrl(repoRaceId: string): string {
  const race = RACE_CDN[repoRaceId];
  if (!race) throw new Error(`Unknown race repo: ${repoRaceId}`);
  return `${ASSET_CDN}/assets/${race.folder}/models/characters/${race.modelFile}`;
}

function raceTextureUrl(repoRaceId: string): string {
  const race = RACE_CDN[repoRaceId];
  if (!race) throw new Error(`Unknown race repo: ${repoRaceId}`);
  return `${ASSET_CDN}/assets/${race.folder}/textures/${race.textureFile}`;
}

function bakedClipUrl(rel: string): string {
  const encoded = rel
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${ASSET_CDN}/anims/baked/${encoded}.json`;
}

function powerOfTenScale(reference: number, current: number): number {
  if (!(reference > 0) || !(current > 0)) return 1;
  return Math.pow(10, Math.round(Math.log10(reference / current)));
}

function unifySkeletons(root: THREE.Object3D): THREE.Skeleton | null {
  root.updateMatrixWorld(true);
  const canon = new Map<string, THREE.Bone>();
  const queue: THREE.Object3D[] = [...root.children];
  while (queue.length) {
    const node = queue.shift()!;
    if (node instanceof THREE.Bone && !canon.has(node.name)) canon.set(node.name, node);
    queue.push(...node.children);
  }
  if (canon.size === 0) return null;

  let widest: THREE.Skeleton | null = null;
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh && node.skeleton) {
      const newBones = node.skeleton.bones.map((b) => canon.get(b.name) ?? b);
      const newSkel = new THREE.Skeleton(newBones, node.skeleton.boneInverses);
      node.bind(newSkel, node.bindMatrix);
      if (!widest || newSkel.bones.length > widest.bones.length) widest = newSkel;
    }
  });
  return widest;
}

function normalizeCharacterGroup(fbx: THREE.Object3D, targetHeight = 2.05): THREE.Skeleton | null {
  const skeleton = unifySkeletons(fbx);
  fbx.rotation.y = Math.PI / 2;
  fbx.updateWorldMatrix(true, true);

  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const effScaleOf = (node: THREE.Object3D): number => {
    node.matrixWorld.decompose(_p, _q, _s);
    return Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z));
  };
  const skinnedEff: number[] = [];
  fbx.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) skinnedEff.push(effScaleOf(node));
  });
  skinnedEff.sort((a, b) => a - b);
  const refEff = skinnedEff.length > 0 ? skinnedEff[Math.floor(skinnedEff.length / 2)] : 1;
  let normalizedAny = false;
  fbx.traverse((node) => {
    if (node instanceof THREE.Mesh && !(node instanceof THREE.SkinnedMesh)) {
      const correction = powerOfTenScale(refEff, effScaleOf(node));
      if (correction !== 1) {
        node.scale.multiplyScalar(correction);
        normalizedAny = true;
      }
    }
  });
  if (normalizedAny) fbx.updateWorldMatrix(true, true);

  const bodyBox = new THREE.Box3();
  let bodyMeshCount = 0;
  fbx.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) {
      bodyBox.expandByObject(node);
      bodyMeshCount++;
    }
  });
  const box = bodyMeshCount > 0 ? bodyBox : new THREE.Box3().setFromObject(fbx);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) fbx.scale.setScalar(targetHeight / maxDim);

  fbx.updateWorldMatrix(true, true);
  const bodyBox2 = new THREE.Box3();
  fbx.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) bodyBox2.expandByObject(node);
  });
  const box2 = bodyMeshCount > 0 ? bodyBox2 : new THREE.Box3().setFromObject(fbx);
  fbx.position.set(-center.x * fbx.scale.x, -box2.min.y, -center.z * fbx.scale.z);

  return skeleton;
}

function applyGearPreset(group: THREE.Object3D, visibleMeshes: string[]): void {
  const want = new Set(visibleMeshes);
  group.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
      node.visible = want.has(node.name);
    }
  });
}

function applyBodyTexture(group: THREE.Object3D, texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  // Per-mesh materials so tint/preview clones don't share one material instance
  group.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
      node.material = new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.06,
        envMapIntensity: 0.4,
      });
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

function warnLowBind(
  label: string,
  action: THREE.AnimationAction,
  scene: THREE.Object3D,
): void {
  const stats = getTrackBindingStats(action);
  if (stats.total > 0 && stats.ratio < 0.45) {
    const sample = [...buildSceneBoneNames(scene)].slice(0, 4).join(", ");
    console.warn(
      `[grudge6] low clip bind ${label}: ${stats.bound}/${stats.total} — rig bones: ${sample}`,
    );
  }
}

function buildSceneBoneNames(scene: THREE.Object3D): string[] {
  const names: string[] = [];
  scene.traverse((node) => {
    if (node instanceof THREE.Bone) names.push(node.name);
  });
  return names;
}

/** Load a rotation-only baked clip from the GRUDGE CDN (shared by skills + locomotion). */
export async function loadBakedClipByRel(
  rel: string,
  scene: THREE.Object3D | null = null,
): Promise<THREE.AnimationClip> {
  const url = bakedClipUrl(rel);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Baked clip ${url} HTTP ${res.status}`);
  const json = (await res.json()) as THREE.AnimationClipJSON;
  const raw = THREE.AnimationClip.parse(json);
  return normalizeBakedBip001Clip(toRotationOnlyClip(raw), scene);
}

export type Grudge6LocoState = "idle" | "walk" | "run" | "attack";

export interface PreparedGrudge6Character {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  director: AnimationDirector;
  attackClip: THREE.AnimationClip;
  /** @deprecated Use `director` — kept for lane-guard fallback crossfades. */
  actions: Partial<Record<Grudge6LocoState, THREE.AnimationAction>>;
  swapAnimPack: (pack: AnimPack) => Promise<void>;
}

/** @deprecated Use PreparedGrudge6Character */
export type PreparedGrudge6Guard = PreparedGrudge6Character;

const characterCache = new Map<string, Promise<PreparedGrudge6Character>>();

function cacheKey(typeId: string, fitHeight: number, tint: string, pack: AnimPack): string {
  return `${typeId}|${fitHeight}|${tint}|${pack}`;
}

export function crossfadeGrudge6(
  prepared: PreparedGrudge6Character,
  want: Grudge6LocoState,
  prev: Grudge6LocoState,
): void {
  if (want === prev) return;
  const next = prepared.actions[want] ?? prepared.actions.idle ?? prepared.actions.walk;
  const prior = prepared.actions[prev];
  if (!next) return;
  prior?.fadeOut(0.12);
  if (want === "attack") {
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = false;
  } else {
    next.setLoop(THREE.LoopRepeat, Infinity);
  }
  next.reset().fadeIn(0.12).play();
}

async function loadPackBundle(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  pack: AnimPack,
): Promise<{
  director: AnimationDirector;
  attackClip: THREE.AnimationClip;
  actions: Partial<Record<Grudge6LocoState, THREE.AnimationAction>>;
}> {
  const loco = LOCO_BAKED_BY_PACK[pack];
  const [idleClip, walkClip, runClip, sprintClip, attackClip] = await Promise.all([
    loadBakedClipByRel(loco.idle, root),
    loadBakedClipByRel(loco.walk, root),
    loadBakedClipByRel(loco.run, root),
    loadBakedClipByRel(loco.sprint, root),
    loadBakedClipByRel(ATTACK_BY_PACK[pack], root),
  ]);
  const clips: LocoClips = { idle: idleClip, walk: walkClip, run: runClip, sprint: sprintClip };
  const director = new AnimationDirector(mixer, clips);
  const idleAction = mixer.clipAction(idleClip);
  warnLowBind(`${pack}/idle`, idleAction, root);
  return {
    director,
    attackClip,
    actions: {
      idle: idleAction,
      walk: mixer.clipAction(walkClip),
      run: mixer.clipAction(runClip),
      attack: mixer.clipAction(attackClip),
    },
  };
}

/** Load a GRUDGE6 character by unit type id (`race_class`). */
export function loadGrudge6Character(
  typeId: string,
  opts: { fitHeight?: number; tint?: string; animPack?: AnimPack } = {},
): Promise<PreparedGrudge6Character> {
  const def = resolveUnitDef(typeId);
  const preset = def?.grudge
    ? gearPresetFor(def.grudge.raceId, def.grudge.classId)
    : undefined;
  const pack = asAnimPackId(opts.animPack ?? preset?.animPack ?? "unarmed");
  const fitHeight = opts.fitHeight ?? 2.05;
  const tint = opts.tint ?? def?.grudge?.skinTint ?? "#ffffff";
  const key = cacheKey(typeId, fitHeight, tint, pack);
  let cached = characterCache.get(key);
  if (!cached) {
    cached = buildCharacter(typeId, { fitHeight, tint, animPack: pack });
    cached.catch(() => characterCache.delete(key));
    characterCache.set(key, cached);
  }
  return cached;
}

/**
 * Independent instance for lobby / warcamp preview.
 * Clones the cached mesh so battle cannot steal the preview root, and
 * owns its own mixer + AnimationDirector (safe to dispose on unmount).
 */
export async function loadGrudge6CharacterInstance(
  typeId: string,
  opts: { fitHeight?: number; tint?: string; animPack?: AnimPack } = {},
): Promise<PreparedGrudge6Character & { dispose: () => void }> {
  const shared = await loadGrudge6Character(typeId, opts);
  const def = resolveUnitDef(typeId);
  const preset = def?.grudge
    ? gearPresetFor(def.grudge.raceId, def.grudge.classId)
    : undefined;
  const pack = asAnimPackId(opts.animPack ?? preset?.animPack ?? "unarmed");

  const root = SkeletonUtils.clone(shared.root) as unknown as THREE.Group;
  // Ensure materials are unique + texture color space still valid after clone
  root.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      const next = mats.map((m) => {
        const c = m.clone();
        const std = c as THREE.MeshStandardMaterial;
        if (std.map) {
          std.map.colorSpace = THREE.SRGBColorSpace;
          std.map.needsUpdate = true;
        }
        if (std.color && opts.tint && opts.tint !== "#ffffff") {
          // tint already applied on shared; clone keeps it
        }
        return c;
      });
      node.material = Array.isArray(node.material) ? next : next[0]!;
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  const mixer = new THREE.AnimationMixer(root);
  const bundle = await loadPackBundle(root, mixer, pack);
  bundle.director.setGaitTarget(false, false);

  const prepared: PreparedGrudge6Character & { dispose: () => void } = {
    root,
    mixer,
    director: bundle.director,
    attackClip: bundle.attackClip,
    actions: bundle.actions,
    swapAnimPack: async (nextPack: AnimPack) => {
      prepared.director.dispose();
      mixer.stopAllAction();
      const next = await loadPackBundle(root, mixer, nextPack);
      prepared.director = next.director;
      prepared.attackClip = next.attackClip;
      prepared.actions = next.actions;
      prepared.director.setGaitTarget(false, false);
    },
    dispose: () => {
      try {
        prepared.director.dispose();
      } catch { /* ignore */ }
      mixer.stopAllAction();
      root.removeFromParent();
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose?.();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) m?.dispose?.();
        }
      });
    },
  };
  return prepared;
}

/** Lane guard loader — same GRUDGE6 Bip001 pipeline as warlords. */
export function loadGrudge6LaneGuard(
  typeId: string,
  opts: { fitHeight?: number; tint?: string } = {},
): Promise<PreparedGrudge6Character> {
  return loadGrudge6Character(typeId, opts);
}

function clipFromGltf(
  animations: THREE.AnimationClip[],
  name: string,
  root: THREE.Object3D,
  fallback = "idle",
): THREE.AnimationClip {
  const hit =
    animations.find((c) => c.name === name) ??
    animations.find((c) => c.name === fallback) ??
    animations[0];
  if (!hit) throw new Error(`baked prefab missing clip ${name}`);
  return normalizeBakedBip001Clip(toRotationOnlyClip(hit), root);
}

async function tryBuildFromBakedPrefab(
  prefabId: string,
  opts: { fitHeight: number; tint: string; animPack: AnimPack },
): Promise<PreparedGrudge6Character | null> {
  try {
    const asset = prefabBakedAsset(prefabId);
    const gltf = await gltfLoader.loadAsync(`${ASSET_CDN}${asset.glbUrl}`);
    const root = gltf.scene as THREE.Group;
    root.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh || child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    normalizeCharacterGroup(root, opts.fitHeight);
    if (opts.tint && opts.tint !== "#ffffff") {
      root.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
          const mat = node.material as THREE.MeshLambertMaterial;
          if (mat?.color) mat.color.multiply(new THREE.Color(opts.tint));
        }
      });
    }
    const mixer = new THREE.AnimationMixer(root);
    const idleClip = clipFromGltf(gltf.animations, "idle", root);
    const walkClip = clipFromGltf(gltf.animations, "walk", root);
    const runClip = clipFromGltf(gltf.animations, "run", root);
    const attackClip = clipFromGltf(gltf.animations, "attack", root);
    const sprintClip = runClip.clone();
    const clips: LocoClips = { idle: idleClip, walk: walkClip, run: runClip, sprint: sprintClip };
    const bundle = {
      director: new AnimationDirector(mixer, clips),
      attackClip,
      actions: {
        idle: mixer.clipAction(idleClip),
        walk: mixer.clipAction(walkClip),
        run: mixer.clipAction(runClip),
        attack: mixer.clipAction(attackClip),
      },
    };
    const prepared: PreparedGrudge6Character = {
      root,
      mixer,
      director: bundle.director,
      attackClip: bundle.attackClip,
      actions: bundle.actions,
      swapAnimPack: async (pack: AnimPack) => {
        prepared.director.dispose();
        mixer.stopAllAction();
        const next = await loadPackBundle(root, mixer, pack);
        prepared.director = next.director;
        prepared.attackClip = next.attackClip;
        prepared.actions = next.actions;
      },
    };
    return prepared;
  } catch {
    return null;
  }
}

async function buildCharacter(
  typeId: string,
  opts: { fitHeight?: number; tint?: string; animPack: AnimPack },
): Promise<PreparedGrudge6Character> {
  const def = resolveUnitDef(typeId);
  if (!def?.grudge) throw new Error(`Not a GRUDGE6 unit: ${typeId}`);
  const { raceId, classId, repoRaceId, prefabId } = def.grudge;
  const preset = gearPresetFor(raceId, classId);
  const animPack = opts.animPack;
  const fitHeight = opts.fitHeight ?? 2.05;
  const tint = opts.tint ?? def.grudge.skinTint ?? "#ffffff";

  if (prefabId) {
    const baked = await tryBuildFromBakedPrefab(prefabId, { fitHeight, tint, animPack });
    if (baked) return baked;
  }

  const [fbx, texture] = await Promise.all([
    fbxLoader.loadAsync(raceModelUrl(repoRaceId)),
    new THREE.TextureLoader().loadAsync(raceTextureUrl(repoRaceId)),
  ]);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;

  fbx.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh || child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  normalizeCharacterGroup(fbx, fitHeight);
  if (preset?.visibleMeshes?.length) {
    applyGearPreset(fbx, preset.visibleMeshes);
  }
  applyBodyTexture(fbx, texture);
  if (tint && tint !== "#ffffff") {
    fbx.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
        const mat = node.material as THREE.MeshLambertMaterial;
        if (mat?.color) mat.color.multiply(new THREE.Color(tint));
      }
    });
  }

  const mixer = new THREE.AnimationMixer(fbx);
  const bundle = await loadPackBundle(fbx, mixer, animPack);

  const prepared: PreparedGrudge6Character = {
    root: fbx,
    mixer,
    director: bundle.director,
    attackClip: bundle.attackClip,
    actions: bundle.actions,
    swapAnimPack: async (pack: AnimPack) => {
      prepared.director.dispose();
      mixer.stopAllAction();
      const next = await loadPackBundle(fbx, mixer, pack);
      prepared.director = next.director;
      prepared.attackClip = next.attackClip;
      prepared.actions = next.actions;
    },
  };
  return prepared;
}

