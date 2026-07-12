/**
 * Fleet origins — static canonical map + optional health probe.
 * Player game data is NEVER api.grudge-studio.com (retired split-brain).
 */

import { GRUDGE_FLEET_URLS } from "./fleetUrls";

const CACHE_KEY = "grudge_origins_v2";
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

/** Canonical static fleet map (SSOT). */
const FALLBACK_CATALOG: OriginsCatalog = {
  ok: true,
  version: "canonical-2026",
  updatedAt: Date.now(),
  origins: [
    {
      id: "game-data",
      label: "Game API (Railway)",
      kind: "http",
      url: GRUDGE_FLEET_URLS.gameData,
      status: "live",
      roles: ["api", "game-data", "characters", "account", "wallet", "treaty"],
      healthUrl: `${GRUDGE_FLEET_URLS.gameData}/api/health`,
      updatedAt: Date.now(),
    },
    {
      id: "identity",
      label: "Grudge ID",
      kind: "http",
      url: GRUDGE_FLEET_URLS.identity,
      status: "live",
      roles: ["auth", "identity"],
      updatedAt: Date.now(),
    },
    {
      id: "hub",
      label: "Studio Hub",
      kind: "http",
      url: GRUDGE_FLEET_URLS.hub,
      status: "live",
      roles: ["portal", "wallet", "treaty"],
      updatedAt: Date.now(),
    },
    {
      id: "ws",
      label: "Realtime (Railway)",
      kind: "ws",
      url: "wss://grudge-api-production-0d46.up.railway.app",
      status: "live",
      roles: ["realtime", "colyseus"],
      updatedAt: Date.now(),
    },
    {
      id: "cdn",
      label: "Assets R2",
      kind: "http",
      url: GRUDGE_FLEET_URLS.assetsCdn,
      status: "live",
      roles: ["cdn", "models"],
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
    /* ignore */
  }
}

/** Probe Railway health and return endpoints for lobby display. */
export async function getFleetEndpoints(): Promise<{
  world: string | null;
  colyseus: { host: string; port: number } | null;
  gameData: string;
  identity: string;
  hub: string;
  healthy: boolean;
}> {
  const cached = readCache();
  let healthy = false;
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as { status?: string; database?: string };
    healthy = r.ok && (j.status === "healthy" || j.database === "connected");
  } catch {
    healthy = false;
  }
  const catalog = cached ?? FALLBACK_CATALOG;
  if (!cached) writeCache(FALLBACK_CATALOG);

  return {
    world: GRUDGE_FLEET_URLS.water,
    colyseus: { host: "grudge-api-production-0d46.up.railway.app", port: 443 },
    gameData: GRUDGE_FLEET_URLS.gameData,
    identity: GRUDGE_FLEET_URLS.identity,
    hub: GRUDGE_FLEET_URLS.hub,
    healthy,
  };
}

export async function getOriginsCatalog(): Promise<OriginsCatalog> {
  const cached = readCache();
  if (cached) return cached;
  writeCache(FALLBACK_CATALOG);
  return FALLBACK_CATALOG;
}
