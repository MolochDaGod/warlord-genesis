import type { EnemyShipData, Faction } from "./aethermoor";

/** GLB paths under /models/ships (junctioned from Tactical-Infinity public/). */
export const TI_SHIP_GLB: Record<EnemyShipData["shipType"], string> = {
  small: "/models/ships/ship-small.glb",
  medium: "/models/ships/ship-medium.glb",
  large: "/models/ships/ship-large.glb",
  ghost: "/models/ships/ship-ghost.glb",
};

export function shipGlbForType(
  shipType: EnemyShipData["shipType"],
  faction: Faction,
): string {
  if (faction === "pirate") {
    const pirate: Record<EnemyShipData["shipType"], string> = {
      small: "/models/ships/ship-pirate-small.glb",
      medium: "/models/ships/ship-pirate-medium.glb",
      large: "/models/ships/ship-pirate-large.glb",
      ghost: "/models/ships/ship-ghost.glb",
    };
    return pirate[shipType];
  }
  return TI_SHIP_GLB[shipType];
}

export const TI_PLAYER_SHIP_GLB = "/models/ships/pirate-sloop.glb";