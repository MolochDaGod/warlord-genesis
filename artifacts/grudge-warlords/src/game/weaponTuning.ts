import { create } from "zustand";
import {
  WEAPON_MODEL_DEFS,
  WEAPON_MODEL_KEYS,
  type WeaponModelKey,
} from "./anim/weaponModels";

/**
 * Live, per-weapon placement tuning for the real voxel models. The in-game
 * panel writes these and they apply to the mounted weapon immediately; values
 * persist to localStorage so a dialled-in placement survives reloads.
 */
export interface WeaponTuning {
  /** Holder local position (metres). */
  px: number;
  py: number;
  pz: number;
  /** Holder local euler rotation (radians). */
  rx: number;
  ry: number;
  rz: number;
  /** Uniform holder scale multiplier. */
  scale: number;
  /** Muzzle / tip local offset on the holder (shot origin). */
  mx: number;
  my: number;
  mz: number;
}

export type TuningField = keyof WeaponTuning;

const STORAGE_KEY = "gw_weapon_tuning_v1";

/** The factory default tuning for a model, taken from its model def. */
export function defaultTuning(key: WeaponModelKey): WeaponTuning {
  const d = WEAPON_MODEL_DEFS[key];
  return {
    px: d.pos[0], py: d.pos[1], pz: d.pos[2],
    rx: d.rot[0], ry: d.rot[1], rz: d.rot[2],
    scale: d.scale,
    mx: d.muzzle[0], my: d.muzzle[1], mz: d.muzzle[2],
  };
}

function allDefaults(): Record<WeaponModelKey, WeaponTuning> {
  const out = {} as Record<WeaponModelKey, WeaponTuning>;
  for (const k of WEAPON_MODEL_KEYS) out[k] = defaultTuning(k);
  return out;
}

function load(): Record<WeaponModelKey, WeaponTuning> {
  const base = allDefaults();
  if (typeof localStorage === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Record<WeaponModelKey, Partial<WeaponTuning>>>;
    for (const k of WEAPON_MODEL_KEYS) {
      if (saved[k]) base[k] = { ...base[k], ...saved[k] };
    }
  } catch {
    // Corrupt payload: fall back to defaults.
  }
  return base;
}

function persist(tuning: Record<WeaponModelKey, WeaponTuning>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning));
  } catch {
    // Storage full / unavailable: keep running with in-memory values.
  }
}

interface WeaponTuningState {
  tuning: Record<WeaponModelKey, WeaponTuning>;
  /** Whether the tuning panel is shown. */
  editorOpen: boolean;
  /** The model the panel currently edits (the hero's equipped real model). */
  activeKey: WeaponModelKey | null;
  setField: (key: WeaponModelKey, field: TuningField, value: number) => void;
  reset: (key: WeaponModelKey) => void;
  setActiveKey: (key: WeaponModelKey | null) => void;
  toggleEditor: () => void;
}

export const useWeaponTuning = create<WeaponTuningState>((set) => ({
  tuning: load(),
  editorOpen: false,
  activeKey: null,
  setField: (key, field, value) =>
    set((s) => {
      const next = { ...s.tuning, [key]: { ...s.tuning[key], [field]: value } };
      persist(next);
      return { tuning: next };
    }),
  reset: (key) =>
    set((s) => {
      const next = { ...s.tuning, [key]: defaultTuning(key) };
      persist(next);
      return { tuning: next };
    }),
  setActiveKey: (key) => set({ activeKey: key }),
  toggleEditor: () => set((s) => ({ editorOpen: !s.editorOpen })),
}));
