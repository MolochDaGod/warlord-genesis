import {
  WORLD_ENEMY_SHIPS,
  WORLD_ISLANDS,
  WORLD_SIZE,
  type EnemyShipData,
  type Vec2,
  type WorldIslandData,
} from "./aethermoor";

/** 3×3 overworld grid — each cell is a streamed sailing sector. */
export const SECTOR_GRID = 3;
export const SECTOR_SIZE = WORLD_SIZE / SECTOR_GRID;
const WORLD_HALF = WORLD_SIZE / 2;

/** Width of the navigable channel cut through each sector border (world units). */
export const CHANNEL_SPAN = 520;
/** How close to the border the ship must be to trigger a sector load. */
export const CHANNEL_DEPTH = 200;
/** Placement inside the new sector after a channel crossing. */
export const CHANNEL_ENTRY_INSET = 140;

export interface SectorCoord {
  sx: number;
  sz: number;
}

export type ChannelDir = "north" | "south" | "east" | "west";

export interface SectorBounds {
  sx: number;
  sz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
}

export interface SectorMeta {
  id: string;
  sx: number;
  sz: number;
  name: string;
  subtitle: string;
  /** Primary faction tone for HUD / fog tint */
  tone: "crusade" | "fabled" | "legion" | "pirate" | "neutral" | "frontier";
}

/** Lore names for the 9 sectors (NW→SE). */
export const SECTOR_META: SectorMeta[] = [
  { id: "nw", sx: 0, sz: 0, name: "Frozen Expanse", subtitle: "Northern Ethereal Falls", tone: "frontier" },
  { id: "n", sx: 1, sz: 0, name: "Odin's Reach", subtitle: "Crusade northern seas", tone: "crusade" },
  { id: "ne", sx: 2, sz: 0, name: "Gilded Frontier", subtitle: "Crusade trade routes", tone: "crusade" },
  { id: "w", sx: 0, sz: 1, name: "Forgotten Shoals", subtitle: "Western ruins & lighthouses", tone: "neutral" },
  { id: "c", sx: 1, sz: 1, name: "Sanctuary Waters", subtitle: "Waterfall Isle hub — no PvP", tone: "neutral" },
  { id: "e", sx: 2, sz: 1, name: "Starfall Archipelago", subtitle: "Fabled eastern realms", tone: "fabled" },
  { id: "sw", sx: 0, sz: 2, name: "Wildwood Drift", subtitle: "Legion western approach", tone: "legion" },
  { id: "s", sx: 1, sz: 2, name: "Hellmaw Depths", subtitle: "Legion volcanic south", tone: "legion" },
  { id: "se", sx: 2, sz: 2, name: "Pirate Expanse", subtitle: "Freeport & lawless coves", tone: "pirate" },
];

export function sectorKey(sx: number, sz: number): string {
  return `${sx},${sz}`;
}

