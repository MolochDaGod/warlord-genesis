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
import { isLoadoutReady, useRoster } from "./roster";
import { useMeta } from "./metaProgression";
import { configureMatchFactions } from "../engine/grudge6";
import { computeLoadoutStats } from "./equipment";
import type { MapSize } from "./mapgen";
import {
  DEFAULT_PRODUCTION_SPECS,
  type ProductionSpecs,
  type WarriorSpec,
  type WorgeSpec,
  type MageSpec,
  type RangerSpec,
  WARRIOR_SPECS,
  WORGE_SPECS,
  MAGE_SPECS,
  RANGER_SPECS,
} from "./productionSpecs";
import {
  computeHeroBonuses,
  levelFromXp,
  nextPendingPickLevel,
  startingSkillId,
  toPickOptions,
  HERO_XP_KILL,
  type HeroSkillBonuses,
  type SkillPickOption,
  EMPTY_HERO_BONUSES,
} from "./heroSkillTree";
import {
  playerDefaultDeployment,
  type LaneDeployment,
  type LaneId,
  type LanePick,
} from "./laneDeployment";

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
  /** Active combat weapon set (ranged vs melee) — drives the weapon-skill hotbar. */
  heroActiveWeapon: "ranged" | "melee";
  /** Per-skill-id recast timers for the equipped weapon's hotbar (seconds). */
  weaponSkillCd: Record<string, number>;

  /** Hero level (1–10), XP, and class skill picks — reset each match. */
  heroLevel: number;
  heroXp: number;
  heroSkillPicks: string[];
  heroBonuses: HeroSkillBonuses;
  pendingSkillPick: { level: number; options: SkillPickOption[] } | null;

  /** Current tier (1..MAX_BUILDING_LEVEL) of each ally production building. */
  buildings: { barracks: number; archery: number };
  /** Barracks / archery specialization picks (warrior, worge, mage, ranger). */
  productionSpecs: ProductionSpecs;

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

  /** Per-lane guard + wave creep picks (melee/ranged NPCs + 2M+1R waves). */
  laneDeployment: LaneDeployment;
  /** Current deployment round (increments each escalation period). */
  deploymentRound: number;
  /** True when a new round opened — highlights the deployment panel. */
  deploymentHighlight: boolean;

  messages: FloatMsg[];

  // actions
  /** Returns false if loadout/unlock gates fail (never silent-success). */
  startGame: () => boolean;
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
  setHeroActiveWeapon: (mode: "ranged" | "melee") => void;
  /** Start recast on a weapon skill (id from API matrix). */
  startWeaponSkillCooldown: (skillId: string, cooldown: number) => void;
  weaponSkillReady: (skillId: string) => boolean;

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

  addHeroXp: (n: number) => void;
  pickHeroSkill: (skillId: string) => void;
  recomputeHeroStats: () => void;

  /** Upgrade an ally production building one tier (spends credits). */
  upgradeBuilding: (kind: "barracks" | "archery") => boolean;
  /** Pick a barracks or archery specialization (one-time per line). */
  upgradeProductionSpec: (
    line: keyof ProductionSpecs,
    spec: WarriorSpec | WorgeSpec | MageSpec | RangerSpec,
  ) => boolean;

  /** Buy the next ally tech tier (spends credits; strengthens the whole army). */
  upgradeTech: () => boolean;

  /** Set one slot on a lane's deployment sheet. */
  setLanePick: (lane: LaneId, key: keyof LanePick, typeId: string) => void;
  /** Reset all lanes to faction defaults. */
  resetLaneDeployment: () => void;
  /** Acknowledge the new-round deployment prompt. */
  dismissDeploymentHighlight: () => void;
  /** Called by MatchDirector when a new deployment round begins. */
  beginDeploymentRound: (round: number) => void;

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
  heroActiveWeapon: "ranged" as "ranged" | "melee",
  weaponSkillCd: {} as Record<string, number>,
  heroLevel: 1,
  heroXp: 0,
  heroSkillPicks: [] as string[],
  heroBonuses: { ...EMPTY_HERO_BONUSES },
  pendingSkillPick: null as { level: number; options: SkillPickOption[] } | null,
  buildings: { barracks: 1, archery: 1 },
  productionSpecs: { ...DEFAULT_PRODUCTION_SPECS },
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
  laneDeployment: playerDefaultDeployment(),
  deploymentRound: 1,
  deploymentHighlight: true,
  messages: [] as FloatMsg[],
};

