// ── Universal animation defaults ──────────────────────────────────────────────
//
// Single source of truth for locomotion, weapon skills, traversal, harvest, and
// swim defaults. Consumed by /world (Bip001 races + Nexus + NPC archetypes),
// the AI assistant, anim-test bindings, and character-viewer gear presets.
//
// Keys reference ANIM_LIBRARY stable ids; baked paths resolve through ANIM_BY_KEY.

import { ANIM_BY_KEY, type AnimCategory } from "./animations";

/** Loadout / stance families (matches character-kit AnimPack). */
export type AnimPackId = "magic" | "sword_shield" | "longbow" | "rifle" | "pistol" | "unarmed";

export type LocoBand = "idle" | "walk" | "run" | "sprint";

export type GameplayMode =
  | "combat"
  | "harvest"
  | "swim"
  | "climb"
  | "traversal"
  | "social";

export type TraversalKind =
  | "ladder"
  | "mantle"
  | "wall_jump"
  | "wall_hang"
  | "crawl"
  | "slide";

/** Baked clip path (no `.json`) per locomotion band. */
export type LocoBakedSet = Record<LocoBand, string>;

function bakedOr(key: string, fallback: string): string {
  return ANIM_BY_KEY[key]?.baked ?? fallback;
}

/** Per-pack locomotion defaults — all paths under `/anims/baked/`. */
export const LOCO_BAKED_BY_PACK: Record<AnimPackId, LocoBakedSet> = {
  unarmed: {
    idle: bakedOr("venom_idle", "venom/idle"),
    walk: bakedOr("venom_walk", "venom/walk-forward"),
    run: bakedOr("venom_run", "venom/run-forward"),
    sprint: bakedOr("venom_run", "venom/run-forward"),
  },
  sword_shield: {
    idle: bakedOr("idle_shield", "sword_shield/sword and shield idle"),
    walk: bakedOr("walk", "locomotion/walking"),
    run: bakedOr("run", "locomotion/running"),
    sprint: bakedOr("sprint", "uploads_2026_06/locomotion/running"),
  },
  magic: {
    idle: bakedOr("magic_idle", "magic/standing idle"),
    walk: bakedOr("walk", "locomotion/walking"),
    run: bakedOr("magic_run", "magic/Standing Run Forward"),
    sprint: bakedOr("sprint", "uploads_2026_06/locomotion/running"),
  },
  longbow: {
    idle: bakedOr("bow_idle", "longbow/standing idle 01"),
    walk: bakedOr("walk", "locomotion/walking"),
    run: bakedOr("bow_run", "longbow/standing run forward"),
    sprint: bakedOr("sprint", "uploads_2026_06/locomotion/running"),
  },
  rifle: {
    idle: bakedOr("rifle_idle_loco", "rifle/idle"),
    walk: bakedOr("rifle_walk_fwd", "rifle/walk forward"),
    run: bakedOr("rifle_run_fwd", "rifle/run forward"),
    sprint: bakedOr("rifle_run_fwd", "rifle/run forward"),
  },
  pistol: {
    idle: bakedOr("pistol_idle_loco", "pistol/pistol idle"),
    walk: bakedOr("pistol_walk", "pistol/pistol walk"),
    run: bakedOr("pistol_run", "pistol/pistol run"),
    sprint: bakedOr("pistol_run", "pistol/pistol run"),
  },
};

/** Overlay blend when a skill plays (1 = full body; lower = legs keep locomotion). */
export const SKILL_BLEND_BY_ID: Record<string, number> = {
  // Sword / shield — block and bash keep some leg motion
  "sword.slash": 0.92,
  "sword.dash": 0.88,
  "sword.finisher": 1,
  "shield.bash": 0.75,
  "shield.dash": 0.85,
  // Heavy melee
  "axe.chop": 0.95,
  "axe.rend": 1,
  "hammer.smash": 1,
  "hammer.quake": 1,
  "mace.bash": 0.9,
  "spear.thrust": 0.88,
  "spear.sweep": 1,
  // Casters — channel over locomotion
  "staff.bolt": 0.55,
  "staff.nova": 0.7,
  "staff.lance": 0.85,
  // Ranged
  "bow.shot": 0.65,
  "bow.volley": 0.8,
  "dagger.stab": 0.9,
  "dagger.backstab": 1,
  // Harvest / fishing
  "pick.mine": 1,
  "fish.cast": 0.85,
  "fish.idle": 0.5,
  // Venom symbiote — channel over legs where it reads better
  "venom_symbiote": 0.55,
  "venom_devour_start": 0.72,
  "venom_devour_loop": 0.65,
  "venom_tentacles_a": 0.88,
  "venom_tentacles_b": 0.88,
  "venom_attack_a": 0.92,
  "venom_attack_b": 0.9,
  "venom_attack_c": 1,
  "venom_dash_l": 0.85,
  "venom_dash_r": 0.85,
  "venom.symbiote": 0.55,
  "venom.devour": 0.72,
  "venom.lunge": 0.92,
  "venom.claws": 0.9,
  "venom.tentacles": 0.88,
  "venom.slam": 1,
  "venom.shackle": 0.78,
  "venom.flight": 0.62,
  "venom_shackle": 0.78,
  "venom_flight_start": 0.62,
  "venom_flight_loop": 0.55,
  "marvel_stealth": 0.7,
};

