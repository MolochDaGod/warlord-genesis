/** Attach loss/restore listeners so mobile tab sleep does not hard-crash the scene. */
export function attachWebGLContextGuard(
  canvas: HTMLCanvasElement,
  label = "fleet",
): () => void {
  const onLost = (e: Event) => {
    e.preventDefault();
    console.warn(`[${label}] WebGL context lost — awaiting restore`);
  };
  const onRestored = () => {
    console.warn(`[${label}] WebGL context restored`);
  };
  canvas.addEventListener("webglcontextlost", onLost, false);
  canvas.addEventListener("webglcontextrestored", onRestored, false);
  return () => {
    canvas.removeEventListener("webglcontextlost", onLost, false);
    canvas.removeEventListener("webglcontextrestored", onRestored, false);
  };
}