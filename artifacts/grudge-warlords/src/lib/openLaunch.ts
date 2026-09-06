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

const OPEN_ALIASES: Record<string, string[]> = {
  [KEYS.characterId]: ["grudge.open.selectedCharacterId", "grudge.open.characterId"],
  [KEYS.raceId]: ["grudge.open.raceId"],
  [KEYS.baseId]: ["grudge.open.baseId"],
  [KEYS.flag]: ["grudge.open.launch"],
};

function read(key: string): string | null {
  try {
    const direct = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (direct) return direct;
    for (const alt of OPEN_ALIASES[key] || []) {
      const v = sessionStorage.getItem(alt) || localStorage.getItem(alt);
      if (v) return v;
    }
    return null;
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
      sessionStorage.setItem("grudge.open.selectedCharacterId", cid);
    }
    if (race) {
      sessionStorage.setItem(KEYS.raceId, race);
      sessionStorage.setItem("grudge.open.raceId", race);
    }
    if (base) {
      sessionStorage.setItem(KEYS.baseId, base);
      sessionStorage.setItem("grudge.open.baseId", base);
    }
    if (fromOpen || cid) {
      sessionStorage.setItem(KEYS.flag, "1");
      sessionStorage.setItem("grudge.open.launch", "1");
    }
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
