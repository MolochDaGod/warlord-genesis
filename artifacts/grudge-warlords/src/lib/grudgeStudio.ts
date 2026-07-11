// Grudge Studio SSO — the primary login. The player signs in through the
// id.grudge-studio.com popup, which posts back a session token (or redirects
// with one in the query string). We hold that token client-side and use the
// Grudge Studio SDK to resolve the account. This mirrors the reference popup
// flow: open popup -> receive `grudge-auth:success` token -> load the SDK ->
// `auth.getMe()`.

import type { GrudgeUser } from "./grudgeAuth";

const AUTH_ORIGIN = "https://id.grudge-studio.com";
const SDK_URL = "https://objectstore.grudge-studio.com/sdk/grudge-sdk.js";
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
 * Some Grudge Studio sign-in flows redirect back with the token in the URL
 * (`?grudge_token=` / `?sso_token=`) instead of a popup message. Capture it on
 * load, persist it, and scrub the query string. Safe to call repeatedly.
 */
export function captureRedirectToken(): void {
  if (typeof window === "undefined") return;
  try {
    const qs = new URLSearchParams(window.location.search);
    const token = qs.get("grudge_token") || qs.get("sso_token");
    if (token) {
      setStudioToken(token);
      window.history.replaceState({}, "", window.location.pathname);
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

async function fetchStudioUser(token: string): Promise<GrudgeUser> {
  const sdk = await loadSdk(token);
  const me = await sdk.auth.getMe();
  return toGrudgeUser(me);
}

/** Auth success message types used across fleet clients (modern + legacy). */
const AUTH_SUCCESS_TYPES = new Set([
  "grudge-auth:success",
  "grudge:auth:success",
  "GRUDGE_AUTH_SUCCESS",
]);

/** Open the Grudge Studio popup and resolve with the returned session token. */
function openAuthPopup(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const origin = window.location.origin;
    // Canonical login path — same page as full-page SSO /login?redirect_uri=
    const authUrl =
      `${AUTH_ORIGIN}/login?origin=${encodeURIComponent(origin)}` +
      `&app=genesis`;
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
}
