import { create } from "zustand";
import {
  type GrudgeUser,
  getMe,
  loginGuest,
  logout as apiLogout,
} from "../lib/grudgeAuth";
import {
  loginWithGrudgeStudio,
  restoreGrudgeStudio,
  logoutGrudgeStudio,
} from "../lib/grudgeStudio";
import { hydrateMetaFromServer } from "../lib/profileSync";
import { hydrateRosterFromFleet } from "../lib/fleetCharacterHydrate";

interface SessionState {
  user: GrudgeUser | null;
  loading: boolean;
  error: string | null;

  restore: () => Promise<void>;
  guest: () => Promise<void>;
  signInWithStudio: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

async function run(
  set: (partial: Partial<SessionState>) => void,
  fn: () => Promise<GrudgeUser>,
) {
  set({ loading: true, error: null });
  try {
    const user = await fn();
    // Non-fatal: progress hydrate can fail offline / without characters
    try {
      await hydrateMetaFromServer();
    } catch {
      /* ignore */
    }
    try {
      await hydrateRosterFromFleet();
    } catch {
      /* ignore */
    }
    set({ user, loading: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    // Redirect-in-progress is not a hard failure
    if (/Redirecting to Grudge ID/i.test(msg)) {
      set({ loading: true, error: null });
      return;
    }
    set({
      loading: false,
      error: msg,
    });
  }
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  loading: false,
  error: null,

  restore: async () => {
    set({ loading: true });
    try {
      // Prefer a stored Grudge Studio session; fall back to a server guest cookie.
      const studio = await restoreGrudgeStudio();
      if (studio) {
        await hydrateMetaFromServer();
        await hydrateRosterFromFleet();
        set({ user: studio, loading: false });
        return;
      }
      const user = await getMe();
      if (user) {
        await hydrateMetaFromServer();
        await hydrateRosterFromFleet();
      } else {
        // Open / charactersgrudox handoff: still hydrate warlord from race/base
        // even when the player has no account cookie on this origin.
        await hydrateRosterFromFleet();
      }
      set({ user, loading: false });
    } catch {
      // Last chance: Open handoff race/base still playable offline
      try {
        await hydrateRosterFromFleet();
      } catch {
        /* */
      }
      set({ user: null, loading: false });
    }
  },
  guest: () => run(set, loginGuest),
  signInWithStudio: () => run(set, loginWithGrudgeStudio),
  signOut: async () => {
    logoutGrudgeStudio();
    await apiLogout();
    set({ user: null });
  },
  clearError: () => set({ error: null }),
}));
