import { create } from "zustand";

export type HubTab = "account" | "codex" | "ai";

interface UIState {
  hubOpen: boolean;
  hubTab: HubTab;
  openHub: (tab?: HubTab) => void;
  closeHub: () => void;
  setHubTab: (tab: HubTab) => void;
}

export const useUI = create<UIState>((set) => ({
  hubOpen: false,
  hubTab: "account",
  openHub: (tab) => set({ hubOpen: true, ...(tab ? { hubTab: tab } : {}) }),
  closeHub: () => set({ hubOpen: false }),
  setHubTab: (tab) => set({ hubTab: tab }),
}));
