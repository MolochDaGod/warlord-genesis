/**
 * Input SSOT — modes do not share keys.
 *
 * Combat (TPS): WASD · Space · Shift · R reload · Q swap · C dash · G slam · Digit1–6 skills · ` toggle
 * Command (RTS): ` toggle · 1–5 fortify · F1 attack-move · F2 hold · F3 stop · F4 follow · F5 defend citadel
 * Alt+V/B/F/G/T/C = VFX sandbox only (not F1–F5, not fortify).
 */
export enum Controls {
  forward = "forward",
  back = "back",
  left = "left",
  right = "right",
  jump = "jump",
  sprint = "sprint",
  camUp = "camUp",
  camDown = "camDown",
  camLeft = "camLeft",
  camRight = "camRight",
}

export const keyMap = [
  { name: Controls.forward, keys: ["ArrowUp", "KeyW"] },
  { name: Controls.back, keys: ["ArrowDown", "KeyS"] },
  { name: Controls.left, keys: ["ArrowLeft", "KeyA"] },
  { name: Controls.right, keys: ["ArrowRight", "KeyD"] },
  { name: Controls.jump, keys: ["Space"] },
  { name: Controls.sprint, keys: ["ShiftLeft", "ShiftRight"] },
  // Numpad camera nudge (RTS / command view): 8/2 tilt angle, 4/6 orbit.
  { name: Controls.camUp, keys: ["Numpad8"] },
  { name: Controls.camDown, keys: ["Numpad2"] },
  { name: Controls.camLeft, keys: ["Numpad4"] },
  { name: Controls.camRight, keys: ["Numpad6"] },
];
