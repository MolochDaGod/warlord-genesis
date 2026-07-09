/**
 * Warlord Genesis — Grudge Engine manifest (Nexus-era pattern).
 * Single boot document: CDN paths, unit tiers, turret archetypes, weapon mounts.
 * Gameplay code reads stats from here instead of scattering magic numbers.
 */

import type { StructureKind } from "../game/config";
import type { WeaponModelKey } from "../game/anim/weaponModels";

export const ASSET_CDN = "https://assets.grudge-studio.com";

export interface UnitTierDef {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  line: "melee" | "ranged";
  /** Base stat multipliers vs tier-1 militia/skirmisher baseline. */
  hpMult: number;
  dmgMult: number;
  speedMult: number;
  mesh: string;
  scale: number;
  tierColor: string;
}

export interface TurretArchetype {
  kind: StructureKind;
  name: string;
  glyph: string;
  description: string;
  /** R2 icon path (optional HUD). */
  iconPath: string;
  splash: boolean;
  slow: boolean;
}

export interface WeaponMountDef {
  targetSize: number;
  pos: [number, number, number];
  rot: [number, number, number];
  scale: number;
  muzzle: [number, number, number];
}

export const WARLORD_MANIFEST = {
  version: "1.0.0",
  pipeline: {
    cdn: ASSET_CDN,
    r2: {
      units: `${ASSET_CDN}/grudge-nexus/models/rts/units/`,
      unitPalette: `${ASSET_CDN}/grudge-nexus/textures/Color_Palette.png`,
      rtsIcons: `${ASSET_CDN}/grudge-nexus/icons/skills/`,
      bakedAnims: `${ASSET_CDN}/anims/baked/`,
      raceModels: `${ASSET_CDN}/models/grudge6/races/`,
      /** Craftpix map towers — human/medieval, elf/elven, orc (faction-themed atlases). */
      mapTowers: `${ASSET_CDN}/models/maps/`,
      mapTowerAtlases: `${ASSET_CDN}/models/maps/`,
    },
    d1: {
      characters: "/api/characters",
      catalog: "warlords-heroes",
    },
  },
  controllers: {
    id: "warlord-tps",
    worldScale: 1,
    playerHeight: 1.2,
    camFollow: 20,
    fov: 72,
  },
  terrain: {
    cellSize: 1.7,
    ridgeHeight: 3.6,
    corridorHalf: 5,
    sampleRadius: 0.4,
  },
  /** Three melee tiers — barracks L1→L3. */
  meleeTiers: [
    { id: "militia", name: "Militia", tier: 1, line: "melee", hpMult: 1, dmgMult: 1, speedMult: 1, mesh: "footman", scale: 0.88, tierColor: "#8b7355" },
    { id: "footman", name: "Footman", tier: 2, line: "melee", hpMult: 1.35, dmgMult: 1.4, speedMult: 1, mesh: "footman", scale: 1, tierColor: "#a8a8a8" },
    { id: "knight", name: "Knight", tier: 3, line: "melee", hpMult: 2.1, dmgMult: 1.75, speedMult: 0.92, mesh: "knight", scale: 1.15, tierColor: "#4a9eff" },
  ] satisfies UnitTierDef[],
  /** Three ranged tiers — archery L1→L3. */
  rangedTiers: [
    { id: "skirmisher", name: "Skirmisher", tier: 1, line: "ranged", hpMult: 1, dmgMult: 1, speedMult: 1.08, mesh: "archer", scale: 0.84, tierColor: "#8b7355" },
    { id: "archer", name: "Archer", tier: 2, line: "ranged", hpMult: 1.2, dmgMult: 1.35, speedMult: 1, mesh: "archer", scale: 0.95, tierColor: "#a8a8a8" },
    { id: "marksman", name: "Marksman", tier: 3, line: "ranged", hpMult: 1.45, dmgMult: 1.7, speedMult: 0.94, mesh: "archer", scale: 1.05, tierColor: "#4a9eff" },
  ] satisfies UnitTierDef[],
  turrets: [
    { kind: "cannon", name: "Cannon Turret", glyph: "💣", description: "Splash AoE — best vs clustered waves.", iconPath: "cannon", splash: true, slow: false },
    { kind: "ballista", name: "Ballista", glyph: "🏹", description: "Single-target sniper — highest DPS.", iconPath: "ballista", splash: false, slow: false },
    { kind: "mage", name: "Mage Tower", glyph: "🔮", description: "Arcane pulse — slows and splashes.", iconPath: "mage", splash: true, slow: true },
    { kind: "barrier", name: "Barrier", glyph: "🧱", description: "Lane blocker — soaks damage.", iconPath: "barrier", splash: false, slow: false },
  ] satisfies TurretArchetype[],
  /** Authoritative in-hand weapon mounts (metres). Overrides stale localStorage. */
  weaponMounts: {
    bow: { targetSize: 1.05, pos: [0.02, 0.04, 0], rot: [0, 0, 1.5708], scale: 1, muzzle: [0, 0.48, 0] },
    pistol: { targetSize: 0.28, pos: [0.02, 0.03, 0.02], rot: [1.45, 0, 0], scale: 1, muzzle: [0, 0, 0.16] },
    rifle: { targetSize: 0.62, pos: [0.03, 0.04, 0.02], rot: [1.45, 0, 0], scale: 1, muzzle: [0, 0.02, 0.38] },
    sniper: { targetSize: 0.74, pos: [0.03, 0.04, 0.02], rot: [1.45, 0, 0], scale: 1, muzzle: [0, 0.02, 0.46] },
    sword: { targetSize: 0.72, pos: [0.02, 0.05, 0], rot: [1.5708, 0, 0], scale: 1, muzzle: [0, 0.42, 0] },
  } satisfies Record<WeaponModelKey, WeaponMountDef>,
} as const;

export type WarlordManifest = typeof WARLORD_MANIFEST;