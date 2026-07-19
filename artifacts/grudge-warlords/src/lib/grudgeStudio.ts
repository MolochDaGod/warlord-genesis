// Grudge Studio SSO — the primary login. The player signs in through the
// id.grudge-studio.com popup, which posts back a session token (or redirects
// with one in the query string). We hold that token client-side and use the
// Grudge Studio SDK to resolve the account. This mirrors the reference popup
// flow: open popup -> receive `grudge-auth:success` token -> load the SDK ->
// `auth.getMe()`.

import type { GrudgeUser } from "./grudgeAuth";

const AUTH_ORIGIN = "https://id.grudge-studio.com";
/** Same-origin shim — objectstore.grudge-studio.com/sdk is 404 / ERR_CONNECTION_CLOSED. */
const SDK_URL = "/sdk/grudge-sdk.js";
const TOKEN_KEY = "grudge_auth_token";
const POPUP_TIMEOUT_MS = 120_000;

/** Shape of the Grudge Studio SDK we depend on (loaded from a remote URL). */
type GrudgeStudioSDK = {
  auth: { getMe: () => Promise<Record<string, unknown>> };
  game?: { listCharacters?: () => Promise<unknown[]> };
};
type GrudgeStudioSDKCtor = new (opts: { token: string }) => GrudgeStudioSDK;

export function getStudioToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStudioToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable — token lives only for this tab session.
  }
}

function clearStudioToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

/**
 * Capture SSO handoff from query or hash (`sso_token` / `grudge_token` / `token`).
 * Scrubs sensitive params from the URL. Safe to call repeatedly.
 */
export function captureRedirectToken(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(
      url.hash.startsWith("#") ? url.hash.slice(1) : url.hash,
    );
    const token =
      url.searchParams.get("sso_token") ||
      url.searchParams.get("grudge_token") ||
      url.searchParams.get("token") ||
      hash.get("sso_token") ||
      hash.get("grudge_token") ||
      hash.get("token");
    if (token) {
      setStudioToken(token);
      // Also write fleet keys used across Grudge apps
      try {
        localStorage.setItem("grudge_session_token", token);
        localStorage.setItem("sso_token", token);
        localStorage.setItem("grudge.token", token);
      } catch {
        /* ignore */
      }
    }
    for (const p of [
      "sso_token",
      "grudge_token",
      "token",
      "grudge_id",
      "grudgeId",
      "grudge_username",
      "username",
      "provider",
    ]) {
      url.searchParams.delete(p);
      hash.delete(p);
    }
    const nextHash = hash.toString();
    const clean =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams}` : "") +
      (nextHash ? `#${nextHash}` : "");
    if (token || window.location.search.includes("sso_token")) {
      window.history.replaceState({}, "", clean);
    }
  } catch {
    // ignore malformed URLs
  }
}

// Run redirect capture as soon as this module loads.
captureRedirectToken();

