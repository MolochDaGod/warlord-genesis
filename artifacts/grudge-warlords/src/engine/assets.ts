import { WARLORD_MANIFEST, ASSET_CDN } from "./warlordManifest";

const LOCAL = import.meta.env.BASE_URL;

/** Resolve unit GLB — R2 CDN first, local public fallback (Vercel proxy). */
export function unitModelUrl(mesh: string): string {
  return `${WARLORD_MANIFEST.pipeline.r2.units}${mesh}.glb`;
}

export function unitModelUrlLocal(mesh: string): string {
  return `${LOCAL}models/units/${mesh}.glb`;
}

export function unitPaletteUrl(): string {
  return WARLORD_MANIFEST.pipeline.r2.unitPalette;
}

export function unitPaletteUrlLocal(): string {
  return `${LOCAL}models/units/Color_Palette.png`;
}

export function kaykitEnemyUrlLocal(mesh: string): string {
  return `${LOCAL}models/kaykit/enemies/${mesh}.glb`;
}

export function kaykitHeroUrlLocal(hero: string): string {
  return `${LOCAL}models/kaykit/heroes/${hero}.glb`;
}

/** KayKit faction mob GLBs — lane creeps only, not GRUDGE6 lane guards. */
export function kaykitMobUrlLocal(mesh: string): string {
  if (mesh === "skeleton_warrior" || mesh === "skeleton_mage") {
    return kaykitEnemyUrlLocal(mesh);
  }
  const hero = mesh.replace(/^kaykit_/, "");
  return kaykitHeroUrlLocal(hero);
}

/** @deprecated Use kaykitEnemyUrlLocal */
export function kaykitModelUrlLocal(mesh: string): string {
  return kaykitEnemyUrlLocal(mesh);
}

/** Prefer CDN when engine boot reports reachability. */
export function resolveUnitAssets(cdnOk: boolean): {
  models: Record<string, string>;
  palette: string;
  kaykit: Record<string, string>;
} {
  const models: Record<string, string> = {};
  for (const id of ["footman", "archer", "knight"] as const) {
    models[id] = cdnOk ? unitModelUrl(id) : unitModelUrlLocal(id);
  }
  const kaykit: Record<string, string> = {};
  for (const id of [
    "skeleton_warrior",
    "skeleton_mage",
    "kaykit_barbarian",
    "kaykit_rogue_hooded",
    "kaykit_knight",
    "kaykit_ranger",
  ] as const) {
    kaykit[id] = kaykitMobUrlLocal(id);
  }
  return {
    models,
    palette: cdnOk ? unitPaletteUrl() : unitPaletteUrlLocal(),
    kaykit,
  };
}

export { ASSET_CDN };