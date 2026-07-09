/** Registered game artifacts — keys for `game_profiles.game_id`. */
export const GAME_IDS = {
  WARLORDS: "grudge-warlords",
  WORLD: "grudge-world",
} as const;

export type GameId = (typeof GAME_IDS)[keyof typeof GAME_IDS];

const KNOWN = new Set<string>(Object.values(GAME_IDS));

export function isKnownGameId(id: string): id is GameId {
  return KNOWN.has(id);
}