import { create } from "zustand";
import {
  PLAYER,
  WEAPON,
  STRUCT,
  ECONOMY,
  ABILITIES,
  RANGED_WEAPONS,
  DIFFICULTY,
  DEFAULT_DIFFICULTY,
  BUILDINGS,
  MAX_BUILDING_LEVEL,
  ALLY_TECH,
  MAX_ALLY_TECH,
  type AbilityId,
  type Difficulty,
} from "./config";
import type { Faction } from "./config";
import { EM } from "./entities";
import { useCommand } from "./command";
import { useRoster } from "./roster";
import { computeLoadoutStats } from "./equipment";
import type { MapSize } from "./mapgen";

export type Phase = "menu" | "battle" | "victory" | "defeat";

const DIFFICULTY_KEY = "gw_difficulty_v1";

/** Load the persisted difficulty, falling back to the default if unset/invalid. */
function loadDifficulty(): Difficulty {
  try {
    const raw = localStorage.getItem(DIFFICULTY_KEY);
    if (raw && raw in DIFFICULTY) return raw as Difficulty;
  } catch {
    // non-fatal
  }
  return DEFAULT_DIFFICULTY;
}

function saveDifficulty(d: Difficulty) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, d);
  } catch {
    // non-fatal
  }
}

export interface FloatMsg {
  id: number;
  text: string;
  kind: "info" | "warn" | "good" | "danger";
}

interface GameState {
  phase: Phase;
  /** Selected battlefield size; preserved across resets. */
  mapSize: MapSize;
  /** Selected enemy difficulty; persisted to localStorage and preserved across resets. */
  difficulty: Difficulty;
  /** Bumps every time a new map is generated so the renderer rebuilds terrain. */
  mapVersion: number;
  credits: number;
  score: number;
  kills: number;

  health: number;
  maxHealth: number;

  /** Loadout-derived hero damage multiplier (1 = base). */
  damageMult: number;
  /** Loadout-derived incoming-damage reduction fraction (0..0.6). */
  defense: number;

  ammo: number;
  magazine: number;
  reserve: number;
  reloading: boolean;

  allyCoreHp: number;
  allyCoreMax: number;
  enemyCoreHp: number;
  enemyCoreMax: number;

  /** Hero respawn: when dead, counts down to 0 then revives at base. */
  heroDead: boolean;
  respawnTimer: number;

  /** Remaining cooldown (seconds) per hero ability; 0 means ready. */
  abilityCd: Record<AbilityId, number>;

  /** Current tier (1..MAX_BUILDING_LEVEL) of each ally production building. */
  buildings: { barracks: number; archery: number };

  // --- HUD-reactive mirror of EM.match (written by MatchDirector each frame) ---
  /** Short label of the player's current attackable objective / next goal. */
  objectiveLabel: string;
  /** True once the enemy Citadel can be damaged (a lane is fully broken). */
  enemyCoreOpen: boolean;
  /** True once the ally Citadel is exposed (one of our lanes is fully broken). */
  allyCoreExposed: boolean;
  /** Relic objective phase for the HUD beacon/banner. */
  relicPhase: "dormant" | "active" | "cooldown";
  /** Whole seconds until the relic rises (dormant/cooldown) or withers (active). */
  relicTimer: number;
  /** Capture progress 0..1 of the currently-active relic. */
  relicProgress: number;
  /** Faction currently contesting the relic (null = uncontested). */
  relicCapturer: Faction | null;
  /** Faction that last claimed the relic (for the buff banner attribution). */
  relicOwner: Faction | null;
  /** Whole seconds left on the ally / enemy relic damage buff (0 = none). */
  buffAllyTimer: number;
  buffEnemyTimer: number;
  /** Purchased ally tech tier (0 = none, up to MAX_ALLY_TECH). */
  allyTech: number;
  /** True while the trailing-side comeback bonus is active per faction. */
  comebackAlly: boolean;
  comebackEnemy: boolean;

  messages: FloatMsg[];

