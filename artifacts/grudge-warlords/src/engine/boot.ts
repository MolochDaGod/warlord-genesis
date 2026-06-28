import { WARLORD_MANIFEST } from "./warlordManifest";

const CACHE_KEY = "gw_engine_boot_v1";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface EngineBootState {
  ready: boolean;
  manifest: typeof WARLORD_MANIFEST;
  cdnReachable: boolean;
  bootedAt: number;
}

let state: EngineBootState = {
  ready: false,
  manifest: WARLORD_MANIFEST,
  cdnReachable: false,
  bootedAt: 0,
};

/** Grudge Engine boot — manifest + optional CDN probe (R2 best practice). */
export async function bootEngine(): Promise<EngineBootState> {
  const cached = readCache();
  if (cached) {
    state = cached;
    return state;
  }

  let cdnReachable = false;
  try {
    const res = await fetch(`${WARLORD_MANIFEST.pipeline.cdn}/grudge-nexus/textures/Color_Palette.png`, {
      method: "HEAD",
      mode: "cors",
    });
    cdnReachable = res.ok;
  } catch {
    cdnReachable = false;
  }

  state = {
    ready: true,
    manifest: WARLORD_MANIFEST,
    cdnReachable,
    bootedAt: Date.now(),
  };
  writeCache(state);
  return state;
}

export function getEngine(): EngineBootState {
  return state;
}

function readCache(): EngineBootState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EngineBootState;
    if (Date.now() - parsed.bootedAt > CACHE_TTL_MS) return null;
    parsed.manifest = WARLORD_MANIFEST;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(s: EngineBootState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}