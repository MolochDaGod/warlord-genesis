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
import { verifyLoadedAsset, type AssetVerifyReport } from "./assetVerify";
import {
  attackFromNativeClips,
  clipsFromLoadedFile,
  locoFromNativeClips,
} from "./sourceClips";
import { classifyConceptClips, freezeHipsTravel } from "./threeAnim";

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();

type AnimPack = AnimPackId;

/** Attack one-shots — aligned with Open DRC (samurai 1H primary for sword). */
const ATTACK_BY_PACK: Record<AnimPack, string> = {
  unarmed: "unarmed/punching",
  magic: "magic/standing 1h cast spell 01",
  sword_shield: "greatsword_samurai/gs_samurai_combo_a",
  longbow: "longbow/standing aim recoil",
  rifle: "rifle/firing rifle",
  pistol: "pistol/pistol idle",
};

/** Open DRC baked pack hosts (R2 prod/anims often 404). */
const BAKED_ANIM_HOSTS = [
  "https://open.grudge-studio.com/anims/baked",
  "https://gameopen.vercel.app/anims/baked",
  "/anims/baked", // same-origin if SPA mirrors packs
] as const;

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

/** Production kit stem (WK_Characters) from canon FBX name. */
function raceGlbStem(canonFbx: string): string {
  return canonFbx.replace(/\.fbx$/i, ".glb");
}

/** Map fleet repo race folder → Toon RTS character id (lab GOLDEN pack). */
function mapRepoToFleetRace(repoRaceId: string): string {
  const m: Record<string, string> = {
    "western-kingdoms": "human",
    barbarians: "barbarian",
    "high-elves": "elf",
    dwarves: "dwarf",
    orcs: "orc",
    undead: "undead",
  };
  return m[repoRaceId] || repoRaceId;
}

/**
 * GOLDEN browser kit = Toon RTS pack (same as GRUDGE6_Characters lab).
 * NOT models/grudge6/races/*_Characters.glb (compare bake only).
 */
function raceModelUrls(repoRaceId: string): string[] {
  const fleet = mapRepoToFleetRace(repoRaceId);
  return [
    `${ASSET_CDN}/asset-packs/toon-rts-characters/glb/characters/${fleet}.glb`,
  ];
}

/** Stone atlas only (textures/grudge6/…). Local stage second; no legacy /assets/{folder}/textures. */
function raceTextureUrls(repoRaceId: string): string[] {
  const race = RACE_CDN[repoRaceId];
  if (!race) throw new Error(`Unknown race repo: ${repoRaceId}`);
  return [
    `${ASSET_CDN}/textures/grudge6/${race.folder}/${race.textureFile}`,
    race.localTex,
  ];
}

