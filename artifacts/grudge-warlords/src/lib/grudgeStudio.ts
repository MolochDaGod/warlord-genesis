// Grudge Studio SSO — the primary login. The player signs in through the
// id.grudge-studio.com popup, which posts back a session token (or redirects
// with one in the query string). We hold that token client-side and use the
// Grudge Studio SDK to resolve the account. This mirrors the reference popup
// flow: open popup -> receive `grudge-auth:success` token -> load the SDK ->
// `auth.getMe()`.

import type { GrudgeUser } from "./grudgeAuth";
import { captureOpenLaunchParams } from "./openLaunch";

const AUTH_ORIGIN = "https://id.grudge-studio.com";
const SDK_URL = "https://objectstore.grudge-studio.com/sdk/grudge-sdk.js";

/** Canonical + dual-read fleet token keys (production wiring §2.1). */
const TOKEN_KEYS = [
  "grudge_auth_token",
  "grudge_session_token",
  "grudge.token",
  "sso_token",
  "grudge_token",
] as const;
const TOKEN_KEY = TOKEN_KEYS[0];

const POPUP_TIMEOUT_MS = 120_000;

/** Shape of the Grudge Studio SDK we depend on (loaded from a remote URL). */
type GrudgeStudioSDK = {
  auth: { getMe: () => Promise<Record<string, unknown>> };
  game?: { listCharacters?: () => Promise<unknown[]> };
};
type GrudgeStudioSDKCtor = new (opts: { token: string }) => GrudgeStudioSDK;

export function getStudioToken(): string | null {
  try {
    for (const k of TOKEN_KEYS) {
      const v = localStorage.getItem(k);
      if (v) return v;
    }
    // sessionStorage fallback (some fleet apps prefer session for sso_token)
    for (const k of ["sso_token", "grudge_auth_token"] as const) {
      const v = sessionStorage.getItem(k);
      if (v) return v;
    }
    return null;
  } catch {
    return null;
  }
}

function setStudioToken(token: string): void {
  try {
    // Dual-write all fleet keys so hydrate + other apps share the session
    for (const k of TOKEN_KEYS) {
      localStorage.setItem(k, token);
    }
    sessionStorage.setItem("sso_token", token);
    sessionStorage.setItem("grudge_auth_token", token);
  } catch {
    // Storage unavailable — token lives only for this tab session.
  }
}

function clearStudioToken(): void {
  try {
    for (const k of TOKEN_KEYS) {
      localStorage.removeItem(k);
    }
    sessionStorage.removeItem("sso_token");
    sessionStorage.removeItem("grudge_auth_token");
  } catch {
    // ignore
  }
}

/**
 * Open + Grudge ID handoff: capture token AND characterId / open flags before
 * scrubbing sensitive query params. Safe to call repeatedly.
 *
 * Accepted token params: sso_token (preferred), grudge_token, token, launch_token
 * Character: characterId | character_id | charId
 * Open flags: open=1, from=open|gameopen
 */
export function captureRedirectToken(): void {
  if (typeof window === "undefined") return;
  try {
    const qs = new URLSearchParams(window.location.search);
    // Also read hash fragment (industry preference for token handoff)
    if (window.location.hash && window.location.hash.length > 1) {
      const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      for (const [k, v] of hp.entries()) {
        if (!qs.has(k)) qs.set(k, v);
      }
    }

    // Persist Open launch context before any scrub
    captureOpenLaunchParams(qs);

    const token =
      qs.get("sso_token") ||
      qs.get("token") ||
      qs.get("grudge_token") ||
      qs.get("launch_token") ||
      qs.get("access_token");

    if (token) {
      setStudioToken(token);
    }

    // Scrub secrets + handoff identity (already captured to session/local)
    const sensitive = new Set([
      "sso_token",
      "token",
      "grudge_token",
      "launch_token",
      "access_token",
      "characterId",
      "character_id",
      "charId",
      "baseId",
      "base_id",
      "raceId",
      "race_id",
      "characterName",
      "character_name",
      "open",
      "from",
    ]);
    let dirty = false;
    for (const key of sensitive) {
      if (qs.has(key)) {
        qs.delete(key);
        dirty = true;
      }
    }

    if (dirty || token) {
      const next = qs.toString();
      const clean =
        window.location.pathname + (next ? `?${next}` : "") + window.location.hash;
      // Drop hash secrets if we copied them
      const cleanNoHashSecrets = clean.replace(
        /#.*(sso_token|grudge_token|token)=[^&]+/i,
        "",
      );
      window.history.replaceState({}, "", cleanNoHashSecrets || window.location.pathname);
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
    // Fallback: try Railway /api/auth/me with Bearer when SDK path fails
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const me = (await res.json()) as Record<string, unknown>;
        return toGrudgeUser(me);
      }
    } catch {
      /* ignore */
    }
    clearStudioToken();
    return null;
  }
}

export function logoutGrudgeStudio(): void {
  clearStudioToken();
}
