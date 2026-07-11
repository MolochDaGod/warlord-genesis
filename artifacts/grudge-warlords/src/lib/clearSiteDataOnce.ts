/**
 * One-shot wipe of *game* storage only — never fleet/auth tokens.
 * Flag: localStorage `gw_site_data_cleared_v69` — runs at most once per browser profile.
 *
 * Purpose: reseed weak pre-v68 gear saves so ensureWarcampReady can apply the
 * campaign kit. Auth / SSO must survive so Puter + Grudge ID handoff still works.
 */

const FLAG = "gw_site_data_cleared_v69";
/** Older one-shot flags — leave them so we don't thrash wipes every version. */
const LEGACY_FLAGS = ["gw_site_data_cleared_v68"] as const;

/**
 * Game-owned keys only. Do NOT match `grudge_*` / `puter*` / sso tokens —
 * those are fleet identity (see grudge-production-wiring).
 */
const GAME_PREFIXES = [
  "gw_",
  "wg-",
  "wg_",
  "engine_boot_",
] as const;

/** Fleet / auth keys that must never be cleared by this wipe. */
const AUTH_SAFE = new Set([
  "grudge_auth_token",
  "grudge_session_token",
  "grudge.token",
  "sso_token",
  "grudge_account_id",
  "grudge_device_id",
  "grudge_user",
  FLAG,
  ...LEGACY_FLAGS,
]);

function shouldClearKey(key: string): boolean {
  if (AUTH_SAFE.has(key)) return false;
  // Explicit auth-ish prefixes
  if (/^(grudge_auth|grudge_session|sso_|puter\.|clerk)/i.test(key)) return false;
  for (const p of GAME_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return (
    key === "DIFFICULTY" ||
    key === "gw_roster_v1" ||
    key === "gw_roster_v2" ||
    key === "gw_meta_v1" ||
    /^weapon_tuning/i.test(key)
  );
}

/**
 * Call once at boot, before Zustand stores hydrate from localStorage.
 * Returns whether a wipe ran this page load.
 */
export function clearSiteDataOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(FLAG) === "1") return false;
    // If user already ran v68 wipe, just set v69 flag without re-wiping auth.
    if (localStorage.getItem("gw_site_data_cleared_v68") === "1") {
      localStorage.setItem(FLAG, "1");
      return false;
    }
  } catch {
    return false;
  }

  let cleared = 0;

  try {
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && shouldClearKey(k)) sessionKeys.push(k);
    }
    for (const k of sessionKeys) {
      sessionStorage.removeItem(k);
      cleared += 1;
    }
  } catch {
    /* ignore */
  }

  try {
    const localKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && shouldClearKey(k)) localKeys.push(k);
    }
    for (const k of localKeys) {
      localStorage.removeItem(k);
      cleared += 1;
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }

  if (cleared > 0) {
    console.info(
      `[warlord-genesis] game storage cleared once (${cleared} keys; auth tokens preserved).`,
    );
  }
  return cleared > 0;
}