async function loadFirstRaceKit(
  urls: string[],
): Promise<{ group: THREE.Group; animations: THREE.AnimationClip[]; url: string }> {
  let lastErr: unknown;
  for (const url of urls) {
    try {
      if (/\.glb($|\?)/i.test(url) || /\.gltf($|\?)/i.test(url)) {
        const gltf = await gltfLoader.loadAsync(url);
        const group = gltf.scene as THREE.Group;
        const animations = clipsFromLoadedFile(group, gltf.animations);
        console.info(`[grudge6] GLB ${url} clips=${animations.length}`);
        return { group, animations, url };
      }
      const group = (await fbxLoader.loadAsync(url)) as THREE.Group & {
        animations?: THREE.AnimationClip[];
      };
      const animations = clipsFromLoadedFile(group);
      console.info(`[grudge6] FBX ${url} clips=${animations.length}`);
      return { group, animations, url };
    } catch (e) {
      lastErr = e;
      console.warn(`[grudge6] kit miss ${url}`, e);
    }
  }
  throw lastErr ?? new Error("no race kit GLB/FBX");
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

function encodeBakedRel(rel: string): string {
  return rel
    .replace(/^\//, "")
    .replace(/\.json$/i, "")
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/** Candidate URLs for a baked Bip001 clip (Open SSOT first). */
export function bakedClipCandidates(rel: string): string[] {
  const enc = encodeBakedRel(rel);
  return BAKED_ANIM_HOSTS.map((h) => `${h}/${enc}.json`);
}

/** @deprecated prefer bakedClipCandidates — kept for single-URL callers */
function bakedClipUrl(rel: string): string {
  return bakedClipCandidates(rel)[0]!;
}

/** Target hero height in world meters (matches PLAYER capsule ~1.2 + headroom). */
export const GRUDGE6_TARGET_HEIGHT_M = 1.85;

/**
 * Kit exports face +X; Three play space treats yaw=0 as facing +Z (atan2(dx,dz)).
 * Apply this offset on the rig root so movement direction matches mesh forward.
 * Player/Units must use: `root.rotation.y = facingYaw + GRUDGE6_FACE_YAW` when
 * overwriting root rotation (Player), or leave it baked on the child (Units parent yaw).
 */
export const GRUDGE6_FACE_YAW = -Math.PI / 2;

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

/**
 * Prefer the first skinned mesh's skeleton root / armature for AnimationMixer.
 * Binding the mixer to a pure Group is fine if bones are descendants; armature
 * roots avoid accidental binding to decoy empty nodes in multi-armature FBX.
 */
function findAnimRoot(root: THREE.Object3D): THREE.Object3D {
  let skin: THREE.SkinnedMesh | undefined;
  root.traverse((n) => {
    if (skin) return;
    const sm = n as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh && sm.skeleton?.bones?.length) skin = sm;
  });
  if (skin) {
    let p: THREE.Object3D | null = skin;
    while (p && p.parent && p.parent !== root) p = p.parent;
    return p ?? root;
  }
  const byName = root.getObjectByName("Armature") ?? root.getObjectByName("Root");
  return byName ?? root;
}

/** After mixer poses idle, re-plant soles on local y=0 (bind bbox ≠ idle pose). */
function replantRoot(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const box = measureCharacterBox(root);
  if (box.isEmpty()) return;
  root.position.y -= box.min.y;
  root.updateWorldMatrix(true, true);
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
  // Kit faces +X → world +Z at parent yaw 0 (see GRUDGE6_FACE_YAW)
  root.rotation.set(0, GRUDGE6_FACE_YAW, 0);
  root.updateWorldMatrix(true, true);

  // Hard clamp final uniform scale so nothing stays 10–100× (cm exports)
  // Applied after height fit below.

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

  // 6) Final height sanity — if still huge/tiny, force re-fit from measured Y
  {
    const finalBox = measureCharacterBox(root);
    const finalH = finalBox.getSize(new THREE.Vector3()).y;
    if (finalH > targetHeight * 2.5 || finalH < targetHeight * 0.35) {
      const fix = targetHeight / Math.max(finalH, 1e-6);
      if (Number.isFinite(fix) && fix > 0) {
        root.scale.multiplyScalar(THREE.MathUtils.clamp(fix, 0.05, 20));
        root.updateWorldMatrix(true, true);
        const b2 = measureCharacterBox(root);
        const c2 = b2.getCenter(new THREE.Vector3());
        root.position.x -= c2.x;
        root.position.z -= c2.z;
        root.position.y -= b2.min.y;
        root.updateWorldMatrix(true, true);
      }
      if (typeof console !== "undefined") {
        console.warn(
          `[grudge6] height re-fit: was ${finalH.toFixed(2)}m → target ${targetHeight}m`,
        );
      }
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

/**
 * Mesh part class for Toon-RTS / GRUDGE6 multi-mesh kits.
 * Skin + weapons keep authored atlas colors; only armor/cloth take faction tint.
 */
export type MeshPartClass = "skin" | "armor" | "cloth" | "weapon" | "other";

export function classifyMeshPart(name: string): MeshPartClass {
  const n = name.toLowerCase();
  if (!n) return "other";
  // Weapons / tools first
  if (
    /(weapon|sword|axe|hammer|mace|spear|bow|staff|shield|quiver|dagger|pick|gun|arrow)/.test(
      n,
    )
  ) {
    return "weapon";
  }
  // Skin / head / face / hair — never faction-tint
  if (/(head|face|skin|hair|ear|eye|beard|tooth|teeth|horn)/.test(n)) {
    return "skin";
  }
  // Cloth / robes / soft gear
  if (/(cloth|robe|cape|cloak|hood|scarf|skirt|dress|tunic|fabric|rag)/.test(n)) {
    return "cloth";
  }
  // Armor / plate / body kit pieces (body/arms/legs/shoulders on Synty kits)
  if (
    /(armor|armour|plate|mail|shoulder|pad|body|torso|chest|arms|arm|legs|leg|boot|glove|helm|helmet|bracer|gaunt|belt)/.test(
      n,
    )
  ) {
    return "armor";
  }
  return "other";
}

const _factionColor = new THREE.Color();
const _baseWhite = new THREE.Color(0xffffff);

/**
 * Preserve real atlas textures: clone materials per mesh, force map color space,
 * reset color to white so albedo reads correctly (no muddy shared tints).
 */
export function preserveAuthoredMaterials(group: THREE.Object3D): void {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    const next = mats.map((m) => {
      const c = m.clone() as THREE.MeshStandardMaterial;
      if (c.map) {
        c.map.colorSpace = THREE.SRGBColorSpace;
        c.map.flipY = c.map.flipY ?? false;
        c.map.anisotropy = Math.max(c.map.anisotropy || 1, 8);
        c.map.needsUpdate = true;
      }
      // Authored albedo only — do not bake a gray/faction color into base
      if (c.color) c.color.copy(_baseWhite);
      c.roughness = Math.min(0.92, c.roughness ?? 0.78);
      c.metalness = Math.min(0.25, c.metalness ?? 0.06);
      if ("envMapIntensity" in c) c.envMapIntensity = 0.4;
      c.needsUpdate = true;
      return c;
    });
    node.material = Array.isArray(node.material) ? next : next[0]!;
  });
}

/**
 * Faction / loadout color: ONLY armor + cloth mesh parts.
 * Skin, hair, weapons keep real textured colors.
 * `strength` 0..1 how hard to blend toward the faction color (atlas still shows).
 */
export function applyFactionGearColors(
  group: THREE.Object3D,
  factionHex: string | undefined | null,
  strength = 0.55,
): void {
  if (!factionHex || factionHex === "#ffffff" || factionHex === "#fff") return;
  try {
    _factionColor.set(factionHex);
  } catch {
    return;
  }
  const s = THREE.MathUtils.clamp(strength, 0, 1);
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh)) return;
    if (!node.visible) return;
    const part = classifyMeshPart(node.name);
    if (part !== "armor" && part !== "cloth") return;
    const mats = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const mat of mats) {
      const sm = mat as THREE.MeshStandardMaterial;
      if (!sm?.color) continue;
      // Soft blend: keep atlas readable, shift armor/cloth toward faction
      sm.color.copy(_baseWhite).lerp(_factionColor, part === "cloth" ? s * 0.85 : s);
      sm.needsUpdate = true;
    }
  });
}

