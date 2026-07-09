import { create } from "zustand";
import {
  posToSector,
  sectorBounds,
  type SectorCoord,
  type SectorMeta,
} from "@workspace/world-content";

/** Player ship pose on the Aethermoor overworld (world units). */
export interface SailingState {
  x: number;
  z: number;
  yaw: number;
  sector: SectorCoord;
  /** Brief banner after crossing a channel into a new sector */
  transitionBanner: string | null;
  setPose: (x: number, z: number, yaw: number) => void;
  setSector: (sx: number, sz: number, banner?: string) => void;
  warpToSector: (sx: number, sz: number, banner?: string) => void;
  clearBanner: () => void;
  resetSpawn: () => void;
}

/** SE of Waterfall Isle — sail in toward the neutral hub (Tactical-Infinity spawn). */
const SPAWN = { x: 220, z: 220, yaw: Math.PI * 1.25 };

export const useSailing = create<SailingState>((set) => ({
  x: SPAWN.x,
  z: SPAWN.z,
  yaw: SPAWN.yaw,
  sector: posToSector(SPAWN.x, SPAWN.z),
  transitionBanner: null,
  setPose: (x, z, yaw) => set({ x, z, yaw }),
  setSector: (sx, sz, banner) =>
    set({
      sector: { sx, sz },
      transitionBanner: banner ?? null,
    }),
  warpToSector: (sx, sz, banner) => {
    const b = sectorBounds(sx, sz);
    set({
      x: b.centerX,
      z: b.centerZ,
      sector: { sx, sz },
      transitionBanner: banner ?? null,
    });
  },
  clearBanner: () => set({ transitionBanner: null }),
  resetSpawn: () =>
    set({
      ...SPAWN,
      sector: posToSector(SPAWN.x, SPAWN.z),
      transitionBanner: null,
    }),
}));

export function sectorBanner(meta: SectorMeta): string {
  return `Entering ${meta.name}`;
}