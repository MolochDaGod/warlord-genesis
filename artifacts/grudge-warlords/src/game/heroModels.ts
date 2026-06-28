// Maps each playable hero preset to one of the 18 provided GLB voxel models and
// its 64x64 thumbnail. The GLB models are node-based (not Mixamo-skinned) — their
// whole-limb part meshes (head/torso/arms/legs) are attached to the animation
// skeleton (VoxelCharacter model mode) so the chosen warcamp character IS the
// in-match hero, animated by the equipped weapon class's clips. The same mapping
// drives the Character Select carousel/preview thumbnails.

/** Hero preset id -> GLB model letter (character-<letter>.glb). */
export const HERO_MODEL: Record<string, string> = {
  human: "a",
  sylvan: "b",
  drifter: "c",
  orc: "d",
  ender: "e",
  construct: "f",
  templar: "g",
  breaker: "h",
  raider: "i",
  stalker: "j",
  warbrute: "k",
};

/** GRUDGE 6 canonical race affinity for warcamp heroes (UI + export). */
export const HERO_GRUDGE_RACE: Record<string, string> = {
  human: "western-kingdoms",
  sylvan: "high-elves",
  drifter: "barbarians",
  orc: "orcs",
  ender: "undead",
  construct: "dwarves",
  templar: "western-kingdoms",
  breaker: "barbarians",
  raider: "orcs",
  stalker: "high-elves",
  warbrute: "barbarians",
};

// 64x64 PNG thumbnails live in attached_assets as character-<letter>_<ts>.png.
// Wire them through the @assets alias, keyed by the model letter.
const thumbModules = import.meta.glob("@assets/character-*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const THUMB_BY_LETTER: Record<string, string> = {};
for (const [path, url] of Object.entries(thumbModules)) {
  const m = path.match(/character-([a-r])_/);
  if (m) THUMB_BY_LETTER[m[1]] = url;
}

/** Public URL of a model GLB by its letter (textures resolve from ./Textures). */
export function modelUrl(letter: string): string {
  return `${import.meta.env.BASE_URL}models/characters/character-${letter}.glb`;
}

/** GLB url for a hero preset id. */
export function heroModelUrl(heroId: string): string {
  return modelUrl(HERO_MODEL[heroId] ?? "a");
}

/** 64x64 thumbnail url for a hero preset id (may be undefined if unstaged). */
export function heroThumb(heroId: string): string | undefined {
  return THUMB_BY_LETTER[HERO_MODEL[heroId] ?? "a"];
}
