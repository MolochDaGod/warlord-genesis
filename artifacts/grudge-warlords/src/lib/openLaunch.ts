/**
 * Open.grudge-studio.com handoff helpers.
 * Captures character / race query params for fleet hydrate.
 * Stub-safe when open launch is not used.
 */

const KEYS = {
  characterId: "gw_open_character_id",
  raceId: "gw_open_race_id",
  baseId: "gw_open_base_id",
  flag: "gw_open_launch",
} as const;

export interface OpenLaunchState {
  characterId: string | null;
  raceId: string | null;
  baseId: string | null;
  active: boolean;
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Capture ?characterId= / ?raceId= / ?from=open on first load. */
export function captureOpenLaunchQuery(): void {
  if (typeof window === "undefined") return;
  try {
    const qs = new URLSearchParams(window.location.search);
    const cid = qs.get("characterId") || qs.get("character_id");
    const race = qs.get("raceId") || qs.get("race");
    const base = qs.get("baseId") || qs.get("base");
    const fromOpen = qs.get("from") === "open" || qs.get("open") === "1";
    if (cid) {
      sessionStorage.setItem(KEYS.characterId, cid);
      localStorage.setItem(KEYS.characterId, cid);
    }
    if (race) sessionStorage.setItem(KEYS.raceId, race);
    if (base) sessionStorage.setItem(KEYS.baseId, base);
    if (fromOpen || cid) sessionStorage.setItem(KEYS.flag, "1");
  } catch {
    /* ignore */
  }
}

captureOpenLaunchQuery();

export function isOpenLaunch(): boolean {
  return read(KEYS.flag) === "1" || Boolean(read(KEYS.characterId));
}

export function openLaunchCharacterId(): string | null {
  return read(KEYS.characterId);
}

export function openLaunchRaceId(): string | null {
  return read(KEYS.raceId);
}

export function openLaunchBaseId(): string | null {
  return read(KEYS.baseId);
}

export function getOpenLaunchState(): OpenLaunchState {
  return {
    characterId: openLaunchCharacterId(),
    raceId: openLaunchRaceId(),
    baseId: openLaunchBaseId(),
    active: isOpenLaunch(),
  };
}
