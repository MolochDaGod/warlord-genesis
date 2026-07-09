/** Selector / viewer race ids → character-kit race id strings. */
export const GRUDGE_RACE_TO_KIT: Record<string, string> = {
  human: "western-kingdoms",
  barbarian: "barbarians",
  elf: "high-elves",
  dwarf: "dwarves",
  orc: "orcs",
  undead: "undead",
};

export function raceKitId(raceId: string): string {
  return GRUDGE_RACE_TO_KIT[raceId] ?? "western-kingdoms";
}