  // actions
  startGame: () => void;
  reset: () => void;
  setMapSize: (size: MapSize) => void;
  setDifficulty: (d: Difficulty) => void;
  setPhase: (p: Phase) => void;
  win: () => void;
  lose: () => void;

  setHealth: (h: number) => void;
  damagePlayer: (amount: number) => void;
  healPlayer: (amount: number) => void;
  killHero: () => void;
  reviveHero: () => void;
  tickRespawn: (dt: number) => void;

  tickAbilities: (dt: number) => void;
  /** Try to fire an ability; returns true (and starts its cooldown) if ready. */
  triggerAbility: (id: AbilityId) => boolean;

  setAmmo: (mag: number, reserve: number) => void;
  setReloading: (r: boolean) => void;
  /** Reset the ammo HUD to a freshly selected ranged weapon (Q swap). */
  setWeaponAmmo: (magazine: number, ammo: number, reserve: number) => void;

  setCoreHp: (ally: number, enemy: number) => void;
  repairAllyCore: (amount: number) => void;

  addCredits: (n: number) => void;
  spendCredits: (n: number) => boolean;
  addScore: (n: number) => void;
  addKill: () => void;

  /** Upgrade an ally production building one tier (spends credits). */
  upgradeBuilding: (kind: "barracks" | "archery") => boolean;

  /** Buy the next ally tech tier (spends credits; strengthens the whole army). */
  upgradeTech: () => boolean;

  /** Change-guarded mirror of the EM.match HUD slice (written each frame). */
  syncMatchHud: (s: {
    objectiveLabel: string;
    enemyCoreOpen: boolean;
    allyCoreExposed: boolean;
    relicPhase: "dormant" | "active" | "cooldown";
    relicTimer: number;
    relicProgress: number;
    relicCapturer: Faction | null;
    relicOwner: Faction | null;
    buffAllyTimer: number;
    buffEnemyTimer: number;
    allyTech: number;
    comebackAlly: boolean;
    comebackEnemy: boolean;
  }) => void;

  pushMessage: (text: string, kind?: FloatMsg["kind"]) => void;
  popMessage: (id: number) => void;
}

let msgId = 0;

const initial = {
  phase: "menu" as Phase,
  credits: ECONOMY.startCredits,
  // mapSize / mapVersion live outside `initial` so resets preserve them.
  score: 0,
  kills: 0,
  health: PLAYER.maxHealth,
  maxHealth: PLAYER.maxHealth,
  damageMult: 1,
  defense: 0,
  ammo: WEAPON.magazine,
  magazine: WEAPON.magazine,
  reserve: WEAPON.reserve,
  reloading: false,
  allyCoreHp: STRUCT.core.hp,
  allyCoreMax: STRUCT.core.hp,
  enemyCoreHp: STRUCT.core.hp,
  enemyCoreMax: STRUCT.core.hp,
  heroDead: false,
  respawnTimer: 0,
  abilityCd: { dash: 0, slam: 0 } as Record<AbilityId, number>,
  buildings: { barracks: 1, archery: 1 },
  objectiveLabel: "",
  enemyCoreOpen: false,
  allyCoreExposed: false,
  relicPhase: "dormant" as "dormant" | "active" | "cooldown",
  relicTimer: 0,
  relicProgress: 0,
  relicCapturer: null as Faction | null,
  relicOwner: null as Faction | null,
  buffAllyTimer: 0,
  buffEnemyTimer: 0,
  allyTech: 0,
  comebackAlly: false,
  comebackEnemy: false,
  messages: [] as FloatMsg[],
};

