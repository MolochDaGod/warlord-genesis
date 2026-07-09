// ── Controller / input scheme ─────────────────────────────────────────────────
//
// A single, consistent input contract across the three camera modes
// (action / mmo / rts). Every gameplay action has one stable id, a default
// keyboard binding and a default gamepad button. The 3D game reads bindings by
// (mode, actionId) so remapping and gamepad support stay lossless and lagless.
//
// Gamepad button indices follow the W3C "Standard Gamepad" mapping:
//   0 A  1 B  2 X  3 Y  4 LB  5 RB  6 LT  7 RT  8 Back  9 Start
//   10 L3  11 R3  12 DPadUp  13 DPadDown  14 DPadLeft  15 DPadRight  16 Home

export type CameraMode = "action" | "mmo" | "rts";

export const CAMERA_MODES: { id: CameraMode; label: string; description: string }[] = [
  { id: "action", label: "Action", description: "Over-the-shoulder, reticle aim — Conan-style melee/ranged." },
  { id: "mmo", label: "MMO", description: "Free-orbit third person, tab-target and ground-target skills." },
  { id: "rts", label: "RTS", description: "Top-down command camera for base building and unit control." },
];

export type ActionCategory =
  | "movement"
  | "combat"
  | "skill"
  | "harvest"
  | "interaction"
  | "camera"
  | "rts"
  | "ui";

export interface GameActionDef {
  id: string;
  label: string;
  category: ActionCategory;
  description: string;
}

// Stable gamepad button names → standard mapping index.
export const PAD = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  Back: 8, Start: 9, L3: 10, R3: 11,
  DUp: 12, DDown: 13, DLeft: 14, DRight: 15, Home: 16,
} as const;

export type PadButton = (typeof PAD)[keyof typeof PAD];

export interface InputBinding {
  /** KeyboardEvent.code, or null when unbound for this mode. */
  key: string | null;
  /** Standard gamepad button index, or null when unbound. */
  pad: PadButton | null;
}

export const GAME_ACTIONS: GameActionDef[] = [
  // movement
  { id: "jump", label: "Jump / Mantle", category: "movement", description: "Jump; context-mantle when near a ledge." },
  { id: "sprint", label: "Sprint", category: "movement", description: "Toggle to run faster (Shift)." },
  { id: "dodge", label: "Dodge Roll", category: "movement", description: "Evasive roll/dash with i-frames." },
  { id: "crouch", label: "Crouch / Swim Down", category: "movement", description: "Toggle crouch on land; descend while swimming (Ctrl)." },
  // combat
  { id: "attack_light", label: "Light Attack", category: "combat", description: "Primary attack / combo." },
  { id: "attack_heavy", label: "Heavy Attack / Melee", category: "combat", description: "Middle-mouse heavy strike or rifle bash." },
  { id: "soft_lock", label: "Soft Lock Target", category: "combat", description: "Tab-target nearest enemy in view cone." },
  { id: "block", label: "Block / Aim", category: "combat", description: "Raise shield or aim ranged." },
  // skills (action-bar) — 1..8
  { id: "skill_1", label: "Skill 1", category: "skill", description: "Action-bar slot 1." },
  { id: "skill_2", label: "Skill 2", category: "skill", description: "Action-bar slot 2." },
  { id: "skill_3", label: "Skill 3", category: "skill", description: "Action-bar slot 3." },
  { id: "skill_4", label: "Skill 4", category: "skill", description: "Action-bar slot 4." },
  { id: "skill_5", label: "Skill 5", category: "skill", description: "Action-bar slot 5." },
  { id: "skill_6", label: "Skill 6", category: "skill", description: "Action-bar slot 6." },
  // harvest
  { id: "harvest_use", label: "Use Tool", category: "harvest", description: "Swing the equipped harvest tool at a node." },
  { id: "harvest_cycle", label: "Cycle Tool", category: "harvest", description: "Switch between pick / axe / sickle." },
  { id: "harvest_mode", label: "Toggle Harvest Mode", category: "harvest", description: "Enter/exit harvest mode (tools to hand)." },
  // interaction
  { id: "interact", label: "Interact", category: "interaction", description: "Open chests, talk, use benches." },
  { id: "inventory", label: "Inventory", category: "ui", description: "Open inventory / paper-doll." },
  // camera
  { id: "camera_cycle", label: "Cycle Camera", category: "camera", description: "Switch action / mmo / rts camera modes." },
  { id: "camera_recenter", label: "Recenter Camera", category: "camera", description: "Snap camera behind the character." },
  // rts
  { id: "rts_select", label: "Select", category: "rts", description: "Select unit / building under cursor." },
  { id: "rts_command", label: "Command", category: "rts", description: "Issue move/attack order." },
  { id: "rts_build", label: "Build Menu", category: "rts", description: "Open the build/bench menu." },
];

