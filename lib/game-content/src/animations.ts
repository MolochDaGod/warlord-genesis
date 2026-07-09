// ── Animation library ─────────────────────────────────────────────────────────
//
// Shared, typed index of every animation clip the game can play, grouped by the
// gameplay system it serves. Clip names use UPPER_SNAKE_CASE exactly as stored
// in the source GLB/FBX so they can be looked up by name in a Three.js
// AnimationMixer (or retargeted onto a Bip001 skeleton in the viewer).
//
// `key` is the stable game-facing identifier the rest of the systems reference
// (controller bindings, harvest action bars, skill anim bindings). Clip names
// may change as assets are re-exported; keys do not.

export type AnimCategory =
  | "locomotion"
  | "traversal" // climbing, wall-jump, slide, swim
  | "swimming"
  | "survival" // harvest, plant, water, consume, chop
  | "combat"
  | "combat_sword"
  | "combat_shield"
  | "combat_unarmed"
  | "combat_throw"
  | "idle_variant"
  | "interaction"
  | "social"
  | "enemy";

export interface AnimClipDef {
  /** Stable game key referenced by controller/skill/harvest systems. */
  key: string;
  /** Source clip name as stored in the GLB/FBX (UPPER_SNAKE_CASE). */
  clip: string;
  category: AnimCategory;
  loop: boolean;
  /** Seconds; omitted for looping clips. */
  duration?: number;
  label?: string;
  /**
   * Baked Bip001 clip path under `/anims/baked` (no `.json`). Set ONLY when a
   * real retargeted asset exists on disk for this entry. Consumed by:
   *   • the `/world` in-world anim test panel (plays it on the live character),
   *   • the `/game` Animations codex (flags "has asset" vs "no asset" vs drift),
   *   • `validate-anim-catalog` (fails if the path has no baked JSON).
   * Entries without `baked` are catalog placeholders (no asset yet).
   */
  baked?: string;
}

