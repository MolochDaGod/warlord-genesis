/**
 * Grudge Warlord race character cards — SSOT for tactical equipment paper-doll.
 *
 * Design guide (tactical / equipment page):
 *   docs/references/tactical-equipment-race-cards.png
 *   assets/ui-kit/race-cards/_layout-guide.png
 *
 * Metrics (from design annotation):
 *   slot = 48px · gap = 9px · pad = 11px
 *
 * Grid (6 rows × 2 columns of slots + center portrait):
 *   LEFT  R1→R6: helm · chest · hands · legs · feet · ring
 *   RIGHT R1→R6: weapon · offhand · necklace · shoulder · relic · (+) bag
 *
 * Race plate art (silhouette + environment):
 *   /assets/ui-kit/race-cards/{human,orc,elf,dwarf,barbarian,undead}.png
 */

import type { SlotId } from "./equipment";

export const RACE_IDS = [
  "human",
  "orc",
  "elf",
  "dwarf",
  "barbarian",
  "undead",
] as const;

export type RaceCardId = (typeof RACE_IDS)[number];

export const RACE_CARD_LABEL: Record<RaceCardId, string> = {
  human: "HUMAN",
  orc: "ORC",
  elf: "ELF",
  dwarf: "DWARF",
  barbarian: "BARBARIAN",
  undead: "UNDEAD",
};

/** Exact layout tokens from the tactical equipment design. */
export const TACTICAL_EQUIP = {
  /** Slot button size */
  slotPx: 48,
  /** Vertical/horizontal gap between slots */
  gapPx: 9,
  /** Inner padding around the doll grid */
  padPx: 11,
  /** Portrait column flex weight / min width */
  portraitMinPx: 120,
  rows: 6,
} as const;

/** CDN / deploy path for race card portrait plate. */
export function raceCardUrl(race: string): string {
  const id = normalizeRaceId(race);
  return `/assets/ui-kit/race-cards/${id}.png`;
}

export function normalizeRaceId(race: string | undefined | null): RaceCardId {
  const r = (race || "human").toLowerCase();
  if ((RACE_IDS as readonly string[]).includes(r)) return r as RaceCardId;
  if (r === "western-kingdoms" || r === "wk" || r === "humans") return "human";
  if (r === "barbarians" || r === "brb") return "barbarian";
  if (r === "high-elves" || r === "elves" || r === "elfs") return "elf";
  if (r === "dwarves" || r === "dwf") return "dwarf";
  if (r === "orcs" || r === "orcish") return "orc";
  if (r === "ud" || r === "undeads" || r === "skeleton") return "undead";
  return "human";
}

export type PaperDollSide = "left" | "right";

export interface PaperDollSlotDef {
  id: SlotId | "bag";
  side: PaperDollSide;
  /** 0-based row (R1 = 0 … R6 = 5) */
  row: number;
  label: string;
  /** Empty-slot glyph (unicode, matches design icons) */
  icon: string;
  /** True for the gold “+” bag / inventory action */
  isAction?: boolean;
}

/**
 * Tactical equipment slots — left armor column, right weapons/jewelry.
 * Row order matches the design guide annotation (R1 top → R6 bot).
 */
export const PAPER_DOLL_SLOTS: PaperDollSlotDef[] = [
  // LEFT column — armor / body
  { id: "helm", side: "left", row: 0, label: "Helm", icon: "⛑" },
  { id: "chest", side: "left", row: 1, label: "Chest", icon: "👕" },
  { id: "hands", side: "left", row: 2, label: "Gauntlets", icon: "🖐" },
  { id: "legs", side: "left", row: 3, label: "Greaves", icon: "👖" },
  { id: "feet", side: "left", row: 4, label: "Boots", icon: "👢" },
  { id: "ring", side: "left", row: 5, label: "Ring", icon: "○" },
  // RIGHT column — weapons / jewels / relic
  { id: "weapon", side: "right", row: 0, label: "Main Hand", icon: "⚔" },
  { id: "offhand", side: "right", row: 1, label: "Off Hand", icon: "🛡" },
  { id: "necklace", side: "right", row: 2, label: "Necklace", icon: "◆" },
  { id: "shoulder", side: "right", row: 3, label: "Shoulders", icon: "⚓" },
  { id: "relic", side: "right", row: 4, label: "Relic", icon: "✦" },
  { id: "bag", side: "right", row: 5, label: "Inventory", icon: "+", isAction: true },
];

export const PAPER_DOLL_LEFT = PAPER_DOLL_SLOTS.filter((s) => s.side === "left");
export const PAPER_DOLL_RIGHT = PAPER_DOLL_SLOTS.filter((s) => s.side === "right");

/** Real gear slots only (excludes bag action). */
export const PAPER_DOLL_SLOT_IDS: SlotId[] = PAPER_DOLL_SLOTS.filter(
  (s): s is PaperDollSlotDef & { id: SlotId } => s.id !== "bag" && !s.isAction,
).map((s) => s.id);

/** @deprecated use PAPER_DOLL_SLOTS — kept for any percent-position consumers */
export type PaperDollSlotPos = PaperDollSlotDef & { x?: number; y?: number };
