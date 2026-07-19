// Grudge Studio SSO — primary login for Warlord Genesis.
//
// Flow:
//   1. Popup (or full-page redirect) to id.grudge-studio.com
//   2. Receive JWT via postMessage or ?grudge_token= / ?sso_token=
//   3. Resolve profile via /api/grudge/auth/me (Bearer) — no remote SDK required
//   4. Optional SDK hydrate if available (assets CDN)
//
// Broken objectstore SDK URL caused production sign-in to fail after popup success.

import type { GrudgeUser } from "./grudgeAuth";

const AUTH_ORIGIN = "https://id.grudge-studio.com";
/** Working fleet SDK hosts (objectstore /sdk path is 404). */
const SDK_URLS = [
  "https://assets.grudge-studio.com/sdk/grudge-sdk.js",
  "https://grudge-studio.com/sdk/grudge-sdk.js",
] as const;
const TOKEN_KEY = "grudge_auth_token";
const POPUP_TIMEOUT_MS = 120_000;

type GrudgeStudioSDK = {
  auth: { getMe: () => Promise<Record<string, unknown>> };
};
type GrudgeStudioSDKCtor = new (opts: { token: string }) => GrudgeStudioSDK;

export function getStudioToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStudioToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    // Fleet aliases so other tabs / bootstrap scripts see the same session
    localStorage.setItem("sso_token", token);
  } catch {
    // Storage unavailable — token lives only for this tab session.
  }
}

function clearStudioToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("sso_token");
  } catch {
    // ignore
  }
}

/**
 * Capture redirect tokens on load (`?grudge_token=` / `?sso_token=` / hash).
 * Scrubs query string after persist.
 */
export function captureRedirectToken(): void {
  if (typeof window === "undefined") return;
  try {
    const qs = new URLSearchParams(window.location.search);
    let token = qs.get("grudge_token") || qs.get("sso_token") || qs.get("token");
    if (!token && window.location.hash) {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      token = hash.get("grudge_token") || hash.get("sso_token") || hash.get("token");
    }
    if (token) {
      setStudioToken(token);
      const url = new URL(window.location.href);
      url.searchParams.delete("grudge_token");
      url.searchParams.delete("sso_token");
      url.searchParams.delete("token");
      url.hash = "";
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  } catch {
    // ignore malformed URLs
  }
}

// Run redirect capture as soon as this module loads.
captureRedirectToken();

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

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
    avatarUrl:
      (typeof me.avatarUrl === "string" && me.avatarUrl) ||
      (typeof me.avatar_url === "string" && me.avatar_url) ||
      null,
    gbuxBalance: String(balance),
    role: str(me.role) || "player",
  };
}

/**
 * Resolve account from JWT via genesis proxy → grudge-api (preferred, no SDK).
 */
export async function fetchUserFromToken(token: string): Promise<GrudgeUser> {
  const res = await fetch("/api/grudge/auth/me", {
    credentials: "same-origin",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.ok) {
    const me = (await res.json()) as Record<string, unknown>;
    return toGrudgeUser(me);
  }

  // Fallback: fleet /api/auth/me (grudge-api direct rewrite)
  const fleet = await fetch("/api/auth/me", {
    credentials: "same-origin",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (fleet.ok) {
    const me = (await fleet.json()) as Record<string, unknown>;
    // grudge-api often wraps { success, ...fields }
    const body =
      me && typeof me === "object" && me.success !== undefined
        ? (me as Record<string, unknown>)
        : me;
    return toGrudgeUser(body);
  }

  // Last resort: remote SDK if CDN is up
  try {
    return await fetchStudioUserViaSdk(token);
  } catch {
    throw new Error(
      `Could not load profile (${res.status}). Sign in again or continue as guest.`,
    );
  }
}

async function loadSdk(token: string): Promise<GrudgeStudioSDK> {
  let lastErr: unknown;
  for (const url of SDK_URLS) {
    try {
      const mod = (await import(/* @vite-ignore */ url)) as {
        GrudgeSDK: GrudgeStudioSDKCtor;
        default?: GrudgeStudioSDKCtor;
      };
      const Ctor = mod.GrudgeSDK || mod.default;
      if (!Ctor) throw new Error("SDK missing GrudgeSDK export");
      return new Ctor({ token });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("SDK load failed");
}

async function fetchStudioUserViaSdk(token: string): Promise<GrudgeUser> {
  const sdk = await loadSdk(token);
  const me = await sdk.auth.getMe();
  return toGrudgeUser(me);
}

const AUTH_SUCCESS_TYPES = new Set([
  "grudge-auth:success",
  "grudge:auth:success",
  "GRUDGE_AUTH_SUCCESS",
  "auth:success",
]);

function buildLoginUrl(mode: "popup" | "redirect"): string {
  const origin = window.location.origin;
  const returnTo = `${origin}/`;
  const params = new URLSearchParams({
    // Fleet dual-write (id hub accepts several names)
    redirect_uri: returnTo,
    redirect: returnTo,
    return: returnTo,
    origin,
    app: "warlord-genesis",
  });
  if (mode === "popup") params.set("popup", "1");
  return `${AUTH_ORIGIN}/login?${params.toString()}`;
}

/** Open popup; fall back to full-page redirect if blocked. */
function openAuthPopup(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const authUrl = buildLoginUrl("popup");
    const popup = window.open(authUrl, "grudge-auth", "width=480,height=720");
    if (!popup) {
      // Full-page SSO — captureRedirectToken on return
      window.location.assign(buildLoginUrl("redirect"));
      reject(new Error("Redirecting to Grudge ID sign-in…"));
      return;
    }

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
      clearTimeout(timer);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== AUTH_ORIGIN && e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; token?: string } | null;
      if (!data?.token) return;
      if (data.type && !AUTH_SUCCESS_TYPES.has(data.type)) return;
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      resolve(data.token);
    };

    window.addEventListener("message", onMessage);
    try {
      popup.postMessage({ type: "grudge-auth:init", origin: window.location.origin }, "*");
    } catch {
      /* handshake optional */
    }

    const poll = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup();
        // Maybe completed via redirect in same tab? check storage
        const t = getStudioToken();
        if (t) {
          resolve(t);
          return;
        }
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
        /* ignore */
      }
      reject(new Error("Sign-in timed out. Please try again."));
    }, POPUP_TIMEOUT_MS);
  });
}

/** Primary login: popup/redirect → token → /api/grudge/auth/me */
export async function loginWithGrudgeStudio(): Promise<GrudgeUser> {
  // If we already landed with a token from full-page SSO, use it.
  captureRedirectToken();
  let token = getStudioToken();
  if (!token) {
    token = await openAuthPopup();
  }
  setStudioToken(token);
  try {
    return await fetchUserFromToken(token);
  } catch (err) {
    clearStudioToken();
    throw err instanceof Error
      ? err
      : new Error("Could not load your Grudge Studio profile.");
  }
}

/** Restore session from stored token (or cookies via getMe path). */
export async function restoreGrudgeStudio(): Promise<GrudgeUser | null> {
  captureRedirectToken();
  const token = getStudioToken();
  if (!token) return null;
  try {
    return await fetchUserFromToken(token);
  } catch {
    clearStudioToken();
    return null;
  }
}

export function logoutGrudgeStudio(): void {
  clearStudioToken();
}
