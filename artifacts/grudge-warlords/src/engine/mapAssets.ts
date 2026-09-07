/**
 * Authored battlefield GLBs — replaces procedural grey heightfield visuals.
 *
 *  • sanctum_island  — large 3-lane map (standard / large)
 *  • sanctum_turret  — lane towers on Sanctum (missing towers in the island GLB)
 *  • arena_1v1       — small 1v1 / skirmish map (1vs1_high_poly source)
 *
 * Gameplay pathing still uses mapgen lanes + WalkGrid; these are the visuals
 * and tower/jungle meshes. Scale is fit so a ~2 m orc hero reads correctly.
 *
 * Vercel deploys Git LFS *pointers* (~133 B "version https://git-lfs...") unless
 * LFS is enabled on the project. Three/GLTFLoader then throws
 * `Unexpected token 'v', "version ht"... is not valid JSON`.
 * Resolve binaries from GitHub LFS media (CORS *) — same-origin /models/maps
 * is redirected there in vercel.json as well.
 */

import type { MapSize } from "../game/mapgen";

const LOCAL = import.meta.env.BASE_URL;
const LFS_MEDIA =
  "https://media.githubusercontent.com/media/MolochDaGod/warlord-genesis/main/";

export type AuthoredMapId = "sanctum" | "arena1v1";

/** Target humanoid height the rest of the world is authored against. */
export const HERO_REFERENCE_HEIGHT_M = 2.0;

export interface AuthoredMapDef {
  id: AuthoredMapId;
  /** Public URL — GitHub LFS media so production is never a pointer file. */
  url: string;
  label: string;
  /**
   * Desired world footprint (XZ) after fit — match mapgen width/length so
   * cores/lanes line up with the art roughly.
   */
  targetWidth: number;
  targetLength: number;
  /** Use sanctum turrets for lane towers. */
  useSanctumTurrets: boolean;
  /** Jungle creeps use elemental_lord / belerick. */
  useJungleCreatures: boolean;
}

function lfsGlb(rel: string): string {
  return `${LFS_MEDIA}${rel.replace(/^\//, "")}`;
}

export const MAP_GLB = {
  sanctum: lfsGlb("models/maps/sanctum_island.glb"),
  sanctumTurret: lfsGlb("models/maps/sanctum_turret.glb"),
  arena1v1: lfsGlb("models/maps/arena_1v1.glb"),
  elementalLord: lfsGlb("models/units/jungle/elemental_lord.glb"),
  belerick: lfsGlb("models/units/jungle/belerick.glb"),
  /** Same-origin fallback if media is blocked; vercel.json redirects LFS. */
  sanctumLocal: `${LOCAL}models/maps/sanctum_island.glb`,
} as const;

/** Sanctum = full 3-lane island; 1v1 = compact duel map. */
export const AUTHORED_MAPS: Record<AuthoredMapId, AuthoredMapDef> = {
  sanctum: {
    id: "sanctum",
    url: MAP_GLB.sanctum,
    label: "Sanctum Island",
    // Raw GLB ~190×190 — keep near-native so 2 m heroes match kit scale
    targetWidth: 190,
    targetLength: 190,
    useSanctumTurrets: true,
    useJungleCreatures: true,
  },
  arena1v1: {
    id: "arena1v1",
    url: MAP_GLB.arena1v1,
    label: "Arena 1v1",
    // Raw ~56×47 — small 1v1 field (1vs1_high_poly.glb)
    targetWidth: 56,
    targetLength: 50,
    useSanctumTurrets: false,
    useJungleCreatures: false,
  },
};

/** Which authored map each match size uses. */
export function authoredMapForSize(size: MapSize): AuthoredMapDef {
  if (size === "skirmish" || size === "royale") return AUTHORED_MAPS.arena1v1;
  return AUTHORED_MAPS.sanctum;
}

export function sanctumTurretUrl(): string {
  return MAP_GLB.sanctumTurret;
}

export function jungleCreepUrl(kind: "elemental" | "belerick"): string {
  return kind === "elemental" ? MAP_GLB.elementalLord : MAP_GLB.belerick;
}
