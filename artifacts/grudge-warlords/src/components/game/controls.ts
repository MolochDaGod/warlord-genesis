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
