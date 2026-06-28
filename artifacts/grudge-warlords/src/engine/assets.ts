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

/** Prefer CDN when engine boot reports reachability. */
export function resolveUnitAssets(cdnOk: boolean): { models: Record<string, string>; palette: string } {
  const models: Record<string, string> = {};
  for (const id of ["footman", "archer", "knight"] as const) {
    models[id] = cdnOk ? unitModelUrl(id) : unitModelUrlLocal(id);
  }
  return {
    models,
    palette: cdnOk ? unitPaletteUrl() : unitPaletteUrlLocal(),
  };
}

export { ASSET_CDN };