// Defaults shared by all modes unless a mode overrides them below.
const SHARED: Record<string, InputBinding> = {
  jump: { key: "Space", pad: PAD.A },
  sprint: { key: "ShiftLeft", pad: PAD.L3 },
  dodge: { key: "KeyC", pad: PAD.B },
  crouch: { key: "ControlLeft", pad: PAD.DDown },
  attack_light: { key: "Mouse0", pad: PAD.RT },
  attack_heavy: { key: "Mouse1", pad: PAD.RB },
  soft_lock: { key: "Tab", pad: PAD.R3 },
  block: { key: "KeyF", pad: PAD.LT },
  skill_1: { key: "Digit1", pad: PAD.X },
  skill_2: { key: "Digit2", pad: PAD.Y },
  skill_3: { key: "Digit3", pad: PAD.DUp },
  skill_4: { key: "Digit4", pad: PAD.DLeft },
  skill_5: { key: "Digit5", pad: PAD.DRight },
  skill_6: { key: "Digit6", pad: null },
  harvest_use: { key: "Mouse0", pad: PAD.RT },
  harvest_cycle: { key: "KeyT", pad: PAD.DRight },
  harvest_mode: { key: "KeyH", pad: PAD.LB },
  interact: { key: "KeyE", pad: PAD.A },
  inventory: { key: "KeyI", pad: PAD.Back },
  camera_cycle: { key: "KeyV", pad: PAD.R3 },
  camera_recenter: { key: "KeyR", pad: PAD.R3 },
  rts_select: { key: "Mouse0", pad: PAD.A },
  rts_command: { key: "Mouse2", pad: PAD.RT },
  rts_build: { key: "KeyB", pad: PAD.Y },
};

function withOverrides(over: Record<string, InputBinding>): Record<string, InputBinding> {
  return { ...SHARED, ...over };
}

export const DEFAULT_BINDINGS: Record<CameraMode, Record<string, InputBinding>> = {
  action: withOverrides({
    // action mode aims with block/aim on LT, fires on RT (already shared)
  }),
  mmo: withOverrides({
    // MMO leans on tab-target; light attack is auto-attack toggle
    attack_light: { key: "KeyQ", pad: PAD.RT },
  }),
  rts: withOverrides({
    // RTS repurposes face buttons for command grid
    skill_1: { key: "KeyQ", pad: PAD.X },
    skill_2: { key: "KeyW", pad: PAD.Y },
    skill_3: { key: "KeyE", pad: PAD.B },
  }),
};

// ── Action bars ────────────────────────────────────────────────────────────────
export interface ActionBarDef {
  id: string;
  label: string;
  /** Action ids in slot order. */
  slots: string[];
  /** Camera modes this bar shows in. */
  modes: CameraMode[];
}

export const ACTION_BARS: ActionBarDef[] = [
  {
    id: "skills",
    label: "Skill Bar",
    slots: ["skill_1", "skill_2", "skill_3", "skill_4", "skill_5", "skill_6"],
    modes: ["action", "mmo"],
  },
  {
    id: "harvest",
    label: "Harvest Bar",
    slots: ["harvest_use", "harvest_cycle", "harvest_mode"],
    modes: ["action", "mmo"],
  },
  {
    id: "command",
    label: "Command Bar",
    slots: ["rts_build", "skill_1", "skill_2", "skill_3"],
    modes: ["rts"],
  },
];

export const GAME_ACTION_BY_ID: Record<string, GameActionDef> = Object.fromEntries(
  GAME_ACTIONS.map((a) => [a.id, a]),
);

export function bindingFor(mode: CameraMode, actionId: string): InputBinding | undefined {
  return DEFAULT_BINDINGS[mode]?.[actionId];
}
