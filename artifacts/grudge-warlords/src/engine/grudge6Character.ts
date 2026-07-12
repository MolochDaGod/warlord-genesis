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

/**
 * Race kit SSOT — prefer canonical grudge6 race FBX on CDN, then legacy
 * ToonRTS customizable paths. Textures: same-origin stage first, then CDN.
 */
const RACE_CDN: Record<
  string,
  {
    folder: string;
    /** Canonical Bip001 kit under models/grudge6/races/ */
    canonFbx: string;
    legacyFbx: string;
    textureFile: string;
    /** Local staged webp under public/textures/grudge6/ */
    localTex: string;
  }
> = {
  barbarians: {
    folder: "barbarians",
    canonFbx: "BRB_Characters.fbx",
    legacyFbx: "BRB_Characters_customizable.FBX",
    textureFile: "BRB_StandardUnits_texture.webp",
    localTex: "/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp",
  },
  dwarves: {
    folder: "dwarves",
    canonFbx: "DWF_Characters.fbx",
    legacyFbx: "DWF_Characters_customizable.FBX",
    textureFile: "DWF_Standard_Units.webp",
    localTex: "/textures/grudge6/dwarves/DWF_Standard_Units.webp",
  },
  "high-elves": {
    folder: "elves",
    canonFbx: "ELF_Characters.fbx",
    legacyFbx: "ELF_Characters_customizable.FBX",
    textureFile: "ELF_HighElves_Texture.webp",
    localTex: "/textures/grudge6/elves/ELF_HighElves_Texture.webp",
  },
  orcs: {
    folder: "orcs",
    canonFbx: "ORC_Characters.fbx",
    legacyFbx: "ORC_Characters_Customizable.FBX",
    textureFile: "ORC_StandardUnits.webp",
    localTex: "/textures/grudge6/orcs/ORC_StandardUnits.webp",
  },
  undead: {
    folder: "undead",
    canonFbx: "UD_Characters.fbx",
    legacyFbx: "UD_Characters_customizable.FBX",
    textureFile: "UD_Standard_Units.webp",
    localTex: "/textures/grudge6/undead/UD_Standard_Units.webp",
  },
  "western-kingdoms": {
    folder: "western-kingdoms",
    canonFbx: "WK_Characters.fbx",
    legacyFbx: "WK_Characters_customizable.FBX",
    textureFile: "WK_Standard_Units.webp",
    localTex: "/textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
  },
};

/** Ordered FBX URLs for a race kit (canonical first). */
function raceModelUrls(repoRaceId: string): string[] {
  const race = RACE_CDN[repoRaceId];
  if (!race) throw new Error(`Unknown race repo: ${repoRaceId}`);
  return [
    `${ASSET_CDN}/models/grudge6/races/${race.canonFbx}`,
    `${ASSET_CDN}/assets/${race.folder}/models/characters/${race.legacyFbx}`,
  ];
}

/** Ordered texture URLs — local stage first (real webp on deploy). */
function raceTextureUrls(repoRaceId: string): string[] {
  const race = RACE_CDN[repoRaceId];
  if (!race) throw new Error(`Unknown race repo: ${repoRaceId}`);
  return [
    race.localTex,
    `${ASSET_CDN}/assets/${race.folder}/textures/${race.textureFile}`,
    `${ASSET_CDN}/textures/grudge6/${race.folder}/${race.textureFile}`,
  ];
}

async function loadFirstFbx(urls: string[]): Promise<THREE.Group> {
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return (await fbxLoader.loadAsync(url)) as THREE.Group;
    } catch (e) {
      lastErr = e;
      console.warn(`[grudge6] FBX miss ${url}`, e);
    }
  }
  throw lastErr ?? new Error("no race FBX");
}

