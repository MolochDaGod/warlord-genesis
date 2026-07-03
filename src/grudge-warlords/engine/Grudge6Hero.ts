/**
 * GRUDGE6 FBX hero pipeline — mirrors bundle L6 / q6 (atlas flipY=true) / WgSyncWeaponMeshes.
 * Patterns: grudge-character-tester + threejs-loaders + threejs-animation.
 */
import type { AnimPack, Grudge6Visual, WeaponType } from "../types";

/** Bundle: aT(weaponType) → anim pack id */
export function weaponToAnimPack(weapon: WeaponType): AnimPack {
  switch (weapon) {
    case "bow":
      return "longbow";
    case "ranged":
      return "rifle";
    case "pistol":
      return "pistol";
    case "magic":
      return "magic";
    case "sword":
    case "greatsword":
    case "greataxe":
    case "hammer":
    case "axe":
    case "spear":
    case "mace":
    case "knife":
      return "sword_shield";
    default:
      return "unarmed";
  }
}

/** Bundle: L6(root, visibleMeshes) — show only named child meshes */
export function setVisibleMeshes(
  root: { traverse: (cb: (o: { name: string; visible: boolean }) => void) => void },
  names: string[],
): void {
  const allow = new Set(names);
  root.traverse((obj) => {
    if ("visible" in obj) obj.visible = allow.has(obj.name);
  });
}

/** Bundle: WgSyncWeaponMeshes — toggle weapon slot meshes when Q swaps melee/ranged */
export function syncWeaponMeshes(
  root: { traverse: (cb: (o: { name: string; visible: boolean }) => void) => void },
  weaponType: WeaponType,
): void {
  const wt = String(weaponType).toLowerCase();
  const pack =
    wt === "bow"
      ? "longbow"
      : wt === "ranged" || wt === "pistol"
        ? "rifle"
        : wt === "magic"
          ? "magic"
          : ["sword", "greatsword", "greataxe", "hammer", "axe", "spear", "mace", "knife"].includes(wt)
            ? "melee"
            : "";

  const weaponRe = /(?:weapon|Weapon|Shield|shield|Bow|bow|staff|Staff|quiver|Quiver)/;

  root.traverse((obj) => {
    if (!weaponRe.test(obj.name)) return;
    let show = false;
    const n = obj.name;
    if (pack === "longbow") show = /(?:bow|Bow|quiver|Quiver)/.test(n);
    else if (pack === "rifle") show = /(?:gun|Gun|rifle|Rifle|crossbow|Crossbow)/.test(n);
    else if (pack === "magic") show = /(?:staff|Staff)/.test(n);
    else if (pack === "melee")
      show =
        /(?:sword|Sword|axe|Axe|hammer|Hammer|spear|Spear|mace|Mace|knife|Knife|Shield|shield)/.test(n) &&
        !/(?:bow|Bow|staff|Staff|quiver|Quiver)/.test(n);
    obj.visible = show;
  });
}

export type PreparedHero = {
  root: object;
  swapAnimPack: (pack: AnimPack, weaponType?: WeaponType) => Promise<void>;
};

/** High-level loader contract (implementation stays in bundle until Vite migration). */
export type Grudge6LoadOptions = {
  visual: Grudge6Visual;
  fitHeight?: number;
  tint?: string;
};

export function applyHeroVisual(root: object, visual: Grudge6Visual): void {
  if (visual.visibleMeshes?.length) setVisibleMeshes(root, visual.visibleMeshes);
}