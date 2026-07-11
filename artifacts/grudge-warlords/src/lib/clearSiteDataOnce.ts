/**
 * One-shot wipe of origin storage for warlord-genesis.
 * Flag: localStorage `gw_site_data_cleared_v68` — runs at most once per browser profile.
 *
 * Clears weak/empty gear saves from pre-v68 boots so ensureWarcampReady can reseed
 * the campaign-ready kit. Does not touch other origins.
 */

const FLAG = "gw_site_data_cleared_v68";

/** Keys / prefixes that belong to this game (and fleet handoff used by it). */
const PREFIXES = [
  "gw_",
  "wg-",
  "wg_",
  "engine_boot_",
  "grudge_",
  "puter",
] as const;

function shouldClearKey(key: string): boolean {
  for (const p of PREFIXES) {
    if (key.startsWith(p) || key.toLowerCase().startsWith(p)) return true;
  }
  // Exact known keys that may not match prefixes above
  return (
    key === "DIFFICULTY" ||
    key.includes("warlord") ||
    key.includes("grudge-warlords") ||
    key.includes("weapon_tuning")
  );
}

function wipeStorage(store: Storage | undefined, label: string): number {
  if (!store) return 0;
  let n = 0;
  const keys: string[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k) keys.push(k);
    }
  } catch {
    return 0;
  }
  for (const k of keys) {
    if (!shouldClearKey(k) && label === "local") {
      // On full site-data clear for this origin, still drop unknown gw leftovers only.
      // Skip unrelated third-party if any shared host (shouldn't on vercel.app).
      continue;
    }
    try {
      if (label === "session" || shouldClearKey(k)) {
        store.removeItem(k);
        n += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return n;
}

/**
 * Call once at boot, before Zustand stores hydrate from localStorage.
 * Returns whether a wipe ran this page load.
 */
export function clearSiteDataOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(FLAG) === "1") return false;
  } catch {
    return false;
  }

  let cleared = 0;
  try {
    // Full origin wipe for session (deploy flags, match resume)
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k) sessionKeys.push(k);
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
      if (k && k !== FLAG) localKeys.push(k);
    }
    for (const k of localKeys) {
      if (shouldClearKey(k)) {
        localStorage.removeItem(k);
        cleared += 1;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    // IndexedDB best-effort (asset caches)
    if (typeof indexedDB !== "undefined" && indexedDB.databases) {
      void indexedDB.databases().then((dbs) => {
        for (const db of dbs) {
          if (db.name && /grudge|warlord|gw_|three|rapier/i.test(db.name)) {
            try {
              indexedDB.deleteDatabase(db.name);
            } catch {
              /* ignore */
            }
          }
        }
      });
    }
  } catch {
    /* ignore */
  }

  try {
    localStorage.setItem(FLAG, "1");
  } catch {
    /* ignore */
  }

  console.info(
    `[warlord-genesis] site data cleared once (${cleared} keys). Reload /play for fresh warcamp kit.`,
  );
  return true;
}
