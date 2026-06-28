export interface WebGLSupport {
  ok: boolean;
  reason?: string;
}

// Detect whether a usable WebGL (or WebGL2) context can be created.
export function detectWebGL(): WebGLSupport {
  if (typeof window === "undefined") return { ok: false, reason: "No window" };
  if (
    !("WebGLRenderingContext" in window) &&
    !("WebGL2RenderingContext" in window)
  ) {
    return { ok: false, reason: "This browser does not support WebGL." };
  }
  try {
    const canvas = document.createElement("canvas");
    const attrs: WebGLContextAttributes = {
      failIfMajorPerformanceCaveat: false,
      powerPreference: "default",
    };
    const gl =
      (canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl", attrs) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl", attrs) as WebGLRenderingContext | null);
    if (!gl) {
      return {
        ok: false,
        reason:
          "A WebGL context could not be created. Your browser may have hardware acceleration disabled.",
      };
    }
    // proactively release the probe context
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Unknown WebGL initialization error.",
    };
  }
}
