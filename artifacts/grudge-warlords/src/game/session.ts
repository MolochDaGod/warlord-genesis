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
    set({ user, loading: false });
  } catch (err) {
    set({
      loading: false,
      error: err instanceof Error ? err.message : "Something went wrong",
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
        set({ user: studio, loading: false });
        return;
      }
      const user = await getMe();
      set({ user, loading: false });
    } catch {
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
