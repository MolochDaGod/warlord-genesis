/**
 * Toon / polyart RTS material + team-color helpers.
 *
 * Visual target: Unity Asset Store polyart packs (clean full-body meshes,
 * saturated hand-painted atlases, soft studio lighting, readable team colors
 * on cloth/armor without destroying skin/metal detail).
 *
 * Team color practice (Ben Golus "The Team Color Problem"):
 *   final = albedo * mix(1, teamColor, mask)
 * Without a mask map we use a *weak* soft lerp so the painted atlas stays primary.
 */

import * as THREE from "three";

let toonGradient: THREE.DataTexture | null = null;

/** 4-band grayscale ramp for MeshToonMaterial (polyart-friendly). */
export function getToonGradientMap(): THREE.DataTexture {
  if (toonGradient) return toonGradient;
  // Stepped shades: shadow → mid → lit → highlight
  const data = new Uint8Array([
    70, 70, 70, 255, 120, 120, 120, 255, 185, 185, 185, 255, 255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  toonGradient = tex;
  return tex;
}

function isWeaponMeshName(name: string): boolean {
  return /weapon|sword|axe|bow|staff|shield|gun|rifle|quiver|hammer|spear|mace|tome|dagger/i.test(
    name || "",
  );
}

export interface ToonRtsFinalizeOpts {
  /** Faction / team hex (e.g. #3b82f6). Applied weakly so atlas stays primary. */
  teamColor?: string;
  /**
   * 0..1 strength of team soft-tint when a map is present.
   * Polyart packs usually ship painted colors — keep low (0.12–0.22).
   */
  teamStrength?: number;
  /** Prefer MeshToonMaterial (banded lighting) vs polished Standard. Default true. */
  useToon?: boolean;
}

/**
 * Normalize materials on a loaded grudge6 / kit hero for clean lobby + battle render:
 * - sRGB atlas, correct flipY for glTF embeds
 * - low metal / high roughness (polyart matte)
 * - weak team tint (not full multiply)
 * - frustumCulled off for skinned parts
 */
export function finalizeToonRtsHero(
  root: THREE.Object3D,
  opts: ToonRtsFinalizeOpts = {},
): void {
  const teamStrength = opts.teamStrength ?? 0.16;
  const useToon = opts.useToon !== false;
  const team =
    opts.teamColor && opts.teamColor !== "#ffffff" && opts.teamColor !== "#fff"
      ? new THREE.Color(opts.teamColor)
      : null;
  const white = new THREE.Color(0xffffff);
  const gradient = useToon ? getToonGradientMap() : null;

  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh)) return;

    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;

    const isWep = isWeaponMeshName(node.name);
    const strength = team ? (isWep ? teamStrength * 0.35 : teamStrength) : 0;
    const soft = team ? white.clone().lerp(team, Math.min(0.4, Math.max(0, strength))) : white;

    const srcMats = Array.isArray(node.material) ? node.material : [node.material];
    const out: THREE.Material[] = [];

    for (const raw of srcMats) {
      if (!raw) continue;
      const src = raw as THREE.MeshStandardMaterial;
      const map = src.map ?? null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        // glTF embedded maps: flipY must stay false
        map.flipY = false;
        map.anisotropy = Math.max(map.anisotropy || 1, 8);
        map.needsUpdate = true;
      }

      if (useToon && gradient) {
        const toon = new THREE.MeshToonMaterial({
          map: map ?? undefined,
          color: soft,
          gradientMap: gradient,
          // Keep alpha if present (cutouts)
          transparent: src.transparent === true,
          opacity: src.opacity ?? 1,
          side: THREE.FrontSide,
        });
        // MeshToonMaterial uses map * color — soft team already in color
        out.push(toon);
        if (raw !== src && "dispose" in raw) {
          /* keep original for shared caches — only dispose if we own it later */
        }
      } else {
        const std =
          src.isMeshStandardMaterial || src.type === "MeshStandardMaterial"
            ? src.clone()
            : new THREE.MeshStandardMaterial({
                map: map ?? undefined,
                color: soft.clone(),
              });
        std.map = map;
        std.color.copy(soft);
        std.roughness = 0.88;
        std.metalness = isWep ? 0.22 : 0.04;
        std.envMapIntensity = 0.15;
        std.needsUpdate = true;
        out.push(std);
      }
    }

    if (out.length === 1) node.material = out[0]!;
    else if (out.length > 1) node.material = out;
  });
}

/** Studio presentation defaults matching Asset Store polyart screenshots. */
export const TOON_RTS_STUDIO = {
  background: "#3a3a3a" as const,
  ground: "#4a4a4a" as const,
  hemiSky: "#ffffff" as const,
  hemiGround: "#5a5a5a" as const,
  keyIntensity: 1.35,
  fillIntensity: 0.45,
  ambientIntensity: 0.55,
  toneMappingExposure: 1.12,
};
