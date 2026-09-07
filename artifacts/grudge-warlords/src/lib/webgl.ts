export interface WebGLSupport {
  ok: boolean;
  /** THREE.WebGLRenderer uses this when present. */
  webgl2: boolean;
  webgl1: boolean;
  reason?: string;
}

function lose(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const ext = gl.getExtension("WEBGL_lose_context");
  if (ext) ext.loseContext();
}

/** Probe WebGL2 first, then WebGL1. Play renderer is WebGLRenderer (not WebGPU). */
export function detectWebGL(): WebGLSupport {
  if (typeof window === "undefined") {
    return { ok: false, webgl2: false, webgl1: false, reason: "No window" };
  }
  const attrs: WebGLContextAttributes = {
    failIfMajorPerformanceCaveat: false,
    powerPreference: "high-performance",
  };
  try {
    const canvas = document.createElement("canvas");
    const gl2 =
      "WebGL2RenderingContext" in window
        ? (canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null)
        : null;
    if (gl2) {
      lose(gl2);
      return { ok: true, webgl2: true, webgl1: true };
    }
    const gl1 =
      (canvas.getContext("webgl", attrs) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl", attrs) as WebGLRenderingContext | null);
    if (gl1) {
      lose(gl1);
      return { ok: true, webgl2: false, webgl1: true };
    }
    return {
      ok: false,
      webgl2: false,
      webgl1: false,
      reason:
        "No WebGL/WebGL2 context. Enable hardware acceleration.",
    };
  } catch (e) {
    return {
      ok: false,
      webgl2: false,
      webgl1: false,
      reason: e instanceof Error ? e.message : "WebGL probe failed",
    };
  }
}
