---
name: WebGL unavailable in screenshot/preview sandbox
description: Why the grudge-warlords 3D canvas throws "Error creating WebGL context" in the headless screenshot tool, and why it is not a code bug.
---

The Replit headless screenshot/app-preview environment has no GPU, so Three.js
`new WebGLRenderer()` fails with "Error creating WebGL context" / "Could not
create a WebGL context, VENDOR = 0xffff, DEVICE = 0xffff". This surfaces as a
Vite runtime-error overlay over the menu and a `[RUNTIME_ERROR]` line in the
workflow logs.

**Why:** the sandbox can't allocate a GL context; it is an environment
limitation, not an application fault. The 3D scene renders fine in a real
user browser.

**How to apply:** for any Three.js / R3F artifact, do NOT treat this specific
WebGL-context error as a regression. Verify instead via `pnpm --filter ...
run typecheck` and that the Vite dev server boots cleanly. The plain HTML/CSS
menu (Screens) still renders behind the overlay, so use that to sanity-check UI.
