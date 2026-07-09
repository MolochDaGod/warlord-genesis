import { createEngineBoot } from "@workspace/grudge-engine";
import { WARLORD_MANIFEST } from "./warlordManifest";

const engine = createEngineBoot(WARLORD_MANIFEST, {
  cacheKey: "gw_engine_boot_v1",
  probeUrl: `${WARLORD_MANIFEST.pipeline.cdn}/grudge-nexus/textures/Color_Palette.png`,
});

export const bootEngine = engine.bootEngine;
export const getEngine = engine.getEngine;

export type { EngineBootState } from "@workspace/grudge-engine";