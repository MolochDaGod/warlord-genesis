// Authoritative, deterministic MOBA/RTS simulation. The server owns an instance
// and ticks it at a fixed rate; the same code (map + kinematics) is imported by
// clients for terrain rendering and local hero-movement prediction. Everything
// derives from the seed + tick count — no wall clock, no Math.random.

import {
  DT,
  ECONOMY,
  STRUCT_DEFS,
  UNIT_DEFS,
  type SimStructDef,
  type SimUnitDef,
  type StructKey,
  type UnitKey,
} from "./config";
import { mulberry32, type Rng } from "./rng";
import { dist, dist2 } from "./vec";
import { generateMap, type SimMap } from "./map";
import type {
  Intent,
  MatchPhase,
  NetPlayer,
  NetStruct,
  NetUnit,
  Snapshot,
  Team,
  GameMode,
} from "./types";

type Order = "idle" | "move" | "attackMove" | "lanePush";

interface SimUnit {
  id: number;
  team: Team;
  key: UnitKey;
  def: SimUnitDef;
  hp: number;
  mhp: number;
  x: number;
  z: number;
  yaw: number;
  ownerSlot: number;
  isHero: boolean;
  lane: number;
  order: Order;
  destX: number;
  destZ: number;
  targetId: number;
  cd: number;
  attacking: number;
  lastHitBy: number;
  alive: boolean;
}

interface SimStruct {
  id: number;
  team: Team;
  key: StructKey;
  def: SimStructDef;
  hp: number;
  mhp: number;
  x: number;
  z: number;
  cd: number;
  alive: boolean;
}

interface SimPlayer {
  slot: number;
  team: Team;
  name: string;
  credits: number;
  heroId: number;
  alive: boolean;
  respawn: number;
  connected: boolean;
  bot: boolean;
  kills: number;
  rallyLane: number;
  summonCount: number;
  pending: Intent[];
  botTimer: number;
}

export interface PlayerDef {
  slot: number;
  team: Team;
  name: string;
  bot?: boolean;
}

export class Sim {
  readonly map: SimMap;
  readonly mode: GameMode;
  readonly seed: number;
  private rng: Rng;
  tick = 0;
  phase: MatchPhase = "playing";
  winner: Team | null = null;
  private nextId = 1;
  players: SimPlayer[] = [];
  private units: SimUnit[] = [];
  private structs: SimStruct[] = [];
  private waveTimer = 0;
  private incomeAcc = 0;

  constructor(seed: number, mode: GameMode, defs: PlayerDef[]) {
    this.seed = seed >>> 0;
    this.mode = mode;
    this.rng = mulberry32(this.seed ^ 0x9e3779b9);
    this.map = generateMap(this.seed, mode);

    for (const d of defs) {
      this.players.push({
        slot: d.slot,
        team: d.team,
        name: d.name,
        credits: ECONOMY.startCredits,
        heroId: -1,
        alive: false,
        respawn: 0,
        connected: true,
        bot: !!d.bot,
        kills: 0,
        rallyLane: 1,
        summonCount: 0,
        pending: [],
        botTimer: 0,
      });
    }

    // Cores + towers per team.
    for (const team of [0, 1] as Team[]) {
      const core = this.map.cores[team];
      this.addStruct(team, "core", core.x, core.z);
      for (const tw of this.map.towers[team]) {
        this.addStruct(team, "tower", tw.x, tw.z);
      }
    }

    // Spawn each player's hero at their team base.
    for (const p of this.players) this.spawnHero(p);
  }

  // --- construction helpers ---

  private addStruct(team: Team, key: StructKey, x: number, z: number) {
    const def = STRUCT_DEFS[key];
    this.structs.push({
      id: this.nextId++,
      team,
      key,
      def,
      hp: def.hp,
      mhp: def.hp,
      x,
      z,
      cd: 0,
      alive: true,
    });
  }

