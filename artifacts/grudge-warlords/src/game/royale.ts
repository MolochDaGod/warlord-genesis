/**
 * Clash Royale–style deploy rules for Warlord Genesis "royale" map.
 *
 * - Elixir regenerates over time (cap 10)
 * - 4-card hand cycles from a deck
 * - Deploy only on your half of the arena (own side of the river / mid Z)
 * - Units push lanes toward enemy princess towers → king (core)
 *
 * Level art: D:\Games\Models\arena3.glb → models/maps/arena3.glb
 */

import type { MapSize } from "./mapgen";

/** Passive elixir regen (Clash-like ~2.8s per elixir at 1x; we use continuous rate). */
export const ROYALE = {
  /** Max elixir. */
  maxElixir: 10,
  /** Starting elixir. */
  startElixir: 5,
  /** Elixir gained per second (≈1 elixir / 2.8s). */
  regenPerSec: 1 / 2.8,
  /** Double elixir after this many match seconds. */
  doubleElixirAtSec: 120,
  /** Player may only deploy with z on their half (ally = positive z in end-to-end). */
  deployMargin: 2,
  /** Soft radius: cannot drop on top of ally core. */
  minCoreDistance: 8,
  /** Hand size. */
  handSize: 4,
} as const;

export type RoyaleCardId = "footman" | "archer" | "knight" | "swarm" | "giant" | "spear";

export interface RoyaleCard {
  id: RoyaleCardId;
  /** Shop / UNIT_TYPES ref (or special spawn). */
  unitRef: string;
  name: string;
  elixir: number;
  blurb: string;
  /** How many units this card drops. */
  count: number;
  glyph: string;
}

/** Default draft deck (cycle through shuffle bag). */
export const ROYALE_DECK: RoyaleCard[] = [
  {
    id: "footman",
    unitRef: "footman",
    name: "Footmen",
    elixir: 3,
    count: 2,
    blurb: "Cheap melee pair — cycle & pressure.",
    glyph: "🗡️",
  },
  {
    id: "archer",
    unitRef: "archer",
    name: "Archers",
    elixir: 3,
    count: 2,
    blurb: "Ranged support behind the line.",
    glyph: "🏹",
  },
  {
    id: "knight",
    unitRef: "knight",
    name: "Knight",
    elixir: 5,
    count: 1,
    blurb: "Heavy tank for tower dives.",
    glyph: "🛡️",
  },
  {
    id: "swarm",
    unitRef: "footman",
    name: "Militia",
    elixir: 4,
    count: 4,
    blurb: "Swarm of four line troops.",
    glyph: "⚔️",
  },
  {
    id: "giant",
    unitRef: "knight",
    name: "Warlord Knight",
    elixir: 7,
    count: 1,
    blurb: "Elite tank — expensive commitment.",
    glyph: "🏰",
  },
  {
    id: "spear",
    unitRef: "archer",
    name: "Spear Throwers",
    elixir: 2,
    count: 1,
    blurb: "Cheap chip damage cycle card.",
    glyph: "🔱",
  },
];

export function isRoyaleMap(size: MapSize | string): boolean {
  return size === "royale";
}

/** Ally deploys on z >= river (0) in end-to-end maps (ally core +z). */
export function canDeployAt(
  x: number,
  z: number,
  side: "ally" | "enemy",
  mapHalfLength: number,
): boolean {
  const margin = ROYALE.deployMargin;
  if (side === "ally") {
    // Own half: from mid toward ally core (+z)
    return z >= margin && z <= mapHalfLength - 4;
  }
  return z <= -margin && z >= -(mapHalfLength - 4);
}

export function pickNearestLane(x: number, laneXs: number[]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < laneXs.length; i++) {
    const d = Math.abs(x - laneXs[i]!);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Build a 4-card hand + remaining cycle from deck. */
export function dealRoyaleHand(seed = Date.now()): {
  hand: RoyaleCard[];
  cycle: RoyaleCard[];
} {
  const bag = [...ROYALE_DECK];
  // Fisher-Yates with seed
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return {
    hand: bag.slice(0, ROYALE.handSize),
    cycle: bag.slice(ROYALE.handSize),
  };
}

/** After playing card at hand index, draw next from cycle and put played to cycle end. */
export function cycleCard(
  hand: RoyaleCard[],
  cycle: RoyaleCard[],
  handIndex: number,
): { hand: RoyaleCard[]; cycle: RoyaleCard[] } {
  if (handIndex < 0 || handIndex >= hand.length) return { hand, cycle };
  const played = hand[handIndex]!;
  const next = cycle[0];
  const newCycle = [...cycle.slice(1), played];
  const newHand = [...hand];
  if (next) {
    newHand[handIndex] = next;
  } else {
    newHand.splice(handIndex, 1);
  }
  return { hand: newHand, cycle: newCycle };
}