/** Apply race atlas to every visible mesh — white base so texture is true. */
function applyBodyTexture(group: THREE.Object3D, texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
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

/**
 * Load rotation-only Bip001 baked clip from Open DRC hosts.
 * Tries open.grudge-studio.com then gameopen then same-origin.
 */
export async function loadBakedClipByRel(
  rel: string,
  scene: THREE.Object3D | null = null,
): Promise<THREE.AnimationClip | null> {
  let lastErr: unknown;
  for (const url of bakedClipCandidates(rel)) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) {
        lastErr = `HTTP ${res.status} ${url}`;
        continue;
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        lastErr = `HTML ${url}`;
        continue;
      }
      const json = (await res.json()) as THREE.AnimationClipJSON;
      const raw = THREE.AnimationClip.parse(json);
      return normalizeBakedBip001Clip(toRotationOnlyClip(raw), scene);
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn(`[grudge6] baked clip failed ${rel}`, lastErr);
  return null;
}

export type Grudge6LocoState = "idle" | "walk" | "run" | "attack";

export interface PreparedGrudge6Character {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  director: AnimationDirector;
  attackClip: THREE.AnimationClip;
  /** Clips that shipped on the GLB/FBX — bind these, do not invent empties. */
  sourceClips: THREE.AnimationClip[];
  /** Samurai/Mixamo concept map (slash, kick, jump…) from the same file. */
  conceptClips?: Partial<Record<string, THREE.AnimationClip>>;
  sourceUrl?: string;
  verify?: AssetVerifyReport;
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
  nativeClips: THREE.AnimationClip[] = [],
): Promise<{
  director: AnimationDirector;
  attackClip: THREE.AnimationClip;
  actions: Partial<Record<Grudge6LocoState, THREE.AnimationAction>>;
}> {
  // Native file clips first — they already target this skeleton.
  const nativeLoco = locoFromNativeClips(nativeClips);
  const nativeAtk = attackFromNativeClips(nativeClips);
  const plant = (c: THREE.AnimationClip | null) => (c ? freezeHipsTravel(c, root) : null);

  let idleClip = plant(nativeLoco?.idle ?? null);
  let walkClip = plant(nativeLoco?.walk ?? null);
  let runClip = plant(nativeLoco?.run ?? null);
  let sprintClip = plant(nativeLoco?.sprint ?? null);
  let attackClip = plant(nativeAtk);

  if (!nativeLoco) {
    const loco = LOCO_BAKED_BY_PACK[pack];
    const baked = await Promise.all([
      loadBakedClipByRel(loco.idle, root),
      loadBakedClipByRel(loco.walk, root),
      loadBakedClipByRel(loco.run, root),
      loadBakedClipByRel(loco.sprint, root),
      loadBakedClipByRel(ATTACK_BY_PACK[pack], root),
    ]);
    idleClip = baked[0];
    walkClip = baked[1];
    runClip = baked[2];
    sprintClip = baked[3];
    attackClip = baked[4];
  } else if (!attackClip) {
    attackClip = await loadBakedClipByRel(ATTACK_BY_PACK[pack], root);
  }

  const fallback = idleClip ?? walkClip ?? runClip ?? sprintClip ?? attackClip;
  if (!fallback) {
    throw new Error(
      `[grudge6] no clips for pack ${pack} — file had ${nativeClips.length} native, baked also empty`,
    );
  }
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
  // Explicit faction color only — race skinTint is baked into atlas textures
  const tint = opts.tint && opts.tint !== "#ffffff" ? opts.tint : "#ffffff";
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
  // Unique materials + real textures; faction tint only on armor/cloth
  preserveAuthoredMaterials(root);
  applyFactionGearColors(root, opts.tint);

  // Mixer on THIS clone's skeleton — native file clips bind by bone name.
  const animRoot = findAnimRoot(root);
  const mixer = new THREE.AnimationMixer(animRoot);
  const sourceClips = shared.sourceClips ?? [];
  const bundle = await loadPackBundle(root, mixer, pack, sourceClips);
  bundle.director.setGaitTarget(false, false);
  // Force idle weight + sample one frame so lobby never shows bind T-pose
  bundle.actions.idle?.reset().setEffectiveWeight(1).play();
  mixer.update(1 / 30);
  replantRoot(root);

  const prepared: PreparedGrudge6Character & { dispose: () => void } = {
    root,
    mixer,
    director: bundle.director,
    attackClip: bundle.attackClip,
    sourceClips,
    conceptClips: shared.conceptClips ?? classifyConceptClips(sourceClips),
    sourceUrl: shared.sourceUrl,
    verify: shared.verify,
    actions: bundle.actions,
    swapAnimPack: async (nextPack: AnimPack) => {
      // Load first — never dispose working director on failed fetch
      const next = await loadPackBundle(root, mixer, nextPack, sourceClips);
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

/**
 * Lane guard loader — ALWAYS an independent instance (own skeleton + mixer).
 * Never mount the shared cache root; multiple guards of the same type must
 * each animate without stealing one mesh.
 */
export function loadGrudge6LaneGuard(
  typeId: string,
  opts: { fitHeight?: number; tint?: string } = {},
): Promise<PreparedGrudge6Character & { dispose: () => void }> {
  return loadGrudge6CharacterInstance(typeId, opts);
}

async function prepareFromGltfRoot(
  root: THREE.Group,
  animations: THREE.AnimationClip[],
  opts: { fitHeight: number; tint: string; animPack: AnimPack; sourceUrl?: string },
): Promise<PreparedGrudge6Character> {
  // Real atlas/skin first, then soft faction recolor on armor/cloth only
  preserveAuthoredMaterials(root);
  normalizeCharacterGroup(root, opts.fitHeight);
  applyFactionGearColors(root, opts.tint);

  const sourceClips = clipsFromLoadedFile(root, animations);
  const verify = verifyLoadedAsset({
    url: opts.sourceUrl ?? "gltf",
    kind: "character",
    root,
    clips: sourceClips,
    targetHeight: opts.fitHeight,
    requireClips: false,
  });

  const animRoot = findAnimRoot(root);
  const mixer = new THREE.AnimationMixer(animRoot);

  // File clips first (same skeleton). Baked JSON only fills missing bands.
  const bundle = await loadPackBundle(root, mixer, opts.animPack, sourceClips);

  const prepared: PreparedGrudge6Character = {
    root,
    mixer,
    director: bundle.director,
    attackClip: bundle.attackClip,
    sourceClips,
    conceptClips: classifyConceptClips(sourceClips),
    sourceUrl: opts.sourceUrl,
    verify,
    actions: bundle.actions,
    swapAnimPack: async (pack: AnimPack) => {
      // Load first — never dispose working director on failed fetch
      const next = await loadPackBundle(root, mixer, pack, sourceClips);
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
    const url = `${ASSET_CDN}${asset.glbUrl}`;
    const gltf = await gltfLoader.loadAsync(url);
    return prepareFromGltfRoot(gltf.scene as THREE.Group, gltf.animations, {
      ...opts,
      sourceUrl: url,
    });
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
      // SkeletonUtils — never Object3D.clone on skinned meshes (T-pose forever)
      const root = SkeletonUtils.clone(gltf.scene) as unknown as THREE.Group;
      return prepareFromGltfRoot(root, gltf.animations, { ...opts, sourceUrl: url });
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
  // Faction / team color only — NEVER race skinTint (atlas already has real skin).
  // Only armor + cloth receive this; head/weapons stay textured as authored.
  const tint = opts.tint && opts.tint !== "#ffffff" ? opts.tint : "#ffffff";

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

  const [fbxFile, texture] = await Promise.all([
    loadFirstRaceKit(raceModelUrls(repoRaceId)),
    loadFirstTexture(raceTextureUrls(repoRaceId)),
  ]);
  const fbx = fbxFile.group;
  const sourceClips = fbxFile.animations;

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
  // Skin stays from atlas (white base). Faction color only armor/cloth names.
  applyFactionGearColors(fbx, tint);

  const verify = verifyLoadedAsset({
    url: fbxFile.url,
    kind: "character",
    root: fbx,
    clips: sourceClips,
    targetHeight: fitHeight,
    requireClips: false,
  });

  const animRoot = findAnimRoot(fbx);
  const mixer = new THREE.AnimationMixer(animRoot);
  const bundle = await loadPackBundle(fbx, mixer, animPack, sourceClips);

  const prepared: PreparedGrudge6Character = {
    root: fbx,
    mixer,
    director: bundle.director,
    attackClip: bundle.attackClip,
    sourceClips,
    conceptClips: classifyConceptClips(sourceClips),
    sourceUrl: fbxFile.url,
    verify,
    actions: bundle.actions,
    swapAnimPack: async (pack: AnimPack) => {
      const next = await loadPackBundle(fbx, mixer, pack, sourceClips);
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

