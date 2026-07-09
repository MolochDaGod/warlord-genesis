import * as THREE from "three";
import type { Faction, ProjectileModel, StructureKind, UnitDef } from "./config";
import type { UnitSkillId } from "./productionSpecs";
import { ALLY_TECH, PROJECTILES, RELIC, STRUCT, TREE, UNIT_TYPES } from "./config";
import { resolveUnitDef } from "../engine/grudge6";
import { generateMap, randomSeed, type GameMap, type MapSize } from "./mapgen";
import { spawnMapCamps, type NeutralCampState } from "./neutralCamps";

/** Order the player can issue to selected commandable units. */
export type OrderKind = "idle" | "move" | "attackMove" | "hold" | "stop";

export interface UnitEntity {
  id: number;
  faction: Faction;
  def: UnitDef;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  attackTimer: number;
  hitFlash: number;
  swing: number; // 0..1 attack animation impulse
  alive: boolean;
  bob: number;
  /** Remaining seconds of the active slow status (0 = not slowed). */
  slowTimer: number;
  /** Movement speed multiplier while slowed (1 = full speed). */
  slowFactor: number;
  /** Whether the player can select & command this unit (summoned allies only). */
  commandable: boolean;
  /** Multiplier on this unit's outgoing attack damage (difficulty scaling; 1 = base). */
  dmgMult: number;
  /**
   * True for the enemy warlord: it lives in `units` so all faction-aware
   * targeting/combat applies, but EnemyHero.tsx owns its movement / attacks /
   * rendering, so Units.tsx skips it in every simulation + render pass.
   */
  isHero: boolean;
  /** GRUDGE6 lane guard champion — Bip001 viewer hero, not a KayKit creep mob. */
  isLaneGuard: boolean;
  // Order state.
  order: OrderKind;
  dest: THREE.Vector3 | null;
  anchor: THREE.Vector3;
  targetId: number | null;
  /** Seconds the unit has wanted to move but made ~no progress (deadlock detect). */
  stuck: number;
  /** Seconds a lane creep has been staging outside tower range (wave-grouping AI). */
  stageTimer: number;
  // Lane creeps: which lane and how far along the path.
  lane: number;
  wp: number; // current waypoint index along its lane direction
  // Grid pathfinding for commandable move orders (A* waypoints + cursor).
  path: { x: number; z: number }[] | null;
  pathIdx: number;
  /** Identifies which dest the current `path` was computed for. */
  pathFor: THREE.Vector3 | null;
  /** Production specialization label (Paladin, Frost Mage, …). */
  specLabel?: string;
  /** Active skills granted by production upgrades. */
  skills: UnitSkillId[];
  /** Per-skill cooldown timers (seconds until ready). */
  skillCd: Partial<Record<UnitSkillId, number>>;
  /** Runtime stat multipliers from specialization. */
  specSpeedMult: number;
  specRangeMult: number;
  specAttackRateMult: number;
  /** Locomotion hint for the skinned mesh (idle / run / attack). */
  locomotion: "idle" | "run" | "attack";
  /** Neutral jungle camp this defender belongs to (neutral faction only). */
  campId?: number;
}

export interface StructureEntity {
  id: number;
  faction: Faction;
  kind: StructureKind;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  fireRate: number;
  fireTimer: number;
  yaw: number;
  muzzleFlash: number;
  hitFlash: number;
  alive: boolean;
  /** Lane this structure belongs to (-1 for cores / player-built defences). */
  lane: number;
  /** Objective-ladder tier for lane towers; null for cores / built defences. */
  tier: "outer" | "inner" | null;
  /** Seconds remaining on the "under attack" flag (drives reactive AI defence). */
  underAttack: number;
}

export interface Tracer {
  id: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  color: string;
}

export interface SpitProjectile {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
}

export interface Spark {
  id: number;
  pos: THREE.Vector3;
  life: number;
  color: string;
}

export interface MuzzleFlash {
  id: number;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  /** Optional tint — turret/cannon flashes use warmer or arcane hues. */
  color?: string;
}

export interface FireBolt {
  id: number;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  dist: number;
  traveled: number;
  speed: number;
}

