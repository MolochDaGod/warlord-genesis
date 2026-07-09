/** Minimal engine manifest — games extend with title-specific tuning. */
export interface EngineManifest {
  version: string;
  pipeline: {
    cdn: string;
    r2: Record<string, string>;
    d1?: Record<string, string>;
  };
  controllers: {
    id: string;
    worldScale: number;
    playerHeight: number;
    camFollow: number;
    fov: number;
  };
  terrain: {
    cellSize: number;
    ridgeHeight: number;
    corridorHalf: number;
    sampleRadius: number;
  };
}