// Plain 2D vector helpers on the ground plane (x, z). The sim never imports
// THREE so it can run headless in Node. The renderer maps {x,z} -> world XZ.

export interface Vec2 {
  x: number;
  z: number;
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.sqrt(dist2(ax, az, bx, bz));
}
