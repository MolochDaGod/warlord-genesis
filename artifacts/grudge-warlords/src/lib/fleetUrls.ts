/**
 * Canonical Grudge Studio fleet URLs — ONE TRUTH for Warlord Genesis.
 * Player SSOT = Railway Postgres (same-origin /api/* rewrites).
 * Never use api.grudge-studio.com for characters/account/wallet/treaty.
 */

export const GRUDGE_FLEET_URLS = {
  /** Canonical studio hub (grudgeDot) — account / wallet / treaty entry */
  hub: "https://grudge.studio",
  assetsCdn: "https://assets.grudge-studio.com",
  identity: "https://id.grudge-studio.com",
  /** Railway game data (prefer same-origin /api/* in this app) */
  gameData: "https://grudge-api-production-0d46.up.railway.app",
  /** Title API — profiles, matches, leaderboards (Railway warlord-genesis-api) */
  warlordApi: "https://warlord-genesis-api-production-3b5a.up.railway.app",
  objectStore: "https://objectstore.grudge-studio.com/api/v1",
  viewer: "https://character.grudge-studio.com",
  forge: "https://forge.grudge-studio.com",
  warlords: "https://grudgewarlords.com",
  crafting: "https://grudge-crafting.puter.site",
  /** Tactical-Infinity open world */
  water: "https://water.grudge-studio.com",
  /** Warlord Genesis production hosts */
  warstrat: "https://warstrat.grudge-studio.com",
  warlordGenesis: "https://warlord-genesis.vercel.app",
  fleetMap: "https://fleet.grudge-studio.com",
  /** Flare sister title + shared MP patterns */
  flare: "https://flare-boss-arena.vercel.app",
  /** Socket.IO PvP / MOBA rooms (set VITE_MP_URL in production) */
  mpDefault: "https://warlord-mp.up.railway.app",
} as const;

export const WARLORD_GAME_ID = "warlord-genesis" as const;
export const WARLORD_BUNDLE_GAME_ID = "grudge-warlords" as const;

/** Production multipath leaderboards (same-origin → Vercel → genesis API). */
export function leaderboardApiBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/games/${WARLORD_BUNDLE_GAME_ID}/leaderboards`;
  }
  return `${GRUDGE_FLEET_URLS.warlordGenesis}/api/games/${WARLORD_BUNDLE_GAME_ID}/leaderboards`;
}

/** Socket.IO MOBA / PvP host. */
export function mpServerUrl(): string {
  try {
    const v = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_MP_URL
      || (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PVP_SERVER_URL;
    if (v?.trim()) return v.trim().replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "http://localhost:4100";
  }
  return GRUDGE_FLEET_URLS.mpDefault;
}

export type FleetConnectionId =
  | "auth"
  | "account_api"
  | "warlord_api"
  | "assets"
  | "objectstore"
  | "mp_pvp"
  | "leaderboards";

export interface FleetConnection {
  id: FleetConnectionId;
  label: string;
  description: string;
  url: string;
  kind: "http" | "ws" | "cdn";
}

export function getFleetConnections(): FleetConnection[] {
  const origin =
    typeof window !== "undefined" ? window.location.origin : GRUDGE_FLEET_URLS.warlordGenesis;
  const mp = mpServerUrl();
  return [
    {
      id: "auth",
      label: "Grudge ID",
      description: "SSO login",
      url: `${GRUDGE_FLEET_URLS.identity}/login`,
      kind: "http",
    },
    {
      id: "account_api",
      label: "Account / characters",
      description: "Railway game-data via /api/*",
      url: `${origin}/api/health`,
      kind: "http",
    },
    {
      id: "warlord_api",
      label: "Genesis title API",
      description: "Profiles, matches, leaderboards",
      url: `${origin}/api/games`,
      kind: "http",
    },
    {
      id: "assets",
      label: "Assets CDN",
      description: "R2 meshes & icons",
      url: GRUDGE_FLEET_URLS.assetsCdn,
      kind: "cdn",
    },
    {
      id: "objectstore",
      label: "ObjectStore",
      description: "Definitions & models",
      url: GRUDGE_FLEET_URLS.objectStore,
      kind: "http",
    },
    {
      id: "mp_pvp",
      label: "MOBA / PvP multiplayer",
      description: "Socket.IO rooms",
      url: mp,
      kind: "ws",
    },
    {
      id: "leaderboards",
      label: "Leaderboards",
      description: "Wins, lanes, KDA",
      url: leaderboardApiBase(),
      kind: "http",
    },
  ];
}

export async function probeFleetUrl(url: string): Promise<{ ok: boolean; ms: number; detail: string }> {
  const start = performance.now();
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(6000) });
    return {
      ok: res.ok || res.status === 204,
      ms: Math.round(performance.now() - start),
      detail: res.ok ? "up" : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      ms: Math.round(performance.now() - start),
      detail: e instanceof Error ? e.message : "unreachable",
    };
  }
}

/** Hostnames that serve this SPA */
export const WARLORD_GENESIS_HOSTS = [
  "warlord-genesis.vercel.app",
  "warstrat.grudge-studio.com",
] as const;

export function isWarlordGenesisHost(hostname: string): boolean {
  return (
    hostname.endsWith(".vercel.app") ||
    (WARLORD_GENESIS_HOSTS as readonly string[]).includes(hostname)
  );
}

const DEV_WATER = "http://localhost:5174";

export function waterClientUrl(): string {
  const fromEnv = import.meta.env.VITE_WORLD_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return import.meta.env.DEV ? DEV_WATER : GRUDGE_FLEET_URLS.water;
}

export function viewerUrl(race?: string, classId?: string): string {
  const base = `${GRUDGE_FLEET_URLS.viewer}?era=warlords`;
  if (!race) return base;
  const params = new URLSearchParams({ era: "warlords", race });
  if (classId) params.set("class", classId);
  return `${GRUDGE_FLEET_URLS.viewer}?${params}`;
}

/** Append SSO token for cross-origin fleet handoff when signed in. */
export function fleetHandoffUrl(
  base: string,
  opts?: { path?: string; token?: string | null; query?: Record<string, string> },
): string {
  const root = base.replace(/\/$/, "");
  const path = opts?.path?.startsWith("/") ? opts.path : opts?.path ? `/${opts.path}` : "";
  const url = new URL(`${root}${path}`);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }
  const token = opts?.token;
  if (token) url.searchParams.set("grudge_token", token);
  return url.toString();
}

export function sailAethermoorUrl(token?: string | null): string {
  return fleetHandoffUrl(waterClientUrl(), {
    path: "/world-map",
    token,
  });
}

/** Deep links into the grudge.studio hub panels */
export function studioHubUrl(panel?: "account" | "wallet" | "treaty"): string {
  if (!panel || panel === "account") return GRUDGE_FLEET_URLS.hub;
  return `${GRUDGE_FLEET_URLS.hub}/?panel=${panel}`;
}
