/**
 * Unit render routing — mirrors bundle xAA (KayKit tU vs palette eU).
 * Local /models/units/*.glb use embedded textures (tU); CDN uses Color_Palette (eU).
 */

export type UnitKind = "footman" | "grunt" | "archer" | "raider" | "knight" | "ogre";

export function isLocalKayKitUrl(url: string): boolean {
  return /\/models\/units\//.test(url);
}

export function pickUnitLayer(
  kind: UnitKind,
  urls: { footman: string; archer: string; knight: string },
): "kaykit" | "palette" {
  switch (kind) {
    case "footman":
    case "grunt":
      return isLocalKayKitUrl(urls.footman) ? "kaykit" : "palette";
    case "archer":
    case "raider":
      return isLocalKayKitUrl(urls.archer) ? "kaykit" : "palette";
    case "knight":
    case "ogre":
      return isLocalKayKitUrl(urls.knight) ? "kaykit" : "palette";
    default:
      return "palette";
  }
}