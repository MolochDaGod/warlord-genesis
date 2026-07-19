/**
 * Production season wipe — clears all game-owned storage once per season flag.
 * Never clears fleet auth tokens (Grudge ID).
 */
import { SITE_CLEAR_FLAG, PRODUCTION_SEASON } from "./productionSeason";

const LEGACY_FLAGS = [
  "gw_site_data_cleared_v68",
  "gw_site_data_cleared_v69",
] as const;

const GAME_PREFIXES = ["gw_", "wg-", "wg_", "engine_boot_"] as const;

const AUTH_SAFE = new Set([
  "grudge_auth_token",
  "grudge_session_token",
  "grudge.token",
  "sso_token",
  "grudge_token",
  "grudge_account_id",
  "grudge_device_id",
  "grudge_user",
  "grudge_id",
  "grudge_username",
  SITE_CLEAR_FLAG,
  ...LEGACY_FLAGS,
]);

function shouldClearKey(key: string): boolean {
  if (AUTH_SAFE.has(key)) return false;
  if (/^(grudge_auth|grudge_session|sso_|puter\.|clerk)/i.test(key)) return false;
  // Always drop legacy season keys
  if (
    key === "gw_meta_v1" ||
    key === "gw_roster_v1" ||
    key === "gw_roster_v2" ||
    key === "gw_island_missions_v1" ||
    key.startsWith("gw_meta_") ||
    key.startsWith("gw_roster_") ||
    key.startsWith("gw_island_missions")
  ) {
    // keep current season keys if flag already set for this season
    if (key.includes("v2") || key.includes("v3")) {
      // still clear on fresh season boot when flag missing
    }
    return true;
  }
  for (const p of GAME_PREFIXES) {
    if (key.startsWith(p)) return true;
  }
  return key === "DIFFICULTY" || /^weapon_tuning/i.test(key);
}

/**
 * Force wipe when SITE_CLEAR_FLAG is not set for this season.
 * Call before Zustand stores hydrate.
 */
export function clearSiteDataOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const flag = localStorage.getItem(SITE_CLEAR_FLAG);
    if (flag === PRODUCTION_SEASON) return false;
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
    localStorage.setItem(SITE_CLEAR_FLAG, PRODUCTION_SEASON);
  } catch {
    /* ignore */
  }

  console.info(
    `[warlord-genesis] production season ${PRODUCTION_SEASON} — cleared ${cleared} game keys (auth preserved).`,
  );
  return true;
}
