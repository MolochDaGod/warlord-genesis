import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

/**
 * Real voxel weapon models (KayKit-style) mounted in the hero's hand in place of
 * the procedural box props. Each FBX is colour-mapped through a shared 256x1
 * `palette.png` strip (the meshes carry UVs that index into the palette), so the
 * map is applied manually with NEAREST filtering — the FBX references the texture
 * by a bare name that the loader can't auto-resolve.
 *
 * Only the five uploaded models exist (bow / pistol / rifle / sniper / sword);
 * every other class keeps its procedural prop from `weapons.ts`.
 */

const BASE = import.meta.env.BASE_URL; // trailing slash

export type WeaponModelKey = "bow" | "pistol" | "rifle" | "sniper" | "sword";

export interface WeaponModelDef {
  /** File stem under `public/models/weapons/<file>.fbx`. */
  file: string;
  /** Which hand bone the model mounts on. */
  hand: "left" | "right";
  /** World-space max-dimension the loaded mesh is normalised to (metres). */
  targetSize: number;
  /** Default holder local position (the starting tuning). */
  pos: THREE.Vector3Tuple;
  /** Default holder local euler rotation in radians (the starting tuning). */
  rot: THREE.Vector3Tuple;
  /** Default uniform holder scale multiplier (the starting tuning). */
  scale: number;
  /** Default muzzle / tip local offset on the holder (where shots originate). */
  muzzle: THREE.Vector3Tuple;
}

/**
 * Per-model defaults. The position/rotation/scale/muzzle values are the starting
 * point for the in-game tuning panel (persisted per model to localStorage), so
 * they only need to be in the right ballpark — the panel dials them in live.
 */
export const WEAPON_MODEL_DEFS: Record<WeaponModelKey, WeaponModelDef> = {
  bow: {
    file: "bow", hand: "left", targetSize: 1.4,
    pos: [0, 0.05, 0], rot: [0, 0, Math.PI / 2], scale: 1, muzzle: [0, 0.6, 0],
  },
  pistol: {
    file: "pistol", hand: "right", targetSize: 0.42,
    pos: [0, 0.02, 0.04], rot: [Math.PI / 2, 0, 0], scale: 1, muzzle: [0, 0, 0.32],
  },
  rifle: {
    file: "rifle", hand: "right", targetSize: 1.0,
    pos: [0, 0.02, 0.05], rot: [Math.PI / 2, 0, 0], scale: 1, muzzle: [0, 0, 0.6],
  },
  sniper: {
    file: "sniper", hand: "right", targetSize: 1.15,
    pos: [0, 0.02, 0.05], rot: [Math.PI / 2, 0, 0], scale: 1, muzzle: [0, 0, 0.7],
  },
  sword: {
    file: "sword", hand: "right", targetSize: 1.0,
    pos: [0, 0.05, 0], rot: [Math.PI / 2, 0, 0], scale: 1, muzzle: [0, 0.55, 0],
  },
};

export const WEAPON_MODEL_KEYS = Object.keys(WEAPON_MODEL_DEFS) as WeaponModelKey[];

const fbxLoader = new FBXLoader();

let paletteTex: THREE.Texture | null = null;
function getPalette(): THREE.Texture {
  if (!paletteTex) {
    paletteTex = new THREE.TextureLoader().load(`${BASE}models/weapons/palette.png`);
    paletteTex.magFilter = THREE.NearestFilter;
    paletteTex.minFilter = THREE.NearestFilter;
    paletteTex.generateMipmaps = false;
    paletteTex.colorSpace = THREE.SRGBColorSpace;
  }
  return paletteTex;
}

/**
 * Normalise a freshly loaded weapon FBX: uniformly scale it so its longest axis
 * matches the def's target size, then swap every mesh to a palette-mapped
 * standard material. The FBX origin (grip) is kept; the tuning panel handles
 * fine placement in the hand.
 */
function prepareModel(raw: THREE.Group, def: WeaponModelDef): THREE.Group {
  const box = new THREE.Box3().setFromObject(raw);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  raw.scale.setScalar(def.targetSize / maxDim);

  const palette = getPalette();
  const mat = new THREE.MeshStandardMaterial({ map: palette, roughness: 0.7, metalness: 0.1 });
  raw.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = mat;
    mesh.castShadow = true;
  });
  return raw;
}

const protoCache = new Map<WeaponModelKey, Promise<THREE.Group>>();
const protoReady = new Map<WeaponModelKey, THREE.Group>();

/** Load + prepare one weapon model (cached by key); resolved proto is cloned per mount. */
export function loadWeaponModel(key: WeaponModelKey): Promise<THREE.Group> {
  let cached = protoCache.get(key);
  if (!cached) {
    const def = WEAPON_MODEL_DEFS[key];
    cached = fbxLoader.loadAsync(`${BASE}models/weapons/${def.file}.fbx`).then((raw) => {
      const proto = prepareModel(raw, def);
      protoReady.set(key, proto);
      return proto;
    });
    cached.catch(() => protoCache.delete(key));
    protoCache.set(key, cached);
  }
  return cached;
}

/** Preload a set of weapon models (defaults to all five). Never rejects. */
export async function preloadWeaponModels(keys: WeaponModelKey[] = WEAPON_MODEL_KEYS): Promise<void> {
  await Promise.all(keys.map((k) => loadWeaponModel(k).catch(() => undefined)));
}

/**
 * Synchronously get a fresh clone of a loaded weapon proto, or null when the
 * model hasn't finished loading (callers fall back to the procedural prop). The
 * clone shares geometry + the palette material with the proto, so it's cheap.
 */
export function getWeaponModelProto(key: WeaponModelKey): THREE.Group | null {
  const proto = protoReady.get(key);
  return proto ? (proto.clone(true) as THREE.Group) : null;
}