/**
 * Flying shell mesh — travels muzzle->impact for a ranged shot. Light shells
 * (arrows / ballista) are visual only (damage was dealt hitscan at fire time).
 * Heavy shells carry a `splash` profile + `faction`: when they land they spawn
 * an explosion that deals area damage (and optional slow) at impact.
 */
export interface Projectile {
  id: number;
  model: ProjectileModel;
  pos: THREE.Vector3;
  from: THREE.Vector3;
  to: THREE.Vector3;
  dir: THREE.Vector3;
  dist: number;
  traveled: number;
  speed: number;
  spin: number;
  roll: number;
  /** Owning faction for impact AoE (null = visual-only shell). */
  faction: Faction | null;
  /** Explosion profile applied at impact, or null for single-target shells. */
  splash: { radius: number; damage: number; slow?: { factor: number; duration: number } } | null;
  /** Parabolic lob peak height (0 = straight tracer). */
  arc: number;
}

export interface SmokePuff {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export interface Ember {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  color: string;
}

/** Additive flame puff — spawned at damage hits and from burning structures. */
export interface FireParticle {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

/** Travelling melee projectile (a crescent slash that cuts a moving band). */
export interface SlashWave {
  id: number;
  origin: THREE.Vector3;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  traveled: number;
  range: number;
  speed: number;
  width: number;
  damage: number;
  color: string;
  faction: Faction;
  hit: Set<number>;
  spawnShock: boolean;
  shockRadius: number;
  shockDamage: number;
  shockDuration: number;
}

/** Expanding ground ring that deals area damage as its front passes. */
export interface Shockwave {
  id: number;
  pos: THREE.Vector3;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  damage: number;
  color: string;
  faction: Faction;
  hit: Set<number>;
  /** Optional movement slow applied to enemy units the wave catches. */
  slow?: { factor: number; duration: number };
}

/** Floating combat text (damage / heal numbers) that rises and fades. */
export interface FloatText {
  id: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  scale: number;
}

/** World-space waypoints per lane (ally->enemy direction). */
export interface LanePath {
  id: number;
  pts: THREE.Vector3[];
}

/** Neutral, destructible tree: blocks pathing + the hero, choppable to 0 HP. */
export interface TreeEntity {
  id: number;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  radius: number;
  scale: number;
  rot: number;
  hitFlash: number;
  alive: boolean;
}

/** The two lane towers for one faction in one lane (the objective ladder). */
export interface LaneGate {
  outer: StructureEntity | null;
  inner: StructureEntity | null;
}

/** Recurring neutral relic objective state (see RELIC config + Relic.tsx). */
export interface RelicState {
  /** "dormant"/"cooldown" = not yet risen; "active" = capturable now. */
  phase: "dormant" | "active" | "cooldown";
  pos: THREE.Vector3;
  /** Dormant/cooldown: seconds until it rises. Active: seconds until it withers. */
  timer: number;
  /** Capture accrual 0..1 toward a claim. */
  progress: number;
  /** Faction currently accruing capture (null = uncontested/empty). */
  capturer: Faction | null;
  /** Faction that last claimed it (for HUD attribution). */
  owner: Faction | null;
}

/** Faction-level reactive AI macro state, driven by MatchDirector. */
export interface AIState {
  /** Banked credits the AI spends on reactive reinforcement. */
  treasury: number;
  /** Lane (0-2) the AI is concentrating on, or -1 for none. */
  focusLane: number;
  /** Enemy structure the AI is actively defending (player attacking it), or null. */
  defendStructureId: number | null;
  /** Counts down before the AI commits to a freshly-observed threat. */
  reactionTimer: number;
  /** Cooldown before the next reactive push spend. */
  pushTimer: number;
}

/** Authoritative per-match systems state (pacing, gating, economy, AI). */
export interface MatchState {
  /** Seconds elapsed since the battle began. */
  clock: number;
  /** Lane-tower references per faction (index = lane id). */
  gate: { ally: LaneGate[]; enemy: LaneGate[] };
  /** Winning-side creep escalation per lane (gained when the FOE loses a tower there). */
  momentum: { ally: number[]; enemy: number[] };
  /** Timed army-wide damage buff per faction (mult applies while timer > 0). */
  buff: { ally: { mult: number; timer: number }; enemy: { mult: number; timer: number } };
  /** Ally tech tiers purchased (0 = none). */
  allyTech: number;
  /** Trailing-side catch-up income/bounty multiplier per faction (>= 1). */
  comeback: { ally: number; enemy: number };
  relic: RelicState;
  ai: AIState;
  /** Neutral jungle camps on this battlefield. */
  camps: NeutralCampState[];
}

function freshMatchState(): MatchState {
  return {
    clock: 0,
    gate: {
      ally: [emptyGate(), emptyGate(), emptyGate()],
      enemy: [emptyGate(), emptyGate(), emptyGate()],
    },
    momentum: { ally: [0, 0, 0], enemy: [0, 0, 0] },
    buff: { ally: { mult: 1, timer: 0 }, enemy: { mult: 1, timer: 0 } },
    allyTech: 0,
    comeback: { ally: 1, enemy: 1 },
    relic: {
      phase: "dormant",
      pos: new THREE.Vector3(0, 0, 0),
      timer: RELIC.firstDelay,
      progress: 0,
      capturer: null,
      owner: null,
    },
    ai: { treasury: 0, focusLane: -1, defendStructureId: null, reactionTimer: 0, pushTimer: 0 },
    camps: [],
  };
}

function emptyGate(): LaneGate {
  return { outer: null, inner: null };
}

class EntityManager {
  units: UnitEntity[] = [];
  structures: StructureEntity[] = [];
  tracers: Tracer[] = [];
  sparks: Spark[] = [];
  spits: SpitProjectile[] = [];
  muzzleFlashes: MuzzleFlash[] = [];
  bolts: FireBolt[] = [];
  projectiles: Projectile[] = [];
  smoke: SmokePuff[] = [];
  embers: Ember[] = [];
  fires: FireParticle[] = [];
  slashes: SlashWave[] = [];
  shocks: Shockwave[] = [];
  floats: FloatText[] = [];
  trees: TreeEntity[] = [];