export const useGame = create<GameState>((set, get) => ({
  ...initial,
  mapSize: "standard" as MapSize,
  difficulty: loadDifficulty(),
  mapVersion: 0,

  startGame: () => {
    // Generate a fresh procedural battlefield at the chosen size.
    const size = get().mapSize;
    EM.newMatch(size);
    // Start every deployment in combat mode with a clean selection so the
    // pointer-lock engage prompt reliably appears.
    useCommand.getState().resetCommand();
    // Apply the equipped loadout's derived stats (health / damage / defense)
    // on top of the base stats for this run.
    const r = useRoster.getState();
    const ls = computeLoadoutStats(r.equipment, r.gearTier);
    const maxHealth = PLAYER.maxHealth + ls.bonusHp;
    // The hero deploys with its chosen ranged weapon active; size the ammo HUD
    // to that weapon (Q swaps to melee, which is ammo-free).
    const rw = RANGED_WEAPONS[r.rangedId] ?? RANGED_WEAPONS.rifle;
    set({
      ...initial,
      mapSize: size,
      difficulty: get().difficulty,
      mapVersion: get().mapVersion + 1,
      phase: "battle",
      maxHealth,
      health: maxHealth,
      damageMult: ls.damageMult,
      defense: ls.defense,
      magazine: rw.magazine,
      ammo: rw.magazine,
      reserve: rw.reserve,
      reloading: false,
    });
    get().pushMessage("THE WAR BEGINS — RAZE THEIR CITADEL", "good");
  },
  reset: () => {
    const size = get().mapSize;
    EM.newMatch(size);
    useCommand.getState().resetCommand();
    set({ ...initial, mapSize: size, difficulty: get().difficulty, mapVersion: get().mapVersion + 1 });
  },
  setMapSize: (size) => set({ mapSize: size }),
  setDifficulty: (d) => {
    saveDifficulty(d);
    set({ difficulty: d });
  },
  setPhase: (p) => set({ phase: p }),

  win: () => {
    if (get().phase !== "battle") return;
    set({ phase: "victory" });
  },
  lose: () => {
    if (get().phase !== "battle") return;
    set({ phase: "defeat" });
  },

  setHealth: (h) => set({ health: Math.max(0, Math.min(get().maxHealth, h)) }),
  damagePlayer: (amount) => {
    if (get().heroDead || get().phase !== "battle") return;
    // A raised shield guard (sword & shield RMB) soaks most of the blow.
    const guard = EM.heroBlocking ? 0.25 : 1;
    const dealt = amount * (1 - get().defense) * guard;
    const h = Math.max(0, get().health - dealt);
    set({ health: h });
    // Jolt the camera proportionally to the blow so taking damage has weight.
    EM.addShake(Math.min(0.25, 0.05 + dealt * 0.004));
    EM.addFloatText(
      EM.playerPos.x,
      2.4,
      EM.playerPos.z,
      String(Math.max(1, Math.round(dealt))),
      "#ff8a7a",
    );
    if (h <= 0) get().killHero();
  },
  healPlayer: (amount) => {
    const before = get().health;
    const after = Math.min(get().maxHealth, before + amount);
    set({ health: after });
    if (after > before) {
      EM.addFloatText(EM.playerPos.x, 2.4, EM.playerPos.z, "+" + Math.round(after - before), "#8effa0");
    }
  },
  killHero: () => {
    if (get().heroDead) return;
    set({ heroDead: true, respawnTimer: PLAYER.respawnTime, health: 0 });
    get().pushMessage("YOU HAVE FALLEN — REGROUPING", "danger");
  },
  reviveHero: () =>
    set({ heroDead: false, respawnTimer: 0, health: get().maxHealth }),
  tickRespawn: (dt) => {
    if (!get().heroDead) return;
    const t = get().respawnTimer - dt;
    if (t <= 0) {
      get().reviveHero();
      get().pushMessage("BACK IN THE FIGHT", "good");
    } else {
      set({ respawnTimer: t });
    }
  },

  tickAbilities: (dt) => {
    const cd = get().abilityCd;
    if (cd.dash <= 0 && cd.slam <= 0) return;
    set({
      abilityCd: {
        dash: Math.max(0, cd.dash - dt),
        slam: Math.max(0, cd.slam - dt),
      },
    });
  },
  triggerAbility: (id) => {
    const g = get();
    if (g.phase !== "battle" || g.heroDead) return false;
    if (g.abilityCd[id] > 0) return false;
    set({ abilityCd: { ...g.abilityCd, [id]: ABILITIES[id].cooldown } });
    return true;
  },

  setAmmo: (mag, reserve) => set({ ammo: mag, reserve }),
  setReloading: (r) => set({ reloading: r }),
  setWeaponAmmo: (magazine, ammo, reserve) => set({ magazine, ammo, reserve, reloading: false }),

  setCoreHp: (ally, enemy) => {
    const cur = get();
    if (cur.allyCoreHp !== ally || cur.enemyCoreHp !== enemy) {
      set({ allyCoreHp: Math.max(0, ally), enemyCoreHp: Math.max(0, enemy) });
    }
  },
  repairAllyCore: (amount) => {
    const core = EM.allyCore;
    if (!core) return;
    const before = core.hp;
    core.hp = Math.min(core.maxHp, core.hp + amount);
    set({ allyCoreHp: core.hp });
    if (core.hp > before) {
      EM.addFloatText(core.pos.x, 5.4, core.pos.z, "+" + Math.round(core.hp - before), "#8effa0", true);
    }
  },

  addCredits: (n) => set({ credits: get().credits + n }),
  spendCredits: (n) => {
    if (get().credits < n) return false;
    set({ credits: get().credits - n });
    return true;
  },
  addScore: (n) => set({ score: get().score + n }),
  addKill: () => set({ kills: get().kills + 1 }),

  upgradeBuilding: (kind) => {
    const lvl = get().buildings[kind];
    if (lvl >= MAX_BUILDING_LEVEL) {
      get().pushMessage("ALREADY AT MAXIMUM TIER", "warn");
      return false;
    }
    const cost = BUILDINGS[kind].levels[lvl - 1].upgradeCost ?? 0;
    if (get().credits < cost) {
      get().pushMessage("NOT ENOUGH CREDITS", "warn");
      return false;
    }
    set({
      credits: get().credits - cost,
      buildings: { ...get().buildings, [kind]: lvl + 1 },
    });
    get().pushMessage(`${BUILDINGS[kind].name.toUpperCase()} UPGRADED TO TIER ${lvl + 1}`, "good");
    return true;
  },

  upgradeTech: () => {
    const tier = get().allyTech;
    if (tier >= MAX_ALLY_TECH) {
      get().pushMessage("ARMY FULLY UPGRADED", "warn");
      return false;
    }
    const next = ALLY_TECH[tier];
    if (get().credits < next.cost) {
      get().pushMessage("NOT ENOUGH CREDITS", "warn");
      return false;
    }
    // EM.match is authoritative for combat math; mirror the tier into the store.
    EM.match.allyTech = tier + 1;
    set({ credits: get().credits - next.cost, allyTech: tier + 1 });
    get().pushMessage(`${next.name.toUpperCase()} — ARMY EMPOWERED`, "good");
    return true;
  },

  syncMatchHud: (s) => {
    const c = get();
    if (
      c.objectiveLabel === s.objectiveLabel &&
      c.enemyCoreOpen === s.enemyCoreOpen &&
      c.allyCoreExposed === s.allyCoreExposed &&
      c.relicPhase === s.relicPhase &&
      c.relicTimer === s.relicTimer &&
      c.relicProgress === s.relicProgress &&
      c.relicCapturer === s.relicCapturer &&
      c.relicOwner === s.relicOwner &&
      c.buffAllyTimer === s.buffAllyTimer &&
      c.buffEnemyTimer === s.buffEnemyTimer &&
      c.allyTech === s.allyTech &&
      c.comebackAlly === s.comebackAlly &&
      c.comebackEnemy === s.comebackEnemy
    ) {
      return;
    }
    set(s);
  },

  pushMessage: (text, kind = "info") => {
    const id = ++msgId;
    set({ messages: [...get().messages, { id, text, kind }] });
    setTimeout(() => get().popMessage(id), 2600);
  },
  popMessage: (id) => set({ messages: get().messages.filter((m) => m.id !== id) }),
}));
