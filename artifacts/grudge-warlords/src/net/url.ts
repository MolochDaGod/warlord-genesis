// Resolve the realtime WebSocket URL. Production Vercel has no native WS upgrade,
// so we try: explicit env → fleet origins → same-host proxy → known fleet WS hosts.

import { fetchOrigins } from "../lib/grudgeOrigins";
import { isWarlordGenesisHost } from "../lib/fleetUrls";

const FALLBACK_WS_HOSTS = [
  "wss://ws.grudge-studio.com/api/realtime",
  "wss://ws.grudge-studio.com",
];

let resolved: string | null = null;
let resolving: Promise<string> | null = null;

function pageHostWs(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/realtime`;
}

/** Synchronously return last known URL (or same-host) for connect(). */
export function realtimeUrl(): string {
  if (resolved) return resolved;
  const fromEnv =
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_REALTIME_WS_URL ||
    (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_WS_URL;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.startsWith("ws")) {
    resolved = fromEnv;
    return resolved;
  }
  return pageHostWs();
}

/** Async discovery — call before connect when possible. */
export async function resolveRealtimeUrl(force = false): Promise<string> {
  if (resolved && !force) return resolved;
  if (resolving && !force) return resolving;

  resolving = (async () => {
    const fromEnv =
      (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_REALTIME_WS_URL ||
      (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_WS_URL;
    if (fromEnv && typeof fromEnv === "string" && fromEnv.startsWith("ws")) {
      resolved = fromEnv;
      return resolved;
    }

    try {
      const catalog = await fetchOrigins(force);
      const byId = new Map(catalog.origins.map((o) => [o.id, o]));
      const wsOrigin =
        byId.get("ws") ||
        catalog.origins.find((o) => o.kind === "ws" && (o.status === "live" || o.status === "degraded"));
      if (wsOrigin?.url) {
        const base = wsOrigin.url.replace(/\/$/, "");
        resolved = base.includes("/api/realtime")
          ? base.replace(/^http/, "ws")
          : `${base.replace(/^http/, "ws")}/api/realtime`;
        return resolved;
      }
    } catch {
      // origins catalog often returns HTML portal — ignore
    }

    // Prefer same-host only if not on static SPA hosts (no WS upgrade).
    if (!isWarlordGenesisHost(window.location.hostname)) {
      resolved = pageHostWs();
      return resolved;
    }

    resolved = FALLBACK_WS_HOSTS[0]!;
    return resolved;
  })();

  try {
    return await resolving;
  } finally {
    resolving = null;
  }
}

export function clearRealtimeUrlCache(): void {
  resolved = null;
}