  lanes: LanePath[] = [];

  /** Active procedural battlefield (regenerated each match). */
  map: GameMap = generateMap(1, "standard");

  playerPos = new THREE.Vector3(0, 1.7, this.map.heroSpawn.z);
  /** True while the hero raises a shield guard (sword & shield RMB block). */
  heroBlocking = false;
  /** Cached core handles for quick HP mirroring + win/lose checks. */
  allyCore: StructureEntity | null = null;
  enemyCore: StructureEntity | null = null;

  /** Authoritative per-match systems state (pacing, gating, economy, AI). */
  match: MatchState = freshMatchState();

  /**
   * Imperative camera-shake magnitude in world units. Combat events bump it via
   * `addShake`; the hero's frame loop jitters the camera by it and decays it.
   * Lives here (not the reactive store) so it never triggers React re-renders.
   */
  shake = 0;

  /**
   * Dynamic obstacle mask over the map's spatial grid: a per-cell reference count
   * of how many runtime obstacles (e.g. trees) occupy that cell. Counting (rather
   * than a binary flag) means clearing one obstacle never unblocks a cell that an
   * overlapping neighbour still occupies. The terrain-walkable mask lives on
   * `map.grid`; combine them via `passable()`. Re-sized to the grid on every reset.
   */
  blocked = new Uint16Array(0);

  private nextId = 1;

  /** Terrain surface height at a world XZ (for grounding entities + the hero). */
  groundY(x: number, z: number): number {
    return this.map.heightAt(x, z);
  }

  /** True if a runtime obstacle occupies the cell containing this world point. */
  isBlocked(x: number, z: number): boolean {
    const g = this.map.grid;
    const c = g.cellX(x);
    const r = g.cellZ(z);
    if (!g.inBounds(c, r)) return false;
    return this.blocked[g.idx(c, r)] > 0;
  }

  /** Terrain-walkable AND not occupied by a runtime obstacle. */
  passable(x: number, z: number): boolean {
    return this.map.grid.isWalkableWorld(x, z) && !this.isBlocked(x, z);
  }