  private spawnHero(p: SimPlayer) {
    const s = this.map.heroSpawn[p.team];
    const def = UNIT_DEFS.hero;
    // Fan heroes out a little so 2v2 teammates don't overlap at spawn.
    const off = p.slot % 2 === 0 ? -2.5 : 2.5;
    const u: SimUnit = {
      id: this.nextId++,
      team: p.team,
      key: "hero",
      def,
      hp: def.hp,
      mhp: def.hp,
      x: s.x + off,
      z: s.z,
      yaw: p.team === 0 ? 0 : Math.PI,
      ownerSlot: p.slot,
      isHero: true,
      lane: 1,
      order: "idle",
      destX: s.x + off,
      destZ: s.z,
      targetId: -1,
      cd: 0,
      attacking: 0,
      lastHitBy: -1,
      alive: true,
    };
    this.units.push(u);
    p.heroId = u.id;
    p.alive = true;
    p.respawn = 0;
  }

  private spawnUnit(
    team: Team,
    key: UnitKey,
    x: number,
    z: number,
    lane: number,
    ownerSlot: number,
  ): SimUnit {
    const def = UNIT_DEFS[key];
    const u: SimUnit = {
      id: this.nextId++,
      team,
      key,
      def,
      hp: def.hp,
      mhp: def.hp,
      x,
      z,
      yaw: team === 0 ? 0 : Math.PI,
      ownerSlot,
      isHero: false,
      lane,
      order: "lanePush",
      destX: x,
      destZ: z,
      targetId: -1,
      cd: 0,
      attacking: 0,
      lastHitBy: -1,
      alive: true,
    };
    this.units.push(u);
    return u;
  }

  // --- external control ---

  pushIntent(slot: number, intent: Intent) {
    const p = this.players.find((q) => q.slot === slot);
    if (p) p.pending.push(intent);
  }

  setConnected(slot: number, connected: boolean) {
    const p = this.players.find((q) => q.slot === slot);
    if (!p) return;
    p.connected = connected;
    // A disconnected player's warlord is taken over by the AI (bot fill).
    if (!connected) p.bot = true;
  }

  teamHasConnectedHuman(team: Team): boolean {
    return this.players.some((p) => p.team === team && p.connected);
  }

  forceWin(team: Team) {
    if (this.phase === "ended") return;
    this.phase = "ended";
    this.winner = team;
  }

  private findPlayer(slot: number): SimPlayer | undefined {
    return this.players.find((p) => p.slot === slot);
  }

  private getUnit(id: number): SimUnit | undefined {
    return this.units.find((u) => u.id === id && u.alive);
  }

  private hero(p: SimPlayer): SimUnit | undefined {
    return p.heroId >= 0 ? this.getUnit(p.heroId) : undefined;
  }

  // --- intent application ---

  private applyIntents() {
    for (const p of this.players) {
      const queued = p.pending;
      p.pending = [];
      for (const intent of queued) this.applyIntent(p, intent);
    }
  }

  private applyIntent(p: SimPlayer, intent: Intent) {
    switch (intent.k) {
      case "move":
      case "attackMove": {
        const h = this.hero(p);
        if (!h) return;
        const wp = this.map.grid.nearestWalkable(intent.x, intent.z);
        h.order = intent.k === "move" ? "move" : "attackMove";
        h.destX = wp.x;
        h.destZ = wp.z;
        h.targetId = -1;
        return;
      }
      case "stop": {
        const h = this.hero(p);
        if (!h) return;
        h.order = "idle";
        h.destX = h.x;
        h.destZ = h.z;
        h.targetId = -1;
        return;
      }
      case "rally": {
        p.rallyLane = Math.max(0, Math.min(2, intent.lane | 0));
        return;
      }
      case "summon": {
        this.trySummon(p, intent.unit, intent.lane);
        return;
      }
      default:
        return;
    }
  }

  private trySummon(p: SimPlayer, unit: UnitKey, laneIn: number) {
    if (unit !== "footman" && unit !== "archer" && unit !== "knight") return;
    if (p.summonCount >= ECONOMY.maxSummonsPerPlayer) return;
    const cost = COST[unit];
    if (p.credits < cost) return;
    p.credits -= cost;
    p.summonCount++;
    const lane = Math.max(0, Math.min(2, laneIn | 0));
    const spawn = this.map.heroSpawn[p.team];
    const jitterX = (this.rng() - 0.5) * 3;
    const jitterZ = (this.rng() - 0.5) * 2;
    this.spawnUnit(p.team, unit, spawn.x + jitterX, spawn.z + jitterZ, lane, p.slot);
  }

