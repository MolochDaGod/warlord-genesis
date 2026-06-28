---
name: Pointer-lock engage binding
description: Why the engage overlay (#lock-target) must mount in the same commit as PointerLockControls
---

# Pointer-lock engage binding

drei's `PointerLockControls selector="#lock-target"` binds its click→requestPointerLock
handler **once, at mount time**, via `document.querySelectorAll(selector)`. If the
`#lock-target` element is not already in the DOM when the controls' effect runs, the
click binding silently never attaches and the user can never lock the pointer.

**Why:** an earlier menu→battle transition mounted the controls before the overlay
existed, so click-to-lock was dead. Splitting into a `/play` page fixed it because the
engage overlay and `<PointerLockControls>` now render in the **same commit** when the
page mounts in `battle` phase.

**How to apply:** keep the element carrying `id="lock-target"` rendered in the same
render pass (same route/page) as `PointerLockControls`. Never gate the overlay behind a
state that flips *after* the controls mount. The overlay shows when
`phase==="battle" && !pointerLocked && mode==="combat"`; command mode is reset to
`combat` in `store.startGame`/`reset` (via `useCommand.resetCommand()`) so the prompt
appears predictably on every fresh deployment and rematch.
