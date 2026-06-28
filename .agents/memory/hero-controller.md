---
name: Hero controller (mouse-look + camera)
description: Why the hero uses a custom pointer-lock/look model instead of drei PointerLockControls, and the ordering/momentum constraints in Player.tsx useFrame.
---

# Hero controller

The hero's mouse-look does NOT use drei `PointerLockControls`. It was removed in
favor of a custom pointer-lock + manual yaw/pitch model.

**Why:** PointerLockControls owns `camera.quaternion` every frame, so you cannot
layer smoothing, a third-person orbit offset, or "level pitch to horizon on
combat entry" on top of it. Those are required for the third-person combat camera
(crosshair must sweep the lower half of the screen without the hero body blocking
downward aim).

**How to apply (Player.tsx):**
- Pointer lock is requested via `gl.domElement.requestPointerLock()` on the
  backtick toggle and on clicking `#lock-target`; `document.exitPointerLock()` /
  Esc releases. A `pointerlockchange` listener (guarded by
  `document.pointerLockElement === gl.domElement`) syncs combat/command mode.
- A `mousemove` handler accumulates raw deltas into `lookYaw/lookPitch` (target),
  scaled by `PLAYER.lookSensitivity`, pitch clamped to `±lookPitchMax`. The
  combat `useFrame` block eases `curYaw/curPitch` toward target and writes
  `camera.quaternion` from Euler order `"YXZ"`. Yaw init on combat entry:
  `atan2(-dir.x, -dir.z)` from the flat camera heading (Three forward = -Z).
- Movement is momentum-based: ease horizontal velocity toward target by
  `accel*dt` (ground vs air accel from `PLAYER`), NOT instant `setLinvel`. The
  RigidBody `linearDamping` is mild enough that steady-state velocity still locks
  to target. Dash/roll still override with fixed burst velocity, and the terrain
  floor-clamp (heightmap pin) still runs every frame.
- Known accepted quirk: movement basis (`_front/_side`) is read from
  `camera.quaternion` at the START of useFrame, but the new look quaternion is
  written at the END — a 1-frame lag, imperceptible at 60fps. Firing stays
  accurate because it samples `camera.getWorldDirection()` after the camera update.
