/**
 * Fleet origins catalog — discover edge + VPS servers autonomously.
 * Fetched from api.grudge-studio.com/origins (CF Worker → KV registry).
 */

import { deployUrl } from "./deployRoutes";
import { GRUDGE_FLEET_URLS } from "./fleetUrls";

/** Live registry (may 404 if worker path missing — always fall back). */
const ORIGINS_API = "https://api.grudge-studio.com/api/origins";
const ORIGINS_API_LEGACY = "https://api.grudge-studio.com/origins";
const CACHE_KEY = "grudge_origins_v1";
const CACHE_TTL_MS = 60_000;

export type OriginKind = "http" | "ws" | "colyseus" | "tunnel";
export type OriginStatus = "live" | "degraded" | "offline" | "planned";

export interface FleetOrigin {
  id: string;
  label: string;
  kind: OriginKind;
  url: string;
  host?: string;
  port?: number;
  status: OriginStatus;
  region?: string;
  roles?: string[];
  healthUrl?: string;
  updatedAt: number;
}

export interface OriginsCatalog {
  ok: boolean;
  version: string;
  updatedAt: number;
  origins: FleetOrigin[];
}

/** Static fleet map so lobby never hard-depends on the origins worker. */
const FALLBACK_CATALOG: OriginsCatalog = {
  ok: true,
  version: "fallback-static",
  updatedAt: Date.now(),
  origins: [
    {
      id: "api",
      label: "Game API",
      kind: "http",
      url: "https://api.grudge-studio.com",
      status: "live",
      roles: ["api", "game-data"],
      healthUrl: "https://api.grudge-studio.com/api/health",
      updatedAt: Date.now(),
    },
    {
      id: "identity",
      label: "Grudge ID",
      kind: "http",
      url: "https://id.grudge-studio.com",
      status: "live",
      roles: ["auth", "identity"],
      updatedAt: Date.now(),
    },
    {
      id: "ws",
      label: "WebSocket edge",
      kind: "ws",
      url: "wss://grudge-api-production-0d46.up.railway.app",
      status: "live",
      roles: ["realtime"],
      updatedAt: Date.now(),
    },
  ],
};

function readCache(): OriginsCatalog | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, catalog } = JSON.parse(raw) as { at: number; catalog: OriginsCatalog };
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return catalog;
  } catch {
    return null;
  }
}

function writeCache(catalog: OriginsCatalog): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), catalog }));
  } catch {
    // ignore
  }
}

/** Fetch the full fleet origins catalog (cached 60s). Never throws. */
export async function fetchOrigins(force = false): Promise<OriginsCatalog> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  for (const url of [ORIGINS_API, ORIGINS_API_LEGACY]) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) continue;
      const catalog = (await res.json()) as OriginsCatalog;
      if (catalog?.origins?.length) {
        writeCache(catalog);
        return catalog;
      }
    } catch {
      /* try next */
    }
  }
  writeCache(FALLBACK_CATALOG);
  return FALLBACK_CATALOG;
}

/** Pick the best live origin for a role (world, pvp, api, auth, …). */
export async function resolveOrigin(
  role: string,
  opts?: { kind?: OriginKind; fallback?: string },
): Promise<FleetOrigin | null> {
  const catalog = await fetchOrigins();
  const ranked = catalog.origins
    .filter((o) => o.roles?.includes(role) || o.id === role)
    .sort((a, b) => {
      const score = (s: OriginStatus) =>
        s === "live" ? 0 : s === "degraded" ? 1 : s === "planned" ? 2 : 3;
      return score(a.status) - score(b.status) || b.updatedAt - a.updatedAt;
    });
  const hit = ranked.find((o) => !opts?.kind || o.kind === opts.kind) ?? ranked[0];
  if (hit?.url) return hit;
  if (opts?.fallback) {
    return {
      id: role,
      label: role,
      kind: opts.kind || "http",
      url: opts.fallback,
      status: "degraded",
      updatedAt: Date.now(),
    };
  }
  return null;
}

/** Convenience URLs for common app flows. */
export async function getFleetEndpoints(): Promise<{
  api: string;
  identity: string;
  ws: string;
  world: string | null;
  colyseus: { host: string; port: number } | null;
  lobby: string;
}> {
  const catalog = await fetchOrigins();
  const byId = new Map(catalog.origins.map((o) => [o.id, o]));
  const api = byId.get("api")?.url || "https://api.grudge-studio.com";
  const identity = byId.get("identity")?.url || "https://id.grudge-studio.com";
  const ws = byId.get("ws")?.url || "wss://ws.grudge-studio.com";
  const worldOrigin = byId.get("world");
  const col = byId.get("colyseus");
  return {
    api,
    identity,
    ws,
    world: worldOrigin?.status === "live" || worldOrigin?.status === "degraded" ? worldOrigin.url : null,
    colyseus: col?.host ? { host: col.host, port: col.port || 2567 } : null,
    lobby: deployUrl(GRUDGE_FLEET_URLS.warlords),
  };
}