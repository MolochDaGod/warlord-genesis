/**
 * Samurai-template retarget (CharacterController._retarget).
 *
 * Skin and motion can disagree on units. Rotations transfer; translations must
 * be scaled from a *bone length* (never hips — hips are pose, not bind).
 * Horizontal hips travel is frozen so the gameplay controller owns XZ.
 *
 * Ref: MolochDaGod/SamuraiThirdPersonTemplateThreeJS
 */
import * as THREE from "three";

function stripNs(name: string): string {
  return name.replace(/^mixamorig:?/i, "").replace(/^Bip001/i, "").replace(/^[:_]+/, "");
}

function isHipsName(name: string): boolean {
  const n = stripNs(name).toLowerCase();
  return n === "hips" || n === "hip" || n === "pelvis";
}

/** Index bones by raw name and namespace-stripped name (Mixamo + Bip001). */
export function indexRigBones(root: THREE.Object3D): Map<string, THREE.Bone> {
  const bones = new Map<string, THREE.Bone>();
  root.traverse((n) => {
    if (!(n instanceof THREE.Bone)) return;
    bones.set(n.name, n);
    const stripped = stripNs(n.name);
    if (stripped && !bones.has(stripped)) bones.set(stripped, n);
  });
  return bones;
}

export function hipsBoneName(root: THREE.Object3D): string | null {
  const bones = indexRigBones(root);
  for (const [k, b] of bones) {
    if (isHipsName(k)) return b.name;
  }
  return null;
}

/**
 * Median bind-length / first-key-length for non-hips position tracks.
 * Inside [0.5, 2] → 1 (rig variance, not units). Outside → real cm↔m scale.
 */
export function measureClipUnits(clip: THREE.AnimationClip, root: THREE.Object3D): number {
  const bones = indexRigBones(root);
  const hips = hipsBoneName(root);
  const ratios: number[] = [];
  for (const track of clip.tracks) {
    if (!track.name.endsWith(".position") || track.values.length < 3) continue;
    const node = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
    if (hips && (node === hips || isHipsName(node))) continue;
    const bone = bones.get(node) ?? bones.get(stripNs(node));
    if (!bone) continue;
    const clipLen = Math.hypot(track.values[0], track.values[1], track.values[2]);
    const bindLen = bone.position.length();
    if (clipLen < 1e-6 || bindLen < 1e-6) continue;
    ratios.push(bindLen / clipLen);
  }
  if (!ratios.length) return 1;
  ratios.sort((a, b) => a - b);
  const ratio = ratios[ratios.length >> 1]!;
  return ratio > 0.5 && ratio < 2 ? 1 : ratio;
}

export interface RetargetOpts {
  /** Keep horizontal hips travel for a motion-warp consumer (jump). */
  recordRootMotion?: boolean;
}

export interface RetargetResult {
  clip: THREE.AnimationClip;
  unitScale: number;
  /** Horizontal hips journey in clip space, if requested. */
  rootTravel?: THREE.Vector3[];
}

/**
 * Bind a foreign Mixamo/Bip001 clip onto this rig:
 * drop unknown joints, rescale translations, freeze hips XZ on bind pose.
 */
export function retargetClipToRig(
  source: THREE.AnimationClip,
  root: THREE.Object3D,
  name = source.name,
  opts: RetargetOpts = {},
): RetargetResult | null {
  const bones = indexRigBones(root);
  if (bones.size === 0) return null;
  const unitScale = measureClipUnits(source, root);
  const hipsName = hipsBoneName(root);
  const hipsBone = hipsName ? bones.get(hipsName) : undefined;
  const tracks: THREE.KeyframeTrack[] = [];
  let rootTravel: THREE.Vector3[] | undefined;

  for (const original of source.tracks) {
    const track = original.clone();
    const node = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
    if (!bones.has(node) && !bones.has(stripNs(node))) continue;

    if (track.name.endsWith(".position")) {
      const values = track.values;
      if (unitScale !== 1) {
        for (let i = 0; i < values.length; i++) values[i] *= unitScale;
      }
      if (hipsName && (node === hipsName || isHipsName(node))) {
        if (opts.recordRootMotion) {
          rootTravel = [];
          for (let i = 0; i < values.length; i += 3) {
            rootTravel.push(new THREE.Vector3(values[i], values[i + 1], values[i + 2]));
          }
        }
        const x = hipsBone ? hipsBone.position.x : values[0];
        const z = hipsBone ? hipsBone.position.z : values[2];
        for (let i = 0; i < values.length; i += 3) {
          values[i] = x;
          values[i + 2] = z;
        }
      }
    }
    tracks.push(track);
  }
  if (!tracks.length) return null;
  return { clip: new THREE.AnimationClip(name, source.duration, tracks), unitScale, rootTravel };
}

/** In-place-safe: clone + freeze hips XZ (native same-skeleton clips). */
export function freezeHipsTravel(clip: THREE.AnimationClip, root: THREE.Object3D): THREE.AnimationClip {
  const out = retargetClipToRig(clip, root, clip.name);
  return out?.clip ?? clip;
}
