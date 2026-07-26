/**
 * Stylized battle level themes for /game/battle (/play).
 * Vertex-color terrain + fog/sky — no photo ground maps, no ocean.
 */

export type BattleThemeId = "warcamp_arid" | "verdant_lanes" | "ash_ridge" | "dusk_bastion";

export interface BattleTheme {
  id: BattleThemeId;
  label: string;
  groundLow: string;
  groundHigh: string;
  wall: string;
  wallTrim: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  skyTop: string;
  skyHorizon: string;
  background: string;
  hemiSky: string;
  hemiGround: string;
  sunColor: string;
  sunIntensity: number;
  ambient: number;
  grassEnabled: boolean;
}

export const BATTLE_THEMES: Record<BattleThemeId, BattleTheme> = {
  warcamp_arid: {
    id: "warcamp_arid",
    label: "Arid Warcamp",
    groundLow: "#c4a06a",
    groundHigh: "#8a6a45",
    wall: "#3a2a22",
    wallTrim: "#c0392b",
    fogColor: "#a07850",
    fogNear: 160,
    fogFar: 400,
    skyTop: "#5a8ab8",
    skyHorizon: "#e8c090",
    background: "#b89262",
    hemiSky: "#ffd9a8",
    hemiGround: "#2a1c14",
    sunColor: "#ffd9a8",
    sunIntensity: 1.65,
    ambient: 0.42,
    grassEnabled: false,
  },
  verdant_lanes: {
    id: "verdant_lanes",
    label: "Verdant Lanes",
    groundLow: "#c9a875",
    groundHigh: "#5d6b3c",
    wall: "#3a2a22",
    wallTrim: "#c0392b",
    fogColor: "#6e5240",
    fogNear: 140,
    fogFar: 420,
    skyTop: "#6aa0d0",
    skyHorizon: "#d4c4a0",
    background: "#5c4636",
    hemiSky: "#ffd9a8",
    hemiGround: "#2a1c14",
    sunColor: "#ffd9a8",
    sunIntensity: 1.7,
    ambient: 0.4,
    grassEnabled: true,
  },
  ash_ridge: {
    id: "ash_ridge",
    label: "Ash Ridge",
    groundLow: "#7a6a62",
    groundHigh: "#4a3a38",
    wall: "#2a2220",
    wallTrim: "#e07040",
    fogColor: "#5a5048",
    fogNear: 120,
    fogFar: 360,
    skyTop: "#3a4050",
    skyHorizon: "#a08070",
    background: "#4a4038",
    hemiSky: "#c8b0a0",
    hemiGround: "#1a1410",
    sunColor: "#ffb080",
    sunIntensity: 1.45,
    ambient: 0.35,
    grassEnabled: false,
  },
  dusk_bastion: {
    id: "dusk_bastion",
    label: "Dusk Bastion",
    groundLow: "#9a7a5a",
    groundHigh: "#5a4a6a",
    wall: "#2a2430",
    wallTrim: "#d4a020",
    fogColor: "#4a3a50",
    fogNear: 130,
    fogFar: 380,
    skyTop: "#1a2040",
    skyHorizon: "#c07050",
    background: "#3a3040",
    hemiSky: "#c0a0d0",
    hemiGround: "#1a1018",
    sunColor: "#ff9060",
    sunIntensity: 1.35,
    ambient: 0.38,
    grassEnabled: false,
  },
};

export const DEFAULT_BATTLE_THEME: BattleThemeId = "warcamp_arid";

export const BATTLE_THEME_ORDER: BattleThemeId[] = [
  "warcamp_arid",
  "verdant_lanes",
  "ash_ridge",
  "dusk_bastion",
];

export function getBattleTheme(id: BattleThemeId | string | undefined): BattleTheme {
  if (id && id in BATTLE_THEMES) return BATTLE_THEMES[id as BattleThemeId];
  return BATTLE_THEMES[DEFAULT_BATTLE_THEME];
}
