---
name: R3F games and headless testing
description: Why runTest fails on Three.js/R3F game scenes and how to verify them instead.
---

The Playwright-based `runTest` browser has no GPU / hardware acceleration, so any
React-Three-Fiber (Three.js) scene that needs a real WebGL context will render the
WebGL fallback (e.g. Grudge Warlords' `CanvasFallback`) instead of the 3D scene.
A `runTest` "failure" reporting "WebGL context could not be created" is an
environment limitation, NOT a code bug.

**Why:** the test agent runs headless without `failIfMajorPerformanceCaveat`-capable
hardware; the app's own graceful WebGL fallback (intentionally added) takes over.

**How to apply:** verify menus/HUD/DOM flows with `runTest`, but verify the actual
3D battlefield via the `screenshot` tool (`type: "app_preview"`), which uses a real
browser that has WebGL. Do not chase the headless WebGL failure as a regression.
