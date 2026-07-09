import type { GameMode } from "./types";

export function modeCapacity(mode: GameMode): number {
  switch (mode) {
    case "1v1":
      return 2;
    case "2v2":
      return 4;
    case "3v3":
      return 6;
  }
}

export function teamSize(mode: GameMode): number {
  return modeCapacity(mode) / 2;
}

/** X offset for hero spawn fan-out within a team (slot index 0..teamSize-1). */
export function heroSpawnOffsetX(teamSlot: number, mode: GameMode): number {
  const n = teamSize(mode);
  if (n <= 1) return 0;
  const spread = n === 2 ? 3.5 : 5.5;
  return (teamSlot - (n - 1) / 2) * spread;
}