async function loadFirstTexture(urls: string[]): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  let lastErr: unknown;
  for (const url of urls) {
    try {
      return await loader.loadAsync(url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("no race texture");
}

function bakedClipUrl(rel: string): string {
  const encoded = rel
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  // Same-origin first — CDN anims/baked often 404 on assets.grudge-studio.com
  return `/anims/baked/${encoded}.json`;
}

/** Target hero height in world meters (matches PLAYER capsule ~1.2 + headroom). */
export const GRUDGE6_TARGET_HEIGHT_M = 1.85;

/**
 * Body mesh heuristic — prefer torso/legs for height so spear/shield outliers
 * do not inflate the bbox (which used to crush or explode scale).
 */
function isBodyMeshName(name: string): boolean {
  const n = name.toLowerCase();
  if (!n) return false;
  if (/(weapon|sword|axe|hammer|mace|spear|bow|staff|shield|quiver|bag|wood|dagger|pick)/.test(n)) {
    return false;
  }
  return /(body|torso|legs|leg|arms|arm|head|units_|pelvis)/.test(n) || n.includes("body");
}

function measureCharacterBox(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const bodyBox = new THREE.Box3();
  let nBody = 0;
  root.traverse((node) => {
    if (!(node instanceof THREE.SkinnedMesh || node instanceof THREE.Mesh)) return;
    if (!node.visible) return;
    if (node instanceof THREE.SkinnedMesh || isBodyMeshName(node.name)) {
      bodyBox.expandByObject(node);
      nBody++;
    }
  });
  if (nBody > 0 && !bodyBox.isEmpty()) return bodyBox;
  const all = new THREE.Box3().setFromObject(root);
  return all;
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

/**
 * Fit a grudge6 kit (FBX or staged GLB) to ~targetHeight meters.
 *
 * CRITICAL: never do `scale.setScalar(target / worldSize)` when the object already
 * has non-unit scale — that treats world meters as local units and blows characters
 * up ~100× (classic FBX cm + partial scale bug). Always reset → measure → multiply.
 */
function normalizeCharacterGroup(
  root: THREE.Object3D,
  targetHeight = GRUDGE6_TARGET_HEIGHT_M,
): THREE.Skeleton | null {
  const skeleton = unifySkeletons(root);

  // 1) Identity scale/pos for a clean local measure
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  // Face -Z play space (kit exports face +X)
  root.rotation.set(0, Math.PI / 2, 0);
  root.updateWorldMatrix(true, true);

  // 2) cm-scale kits: humanoid taller than ~20 units at scale 1 is almost always cm
  let box = measureCharacterBox(root);
  let size = box.getSize(new THREE.Vector3());
  let height = Math.max(size.y, 1e-6);
  if (height > 20) {
    root.scale.setScalar(0.01);
    root.updateWorldMatrix(true, true);
    box = measureCharacterBox(root);
    size = box.getSize(new THREE.Vector3());
    height = Math.max(size.y, 1e-6);
  }

  // 3) Fit height with multiply (preserves any cm fix above)
  const fit = targetHeight / height;
  if (Number.isFinite(fit) && fit > 0) {
    root.scale.multiplyScalar(fit);
  }

  // 4) Power-of-ten fix for rigid prop meshes that stayed in a different unit
  root.updateWorldMatrix(true, true);
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const bodyHeights: number[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) {
      node.matrixWorld.decompose(_p, _q, _s);
      bodyHeights.push(Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z)));
    }
  });
  bodyHeights.sort((a, b) => a - b);
  const refS = bodyHeights.length ? bodyHeights[Math.floor(bodyHeights.length / 2)]! : 1;
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && !(node instanceof THREE.SkinnedMesh)) {
      node.matrixWorld.decompose(_p, _q, _s);
      const cur = Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z));
      if (cur > 1e-8 && refS > 1e-8) {
        const decade = Math.pow(10, Math.round(Math.log10(refS / cur)));
        if (decade !== 1 && Number.isFinite(decade)) node.scale.multiplyScalar(decade);
      }
    }
  });

  // 5) Center XZ + plant feet on y=0
  root.updateWorldMatrix(true, true);
  box = measureCharacterBox(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  root.updateWorldMatrix(true, true);

  if (typeof console !== "undefined") {
    const finalH = measureCharacterBox(root).getSize(new THREE.Vector3()).y;
    if (finalH > targetHeight * 3 || finalH < targetHeight * 0.25) {
      console.warn(
        `[grudge6] unexpected height after fit: ${finalH.toFixed(2)}m (target ${targetHeight}m)`,
      );
    }
  }

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

/** Load rotation-only baked clip — /anims/baked on deploy, warn+null on 404. */
export async function loadBakedClipByRel(
  rel: string,
  scene: THREE.Object3D | null = null,
): Promise<THREE.AnimationClip | null> {
  const url = bakedClipUrl(rel);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[grudge6] baked clip missing ${url} (${res.status})`);
      return null;
    }
    const json = (await res.json()) as THREE.AnimationClipJSON;
    const raw = THREE.AnimationClip.parse(json);
    return normalizeBakedBip001Clip(toRotationOnlyClip(raw), scene);
  } catch (err) {
    console.warn(`[grudge6] baked clip failed ${url}`, err);
    return null;
  }
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
  const fallback =
    idleClip ?? walkClip ?? runClip ?? sprintClip ?? attackClip;
  if (!fallback) throw new Error(`[grudge6] no baked clips for pack ${pack}`);
  const clips: LocoClips = {
    idle: idleClip ?? fallback,
    walk: walkClip ?? fallback,
    run: runClip ?? fallback,
    sprint: sprintClip ?? runClip ?? fallback,
  };
  const director = new AnimationDirector(mixer, clips);
  const idleAction = mixer.clipAction(clips.idle);
  warnLowBind(`${pack}/idle`, idleAction, root);
  const bind = (c: THREE.AnimationClip | null) => (c ? mixer.clipAction(c) : null);
  return {
    director,
    attackClip: attackClip ?? fallback,
    actions: {
      idle: idleAction,
      walk: bind(walkClip) ?? undefined,
      run: bind(runClip) ?? undefined,
      attack: bind(attackClip) ?? undefined,
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
      // Load first — never dispose working director on failed fetch
      const next = await loadPackBundle(root, mixer, nextPack);
      try {
        prepared.director.dispose();
      } catch {
        /* ignore */
      }
      mixer.stopAllAction();
      prepared.director = next.director;
      prepared.attackClip = next.attackClip;
      prepared.actions = next.actions;
      prepared.director.setGaitTarget(false, false);
      prepared.actions.idle?.reset().fadeIn(0.12).play();
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

async function prepareFromGltfRoot(
  root: THREE.Group,
  animations: THREE.AnimationClip[],
  opts: { fitHeight: number; tint: string; animPack: AnimPack },
): Promise<PreparedGrudge6Character> {
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
        const mat = node.material as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
        if (mat?.color) mat.color.multiply(new THREE.Color(opts.tint));
      }
    });
  }

  const mixer = new THREE.AnimationMixer(root);

  // Prefer same-origin baked Bip001 packs (staged GLBs often have zero clips).
  // Fall back to embedded GLTF clips only if baked pack is unavailable.
  let bundle: Awaited<ReturnType<typeof loadPackBundle>> | null = null;
  try {
    bundle = await loadPackBundle(root, mixer, opts.animPack);
  } catch (err) {
    console.warn(`[grudge6] baked pack ${opts.animPack} failed — trying embedded clips`, err);
  }

  if (!bundle && animations.length > 0) {
    const idleClip = clipFromGltf(animations, "idle", root);
    const walkClip = clipFromGltf(animations, "walk", root);
    const runClip = clipFromGltf(animations, "run", root);
    const attackClip = clipFromGltf(animations, "attack", root);
    const clips: LocoClips = {
      idle: idleClip,
      walk: walkClip,
      run: runClip,
      sprint: runClip.clone(),
    };
    const director = new AnimationDirector(mixer, clips);
    bundle = {
      director,
      attackClip,
      actions: {
        idle: mixer.clipAction(idleClip),
        walk: mixer.clipAction(walkClip),
        run: mixer.clipAction(runClip),
        attack: mixer.clipAction(attackClip),
      },
    };
  }

  if (!bundle) {
    // Last resort: empty idle so the mesh still mounts (T-pose) without crashing.
    const idleClip = new THREE.AnimationClip("idle", 1, []);
    const director = new AnimationDirector(mixer, {
      idle: idleClip,
      walk: idleClip,
      run: idleClip,
      sprint: idleClip,
    });
    bundle = {
      director,
      attackClip: idleClip,
      actions: { idle: mixer.clipAction(idleClip) },
    };
    console.warn("[grudge6] no animations for staged hero — T-pose until baked pack deploys");
  }

  const prepared: PreparedGrudge6Character = {
    root,
    mixer,
    director: bundle.director,
    attackClip: bundle.attackClip,
    actions: bundle.actions,
    swapAnimPack: async (pack: AnimPack) => {
      // Load first — never dispose working director on failed fetch
      const next = await loadPackBundle(root, mixer, pack);
      try {
        prepared.director.dispose();
      } catch {
        /* ignore */
      }
      mixer.stopAllAction();
      prepared.director = next.director;
      prepared.attackClip = next.attackClip;
      prepared.actions = next.actions;
      prepared.director.setGaitTarget(false, false);
      prepared.actions.idle?.reset().fadeIn(0.12).play();
    },
  };
  try {
    prepared.director.setGaitTarget(false, false);
    prepared.actions.idle?.reset().setEffectiveWeight(1).fadeIn(0.12).play();
  } catch {
    /* ignore */
  }
  return prepared;
}

async function tryBuildFromBakedPrefab(
  prefabId: string,
  opts: { fitHeight: number; tint: string; animPack: AnimPack },
): Promise<PreparedGrudge6Character | null> {
  try {
    const asset = prefabBakedAsset(prefabId);
    const gltf = await gltfLoader.loadAsync(`${ASSET_CDN}${asset.glbUrl}`);
    return prepareFromGltfRoot(gltf.scene as THREE.Group, gltf.animations, opts);
  } catch {
    return null;
  }
}

/** Fast lobby path — staged race×class GLBs under /models/heroes/grudge6/. */
async function tryBuildFromLocalHeroGlb(
  repoRaceId: string,
  classId: string,
  opts: { fitHeight: number; tint: string; animPack: AnimPack },
): Promise<PreparedGrudge6Character | null> {
  const urls = [
    `/models/heroes/grudge6/${repoRaceId}_${classId}.glb`,
    `${ASSET_CDN}/models/heroes/grudge6/${repoRaceId}_${classId}.glb`,
  ];
  for (const url of urls) {
    try {
      const gltf = await gltfLoader.loadAsync(url);
      return prepareFromGltfRoot(gltf.scene.clone(true) as THREE.Group, gltf.animations, opts);
    } catch {
      // try next
    }
  }
  return null;
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

  // Prefer lightweight staged GLBs for lobby/battle boot (local Vercel + CDN).
  const localHero = await tryBuildFromLocalHeroGlb(repoRaceId, classId, {
    fitHeight,
    tint,
    animPack,
  });
  if (localHero) return localHero;

  if (prefabId) {
    const baked = await tryBuildFromBakedPrefab(prefabId, { fitHeight, tint, animPack });
    if (baked) return baked;
  }

  const [fbx, texture] = await Promise.all([
    loadFirstFbx(raceModelUrls(repoRaceId)),
    loadFirstTexture(raceTextureUrls(repoRaceId)),
  ]);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;

  fbx.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh || child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Equip visibility BEFORE fit so bbox uses body kit, not every weapon outlier
  if (preset?.visibleMeshes?.length) {
    applyGearPreset(fbx, preset.visibleMeshes);
  }
  normalizeCharacterGroup(fbx, fitHeight);
  applyBodyTexture(fbx, texture);
  if (tint && tint !== "#ffffff") {
    fbx.traverse((node) => {
      if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
        const mat = node.material as THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
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
      const next = await loadPackBundle(fbx, mixer, pack);
      try {
        prepared.director.dispose();
      } catch {
        /* ignore */
      }
      mixer.stopAllAction();
      prepared.director = next.director;
      prepared.attackClip = next.attackClip;
      prepared.actions = next.actions;
      prepared.director.setGaitTarget(false, false);
      prepared.actions.idle?.reset().fadeIn(0.12).play();
    },
  };
  try {
    prepared.director.setGaitTarget(false, false);
    prepared.actions.idle?.reset().setEffectiveWeight(1).fadeIn(0.12).play();
  } catch {
    /* ignore */
  }
  return prepared;
}

