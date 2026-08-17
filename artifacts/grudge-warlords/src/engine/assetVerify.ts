/**
 * Verify every scene asset at load time: size, textures, animations.
 * Characters without clips or with insane scale must not ship silently.
 */
import * as THREE from "three";

export type AssetKind = "character" | "unit" | "weapon" | "prop";

export interface ClipReport {
  name: string;
  duration: number;
  tracks: number;
}

export interface AssetVerifyReport {
  url: string;
  kind: AssetKind;
  heightM: number;
  widthM: number;
  depthM: number;
  meshes: number;
  skinnedMeshes: number;
  bones: number;
  texturedMeshes: number;
  untexturedMeshes: number;
  clips: ClipReport[];
  ok: boolean;
  issues: string[];
}

export interface VerifyOpts {
  url: string;
  kind: AssetKind;
  root: THREE.Object3D;
  clips?: THREE.AnimationClip[];
  /** Expected humanoid height after fit (characters / units). */
  targetHeight?: number;
  /** Soft fail (log only) vs hard fail (issues.ok = false). */
  requireClips?: boolean;
  requireTextures?: boolean;
}

function collectMaps(mat: THREE.Material): THREE.Texture[] {
  const rec = mat as THREE.MeshStandardMaterial & Record<string, unknown>;
  const keys = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"];
  const out: THREE.Texture[] = [];
  for (const k of keys) {
    const t = rec[k];
    if (t && t instanceof THREE.Texture) out.push(t);
  }
  return out;
}

export function measureObject(root: THREE.Object3D): THREE.Vector3 {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  return box.getSize(new THREE.Vector3());
}

export function verifyLoadedAsset(opts: VerifyOpts): AssetVerifyReport {
  const { url, kind, root } = opts;
  const clips = (opts.clips ?? []).filter((c) => c && c.duration > 0 && c.tracks.length > 0);
  const size = measureObject(root);
  const issues: string[] = [];

  let meshes = 0;
  let skinnedMeshes = 0;
  let bones = 0;
  let textured = 0;
  let untextured = 0;
  const boneNames = new Set<string>();

  root.traverse((node) => {
    if (node instanceof THREE.Bone) {
      bones++;
      boneNames.add(node.name);
    }
    if (!(node instanceof THREE.Mesh)) return;
    meshes++;
    if (node instanceof THREE.SkinnedMesh) skinnedMeshes++;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    const hasMap = mats.some((m) => m && collectMaps(m).length > 0);
    if (hasMap) textured++;
    else untextured++;
  });

  if (kind === "character" || kind === "unit") {
    if (size.y < 0.35) issues.push(`too small (h=${size.y.toFixed(3)}m)`);
    if (size.y > 6) issues.push(`too tall (h=${size.y.toFixed(2)}m) — likely unscaled cm`);
    if (opts.targetHeight && Math.abs(size.y - opts.targetHeight) > opts.targetHeight * 0.7) {
      issues.push(`height ${size.y.toFixed(2)}m vs target ${opts.targetHeight.toFixed(2)}m`);
    }
    if (skinnedMeshes === 0) issues.push("no SkinnedMesh — cannot bind skeleton clips");
    if (bones === 0) issues.push("no bones");
    if ((opts.requireClips ?? true) && clips.length === 0) {
      issues.push("no playable animation clips on the loaded file");
    }
    if ((opts.requireTextures ?? true) && textured === 0 && meshes > 0) {
      issues.push("no textures (material.map / PBR maps missing)");
    }
  }

  if (kind === "weapon") {
    if (size.y > 8 && size.x > 8) issues.push(`weapon huge (${size.x.toFixed(2)}×${size.y.toFixed(2)})`);
    if (meshes === 0) issues.push("weapon has no meshes");
  }

  const clipReports: ClipReport[] = clips.map((c) => ({
    name: c.name || "(unnamed)",
    duration: c.duration,
    tracks: c.tracks.length,
  }));

  const ok = issues.length === 0;
  const report: AssetVerifyReport = {
    url,
    kind,
    heightM: size.y,
    widthM: size.x,
    depthM: size.z,
    meshes,
    skinnedMeshes,
    bones,
    texturedMeshes: textured,
    untexturedMeshes: untextured,
    clips: clipReports,
    ok,
    issues,
  };

  const line = `[asset-verify] ${kind} ${url} h=${size.y.toFixed(2)} tex=${textured}/${meshes} clips=${clips.length} bones=${bones}${
    ok ? "" : ` ISSUES: ${issues.join("; ")}`
  }`;
  if (ok) console.info(line);
  else console.warn(line);

  return report;
}

/** True when a clip has enough tracks to actually move a skeleton. */
export function isPlayableClip(clip: THREE.AnimationClip | null | undefined): clip is THREE.AnimationClip {
  return Boolean(clip && clip.duration > 0.05 && clip.tracks.length > 0);
}