export const useGame = create<GameState>((set, get) => ({
  ...initial,
  mapSize: "standard" as MapSize,
  difficulty: loadDifficulty(),
  mapVersion: 0,

  startGame: () => {
    const r = useRoster.getState();
    const meta = useMeta.getState();
    if (!isLoadoutReady(r.meleeId, r.rangedId, r.prefabId)) {
      console.warn("[warlord-genesis] startGame blocked: loadout not ready", {
        meleeId: r.meleeId,
        rangedId: r.rangedId,
        prefabId: r.prefabId,
      });
      return false;
    }
    if (!meta.isCharacterUnlocked(r.prefabId)) {
      console.warn("[warlord-genesis] startGame blocked: character locked", r.prefabId);
      return false;
    }

    // Generate a fresh procedural battlefield at the chosen size.
    const size = get().mapSize;
    EM.newMatch(size);
    // Start every deployment in combat mode with a clean selection so the
    // pointer-lock engage prompt reliably appears.
    useCommand.getState().resetCommand();
    // Apply the equipped loadout's derived stats (health / damage / defense)
    // on top of the base stats for this run.
    configureMatchFactions(r.factionId, r.enemyFactionId);
    const ls = computeLoadoutStats(r.equipment, r.gearTier);
    const maxHealth = PLAYER.maxHealth + ls.bonusHp;
    // The hero deploys with its chosen ranged weapon active; size the ammo HUD
    // to that weapon (Q swaps to melee, which is ammo-free).
    const rw = RANGED_WEAPONS[r.rangedId] ?? RANGED_WEAPONS.rifle;
    const keepBuildings = get().buildings;
    const keepSpecs = get().productionSpecs;
    const autoSkill = startingSkillId(r.classId);
    const heroSkillPicks = autoSkill ? [autoSkill] : [];
    const heroBonuses = computeHeroBonuses(r.classId, heroSkillPicks, 1);
    const heroMaxHealth = maxHealth + heroBonuses.bonusHp;
    // Preserve pre-match lane creep picks (lobby/deploy UI). Only fill missing slots.
    const prevLanes = get().laneDeployment;
    const fallbackDep = playerDefaultDeployment({
      meleeGuard: r.laneMeleeHeroId,
      rangedGuard: r.laneRangedHeroId,
    });
    const preservedLanes: LaneDeployment = {
      lanes: {
        0: prevLanes.lanes[0] ?? fallbackDep.lanes[0],
        1: prevLanes.lanes[1] ?? fallbackDep.lanes[1],
        2: prevLanes.lanes[2] ?? fallbackDep.lanes[2],
      },
    };
    set({
      ...initial,
      mapSize: size,
      difficulty: get().difficulty,
      mapVersion: get().mapVersion + 1,
      buildings: keepBuildings,
      productionSpecs: keepSpecs,
      phase: "battle",
      heroLevel: 1,
      heroXp: 0,
      heroSkillPicks,
      heroBonuses,
      pendingSkillPick: null,
      laneDeployment: preservedLanes,
      deploymentRound: 1,
      deploymentHighlight: false,
      maxHealth: heroMaxHealth,
      health: heroMaxHealth,
      damageMult: ls.damageMult * (1 + heroBonuses.damageMult),
      defense: Math.min(0.6, ls.defense + heroBonuses.defense),
      magazine: rw.magazine,
      ammo: rw.magazine,
      reserve: rw.reserve,
      reloading: false,
      messages: [],
    });
    get().pushMessage("RAZE THE ENEMY CITADEL", "good");
    return true;
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
    const wcd = get().weaponSkillCd;
    let wChanged = false;
    const nextWcd = { ...wcd };
    for (const k of Object.keys(nextWcd)) {
      if (nextWcd[k]! > 0) {
        nextWcd[k] = Math.max(0, nextWcd[k]! - dt);
        wChanged = true;
      }
    }
    const dashSlam = cd.dash > 0 || cd.slam > 0;
    if (!dashSlam && !wChanged) return;
    set({
      abilityCd: dashSlam
        ? { dash: Math.max(0, cd.dash - dt), slam: Math.max(0, cd.slam - dt) }
        : cd,
      weaponSkillCd: wChanged ? nextWcd : wcd,
    });
  },
  setHeroActiveWeapon: (mode) => set({ heroActiveWeapon: mode, weaponSkillCd: {} }),
  startWeaponSkillCooldown: (skillId, cooldown) => {
    if (cooldown <= 0) return;
    set({ weaponSkillCd: { ...get().weaponSkillCd, [skillId]: cooldown } });
  },
  weaponSkillReady: (skillId) => (get().weaponSkillCd[skillId] ?? 0) <= 0,
  triggerAbility: (id) => {
    const g = get();
    if (g.phase !== "battle" || g.heroDead) return false;
    if (g.abilityCd[id] > 0) return false;
    const cdMult = id === "dash" ? g.heroBonuses.dashCooldownMult : g.heroBonuses.slamCooldownMult;
    set({ abilityCd: { ...g.abilityCd, [id]: ABILITIES[id].cooldown * cdMult } });
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
  addKill: () => {
    set({ kills: get().kills + 1 });
    get().addHeroXp(HERO_XP_KILL);
  },

  recomputeHeroStats: () => {
    const g = get();
    const r = useRoster.getState();
    const ls = computeLoadoutStats(r.equipment, r.gearTier);
    const bonuses = computeHeroBonuses(r.classId, g.heroSkillPicks, g.heroLevel);
    const maxHealth = PLAYER.maxHealth + ls.bonusHp + bonuses.bonusHp;
    let health = g.health;
    if (!g.heroDead) {
      if (maxHealth > g.maxHealth) health = Math.min(maxHealth, health + (maxHealth - g.maxHealth));
      else health = Math.min(maxHealth, health);
    }
    set({
      heroBonuses: bonuses,
      maxHealth,
      damageMult: ls.damageMult * (1 + bonuses.damageMult),
      defense: Math.min(0.6, ls.defense + bonuses.defense),
      health,
    });
  },

  addHeroXp: (n) => {
    if (get().phase !== "battle" || n <= 0) return;
    const xp = get().heroXp + n;
    const oldLevel = get().heroLevel;
    const newLevel = levelFromXp(xp);
    set({ heroXp: xp, heroLevel: newLevel });
    if (newLevel > oldLevel) {
      get().pushMessage(`HERO LEVEL ${newLevel}`, "good");
      get().recomputeHeroStats();
      const pl = nextPendingPickLevel(newLevel, get().heroSkillPicks);
      if (pl !== null && !get().pendingSkillPick) {
        const classId = useRoster.getState().classId;
        set({ pendingSkillPick: { level: pl, options: toPickOptions(classId, pl) } });
      }
    }
  },

  pickHeroSkill: (skillId) => {
    const pending = get().pendingSkillPick;
    if (!pending) return;
    const choice = pending.options.find((o) => o.id === skillId);
    if (!choice) return;
    const picks = [...get().heroSkillPicks, skillId];
    set({ heroSkillPicks: picks, pendingSkillPick: null });
    get().pushMessage(`${choice.label.toUpperCase()} — SKILL CHOSEN`, "good");
    get().recomputeHeroStats();
    const pl = nextPendingPickLevel(get().heroLevel, picks);
    if (pl !== null) {
      const classId = useRoster.getState().classId;
      set({ pendingSkillPick: { level: pl, options: toPickOptions(classId, pl) } });
    }
  },

  upgradeProductionSpec: (line, spec) => {
    const specs = get().productionSpecs;
    if (specs[line] !== "base") {
      get().pushMessage(`${line.toUpperCase()} ALREADY SPECIALIZED`, "warn");
      return false;
    }
    const table =
      line === "warrior"
        ? WARRIOR_SPECS
        : line === "worge"
          ? WORGE_SPECS
          : line === "mage"
            ? MAGE_SPECS
            : RANGER_SPECS;
    const def = table[spec as keyof typeof table];
    if (!def || def.cost <= 0) return false;
    if (get().credits < def.cost) {
      get().pushMessage("NOT ENOUGH CREDITS", "warn");
      return false;
    }
    set({
      credits: get().credits - def.cost,
      productionSpecs: { ...specs, [line]: spec },
    });
    get().pushMessage(`${def.label.toUpperCase()} — ${line.toUpperCase()} UPGRADED`, "good");
    return true;
  },

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

  setLanePick: (lane, key, typeId) => {
    const dep = get().laneDeployment;
    set({
      laneDeployment: {
        ...dep,
        lanes: {
          ...dep.lanes,
          [lane]: { ...dep.lanes[lane], [key]: typeId },
        },
      },
    });
  },

  resetLaneDeployment: () => {
    const r = useRoster.getState();
    set({
      laneDeployment: playerDefaultDeployment({
        meleeGuard: r.laneMeleeHeroId,
        rangedGuard: r.laneRangedHeroId,
      }),
    });
    if (get().phase === "battle") {
      get().pushMessage("LANE WAVE CREEPS RESET TO FACTION DEFAULTS", "info");
    }
  },

  dismissDeploymentHighlight: () => set({ deploymentHighlight: false }),

  beginDeploymentRound: (round) => {
    if (round <= get().deploymentRound) return;
    set({ deploymentRound: round, deploymentHighlight: true });
    get().pushMessage(`ROUND ${round} — ADJUST WAVE CREEPS PER LANE`, "info");
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
    const next = [...get().messages, { id, text, kind }].slice(-3);
    set({ messages: next });
    setTimeout(() => get().popMessage(id), 2200);
  },
  popMessage: (id) => set({ messages: get().messages.filter((m) => m.id !== id) }),
}));
