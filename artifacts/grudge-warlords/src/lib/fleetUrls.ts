/**
 * Canonical Grudge Studio fleet URLs for cross-app handoffs.
 * Production defaults match water.grudge-studio.com ↔ grudgewarlords.com routing.
 */

export const GRUDGE_FLEET_URLS = {
  assetsCdn: "https://assets.grudge-studio.com",
  identity: "https://id.grudge-studio.com",
  viewer: "https://character.grudge-studio.com",
  /** Tactical-Infinity open world (Aethermoor sailing). */
  water: "https://water.grudge-studio.com",
  warlords: "https://grudgewarlords.com",
  /** Warlord Genesis — branded production host */
  warstrat: "https://warstrat.grudge-studio.com",
  /** Warlord Genesis — Vercel default alias */
  warlordGenesis: "https://warlord-genesis.vercel.app",
  origins: "https://api.grudge-studio.com/origins",
} as const;

/** Hostnames that serve this SPA (static — no native WS upgrade). */
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
  const base = `${GRUDGE_FLEET_URLS.viewer}/viewer`;
  if (!race) return base;
  const params = new URLSearchParams({ race });
  if (classId) params.set("class", classId);
  return `${base}?${params}`;
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