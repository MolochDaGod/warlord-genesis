// ── Pre-baked hero prefab GLBs (24 canonical heroes) ─────────────────────────

import type { AnimPackId } from "./animDefaults";
import { raceKitId } from "./raceKitMap";
import { PREFAB_BY_ID, PREFABS, prefabGrudgeId, type PrefabCharacter } from "./prefabs";
import { prefabVisual } from "./prefabVisuals";

/** Same-origin path — Vercel rewrites `/models-glb/*` → assets.grudge-studio.com CDN. */
export const PREFAB_BAKED_CDN_ROOT = "/models-glb/prefabs";

export interface PrefabBakedAsset {
  prefabId: string;
  glbUrl: string;
  manifestUrl: string;
  raceRepo: string;
  animPack: AnimPackId;
  skinTint: string;
  visibleMeshes: string[];
}

export function prefabBakedGlbUrl(prefabId: string): string {
  return `${PREFAB_BAKED_CDN_ROOT}/${prefabId}.glb`;
}

export function prefabBakedManifestUrl(prefabId: string): string {
  return `/models-glb/manifests/prefabs/${prefabId}.controller.json`;
}

export function prefabBakedAsset(prefab: PrefabCharacter | string): PrefabBakedAsset {
  const p = typeof prefab === "string" ? PREFAB_BY_ID[prefab] : prefab;
  if (!p) {
    throw new Error(`unknown prefab "${typeof prefab === "string" ? prefab : prefab.id}"`);
  }
  const vis = prefabVisual(p);
  return {
    prefabId: p.id,
    glbUrl: prefabBakedGlbUrl(p.id),
    manifestUrl: prefabBakedManifestUrl(p.id),
    raceRepo: raceKitId(p.raceId),
    animPack: vis.animPack,
    skinTint: vis.skinTint,
    visibleMeshes: vis.visibleMeshes,
  };
}

export const PREFAB_BAKED_CATALOG: PrefabBakedAsset[] = PREFABS.map((p) => prefabBakedAsset(p));

export function prefabIdForGrudgeId(grudgeId: string): string | null {
  for (const p of PREFABS) {
    if (prefabGrudgeId(p) === grudgeId) return p.id;
  }
  return null;
}