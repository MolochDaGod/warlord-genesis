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
} as const;

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