  // --- main tick ---

  // `predict` is set by clients running a local copy for hero prediction: it
  // runs the exact same movement/combat code but skips the authority-only,
  // RNG-driven systems (bots, waves, economy, respawns, culling) so a client
  // can safely project a few ticks ahead of the last server snapshot without
  // diverging on anything but its own hero. The server always calls step()
  // with predict=false and remains the sole authority.
  step(dt: number = DT, predict = false) {
    if (this.phase === "ended") {
      this.tick++;
      return;
    }
    this.applyIntents();

    if (!predict) {
      this.runBots();

      // Passive economy (whole-second grain to stay integer-stable).
      this.incomeAcc += dt;
      while (this.incomeAcc >= 1) {
        this.incomeAcc -= 1;
        for (const p of this.players) p.credits += ECONOMY.incomePerSec;
      }

      // Creep waves.
      this.waveTimer += dt;
      if (this.waveTimer >= ECONOMY.waveInterval) {
        this.waveTimer -= ECONOMY.waveInterval;
        this.spawnWaves();
      }

      // Hero respawns.
      for (const p of this.players) {
        if (!p.alive) {
          p.respawn -= dt;
          if (p.respawn <= 0) this.spawnHero(p);
        }
      }
    }

    this.updateUnits(dt);
    this.updateStructs(dt);
    this.separate();
    if (!predict) this.cull();
    this.checkVictory();

    this.tick++;
  }

  /**
   * Overwrite this sim's world with an authoritative snapshot. Used by clients
   * to reset their local prediction copy to the server's last known truth
   * before replaying local intents. The fields a snapshot does not carry
   * (orders, cooldowns, RNG timers) are reset to safe neutral values — fine for
   * the short prediction window, since the local hero's standing order is
   * re-applied by the caller and other entities barely move in a few ticks.
   */
  loadSnapshot(snap: Snapshot) {
    this.tick = snap.tick;
    this.phase = snap.phase;
    this.winner = snap.winner;
    this.waveTimer = 0;
    this.incomeAcc = 0;

    for (const np of snap.players) {
      const p = this.players.find((q) => q.slot === np.slot);
      if (!p) continue;
      p.credits = np.credits;
      p.heroId = np.heroId;
      p.alive = np.alive;
      p.respawn = np.respawn;
      p.connected = np.connected;
      p.bot = np.bot;
      p.kills = np.kills;
    }

    this.units = snap.units.map((nu) => ({
      id: nu.id,
      team: nu.t,
      key: nu.k,
      def: UNIT_DEFS[nu.k],
      hp: nu.hp,
      mhp: nu.mhp,
      x: nu.x,
      z: nu.z,
      yaw: nu.y,
      ownerSlot: nu.o,
      isHero: nu.h,
      lane: 1,
      order: nu.h ? "idle" : "lanePush",
      destX: nu.x,
      destZ: nu.z,
      targetId: -1,
      cd: 0,
      attacking: 0,
      lastHitBy: -1,
      alive: true,
    }));

    this.structs = snap.structs.map((ns) => ({
      id: ns.id,
      team: ns.t,
      key: ns.k,
      def: STRUCT_DEFS[ns.k],
      hp: ns.hp,
      mhp: ns.mhp,
      x: ns.x,
      z: ns.z,
      cd: 0,
      alive: true,
    }));

    let maxId = 0;
    for (const u of this.units) if (u.id > maxId) maxId = u.id;
    for (const s of this.structs) if (s.id > maxId) maxId = s.id;
    this.nextId = maxId + 1;
  }

  /** Current position/facing of a player's hero, or null if dead. */
  heroState(slot: number): { x: number; z: number; yaw: number } | null {
    const p = this.findPlayer(slot);
    if (!p) return null;
    const h = this.hero(p);
    return h ? { x: h.x, z: h.z, yaw: h.yaw } : null;
  }

