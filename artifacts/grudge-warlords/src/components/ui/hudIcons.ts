/**
 * Battle HUD icons — real PNGs from the Grudge icon pack (info.grudge-studio.com
 * / local MouseWithoutBorders icons), staged under public/icons/hud/.
 */

export const HUD_ICONS = {
  sword: "/icons/hud/sword.png",
  bow: "/icons/hud/bow.png",
  axe: "/icons/hud/axe.png",
  hammer: "/icons/hud/hammer.png",
  scythe: "/icons/hud/scythe.png",
  staff: "/icons/hud/staff.png",
  shield: "/icons/hud/shield.png",
  armory: "/icons/hud/Armory-Icon.png",
  arsenal: "/icons/hud/Arsenal-Icon.png",
  blacksmith: "/icons/hud/Blacksmith-Icon.png",
  /** Fortify slots */
  cannon: "/icons/hud/hammer.png",
  ballista: "/icons/hud/bow.png",
  mageTower: "/icons/hud/staff.png",
  barrier: "/icons/hud/shield.png",
  repair: "/icons/hud/Blacksmith-Icon.png",
} as const;

/** Map build item ref → icon path */
export function fortifyIcon(ref: string): string {
  const r = ref.toLowerCase();
  if (r.includes("cannon")) return HUD_ICONS.cannon;
  if (r.includes("ballista")) return HUD_ICONS.ballista;
  if (r.includes("mage")) return HUD_ICONS.mageTower;
  if (r.includes("barrier") || r.includes("wall")) return HUD_ICONS.barrier;
  if (r.includes("repair")) return HUD_ICONS.repair;
  return HUD_ICONS.hammer;
}