  /**
   * Add (`on`) or remove (`!on`) one obstacle's footprint over every cell whose
   * centre falls within `radius` of (x,z), adjusting the per-cell reference count.
   * Removal clamps at 0 so overlapping obstacles never drive a cell negative.
   */
  setBlockedCircle(x: number, z: number, radius: number, on: boolean): void {
    const g = this.map.grid;
    const cc = g.cellX(x);
    const cr = g.cellZ(z);
    const rad = Math.ceil(radius / g.cell);
    const r2 = radius * radius;
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const ni = cc + dc;
        const nj = cr + dr;
        if (!g.inBounds(ni, nj)) continue;
        const wx = g.worldX(ni);
        const wz = g.worldZ(nj);
        const ddx = wx - x;
        const ddz = wz - z;
        if (ddx * ddx + ddz * ddz > r2) continue;
        const id = g.idx(ni, nj);
        if (on) this.blocked[id]++;
        else if (this.blocked[id] > 0) this.blocked[id]--;
      }
    }
  }

  id() {
    return this.nextId++;
  }

  /** Bump the camera-shake magnitude (capped); decayed in the hero frame loop. */
  addShake(amount: number, cap = 0.45) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.shake = Math.max(0, Math.min(cap, this.shake + amount));
  }

  /**
   * Rebuild the world. Pass a freshly-generated `map` to start a new match on a
   * new layout; omit it to regenerate a default map (used at module load).
   */
  reset(map?: GameMap) {
    this.units = [];
    this.structures = [];
    this.tracers = [];
    this.sparks = [];
    this.spits = [];
    this.muzzleFlashes = [];
    this.bolts = [];
    this.projectiles = [];
    this.smoke = [];
    this.embers = [];
    this.fires = [];
    this.slashes = [];
    this.shocks = [];
    this.floats = [];
    this.trees = [];
    this.nextId = 1;
    this.shake = 0;
    this.allyCore = null;
    this.enemyCore = null;
    this.match = freshMatchState();
    this.map = map ?? generateMap(randomSeed(), "standard");
    // Size the dynamic-obstacle (tree) mask to the new map's grid.
    this.blocked = new Uint16Array(this.map.grid.cols * this.map.grid.rows);
    this.lanes = this.map.lanes.map((l) => ({
      id: l.id,
      pts: l.pts.map((p) => p.clone()),
    }));
    this.playerPos.set(this.map.heroSpawn.x, 1.7, this.map.heroSpawn.z);
    this.buildBattlefield();
  }

  /** Convenience: generate a new map for `size`/`seed`, then reset onto it. */
  newMatch(size: MapSize, seed = randomSeed()): GameMap {
    this.reset(generateMap(seed, size));
    return this.map;
  }

  /** Place both Citadels and the per-lane defensive towers on the generated map. */
  private buildBattlefield() {
    const m = this.map;
    this.allyCore = this.addStructure("ally", "core", m.allyCore.x, m.allyCore.z);
    this.enemyCore = this.addStructure("enemy", "core", m.enemyCore.x, m.enemyCore.z);
    for (const t of m.towers) {
      const s = this.addStructure(t.faction, "tower", t.x, t.z, { lane: t.lane, tier: t.tier });
      // Record the objective-ladder references for O(1) gating + AI lookups.
      if (t.faction === "ally" || t.faction === "enemy") {
        const gate = this.match.gate[t.faction][t.lane];
        if (gate) gate[t.tier] = s;
      }
    }
    // Park the relic at the walkable centre of the map for the mid-game objective.
    const rc = m.grid.nearestWalkable(0, 0);
    this.match.relic.pos.set(rc.x, this.groundY(rc.x, rc.z), rc.z);
    // Materialise destructible trees from the map's scatter and stamp their
    // footprints into the dynamic obstacle mask so units route around them.
    for (const sp of this.map.trees) {
      const ent: TreeEntity = {
        id: this.id(),
        pos: new THREE.Vector3(sp.x, this.groundY(sp.x, sp.z), sp.z),
        hp: TREE.hp,
        maxHp: TREE.hp,
        radius: TREE.radius * sp.scale,
        scale: sp.scale,
        rot: sp.rot,
        hitFlash: 0,
        alive: true,
      };
      this.trees.push(ent);
      this.setBlockedCircle(sp.x, sp.z, TREE.blockRadius * sp.scale, true);
    }
    spawnMapCamps(this.map.camps);
  }

  /** Apply damage to a tree; on death clear its footprint and spawn debris. */
  damageTree(t: TreeEntity, dmg: number): void {
    if (!t.alive) return;
    t.hp -= dmg;
    t.hitFlash = 0.12;
    this.addFloatText(t.pos.x, t.pos.y + 3.2 * t.scale, t.pos.z, String(Math.max(1, Math.round(dmg))), "#cdeac0");
    if (t.hp > 0) {
      this.addEmber(t.pos.clone().setY(t.pos.y + 1.6 * t.scale), "#7a5a3a");
      return;
    }
    t.alive = false;
    this.setBlockedCircle(t.pos.x, t.pos.z, TREE.blockRadius * t.scale, false);
    this.addSmoke(t.pos.clone().setY(t.pos.y + 0.6), 0.9 * t.scale);
    for (let k = 0; k < 7; k++) {
      this.addEmber(t.pos.clone().setY(t.pos.y + 1.2 * t.scale), Math.random() > 0.5 ? "#6b4a2e" : "#3f6b39");
    }
  }

  addStructure(
    faction: Faction,
    kind: StructureKind,
    x: number,
    z: number,
    opts: { lane?: number; tier?: "outer" | "inner" | null } = {},
  ): StructureEntity {
    const s = STRUCT[kind];
    const ent: StructureEntity = {
      id: this.id(),
      faction,
      kind,
      pos: new THREE.Vector3(x, this.map.heightAt(x, z), z),
      hp: s.hp,
      maxHp: s.hp,
      range: s.range,
      damage: s.damage,
      fireRate: s.fireRate,
      fireTimer: Math.random() * 0.4,
      yaw: 0,
      muzzleFlash: 0,
      hitFlash: 0,
      alive: true,
      lane: opts.lane ?? -1,
      tier: opts.tier ?? null,
      underAttack: 0,
    };
    this.structures.push(ent);
    return ent;
  }

  spawnUnit(
    faction: Faction,
    typeId: string,
    x: number,
    z: number,
    opts: {
      commandable?: boolean;
      lane?: number;
      /** Scales max HP at spawn (difficulty scaling; default 1). */
      hpMult?: number;
      /** Scales outgoing attack damage (difficulty scaling; default 1). */
      dmgMult?: number;
      /** Marks this as the enemy warlord (EnemyHero.tsx owns its sim/render). */
      isHero?: boolean;
      /** Deployed lane guard (GRUDGE6 Bip001 hero); creeps stay on KayKit faction mobs. */
      isLaneGuard?: boolean;
      specLabel?: string;
      skills?: UnitSkillId[];
      specSpeedMult?: number;
      specRangeMult?: number;
      specAttackRateMult?: number;
      campId?: number;
    } = {},
  ): UnitEntity {
    const def = UNIT_TYPES[typeId] ?? resolveUnitDef(typeId);
    if (!def) throw new Error(`Unknown unit type: ${typeId}`);
    const speedMult = opts.specSpeedMult ?? 1;
    const rangeMult = opts.specRangeMult ?? 1;
    const rateMult = opts.specAttackRateMult ?? 1;
    const maxHp = Math.round(def.hp * (opts.hpMult ?? 1));
    const ent: UnitEntity = {
      id: this.id(),
      faction,
      def,
      hp: maxHp,
      maxHp,
      pos: new THREE.Vector3(x, 0, z),
      vel: new THREE.Vector3(),
      yaw: faction === "ally" ? Math.PI : faction === "enemy" ? 0 : Math.random() * Math.PI * 2,
      attackTimer: 0,
      hitFlash: 0,
      swing: 0,
      alive: true,
      bob: Math.random() * Math.PI * 2,
      slowTimer: 0,
      slowFactor: 1,
      commandable: opts.commandable ?? false,
      dmgMult: opts.dmgMult ?? 1,
      isHero: opts.isHero ?? false,
      isLaneGuard: opts.isLaneGuard ?? false,
      order: "idle",
      dest: null,
      anchor: new THREE.Vector3(x, 0, z),
      targetId: null,
      stuck: 0,
      stageTimer: 0,
      lane: opts.lane ?? 1,
      wp: 0,
      path: null,
      pathIdx: 0,
      pathFor: null,
      specLabel: opts.specLabel,
      skills: opts.skills ?? [],
      skillCd: {},
      specSpeedMult: speedMult,
      specRangeMult: rangeMult,
      specAttackRateMult: rateMult,
      locomotion: "idle",
      campId: opts.campId,
    };
    this.units.push(ent);
    return ent;
  }

  addTracer(from: THREE.Vector3, to: THREE.Vector3, color = "#ffd166") {
    this.tracers.push({ id: this.id(), from: from.clone(), to: to.clone(), life: 0.08, color });
  }

  addSpark(pos: THREE.Vector3, color = "#ffb02e") {
    this.sparks.push({ id: this.id(), pos: pos.clone(), life: 0.35, color });
  }

  addMuzzleFlash(pos: THREE.Vector3, opts?: { color?: string; size?: number }) {
    this.muzzleFlashes.push({
      id: this.id(),
      pos: pos.clone(),
      life: 0.06,
      maxLife: 0.06,
      size: (opts?.size ?? 0.55) + Math.random() * 0.2,
      rot: Math.random() * Math.PI,
      color: opts?.color,
    });
  }

  addBolt(from: THREE.Vector3, to: THREE.Vector3, speed = 90) {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 1e-3) return;
    dir.normalize();
    this.bolts.push({
      id: this.id(),
      pos: from.clone(),
      dir,
      from: from.clone(),
      to: to.clone(),
      dist,
      traveled: 0,
      speed,
    });
  }

  /**
   * Spawn a flying shell. Light shells stay visual-only. If the shell's def has
   * a `splash` profile AND an owning `faction` is supplied, the shell carries
   * that profile so it explodes (area damage + optional slow) at impact; the
   * attacker may override the splash damage with its own via `splashDamage`.
   */
  addProjectile(
    model: ProjectileModel,
    from: THREE.Vector3,
    to: THREE.Vector3,
    opts: {
      faction?: Faction;
      splashDamage?: number;
      splashRadius?: number;
      arc?: number;
    } = {},
  ) {
    const def = PROJECTILES[model];
    const dir = to.clone().sub(from);
    const dist = dir.length();
    if (dist < 1e-3) return;
    dir.normalize();
    const splash =
      def.splash && opts.faction
        ? {
            radius: opts.splashRadius ?? def.splash.radius,
            damage: opts.splashDamage ?? def.splash.damage,
            slow: def.splash.slow,
          }
        : null;
    this.projectiles.push({
      id: this.id(),
      model,
      pos: from.clone(),
      from: from.clone(),
      to: to.clone(),
      dir,
      dist,
      traveled: 0,
      speed: def.speed,
      spin: def.spin,
      roll: 0,
      faction: opts.faction ?? null,
      splash,
      arc: opts.arc ?? 0,
    });
  }

  addSmoke(pos: THREE.Vector3, size = 0.5, vel?: THREE.Vector3) {
    this.smoke.push({
      id: this.id(),
      pos: pos.clone(),
      vel: vel ? vel.clone() : new THREE.Vector3(0, 0.6, 0),
      life: 0.7 + Math.random() * 0.4,
      maxLife: 1.1,
      size,
    });
  }

  addEmber(pos: THREE.Vector3, color = "#ffb74d", vel?: THREE.Vector3) {
    this.embers.push({
      id: this.id(),
      pos: pos.clone(),
      vel:
        vel ??
        new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4,
        ),
      life: 0.3 + Math.random() * 0.25,
      maxLife: 0.55,
      color,
    });
  }

  addImpact(pos: THREE.Vector3) {
    for (let i = 0; i < 6; i++) {
      this.addEmber(pos, Math.random() > 0.5 ? "#ffd166" : "#ff7733");
    }
    this.addSmoke(pos, 0.35);
  }

  /** One additive flame puff that rises, drifts and fades. Array is bounded so
   * sustained fire never grows the pool without limit. */
  addFire(pos: THREE.Vector3, color = "#ff7a1a", size = 0.5) {
    if (this.fires.length > 220) this.fires.shift();
    const life = 0.4 + Math.random() * 0.3;
    this.fires.push({
      id: this.id(),
      pos: pos.clone(),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.9,
        1.1 + Math.random() * 1.1,
        (Math.random() - 0.5) * 0.9,
      ),
      life,
      maxLife: life,
      size: size * (0.7 + Math.random() * 0.6),
      color,
    });
  }

  /** Short flame burst (several puffs) used at damage impacts. */
  addFireBurst(pos: THREE.Vector3, color = "#ff7a1a", count = 3, size = 0.5) {
    for (let i = 0; i < count; i++) this.addFire(pos, color, size);
  }

  addSlashWave(opts: {
    origin: THREE.Vector3;
    dir: THREE.Vector3;
    range: number;
    speed: number;
    width: number;
    damage: number;
    color: string;
    faction: Faction;
    spawnShock: boolean;
    shockRadius: number;
    shockDamage: number;
    shockDuration: number;
  }) {
    this.slashes.push({
      id: this.id(),
      origin: opts.origin.clone(),
      pos: opts.origin.clone(),
      dir: opts.dir.clone().normalize(),
      traveled: 0,
      range: opts.range,
      speed: opts.speed,
      width: opts.width,
      damage: opts.damage,
      color: opts.color,
      faction: opts.faction,
      hit: new Set<number>(),
      spawnShock: opts.spawnShock,
      shockRadius: opts.shockRadius,
      shockDamage: opts.shockDamage,
      shockDuration: opts.shockDuration,
    });
  }

  /**
   * Spawn a floating combat number (damage / heal) that rises and fades.
   * Capped so sustained three-lane fighting never grows the pool unbounded.
   */
  addFloatText(x: number, y: number, z: number, text: string, color: string, big = false) {
    if (this.floats.length >= 32) this.floats.shift();
    this.floats.push({
      id: this.id(),
      pos: new THREE.Vector3(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6),
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, big ? 3 : 2.4, (Math.random() - 0.5) * 0.8),
      life: big ? 1.1 : 0.85,
      maxLife: big ? 1.1 : 0.85,
      text,
      color,
      scale: big ? 1.5 : 1,
    });
  }

  addShockwave(opts: {
    pos: THREE.Vector3;
    maxRadius: number;
    duration: number;
    damage: number;
    color: string;
    faction: Faction;
    slow?: { factor: number; duration: number };
  }) {
    this.shocks.push({
      id: this.id(),
      pos: opts.pos.clone(),
      radius: 0,
      maxRadius: opts.maxRadius,
      life: opts.duration,
      maxLife: opts.duration,
      damage: opts.damage,
      color: opts.color,
      faction: opts.faction,
      hit: new Set<number>(),
      slow: opts.slow,
    });
  }

  /**
   * Apply (or refresh) a movement slow on a unit. The strongest factor wins and
   * the timer is extended to the longest remaining duration so overlapping
   * pulses stack sensibly. `updateUnitSlow` decays it each frame.
   */
  slowUnit(u: UnitEntity, factor: number, duration: number) {
    if (u.slowTimer <= 0) u.slowFactor = factor;
    else u.slowFactor = Math.min(u.slowFactor, factor);
    u.slowTimer = Math.max(u.slowTimer, duration);
  }

  /** Permanent ally-army outgoing-damage multiplier from purchased tech (1 = none). */
  allyTechDmgMult(): number {
    const t = this.match.allyTech;
    return t > 0 ? ALLY_TECH[t - 1].dmgMult : 1;
  }

  /** Permanent ally-army spawn-HP multiplier from purchased tech (1 = none). */
  allyTechHpMult(): number {
    const t = this.match.allyTech;
    return t > 0 ? ALLY_TECH[t - 1].hpMult : 1;
  }

  /**
   * Live faction-wide outgoing-damage multiplier: the timed relic buff times the
   * ally's permanent tech bonus. Read at every attack site so tech + relic buffs
   * apply army-wide (units, structures, warlord, hero) without per-entity state.
   */
  factionDmgMult(faction: Faction): number {
    if (faction === "neutral") return 1;
    const b = this.match.buff[faction];
    const buffMult = b.timer > 0 ? b.mult : 1;
    return buffMult * (faction === "ally" ? this.allyTechDmgMult() : 1);
  }
}

export const EM = new EntityManager();