  private spawnWaves() {
    for (const team of [0, 1] as Team[]) {
      const base = this.map.heroSpawn[team];
      for (let lane = 0; lane < 3; lane++) {
        const lx = this.map.laneX[lane]!;
        for (let i = 0; i < ECONOMY.meleePerWave; i++) {
          this.spawnUnit(
            team,
            "creepMelee",
            base.x + lx * 0.25 + (this.rng() - 0.5) * 2,
            base.z + (this.rng() - 0.5) * 2,
            lane,
            -1,
          );
        }
        for (let i = 0; i < ECONOMY.rangedPerWave; i++) {
          this.spawnUnit(
            team,
            "creepRanged",
            base.x + lx * 0.25 + (this.rng() - 0.5) * 2,
            base.z + (this.rng() - 0.5) * 2,
            lane,
            -1,
          );
        }
      }
    }
  }

  // --- units ---

  private updateUnits(dt: number) {
    for (const u of this.units) {
      if (!u.alive) continue;
      u.attacking = 0;
      if (u.cd > 0) u.cd -= dt;

      const wantsChase = u.isHero ? u.order === "attackMove" : true;
      let target = u.targetId >= 0 ? this.getUnitOrStruct(u.targetId) : undefined;
      if (target && !this.isEnemyAlive(u, target)) {
        target = undefined;
        u.targetId = -1;
      }
      if (!target && wantsChase) {
        target = this.acquireTarget(u);
        u.targetId = target ? targetId(target) : -1;
      }

      if (target) {
        const tx = target.x;
        const tz = target.z;
        const d = dist(u.x, u.z, tx, tz);
        const reach = u.def.attackRange + sizeOf(target);
        if (d <= reach) {
          // In range: face + attack on cooldown.
          u.yaw = Math.atan2(tx - u.x, tz - u.z);
          if (u.cd <= 0) {
            this.dealDamage(u, target);
            u.cd = u.def.attackCooldown;
            u.attacking = 1;
          }
          continue;
        }
        if (u.isHero && u.order === "move") {
          // Hero on a plain move ignores far targets and keeps walking.
        } else {
          this.moveToward(u, tx, tz, dt);
          continue;
        }
      }

      // No engageable target -> follow standing order.
      if (u.isHero) {
        if (u.order === "move" || u.order === "attackMove") {
          const arrived = this.moveToward(u, u.destX, u.destZ, dt);
          if (arrived) u.order = "idle";
        }
      } else {
        // Lane creeps / summons push toward the enemy core via the flow field.
        this.followFlow(u, dt);
      }
    }
  }

