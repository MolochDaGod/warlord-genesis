/**
 * Open (open.grudge-studio.com) / charactersgrudox → Warlord Genesis handoff.
 *
 * Query contract from Open library / genesis door / GRUDOX campfire:
 *   ?sso_token=…&grudge_token=…&characterId=…&baseId=…&raceId=…
 *   &open=1&from=open|gameopen|charactersgrudox
 *
 * Tokens are dual-written by grudgeStudio.captureRedirectToken.
 * Character id is preferred by fleetCharacterHydrate.
 */

import type { MapSize } from "../game/mapgen";
import type { Difficulty } from "../game/config";

const OPEN_FLAG_KEY = "gw_open_launch";
const OPEN_CHAR_KEY = "gw_open_character_id";
const OPEN_FROM_KEY = "gw_open_from";
const OPEN_BASE_KEY = "gw_open_base_id";
const OPEN_RACE_KEY = "gw_open_race_id";
const OPEN_NAME_KEY = "gw_open_character_name";

export type OpenLaunchState = {
  fromOpen: boolean;
  characterId: string | null;
  baseId: string | null;
  raceId: string | null;
  characterName: string | null;
  from: string | null;
};

function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function localGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Capture Open / charactersgrudox launch flags before URL scrub. Safe to call repeatedly. */
export function captureOpenLaunchParams(qs: URLSearchParams): void {
  const open = qs.get("open");
  const from = qs.get("from");
  const characterId =
    qs.get("characterId") ||
    qs.get("character_id") ||
    qs.get("charId");
  const baseId = qs.get("baseId") || qs.get("base_id");
  const raceId = qs.get("raceId") || qs.get("race_id");
  const characterName = qs.get("characterName") || qs.get("character_name");

  const fromOpen =
    open === "1" ||
    open === "true" ||
    from === "open" ||
    from === "gameopen" ||
    from === "charactersgrudox" ||
    from === "open.grudge-studio.com";

  if (fromOpen) {
    sessionSet(OPEN_FLAG_KEY, "1");
    localSet(OPEN_FLAG_KEY, "1");
  }
  if (from) {
    sessionSet(OPEN_FROM_KEY, from);
  }
  if (characterId) {
    sessionSet(OPEN_CHAR_KEY, characterId);
    localSet(OPEN_CHAR_KEY, characterId);
    // Fleet active character keys (hydrate + warcamp)
    localSet("grudge_active_character", characterId);
    localSet("gruda_active_character", characterId);
  }
  if (baseId) {
    sessionSet(OPEN_BASE_KEY, baseId);
    localSet(OPEN_BASE_KEY, baseId);
  }
  if (raceId) {
    sessionSet(OPEN_RACE_KEY, raceId);
    localSet(OPEN_RACE_KEY, raceId);
  }
  if (characterName) {
    sessionSet(OPEN_NAME_KEY, characterName);
    localSet(OPEN_NAME_KEY, characterName);
  }
}

export function isOpenLaunch(): boolean {
  return sessionGet(OPEN_FLAG_KEY) === "1" || localGet(OPEN_FLAG_KEY) === "1";
}

export function openLaunchCharacterId(): string | null {
  return sessionGet(OPEN_CHAR_KEY) || localGet(OPEN_CHAR_KEY);
}

export function openLaunchBaseId(): string | null {
  return sessionGet(OPEN_BASE_KEY) || localGet(OPEN_BASE_KEY);
}

export function openLaunchRaceId(): string | null {
  return sessionGet(OPEN_RACE_KEY) || localGet(OPEN_RACE_KEY);
}

export function getOpenLaunchState(): OpenLaunchState {
  return {
    fromOpen: isOpenLaunch(),
    characterId: openLaunchCharacterId(),
    baseId: openLaunchBaseId(),
    raceId: openLaunchRaceId(),
    characterName: sessionGet(OPEN_NAME_KEY) || localGet(OPEN_NAME_KEY),
    from: sessionGet(OPEN_FROM_KEY),
  };
}

/**
 * Defaults tuned for Open.grudge-studio.com players:
 * - Skirmish map (smaller, faster load than standard/large)
 * - Normal difficulty
 */
export function openPlayDefaults(): { mapSize: MapSize; difficulty: Difficulty } {
  return { mapSize: "skirmish", difficulty: "normal" };
}

/** Deep-link back to Open library (or gameopen hub). */
export function openStudioReturnUrl(): string {
  const from = sessionGet(OPEN_FROM_KEY);
  if (from === "gameopen" || from === "charactersgrudox") {
    return "https://gameopen.vercel.app/";
  }
  return "https://open.grudge-studio.com/";
}
