---
name: R3F WebGL robustness
description: How to make a react-three-fiber Canvas degrade gracefully when WebGL is unavailable or context is lost
---

For any R3F game/app, make the renderer fail gracefully instead of throwing a raw crash overlay:

1. **Preflight probe** before mounting `<Canvas>`: create a throwaway canvas, try `getContext("webgl2"|"webgl"|"experimental-webgl")`, release it via the `WEBGL_lose_context` extension, and render a friendly fallback if it fails. Gate on both `WebGLRenderingContext` and `WebGL2RenderingContext` in `window`.
2. **Error boundary** (class component with `getDerivedStateFromError`) wrapping `<Canvas>` to catch render-time errors in the 3D subtree.
3. **Context loss/restore**: capture the canvas via `onCreated={(s)=>setCanvas(s.gl.domElement)}`, then register `webglcontextlost` (call `e.preventDefault()` to allow restore) + `webglcontextrestored` listeners inside a `useEffect` with proper cleanup — NOT inline in `onCreated`, or listeners accumulate on remount.
4. **Tolerant GL attrs**: `failIfMajorPerformanceCaveat: false` lets software/low-end renderers work.

**Why:** the Replit headless screenshot environment has no GPU and fails WebGL context creation; without a fallback the user sees a red runtime-error overlay. Real browsers render fine. This pattern keeps the failure legible everywhere.

**Note:** THREE.Clock / "deprecated parameters for initialization" / PCFSoftShadowMap warnings come from drei/rapier internals, not your code — only the shadow-type one is fixable via `shadows={{ type: THREE.PCFShadowMap }}` on the Canvas.