  private acquireTarget(u: SimUnit): SimUnit | SimStruct | undefined {
    const aggro = u.isHero ? u.def.aggroRange : u.def.aggroRange;
    let best: SimUnit | SimStruct | undefined;
    let bestD = aggro * aggro;
    for (const o of this.units) {
      if (!o.alive || o.team === u.team) continue;
      const d = dist2(u.x, u.z, o.x, o.z);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    for (const s of this.structs) {
      if (!s.alive || s.team === u.team) continue;
      const d = dist2(u.x, u.z, s.x, s.z);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private getUnitOrStruct(id: number): SimUnit | SimStruct | undefined {
    const u = this.units.find((q) => q.id === id);
    if (u && u.alive) return u;
    const s = this.structs.find((q) => q.id === id);
    if (s && s.alive) return s;
    return undefined;
  }

  private isEnemyAlive(u: SimUnit, t: SimUnit | SimStruct): boolean {
    return t.alive && t.team !== u.team;
  }

  private moveToward(u: SimUnit, tx: number, tz: number, dt: number): boolean {
    const dx = tx - u.x;
    const dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) return true;
    u.yaw = Math.atan2(dx, dz);
    const stepLen = Math.min(d, u.def.speed * dt);
    let nx = u.x + (dx / d) * stepLen;
    let nz = u.z + (dz / d) * stepLen;
    if (!this.map.grid.walkable(this.map.grid.cellX(nx), this.map.grid.cellZ(nz))) {
      const wp = this.map.grid.nearestWalkable(nx, nz);
      nx = wp.x;
      nz = wp.z;
    }
    u.x = nx;
    u.z = nz;
    return false;
  }

  private followFlow(u: SimUnit, dt: number) {
    const enemyCoreTeam: Team = u.team === 0 ? 1 : 0;
    const flow = this.map.flowToCore[enemyCoreTeam];
    const dir = flow.sampleDir(u.x, u.z);
    if (!dir) {
      const core = this.map.cores[enemyCoreTeam];
      this.moveToward(u, core.x, core.z, dt);
      return;
    }
    // Bias toward the unit's assigned lane x so waves spread across the map.
    const laneTargetX = this.map.laneX[u.lane]!;
    const bias = Math.max(-1, Math.min(1, (laneTargetX - u.x) * 0.04));
    const stepLen = u.def.speed * dt;
    let nx = u.x + (dir.x + bias) * stepLen;
    let nz = u.z + dir.z * stepLen;
    if (!this.map.grid.walkable(this.map.grid.cellX(nx), this.map.grid.cellZ(nz))) {
      const wp = this.map.grid.nearestWalkable(nx, nz);
      nx = wp.x;
      nz = wp.z;
    }
    u.yaw = Math.atan2(nx - u.x, nz - u.z);
    u.x = nx;
    u.z = nz;
  }

  private dealDamage(attacker: SimUnit, target: SimUnit | SimStruct) {
    target.hp -= attacker.def.damage;
    if ("ownerSlot" in target) {
      (target as SimUnit).lastHitBy = attacker.ownerSlot;
    }
    if (target.hp <= 0) this.killEntity(target, attacker.ownerSlot, attacker.isHero);
  }

  private killEntity(
    target: SimUnit | SimStruct,
    killerSlot: number,
    killerIsHero: boolean,
  ) {
    if (!target.alive) return;
    target.alive = false;
    if ("ownerSlot" in target) {
      const tu = target as SimUnit;
      // Reward gold to the killer (or split among the killing team for neutrals).
      const reward = tu.def.reward;
      const slot = killerSlot >= 0 ? killerSlot : tu.lastHitBy;
      const killer = slot >= 0 ? this.findPlayer(slot) : undefined;
      if (killer) {
        killer.credits += reward;
        if (tu.isHero && killerIsHero) killer.kills++;
      }
      if (tu.ownerSlot >= 0) {
        const owner = this.findPlayer(tu.ownerSlot);
        if (owner) owner.summonCount = Math.max(0, owner.summonCount - 1);
      }
      if (tu.isHero) {
        const owner = this.findPlayer(tu.ownerSlot);
        if (owner) {
          owner.alive = false;
          owner.respawn = ECONOMY.heroRespawn;
          owner.heroId = -1;
        }
      }
    }
  }

  // --- structures ---

  private updateStructs(dt: number) {
    for (const s of this.structs) {
      if (!s.alive) continue;
      if (s.cd > 0) s.cd -= dt;
      if (s.cd > 0) continue;
      let best: SimUnit | undefined;
      let bestD = s.def.range * s.def.range;
      for (const u of this.units) {
        if (!u.alive || u.team === s.team) continue;
        const d = dist2(s.x, s.z, u.x, u.z);
        if (d < bestD) {
          bestD = d;
          best = u;
        }
      }
      if (best) {
        best.hp -= s.def.damage;
        best.lastHitBy = -1;
        if (best.hp <= 0) this.killEntity(best, -1, false);
        s.cd = s.def.fireRate;
      }
    }
  }

  // --- light separation so blobs don't fully overlap ---

  private separate() {
    const arr = this.units;
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i]!;
      if (!a.alive) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j]!;
        if (!b.alive) continue;
        const minD = a.def.radius + b.def.radius;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > minD * minD || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (minD - d) * 0.5;
        const ux = dx / d;
        const uz = dz / d;
        a.x -= ux * push;
        a.z -= uz * push;
        b.x += ux * push;
        b.z += uz * push;
      }
    }
  }

  private cull() {
    if (this.units.length > 400) {
      this.units = this.units.filter((u) => u.alive);
    } else {
      // Periodically compact dead entities to keep snapshots small.
      if (this.tick % 30 === 0) {
        this.units = this.units.filter((u) => u.alive);
      }
    }
  }

  private checkVictory() {
    for (const team of [0, 1] as Team[]) {
      const core = this.structs.find((s) => s.key === "core" && s.team === team);
      if (core && !core.alive) {
        this.phase = "ended";
        this.winner = (team === 0 ? 1 : 0) as Team;
        return;
      }
    }
  }

  // --- simple bot AI (opponent fill + disconnect takeover) ---

  private runBots() {
    for (const p of this.players) {
      if (!p.bot) continue;
      p.botTimer -= DT;
      if (p.botTimer > 0) continue;
      p.botTimer = 1.5;

      // Summon along a rotating lane when affordable.
      const choices: ("footman" | "archer" | "knight")[] = [
        "footman",
        "archer",
        "knight",
      ];
      const pick = choices[Math.floor(this.rng() * choices.length)]!;
      if (p.credits >= COST[pick]) {
        this.trySummon(p, pick, (this.tick >> 5) % 3);
      }

      // Drive the hero: attack-move toward the enemy core or nearest threat.
      const h = this.hero(p);
      if (h) {
        const enemyCoreTeam: Team = p.team === 0 ? 1 : 0;
        const threat = this.nearestEnemyToPoint(p.team, h.x, h.z, 22);
        const tgt = threat ?? this.map.cores[enemyCoreTeam];
        h.order = "attackMove";
        const wp = this.map.grid.nearestWalkable(tgt.x, tgt.z);
        h.destX = wp.x;
        h.destZ = wp.z;
      }
    }
  }

  private nearestEnemyToPoint(
    team: Team,
    x: number,
    z: number,
    range: number,
  ): { x: number; z: number } | undefined {
    let best: SimUnit | undefined;
    let bestD = range * range;
    for (const u of this.units) {
      if (!u.alive || u.team === team) continue;
      const d = dist2(x, z, u.x, u.z);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best ? { x: best.x, z: best.z } : undefined;
  }

  // --- snapshot ---

  snapshot(): Snapshot {
    const units: NetUnit[] = [];
    for (const u of this.units) {
      if (!u.alive) continue;
      units.push({
        id: u.id,
        t: u.team,
        k: u.key,
        hp: Math.max(0, Math.round(u.hp)),
        mhp: u.mhp,
        x: round2(u.x),
        z: round2(u.z),
        y: round2(u.yaw),
        o: u.ownerSlot,
        h: u.isHero,
        a: u.attacking,
      });
    }
    const structs: NetStruct[] = [];
    for (const s of this.structs) {
      if (!s.alive) continue;
      structs.push({
        id: s.id,
        t: s.team,
        k: s.key,
        hp: Math.max(0, Math.round(s.hp)),
        mhp: s.mhp,
        x: round2(s.x),
        z: round2(s.z),
      });
    }
    const players: NetPlayer[] = this.players.map((p) => ({
      slot: p.slot,
      team: p.team,
      name: p.name,
      credits: Math.floor(p.credits),
      heroId: p.heroId,
      alive: p.alive,
      respawn: Math.max(0, round2(p.respawn)),
      connected: p.connected,
      bot: p.bot,
      kills: p.kills,
    }));
    return {
      tick: this.tick,
      phase: this.phase,
      winner: this.winner,
      players,
      units,
      structs,
    };
  }
}

const COST: Record<"footman" | "archer" | "knight", number> = {
  footman: 80,
  archer: 120,
  knight: 180,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sizeOf(t: SimUnit | SimStruct): number {
  if ("ownerSlot" in t) return (t as SimUnit).def.radius;
  return (t as SimStruct).def.radius;
}

function targetId(t: SimUnit | SimStruct): number {
  return t.id;
}
