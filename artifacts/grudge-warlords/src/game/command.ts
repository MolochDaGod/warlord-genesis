import { create } from "zustand";
import * as THREE from "three";
import { EM, type OrderKind } from "./entities";

export type ControlMode = "combat" | "command";

/** When B / a shop build is armed, the next ground click places this structure. */
export type BuildTarget = { ref: string; cost: number } | null;

export interface MarqueeRect {
  active: boolean;
  /** Canvas-relative pixel coordinates of the drag anchor + current point. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const EMPTY_MARQUEE: MarqueeRect = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 };

const NUM_GROUPS = 5;

interface CommandState {
  /** "combat" = pointer-locked crosshair; "command" = free cursor RTS control. */
  mode: ControlMode;
  /** Live marquee box while drag-selecting (command mode). */
  marquee: MarqueeRect;
  /** Selected commandable ally unit ids. */
  selection: number[];
  /** Persistent control groups (Shift+digit assign, digit recall). */
  groups: number[][];
  /** Armed build placement, or null. */
  build: BuildTarget;

  setMode: (m: ControlMode) => void;
  toggleMode: () => ControlMode;
  setMarquee: (m: MarqueeRect) => void;
  clearMarquee: () => void;
  setSelection: (ids: number[]) => void;
  /** Issue an order to the current selection at an optional ground point. */
  issueOrder: (order: OrderKind, point?: THREE.Vector3) => void;
  assignGroup: (n: number) => void;
  recallGroup: (n: number) => void;
  setBuild: (b: BuildTarget) => void;
  resetCommand: () => void;
}

/** Selected, still-alive, commandable ally units. */
function liveSelection(ids: number[]): typeof EM.units {
  const set = new Set(ids);
  return EM.units.filter((u) => u.alive && u.commandable && set.has(u.id));
}

export const useCommand = create<CommandState>((set, get) => ({
  mode: "combat",
  marquee: EMPTY_MARQUEE,
  selection: [],
  groups: Array.from({ length: NUM_GROUPS }, () => []),
  build: null,

  setMode: (mode) => {
    if (get().mode === mode) return;
    if (mode === "combat") {
      set({ mode, marquee: EMPTY_MARQUEE, selection: [], build: null });
    } else {
      set({ mode });
    }
  },
  toggleMode: () => {
    const next: ControlMode = get().mode === "combat" ? "command" : "combat";
    get().setMode(next);
    return next;
  },
  setMarquee: (marquee) => set({ marquee }),
  clearMarquee: () => set({ marquee: EMPTY_MARQUEE }),
  setSelection: (selection) => set({ selection }),

  issueOrder: (order, point) => {
    const units = liveSelection(get().selection);
    if (units.length === 0) return;
    for (const u of units) {
      u.targetId = null;
      if (order === "stop") {
        u.order = "idle";
        u.dest = null;
        u.anchor.copy(u.pos);
      } else if (order === "hold") {
        const at = point ? point.clone().setY(0) : u.pos.clone();
        u.order = "hold";
        u.anchor.copy(at);
        u.dest = at.clone();
      } else if (point) {
        u.order = order; // "move" | "attackMove"
        u.dest = point.clone().setY(0);
        u.anchor.copy(point).setY(0);
      }
    }
  },

  assignGroup: (n) => {
    if (n < 0 || n >= NUM_GROUPS) return;
    const ids = liveSelection(get().selection).map((u) => u.id);
    const groups = get().groups.map((g, i) => (i === n ? ids : g));
    set({ groups });
  },
  recallGroup: (n) => {
    if (n < 0 || n >= NUM_GROUPS) return;
    const ids = get().groups[n].filter((id) =>
      EM.units.some((u) => u.id === id && u.alive),
    );
    set({ selection: ids });
  },

  setBuild: (build) => set({ build }),
  resetCommand: () =>
    set({
      mode: "combat",
      marquee: EMPTY_MARQUEE,
      selection: [],
      build: null,
      groups: Array.from({ length: NUM_GROUPS }, () => []),
    }),
}));