/** Default overlay blend by animation category when skill id is unknown. */
export const SKILL_BLEND_BY_CATEGORY: Partial<Record<AnimCategory, number>> = {
  combat: 0.92,
  combat_sword: 0.92,
  combat_shield: 0.8,
  combat_unarmed: 0.95,
  combat_throw: 0.85,
  survival: 1,
  traversal: 0.9,
  swimming: 0.6,
  locomotion: 0.5,
};

/** Cast windup multiplier for magic skills (clip timeScale = 1/extend). */
export const CASTER_CAST_EXTEND = 1.8;

export const CASTER_SKILL_IDS = new Set([
  "staff.bolt",
  "staff.nova",
  "venom.symbiote",
  "venom.devour",
  "venom.flight",
]);

/** Optional follow-up baked path (no `.json`) after a cast windup. */
export const CAST_FOLLOW_BY_SKILL: Record<string, string> = {
  "venom.devour": bakedOr("venom_devour_loop", "venom/devouring-loop"),
  "venom.flight": bakedOr("venom_flight_loop", "venom/ground-flight-loop"),
};

/** Traversal one-shots / loops keyed by gameplay moment. */
export const TRAVERSAL_DEFAULTS: Record<TraversalKind, string> = {
  ladder: bakedOr("climb_ladder", "uploads/locomotion/Climbing_Ladder"),
  mantle: bakedOr("climb_to_top", "uploads/locomotion/Climbing_To_Top"),
  wall_jump: bakedOr("wall_jump_start", "uploads/locomotion/Jump_From_Wall"),
  wall_hang: bakedOr("venom_wall_hang", "venom/onwall-idle"),
  crawl: bakedOr("crawl", "uploads/locomotion/Crawling"),
  slide: bakedOr("slide_loop", "uploads/locomotion/trip_Running_Slide"),
};

/** Optional wall-run loop (Venom parkour pack). */
export const WALL_RUN_BAKED = bakedOr("venom_wallrun", "venom/wallrun");

/** Swim locomotion bands (catalog keys — bake assets land here). */
export const SWIM_LOCO_KEYS: LocoBakedSet = {
  idle: "tread_water",
  walk: "swim",
  run: "swim_fast",
  sprint: "swim_fast",
};

/** Harvest / gather tool → stable anim key. */
export const HARVEST_TOOL_ANIM_KEY: Record<string, string> = {
  "tool.pickaxe": "mine",
  "tool.axe": "chop_tree",
  "tool.hoe": "harvest",
  "tool.watering_can": "watering",
  "tool.fishingrod": "fishing_cast",
  pick: "mine",
  fishing: "fishing_cast",
};

/** Dodge / roll defaults per direction (baked paths). */
export const ROLL_BAKED_DEFAULTS = {
  f: bakedOr("dodge", "locomotion/dodging"),
  b: bakedOr("dodge", "locomotion/dodging"),
  l: bakedOr("venom_dash_l", "venom/dash-left"),
  r: bakedOr("venom_dash_r", "venom/dash-right"),
} as const;

export function asAnimPackId(value: string): AnimPackId {
  return value in LOCO_BAKED_BY_PACK ? (value as AnimPackId) : "unarmed";
}

/** Resolve a locomotion band's baked path for a loadout pack. */
export function locoBakedForPack(pack: AnimPackId, band: LocoBand): string {
  return LOCO_BAKED_BY_PACK[pack][band];
}

/** Full locomotion set for a pack (for AnimationDirector bootstrap). */
export function locoBakedSetForPack(pack: AnimPackId): LocoBakedSet {
  return { ...LOCO_BAKED_BY_PACK[pack] };
}

/** Resolve skill overlay blend: per-skill override → anim key → category → 1. */
export function skillBlendFor(skillId: string, animKey?: string): number {
  if (skillId in SKILL_BLEND_BY_ID) return SKILL_BLEND_BY_ID[skillId]!;
  if (animKey && animKey in SKILL_BLEND_BY_ID) return SKILL_BLEND_BY_ID[animKey]!;
  const cat = animKey ? ANIM_BY_KEY[animKey]?.category : undefined;
  if (cat && cat in SKILL_BLEND_BY_CATEGORY) {
    return SKILL_BLEND_BY_CATEGORY[cat as AnimCategory]!;
  }
  return 1;
}

/** Channel / wind-up skills from the 16×6 API matrix (staff, wand, tome, mace). */
const API_CASTER_SKILL_RE =
  /^(staff|wand|tome|mace)_(bolt|wave|shield|storm|burst|symbiote|shackle|sanctify|wrath|meteor|inferno|hymn|sigil|apocalypse|missile|chain|pulse)/;

/** Whether a skill should use slowed cast windup. */
export function skillCastExtendFor(skillId: string): number {
  if (CASTER_SKILL_IDS.has(skillId)) return CASTER_CAST_EXTEND;
  if (API_CASTER_SKILL_RE.test(skillId)) return CASTER_CAST_EXTEND;
  if (/symbiote|shackle|burst|nova|meteor|inferno|wrath|sanctify/i.test(skillId)) {
    return CASTER_CAST_EXTEND;
  }
  return 1;
}

/** Resolve stable key → baked path (undefined if catalog placeholder). */
export function bakedPathForKey(key: string): string | undefined {
  return ANIM_BY_KEY[key]?.baked;
}

/** NPC / player archetype shares the same defaults — keyed by anim pack. */
export function defaultsForArchetype(pack: AnimPackId): {
  loco: LocoBakedSet;
  roll: typeof ROLL_BAKED_DEFAULTS;
} {
  return {
    loco: locoBakedSetForPack(pack),
    roll: ROLL_BAKED_DEFAULTS,
  };
}