/** Load the remote Grudge Studio SDK and construct a client for `token`. */
async function loadSdk(token: string): Promise<GrudgeStudioSDK> {
  // Non-literal specifier so the bundler/types treat this as a runtime-only
  // dynamic import (the module lives on a remote origin, not in node_modules).
  const url: string = SDK_URL;
  const mod = (await import(/* @vite-ignore */ url)) as {
    GrudgeSDK: GrudgeStudioSDKCtor;
  };
  return new mod.GrudgeSDK({ token });
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Map the SDK's loosely-typed `me` payload onto our GrudgeUser shape. */
function toGrudgeUser(me: Record<string, unknown>): GrudgeUser {
  const username = str(me.username) || str(me.name) || "player";
  const grudgeId =
    str(me.grudgeId) || str(me.grudge_id) || str(me.id) || username;
  const balance = me.gbuxBalance ?? me.gbux ?? me.balance ?? 0;
  return {
    id: Number(me.id) || 0,
    username,
    grudgeId,
    displayName: str(me.displayName) || str(me.display_name) || username,
    avatarUrl: str(me.avatarUrl) || str(me.avatar_url) || null,
    gbuxBalance: String(balance),
    role: str(me.role) || "player",
  };
}

/** Prefer same-origin / Railway auth me — SDK is optional. */
async function fetchStudioUser(token: string): Promise<GrudgeUser> {
  // 1) Same-origin adapter (warlord-genesis-api → grudge-api)
  try {
    const res = await fetch("/api/grudge/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "same-origin",
    });
    if (res.ok) {
      const me = (await res.json()) as Record<string, unknown>;
      return toGrudgeUser(me);
    }
  } catch {
    /* fall through */
  }
  // 2) Direct Grudge ID / Railway
  for (const base of [
    "https://id.grudge-studio.com",
    "https://grudge-api-production-0d46.up.railway.app",
  ]) {
    try {
      const res = await fetch(`${base}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const me = (await res.json()) as Record<string, unknown>;
        return toGrudgeUser(me);
      }
    } catch {
      /* try next */
    }
  }
  // 3) Legacy remote SDK
  try {
    const sdk = await loadSdk(token);
    const me = await sdk.auth.getMe();
    return toGrudgeUser(me);
  } catch {
    throw new Error("Could not load your Grudge ID profile. Sign in again.");
  }
}

/** Auth success message types used across fleet clients (modern + legacy). */
const AUTH_SUCCESS_TYPES = new Set([
  "grudge-auth:success",
  "grudge:auth:success",
  "GRUDGE_AUTH_SUCCESS",
]);

/** Canonical login URL with dual return params (fleet contract). */
export function buildStudioLoginUrl(
  returnUrl: string = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "https://warlord-genesis.vercel.app/auth/callback",
): string {
  const q = new URLSearchParams();
  q.set("redirect_uri", returnUrl);
  q.set("redirect", returnUrl);
  q.set("return", returnUrl);
  q.set("origin", typeof window !== "undefined" ? window.location.origin : returnUrl);
  q.set("app", "genesis");
  return `${AUTH_ORIGIN}/login?${q.toString()}`;
}

/** Full-page redirect SSO (most reliable on mobile / popup blockers). */
export function loginWithRedirect(returnPath = "/auth/callback"): void {
  if (typeof window === "undefined") return;
  const returnUrl = new URL(returnPath, window.location.origin).href;
  window.location.href = buildStudioLoginUrl(returnUrl);
}

/** Open the Grudge Studio popup and resolve with the returned session token. */
function openAuthPopup(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const origin = window.location.origin;
    const returnUrl = `${origin}/auth/callback`;
    const authUrl = buildStudioLoginUrl(returnUrl);
    const popup = window.open(
      authUrl,
      "grudge-auth",
      "width=480,height=720",
    );
    if (!popup) {
      reject(new Error("Popup blocked. Allow popups for this site and retry."));
      return;
    }

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
      clearTimeout(timer);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== AUTH_ORIGIN) return;
      const data = e.data as { type?: string; token?: string } | null;
      if (!data?.token || !data.type || !AUTH_SUCCESS_TYPES.has(data.type)) return;
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        // ignore
      }
      resolve(data.token);
    };

    window.addEventListener("message", onMessage);
    // Best-effort handshake; the popup also reads our origin from the URL query.
    try {
      popup.postMessage({ type: "grudge-auth:init", origin }, "*");
    } catch {
      // ignore — handshake is non-essential
    }

    const poll = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        reject(new Error("Sign-in window was closed before completing."));
      }
    }, 500);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        // ignore
      }
      reject(new Error("Sign-in timed out. Please try again."));
    }, POPUP_TIMEOUT_MS);
  });
}

/** Primary login: popup -> token -> resolve the Grudge Studio account. */
export async function loginWithGrudgeStudio(): Promise<GrudgeUser> {
  const token = await openAuthPopup();
  setStudioToken(token);
  try {
    return await fetchStudioUser(token);
  } catch (err) {
    clearStudioToken();
    throw err instanceof Error
      ? err
      : new Error("Could not load your Grudge Studio profile.");
  }
}

/** Restore a previous Grudge Studio session from a stored token, if any. */
export async function restoreGrudgeStudio(): Promise<GrudgeUser | null> {
  const token = getStudioToken();
  if (!token) return null;
  try {
    return await fetchStudioUser(token);
  } catch {
    clearStudioToken();
    return null;
  }
}

export function logoutGrudgeStudio(): void {
  clearStudioToken();
  try {
    localStorage.removeItem("grudge_session_token");
    localStorage.removeItem("sso_token");
    localStorage.removeItem("grudge.token");
    localStorage.removeItem("grudge_token");
  } catch {
    /* ignore */
  }
}

export function isStudioAuthenticated(): boolean {
  return Boolean(getStudioToken());
}