export function sectorBounds(sx: number, sz: number): SectorBounds {
  const minX = -WORLD_HALF + sx * SECTOR_SIZE;
  const minZ = -WORLD_HALF + sz * SECTOR_SIZE;
  const maxX = minX + SECTOR_SIZE;
  const maxZ = minZ + SECTOR_SIZE;
  return {
    sx,
    sz,
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

export function posToSector(x: number, z: number): SectorCoord {
  const sx = Math.min(SECTOR_GRID - 1, Math.max(0, Math.floor((x + WORLD_HALF) / SECTOR_SIZE)));
  const sz = Math.min(SECTOR_GRID - 1, Math.max(0, Math.floor((z + WORLD_HALF) / SECTOR_SIZE)));
  return { sx, sz };
}

export function sectorMeta(sx: number, sz: number): SectorMeta {
  return SECTOR_META.find((m) => m.sx === sx && m.sz === sz) ?? SECTOR_META[4]!;
}

export function islandsInSector(sx: number, sz: number): WorldIslandData[] {
  return WORLD_ISLANDS.filter((i) => {
    const s = posToSector(i.position.x, i.position.z);
    return s.sx === sx && s.sz === sz;
  });
}

export function shipsInSector(sx: number, sz: number): EnemyShipData[] {
  return WORLD_ENEMY_SHIPS.filter((s) => {
    const c = posToSector(s.patrolCenter.x, s.patrolCenter.z);
    return c.sx === sx && c.sz === sz;
  });
}

function inChannelSpan(along: number, center: number): boolean {
  return Math.abs(along - center) <= CHANNEL_SPAN / 2;
}

/** Soft clamp — blocks sailing through solid sector edges except channel mouths. */
export function clampToSector(pos: Vec2, sector: SectorCoord): Vec2 {
  const b = sectorBounds(sector.sx, sector.sz);
  let { x, z } = pos;

  if (x < b.minX) x = b.minX;
  if (x > b.maxX) x = b.maxX;
  if (z < b.minZ) z = b.minZ;
  if (z > b.maxZ) z = b.maxZ;

  if (sector.sx > 0 && x <= b.minX + 2 && !inChannelSpan(z, b.centerZ)) x = b.minX + 2;
  if (sector.sx < SECTOR_GRID - 1 && x >= b.maxX - 2 && !inChannelSpan(z, b.centerZ)) x = b.maxX - 2;
  if (sector.sz > 0 && z <= b.minZ + 2 && !inChannelSpan(x, b.centerX)) z = b.minZ + 2;
  if (sector.sz < SECTOR_GRID - 1 && z >= b.maxZ - 2 && !inChannelSpan(x, b.centerX)) z = b.maxZ - 2;

  return { x, z };
}

export interface SectorTransition {
  from: SectorCoord;
  to: SectorCoord;
  dir: ChannelDir;
  newPos: Vec2;
  meta: SectorMeta;
}

/** When the ship sails through a channel mouth, return the adjacent sector to load. */
export function detectSectorTransition(pos: Vec2, sector: SectorCoord): SectorTransition | null {
  const b = sectorBounds(sector.sx, sector.sz);

  if (sector.sx < SECTOR_GRID - 1 && pos.x >= b.maxX - CHANNEL_DEPTH && inChannelSpan(pos.z, b.centerZ)) {
    const to = { sx: sector.sx + 1, sz: sector.sz };
    const nb = sectorBounds(to.sx, to.sz);
    return {
      from: sector,
      to,
      dir: "east",
      newPos: { x: nb.minX + CHANNEL_ENTRY_INSET, z: pos.z },
      meta: sectorMeta(to.sx, to.sz),
    };
  }

  if (sector.sx > 0 && pos.x <= b.minX + CHANNEL_DEPTH && inChannelSpan(pos.z, b.centerZ)) {
    const to = { sx: sector.sx - 1, sz: sector.sz };
    const nb = sectorBounds(to.sx, to.sz);
    return {
      from: sector,
      to,
      dir: "west",
      newPos: { x: nb.maxX - CHANNEL_ENTRY_INSET, z: pos.z },
      meta: sectorMeta(to.sx, to.sz),
    };
  }

  if (sector.sz > 0 && pos.z <= b.minZ + CHANNEL_DEPTH && inChannelSpan(pos.x, b.centerX)) {
    const to = { sx: sector.sx, sz: sector.sz - 1 };
    const nb = sectorBounds(to.sx, to.sz);
    return {
      from: sector,
      to,
      dir: "north",
      newPos: { x: pos.x, z: nb.maxZ - CHANNEL_ENTRY_INSET },
      meta: sectorMeta(to.sx, to.sz),
    };
  }

  if (sector.sz < SECTOR_GRID - 1 && pos.z >= b.maxZ - CHANNEL_DEPTH && inChannelSpan(pos.x, b.centerX)) {
    const to = { sx: sector.sx, sz: sector.sz + 1 };
    const nb = sectorBounds(to.sx, to.sz);
    return {
      from: sector,
      to,
      dir: "south",
      newPos: { x: pos.x, z: nb.minZ + CHANNEL_ENTRY_INSET },
      meta: sectorMeta(to.sx, to.sz),
    };
  }

  return null;
}

export interface ChannelGate {
  dir: ChannelDir;
  /** world-space center of the channel mouth */
  cx: number;
  cz: number;
  /** length along the border */
  span: number;
  /** neighbor sector if any */
  neighbor: SectorMeta | null;
}

export function channelGates(sector: SectorCoord): ChannelGate[] {
  const b = sectorBounds(sector.sx, sector.sz);
  const gates: ChannelGate[] = [];

  if (sector.sx > 0) {
    const n = sectorMeta(sector.sx - 1, sector.sz);
    gates.push({ dir: "west", cx: b.minX, cz: b.centerZ, span: CHANNEL_SPAN, neighbor: n });
  }
  if (sector.sx < SECTOR_GRID - 1) {
    const n = sectorMeta(sector.sx + 1, sector.sz);
    gates.push({ dir: "east", cx: b.maxX, cz: b.centerZ, span: CHANNEL_SPAN, neighbor: n });
  }
  if (sector.sz > 0) {
    const n = sectorMeta(sector.sx, sector.sz - 1);
    gates.push({ dir: "north", cx: b.centerX, cz: b.minZ, span: CHANNEL_SPAN, neighbor: n });
  }
  if (sector.sz < SECTOR_GRID - 1) {
    const n = sectorMeta(sector.sx, sector.sz + 1);
    gates.push({ dir: "south", cx: b.centerX, cz: b.maxZ, span: CHANNEL_SPAN, neighbor: n });
  }

  return gates;
}