export const ANIM_LIBRARY: AnimClipDef[] = [
  // ── Locomotion ──────────────────────────────────────────────────────────────
  { key: "idle", clip: "IDLE", category: "locomotion", loop: true, label: "Idle", baked: "locomotion/idle" },
  { key: "walk", clip: "WALK", category: "locomotion", loop: true, label: "Walk", baked: "locomotion/walking" },
  { key: "run", clip: "RUN", category: "locomotion", loop: true, label: "Run", baked: "locomotion/running" },
  { key: "walk_carry", clip: "WALK_CARRY", category: "locomotion", loop: true, label: "Carry Walk" },
  { key: "strafe_left", clip: "LEFT_STRAFE", category: "locomotion", loop: true, label: "Strafe Left", baked: "locomotion/left strafe" },
  { key: "strafe_right", clip: "RIGHT_STRAFE", category: "locomotion", loop: true, label: "Strafe Right", baked: "locomotion/right strafe" },
  { key: "strafe_left_walk", clip: "LEFT_STRAFE_WALK", category: "locomotion", loop: true, label: "Strafe L Walk", baked: "locomotion/left strafe walking" },
  { key: "strafe_right_walk", clip: "RIGHT_STRAFE_WALK", category: "locomotion", loop: true, label: "Strafe R Walk", baked: "locomotion/right strafe walking" },
  { key: "turn_left", clip: "LEFT_TURN_90", category: "locomotion", loop: false, duration: 0.6, label: "Turn Left", baked: "locomotion/left turn 90" },
  { key: "turn_right", clip: "RIGHT_TURN_90", category: "locomotion", loop: false, duration: 0.6, label: "Turn Right", baked: "locomotion/right turn 90" },
  { key: "jump", clip: "JUMP", category: "locomotion", loop: false, duration: 0.8, label: "Jump", baked: "locomotion/jump" },
  { key: "front_flip", clip: "FRONT_FLIP", category: "locomotion", loop: false, duration: 0.9, label: "Front Flip", baked: "uploads/locomotion/Front_Flip" },

  // ── Shared movement layer (weapon-neutral strafe / aim-strafe / dodge / sneak) ─
  { key: "aim_strafe_b", clip: "AIM_STRAFE_B", category: "locomotion", loop: true, label: "Aim Strafe Back", baked: "longbow/standing aim walk back" },
  { key: "aim_strafe_l", clip: "AIM_STRAFE_L", category: "locomotion", loop: true, label: "Aim Strafe Left", baked: "longbow/standing aim walk left" },
  { key: "aim_strafe_r", clip: "AIM_STRAFE_R", category: "locomotion", loop: true, label: "Aim Strafe Right", baked: "longbow/standing aim walk right" },
  { key: "dodge_fwd", clip: "DODGE_FWD", category: "locomotion", loop: false, duration: 0.5, label: "Dodge Forward", baked: "longbow/standing dodge forward" },
  { key: "dodge_back", clip: "DODGE_BACK", category: "locomotion", loop: false, duration: 0.5, label: "Dodge Back", baked: "longbow/standing dodge backward" },
  { key: "dodge_l", clip: "DODGE_L", category: "locomotion", loop: false, duration: 0.5, label: "Dodge Left", baked: "longbow/standing dodge left" },
  { key: "dodge_r", clip: "DODGE_R", category: "locomotion", loop: false, duration: 0.5, label: "Dodge Right", baked: "longbow/standing dodge right" },
  { key: "sneak_l", clip: "SNEAK_L", category: "locomotion", loop: true, label: "Sneak Left", baked: "uploads/locomotion/crouched_sneaking_left" },
  { key: "sneak_r", clip: "SNEAK_R", category: "locomotion", loop: true, label: "Sneak Right", baked: "uploads/locomotion/crouched_sneaking_right" },
  { key: "cover_sneak_l", clip: "COVER_SNEAK_L", category: "locomotion", loop: true, label: "Cover Sneak L", baked: "uploads/locomotion/left_cover_sneak" },
  { key: "cover_sneak_r", clip: "COVER_SNEAK_R", category: "locomotion", loop: true, label: "Cover Sneak R", baked: "uploads/locomotion/right_cover_sneak" },
  { key: "stand_to_cover", clip: "STAND_TO_COVER", category: "interaction", loop: false, duration: 0.6, label: "Stand To Cover", baked: "uploads/locomotion/stand_to_cover" },
  { key: "cover_to_stand", clip: "COVER_TO_STAND", category: "interaction", loop: false, duration: 0.6, label: "Cover To Stand", baked: "uploads/locomotion/Cover_To_Stand" },
  { key: "crouch_idle", clip: "CROUCH_IDLE", category: "locomotion", loop: true, label: "Crouch Idle", baked: "uploads/action/Crouch_Idle" },
  { key: "ascend_stairs", clip: "ASCEND_STAIRS", category: "locomotion", loop: true, label: "Ascend Stairs", baked: "uploads/action/Long_Step_Forward" },

  // ── Swimming (bake targets — use crawl locomotion until swim pack lands) ───
  { key: "swim", clip: "SWIM", category: "swimming", loop: true, label: "Swim", baked: "locomotion/crawling" },
  { key: "swim_fast", clip: "SWIM_FAST", category: "swimming", loop: true, label: "Swim (fast)", baked: "uploads_2026_06/locomotion/running" },
  { key: "tread_water", clip: "TREAD_WATER", category: "swimming", loop: true, label: "Tread Water", baked: "locomotion/idle" },

  // ── Pack-specific locomotion keys (universal defaults via animDefaults.ts) ─
  { key: "magic_idle", clip: "MAGIC_IDLE", category: "locomotion", loop: true, label: "Magic Idle", baked: "magic/standing idle" },
  { key: "magic_run", clip: "MAGIC_RUN", category: "locomotion", loop: true, label: "Magic Run", baked: "magic/Standing Run Forward" },
  { key: "magic_cast", clip: "MAGIC_CAST", category: "combat", loop: false, duration: 1.2, label: "Cast Spell", baked: "magic/standing 1h cast spell 01" },
  { key: "bow_idle", clip: "BOW_IDLE", category: "locomotion", loop: true, label: "Bow Idle", baked: "longbow/standing idle 01" },
  { key: "bow_run", clip: "BOW_RUN", category: "locomotion", loop: true, label: "Bow Run", baked: "longbow/standing run forward" },
  { key: "bow_shot", clip: "BOW_SHOT", category: "combat", loop: false, duration: 0.5, label: "Bow Shot", baked: "longbow/standing aim recoil" },
  { key: "bow_walk_fwd", clip: "BOW_WALK_FWD", category: "locomotion", loop: true, label: "Bow Walk Fwd", baked: "longbow/standing walk forward" },
  { key: "bow_aim_walk_fwd", clip: "BOW_AIM_WALK_FWD", category: "locomotion", loop: true, label: "Bow Aim Walk Fwd", baked: "longbow/standing aim walk forward" },

  // ── Greatsword / 2H sword locomotion ────────────────────────────────────────
  { key: "gs_idle", clip: "GS_IDLE", category: "locomotion", loop: true, label: "2H Sword Idle", baked: "sword/great sword idle" },
  { key: "gs_walk", clip: "GS_WALK", category: "locomotion", loop: true, label: "2H Sword Walk", baked: "sword/great sword walk" },
  { key: "gs_run", clip: "GS_RUN", category: "locomotion", loop: true, label: "2H Sword Run", baked: "sword/great sword run" },

  // ── Axe locomotion (Mixamo axe pack) ────────────────────────────────────────
  { key: "axe_idle_loco", clip: "AXE_IDLE", category: "locomotion", loop: true, label: "Axe Idle", baked: "axe/idle" },
  { key: "axe_walk_loco", clip: "AXE_WALK", category: "locomotion", loop: true, label: "Axe Walk", baked: "axe/walk" },

  // ── Magic locomotion ────────────────────────────────────────────────────────
  { key: "magic_walk_fwd", clip: "MAGIC_WALK_FWD", category: "locomotion", loop: true, label: "Magic Walk Fwd", baked: "magic/Standing Walk Forward" },

  // ── Rifle / gun (GUN weapon type) ───────────────────────────────────────────
  { key: "rifle_idle_loco", clip: "RIFLE_IDLE", category: "locomotion", loop: true, label: "Rifle Idle", baked: "rifle/idle" },
  { key: "rifle_walk_fwd", clip: "RIFLE_WALK_FWD", category: "locomotion", loop: true, label: "Rifle Walk Fwd", baked: "rifle/walk forward" },
  { key: "rifle_run_fwd", clip: "RIFLE_RUN_FWD", category: "locomotion", loop: true, label: "Rifle Run Fwd", baked: "rifle/run forward" },
  { key: "rifle_fire", clip: "RIFLE_FIRE", category: "combat", loop: false, duration: 0.4, label: "Rifle Fire", baked: "rifle/firing" },
  { key: "rifle_fire_2", clip: "RIFLE_FIRE_2", category: "combat", loop: false, duration: 0.45, label: "Rifle Fire 2", baked: "rifle/firing 2" },
  { key: "rifle_reload", clip: "RIFLE_RELOAD", category: "combat", loop: false, duration: 1.2, label: "Rifle Reload", baked: "rifle/reloading" },
  { key: "rifle_melee", clip: "RIFLE_MELEE", category: "combat", loop: false, duration: 0.5, label: "Rifle Melee", baked: "rifle/punch" },

  // ── Pistol locomotion + combat ───────────────────────────────────────────────
  { key: "pistol_idle_loco", clip: "PISTOL_IDLE", category: "locomotion", loop: true, label: "Pistol Idle", baked: "pistol/pistol idle" },
  { key: "pistol_walk", clip: "PISTOL_WALK", category: "locomotion", loop: true, label: "Pistol Walk", baked: "pistol/pistol walk" },
  { key: "pistol_run", clip: "PISTOL_RUN", category: "locomotion", loop: true, label: "Pistol Run", baked: "pistol/pistol run" },
  { key: "pistol_aim", clip: "PISTOL_AIM", category: "locomotion", loop: true, label: "Pistol Aim", baked: "pistol/pistol aim" },
  { key: "pistol_gunplay", clip: "PISTOL_GUNPLAY", category: "combat", loop: false, duration: 0.5, label: "Pistol Gunplay", baked: "pistol/gunplay" },

  // ── Traversal (climb / wall / slide) ─────────────────────────────────────────
  { key: "climb_ladder", clip: "CLIMBING_LADDER", category: "traversal", loop: true, label: "Climb Ladder", baked: "uploads/locomotion/Climbing_Ladder" },
  { key: "climbup_1m", clip: "CLIMBUP 1M", category: "traversal", loop: false, duration: 1.2, label: "Climb Up", baked: "uploads/locomotion/Climbing_To_Top" },
  { key: "climb_to_top", clip: "CLIMBING_TO_TOP", category: "traversal", loop: false, duration: 1.4, label: "Mantle", baked: "uploads/locomotion/Climbing_To_Top" },
  { key: "wall_jump_start", clip: "NINJAJUMP_START", category: "traversal", loop: false, duration: 0.32, label: "Wall Jump", baked: "uploads/locomotion/Jump_From_Wall" },
  { key: "wall_hang_idle", clip: "NINJAJUMP_IDLE", category: "traversal", loop: true, label: "Wall Hang", baked: "venom/onwall-idle" },
  { key: "wall_grab", clip: "WALL_GRAB", category: "traversal", loop: false, duration: 0.5, label: "Wall Grab", baked: "uploads/action/Grab_And_Slam" },
  { key: "wall_jump_land", clip: "NINJAJUMP_LAND", category: "traversal", loop: false, duration: 0.45, label: "Wall Land", baked: "uploads/locomotion/hard_landing" },
  { key: "slide_start", clip: "SLIDE_START", category: "traversal", loop: false, duration: 0.3, label: "Slide Start", baked: "uploads/locomotion/trip_Running_Slide" },
  { key: "slide_loop", clip: "SLIDE_LOOP", category: "traversal", loop: true, label: "Slide (loop)", baked: "uploads/locomotion/trip_Running_Slide" },
  { key: "slide_exit", clip: "SLIDE_EXIT", category: "traversal", loop: false, duration: 0.38, label: "Slide Exit", baked: "uploads/locomotion/Quick_Roll_To_Run" },
  { key: "crawl", clip: "CRAWLING", category: "traversal", loop: true, label: "Crawl", baked: "uploads/locomotion/Crawling" },
  { key: "swim_edge_exit", clip: "SWIM_EDGE_EXIT", category: "swimming", loop: false, duration: 1.2, label: "Climb From Water", baked: "uploads/locomotion/Climbing_To_Top" },

  // ── Survival / Harvest ───────────────────────────────────────────────────────
  { key: "harvest", clip: "HARVEST", category: "survival", loop: false, duration: 1.5, label: "Harvest", baked: "uploads/action/movingHarvesting" },
  { key: "chop_tree", clip: "TREECHOPPING", category: "survival", loop: false, duration: 1.3, label: "Chop Tree", baked: "uploads/action/movingHarvesting" },
  { key: "mine", clip: "MINING", category: "survival", loop: false, duration: 1.4, label: "Mine", baked: "uploads/action/movingHarvesting" },
  { key: "plant_seed", clip: "PLANT SEED", category: "survival", loop: false, duration: 2.0, label: "Plant Seed", baked: "uploads/action/crafting" },
  { key: "watering", clip: "WATERING", category: "survival", loop: false, duration: 1.8, label: "Water", baked: "uploads/action/crafting" },
  { key: "consume", clip: "CONSUME", category: "survival", loop: false, duration: 1.8, label: "Consume" },
  { key: "open_chest", clip: "CHEST OPEN", category: "interaction", loop: false, duration: 1.5, label: "Open Chest" },
  { key: "crafting", clip: "CRAFTING", category: "interaction", loop: true, label: "Craft", baked: "uploads/action/crafting" },

  // ── Unarmed combat ───────────────────────────────────────────────────────────
  { key: "unarmed_hook", clip: "MELEE_HOOK", category: "combat_unarmed", loop: false, duration: 0.5, label: "Hook", baked: "unarmed/hook_punch" },
  { key: "unarmed_hook_recovery", clip: "MELEE_HOOK_REC", category: "combat_unarmed", loop: false, duration: 0.3 },
  { key: "unarmed_uppercut", clip: "SURPRISE_UPPERCUT", category: "combat_unarmed", loop: false, duration: 0.6, label: "Uppercut", baked: "uploads/combat/1Surprise_Uppercut" },
  { key: "unarmed_spin", clip: "NORTHERN_SOUL_SPIN", category: "combat_unarmed", loop: false, duration: 0.9, label: "Spin Kick", baked: "action/northern soul spin combo" },
  { key: "throw_overhand", clip: "OVERHAND THROW", category: "combat_throw", loop: false, duration: 0.7, label: "Throw", baked: "action/throw object" },

  // ── Sword / shield combat ────────────────────────────────────────────────────
  { key: "sword_attack_a", clip: "SWORD_REGULAR_A", category: "combat_sword", loop: false, duration: 0.58, label: "Slash A", baked: "sword_shield/sword and shield slash" },
  { key: "sword_attack_b", clip: "SWORD_REGULAR_B", category: "combat_sword", loop: false, duration: 0.55, label: "Slash B", baked: "sword_shield/sword and shield attack" },
  { key: "sword_attack_c", clip: "SWORD_REGULAR_C", category: "combat_sword", loop: false, duration: 0.6, label: "Slash C", baked: "sword_shield/sword and shield attack (2)" },
  { key: "sword_combo_finisher", clip: "SWORD_REGULAR_COMBO", category: "combat_sword", loop: false, duration: 1.0, label: "Combo Finisher", baked: "sword/one hand sword combo" },
  { key: "sword_block", clip: "SWORD_BLOCK", category: "combat_sword", loop: false, duration: 0.5, label: "Block", baked: "sword_shield/sword and shield block" },
  { key: "sword_dash_attack", clip: "SWORD_DASH", category: "combat_sword", loop: false, duration: 0.55, label: "Dash Strike", baked: "sword/great sword slide attack" },
  { key: "shield_dash", clip: "SHIELD_DASH", category: "combat_shield", loop: false, duration: 0.55, label: "Shield Dash" },
  { key: "shield_bash", clip: "SHIELD_ONESHOT", category: "combat_shield", loop: false, duration: 0.6, label: "Shield Bash", baked: "sword_shield/sword and shield attack (3)" },
  { key: "idle_shield", clip: "IDLE_SHIELD", category: "combat_shield", loop: true, baked: "sword_shield/sword and shield idle" },
  { key: "dodge", clip: "DODGING", category: "combat", loop: false, duration: 0.5, label: "Dodge", baked: "locomotion/dodging" },
  { key: "aerial_evade", clip: "AERIAL_EVADE", category: "combat", loop: false, duration: 0.7, label: "Aerial Evade", baked: "uploads/action/Aerial_Evade" },
  { key: "hit_knockback", clip: "KNOCKBACK", category: "combat", loop: false, duration: 0.4, label: "Knockback", baked: "uploads/action/Aerial_Evade" },

  // ── Uploaded 2026-06 (real baked Bip001 assets) ──────────────────────────────
  // These carry a `baked` path: the asset exists on disk and is playable in the
  // /world anim test panel. The on-theme TPS subset is the dark-fantasy-safe set.
  { key: "sprint", clip: "RUNNING", category: "locomotion", loop: true, label: "Sprint", baked: "uploads_2026_06/locomotion/running" },
  { key: "sprint_start", clip: "CROUCHED_TO_SPRINTING", category: "locomotion", loop: false, duration: 0.63, label: "Sprint Start", baked: "uploads_2026_06/locomotion/crouched to sprinting" },
  { key: "descend_stairs", clip: "DESCENDING_STAIRS", category: "locomotion", loop: true, label: "Descend Stairs", baked: "uploads_2026_06/locomotion/descending stairs" },
  { key: "torch_run", clip: "TORCH_RUN_FORWARD", category: "locomotion", loop: true, label: "Torch Run", baked: "uploads_2026_06/locomotion/torch run forward" },
  { key: "torch_run_stop", clip: "TORCH_RUN_FORWARD_STOP", category: "locomotion", loop: false, duration: 1.73, label: "Torch Run Stop", baked: "uploads_2026_06/locomotion/torch run forward stop" },
  { key: "wall_run", clip: "WALL_RUN", category: "traversal", loop: true, label: "Wall Run", baked: "uploads_2026_06/traversal/wall run" },
  { key: "wall_climb", clip: "SPRINT_TO_WALL_CLIMB", category: "traversal", loop: false, duration: 1.8, label: "Wall Climb", baked: "uploads_2026_06/traversal/sprint to wall climb" },
  { key: "run_jump_attack", clip: "MELEE_RUN_JUMP_ATTACK", category: "combat", loop: false, duration: 3.67, label: "Run Jump Attack", baked: "uploads_2026_06/combat/melee run jump attack" },
  { key: "fishing_cast", clip: "FISHING_CAST", category: "survival", loop: false, duration: 8.77, label: "Fishing Cast", baked: "uploads_2026_06/survival/fishing cast" },
  { key: "fishing_idle", clip: "FISHING_IDLE", category: "survival", loop: true, label: "Fishing Idle", baked: "uploads_2026_06/survival/fishing idle" },

  // ── Venom (Marvel Rivals → Bip001 baked under venom/) ───────────────────────
  { key: "venom_idle", clip: "VENOM_IDLE", category: "idle_variant", loop: true, label: "Venom Idle", baked: "venom/idle" },
  { key: "venom_attack_a", clip: "VENOM_ATTACK_A", category: "combat_unarmed", loop: false, duration: 1.7, label: "Venom Lunge", baked: "venom/attack-01" },
  { key: "venom_attack_b", clip: "VENOM_ATTACK_B", category: "combat_unarmed", loop: false, duration: 1.5, label: "Venom Claws", baked: "venom/attack-02" },
  { key: "venom_attack_c", clip: "VENOM_ATTACK_C", category: "combat_unarmed", loop: false, duration: 2.2, label: "Venom Slam", baked: "venom/attack-03" },
  { key: "venom_tentacles_a", clip: "VENOM_TENTACLES_A", category: "combat_unarmed", loop: false, duration: 1.4, label: "Tentacles A", baked: "venom/tentacles-01" },
  { key: "venom_tentacles_b", clip: "VENOM_TENTACLES_B", category: "combat_unarmed", loop: false, duration: 1.4, label: "Tentacles B", baked: "venom/tentacles-02" },
  { key: "venom_dash_l", clip: "VENOM_DASH_L", category: "combat", loop: false, duration: 0.2, label: "Venom Dash L", baked: "venom/dash-left" },
  { key: "venom_dash_r", clip: "VENOM_DASH_R", category: "combat", loop: false, duration: 0.2, label: "Venom Dash R", baked: "venom/dash-right" },
  { key: "venom_symbiote", clip: "VENOM_SYMBIOTE", category: "combat", loop: false, duration: 1.5, label: "Symbiote Burst", baked: "venom/symbiote" },
  { key: "venom_devour_start", clip: "VENOM_DEVOUR_START", category: "combat", loop: false, duration: 0.5, label: "Devour Start", baked: "venom/devouring-start" },
  { key: "venom_devour_loop", clip: "VENOM_DEVOUR_LOOP", category: "combat", loop: true, label: "Devour Loop", baked: "venom/devouring-loop" },
  { key: "venom_wallrun", clip: "VENOM_WALLRUN", category: "traversal", loop: true, label: "Venom Wall Run", baked: "venom/wallrun" },
  { key: "venom_low_crawl", clip: "VENOM_LOW_CRAWL", category: "traversal", loop: true, label: "Low Crawl", baked: "venom/low-crawl" },
  { key: "venom_wall_hang", clip: "VENOM_WALL_HANG", category: "traversal", loop: true, label: "Wall Hang", baked: "venom/onwall-idle" },
  { key: "venom_knockout", clip: "VENOM_KNOCKOUT", category: "combat", loop: false, duration: 0.7, label: "Venom Knockout", baked: "venom/knockout-fall" },
  { key: "venom_hit_stagger", clip: "VENOM_STAGGER", category: "combat", loop: false, duration: 1.8, label: "Venom Stagger", baked: "venom/hit-stagger" },
  { key: "venom_jump_start", clip: "VENOM_JUMP_START", category: "locomotion", loop: false, duration: 0.4, label: "Venom Jump", baked: "venom/jump-start" },
  { key: "venom_jump_fall", clip: "VENOM_JUMP_FALL", category: "locomotion", loop: true, label: "Venom Airborne", baked: "venom/jump-fall" },
  { key: "venom_jump_land", clip: "VENOM_JUMP_LAND", category: "locomotion", loop: false, duration: 0.5, label: "Venom Land", baked: "venom/jump-land" },
  { key: "venom_run", clip: "VENOM_RUN", category: "locomotion", loop: true, label: "Venom Run", baked: "venom/run-forward" },
  { key: "venom_walk", clip: "VENOM_WALK", category: "locomotion", loop: true, label: "Venom Walk", baked: "venom/walk-forward" },
  { key: "venom_shackle", clip: "VENOM_SHACKLE", category: "combat", loop: false, duration: 1.2, label: "Shackle", baked: "venom/shackle" },
  { key: "venom_flight_start", clip: "VENOM_FLIGHT_START", category: "traversal", loop: false, duration: 0.6, label: "Symbiote Launch", baked: "venom/ground-flight-start" },
  { key: "venom_flight_loop", clip: "VENOM_FLIGHT_LOOP", category: "traversal", loop: true, label: "Symbiote Flight", baked: "venom/ground-flight-loop" },
  { key: "marvel_stealth", clip: "MARVEL_STEALTH", category: "traversal", loop: true, label: "Stealth Crawl", baked: "marvel/stealth-loop" },

  // ── Marvel Rivals (shared knockdown / locomotion — Bip001 under marvel/) ────
  { key: "marvel_idle", clip: "MARVEL_IDLE", category: "idle_variant", loop: true, label: "Hero Idle", baked: "marvel/idle-hero" },
  { key: "marvel_knockout", clip: "MARVEL_KNOCKOUT", category: "combat", loop: false, duration: 0.7, label: "Knockout Fall", baked: "marvel/knockout-fall" },
  { key: "marvel_knockout_float", clip: "MARVEL_KNOCKOUT_FLOAT", category: "combat", loop: true, label: "Knockout Float", baked: "marvel/knockout-float" },
  { key: "marvel_jump_start", clip: "MARVEL_JUMP_START", category: "locomotion", loop: false, duration: 0.4, label: "Jump Start", baked: "marvel/jump-start" },
  { key: "marvel_jump_fall", clip: "MARVEL_JUMP_FALL", category: "locomotion", loop: true, label: "Jump Fall", baked: "marvel/jump-fall" },
  { key: "marvel_jump_land", clip: "MARVEL_JUMP_LAND", category: "locomotion", loop: false, duration: 0.5, label: "Jump Land", baked: "marvel/jump-land" },
  { key: "marvel_hit_stagger", clip: "MARVEL_STAGGER", category: "combat", loop: false, duration: 1.8, label: "Hit Stagger", baked: "marvel/giddiness" },
  { key: "marvel_melee", clip: "MARVEL_MELEE", category: "combat_unarmed", loop: false, duration: 1.2, label: "Melee Attack", baked: "marvel/melee-attack" },
  { key: "marvel_run", clip: "MARVEL_RUN", category: "locomotion", loop: true, label: "Marvel Run", baked: "marvel/run-forward" },
  { key: "marvel_walk", clip: "MARVEL_WALK", category: "locomotion", loop: true, label: "Marvel Walk", baked: "marvel/walk-forward" },
];

export const ANIM_BY_KEY: Record<string, AnimClipDef> = Object.fromEntries(
  ANIM_LIBRARY.map((a) => [a.key, a]),
);

export function animsByCategory(cat: AnimCategory): AnimClipDef[] {
  return ANIM_LIBRARY.filter((a) => a.category === cat);
}

/** Catalog entries that have a real baked asset on disk (playable / previewable). */
export const ANIM_LIBRARY_BAKED: AnimClipDef[] = ANIM_LIBRARY.filter((a) => !!a.baked);

// Weapon → default light-attack anim key (combo chains resolve at runtime).
export const WEAPON_ATTACK_ANIM: Record<string, string> = {
  sword: "sword_attack_a",
  dagger: "sword_attack_a",
  axe: "sword_attack_c",
  hammer: "sword_attack_c",
  mace: "sword_attack_c",
  spear: "sword_attack_b",
  staff: "magic_cast",
  bow: "bow_shot",
  shield: "shield_bash",
  pick: "mine",
  fishing: "fishing_cast",
  other: "venom_attack_a",
};
