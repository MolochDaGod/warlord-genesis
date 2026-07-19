/**
 * Flare-Boss → Warlords Era 3D islands content port.
 *
 * Source patterns: Flare-Boss-Arena (GameEngine dungeons, bosses, enemy spawn)
 * Target surfaces: 9-sector maps, events, instances, lobby, home-island
 */

export * from "./darkElves";
export * from "./whisp";
export * from "./missions";
export * from "./dungeons";
export * from "./sectorEvents";

export const FLARE_PORT_VERSION = "1.0.0";
export const FLARE_PORT_SOURCE = "Flare-Boss-Arena + GrudgeBuilder missionSystem";
export const FLARE_PORT_TARGET =
  "warlord-genesis / Warlords Era islands (sectors, lobby, home-island, instances)";
