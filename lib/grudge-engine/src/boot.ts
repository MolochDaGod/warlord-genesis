import type { EngineManifest } from "./manifest";

export interface EngineBootState<M extends EngineManifest = EngineManifest> {
  ready: boolean;
  manifest: M;
  cdnReachable: boolean;
  bootedAt: number;
}

export interface EngineBootOptions {
  cacheKey?: string;
  cacheTtlMs?: number;
  /** URL for CDN HEAD probe; defaults to manifest.pipeline.r2.unitPalette if set. */
  probeUrl?: string;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;

/** Factory — one engine instance per game manifest. */
export function createEngineBoot<M extends EngineManifest>(
  manifest: M,
  options: EngineBootOptions = {},
) {
  const cacheKey = options.cacheKey ?? `engine_boot_${manifest.controllers.id}`;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_TTL_MS;
  const probeUrl =
    options.probeUrl ??
    manifest.pipeline.r2["unitPalette"] ??
    `${manifest.pipeline.cdn}/`;

  let state: EngineBootState<M> = {
    ready: false,
    manifest,
    cdnReachable: false,
    bootedAt: 0,
  };

  async function bootEngine(): Promise<EngineBootState<M>> {
    const cached = readCache(cacheKey, cacheTtlMs, manifest);
    if (cached) {
      state = cached;
      return state;
    }

    let cdnReachable = false;
    try {
      const res = await fetch(probeUrl, { method: "HEAD", mode: "cors" });
      cdnReachable = res.ok;
    } catch {
      cdnReachable = false;
    }

    state = {
      ready: true,
      manifest,
      cdnReachable,
      bootedAt: Date.now(),
    };
    writeCache(cacheKey, state);
    return state;
  }

  function getEngine(): EngineBootState<M> {
    return state;
  }

  return { bootEngine, getEngine };
}

function readCache<M extends EngineManifest>(
  cacheKey: string,
  ttlMs: number,
  manifest: M,
): EngineBootState<M> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EngineBootState<M>;
    if (Date.now() - parsed.bootedAt > ttlMs) return null;
    parsed.manifest = manifest;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache<M extends EngineManifest>(cacheKey: string, s: EngineBootState<M>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}