// ── Weapon Mastery (WoW-style talent trees) ──────────────────────────────────
//
// The SINGLE SOURCE OF TRUTH for the /game/panel "Weapons Mastery" talent
// system AND the shareable `mastery.html` spec page (generated from these exact
// defs by `@workspace/scripts run gen-mastery-html`, so the two can never
// drift). Everything here is PURE — only `Math` and plain objects, NO DOM/Node
// globals — so it is importable by the shared libs, the api-server, the /world
// UI, the panel, the headless math harness, and the html generator alike.
//
// The model:
//   • One talent tree per weapon mastery type (9 trees).
//   • Every tree shares the same star-chart TEMPLATE (node positions, rank caps,
//     unlock thresholds, edges) but is THEMED per weapon — different flavor
//     names and a different ordering of which generic combat bonus each node
//     grants. This keeps the trees structurally identical (easy to render as a
//     star chart) while feeling distinct.
//   • The player earns 1 mastery point per character level into ONE shared pool
//     (capped at MASTERY_POOL_CAP) spent across ALL trees — so you can fully
//     master a few weapons, never all of them.
//   • Talents are GENERIC passive combat bonuses (damage / crit / crit-damage /
//     attack-speed / armor-pen / lifesteal) that fold straight into the
//     character stat engine (`applyMasteryBonusesToStats`), so allocating points
//     measurably changes derived stats and combat power.

// ── Bonus kinds → character stat wiring ───────────────────────────────────────
// Each generic bonus maps to one stat key understood by the character stat
// engine (see `characterStats.ts` / `PanelData` stats). `mode` controls how the
// bonus combines: percentage stats add directly; the flat `damage` stat scales
// multiplicatively so a "+% Damage" talent reads correctly.
export type MasteryBonusKind =
  | "damage"
  | "crit"
  | "critDamage"
  | "attackSpeed"
  | "armorPen"
  | "lifesteal";

export interface MasteryBonusDef {
  kind: MasteryBonusKind;
  label: string;
  /** Character stat key this bonus folds into. */
  statKey: string;
  /** `add` → += value (percentage-point stats); `mult` → ×(1 + value/100). */
  mode: "add" | "mult";
  /** Default magnitude granted per rank, in percent. */
  perRank: number;
}

export const MASTERY_BONUS_DEFS: Record<MasteryBonusKind, MasteryBonusDef> = {
  damage: { kind: "damage", label: "Damage", statKey: "damage", mode: "mult", perRank: 3 },
  crit: { kind: "crit", label: "Critical Chance", statKey: "criticalChance", mode: "add", perRank: 2 },
  critDamage: { kind: "critDamage", label: "Critical Damage", statKey: "criticalDamage", mode: "add", perRank: 5 },
  attackSpeed: { kind: "attackSpeed", label: "Attack Speed", statKey: "attackSpeed", mode: "add", perRank: 2 },
  armorPen: { kind: "armorPen", label: "Armor Penetration", statKey: "armorPenetration", mode: "add", perRank: 3 },
  lifesteal: { kind: "lifesteal", label: "Lifesteal", statKey: "drainHealth", mode: "add", perRank: 2 },
};

// ── Shared star-chart template ────────────────────────────────────────────────
// Seven node "slots" laid out on a 3-column, 5-tier grid. `bonus` is an index
// into a theme's ordered 6-kind list (index 0 = the tree's signature bonus); the
// capstone re-uses the signature kind at a single, much stronger rank. `links`
// describe the star edges drawn to the NEXT tier.
type MaxRanks = 1 | 3 | 5;

interface MasteryNodeTemplate {
  slot: string;
  tier: number; // 0..4 (row)
  col: number; // 0..2 (column, for the star layout)
  maxRanks: MaxRanks;
  bonus: number | "signature";
  /** Points that must be spent in LOWER tiers of this tree to unlock the node. */
  reqPoints: number;
  /** Slots in the next tier this node connects to (chart edges). */
  links: string[];
}

const TREE_TEMPLATE: readonly MasteryNodeTemplate[] = [
  { slot: "a", tier: 0, col: 0, maxRanks: 5, bonus: 0, reqPoints: 0, links: ["c"] },
  { slot: "b", tier: 0, col: 2, maxRanks: 5, bonus: 1, reqPoints: 0, links: ["c"] },
  { slot: "c", tier: 1, col: 1, maxRanks: 3, bonus: 2, reqPoints: 5, links: ["d", "e"] },
  { slot: "d", tier: 2, col: 0, maxRanks: 3, bonus: 3, reqPoints: 10, links: ["f"] },
  { slot: "e", tier: 2, col: 2, maxRanks: 3, bonus: 4, reqPoints: 10, links: ["f"] },
  { slot: "f", tier: 3, col: 1, maxRanks: 5, bonus: 5, reqPoints: 16, links: ["g"] },
  { slot: "g", tier: 4, col: 1, maxRanks: 1, bonus: "signature", reqPoints: 22, links: [] },
];

/** The capstone's single rank is this multiple of the signature's per-rank value. */
const CAPSTONE_MULT = 4;

// ── Mastery tree ids + per-weapon themes ──────────────────────────────────────
export type MasteryTreeId =
  | "swords"
  | "axes"
  | "hammers"
  | "guns"
  | "bows"
  | "crossbows"
  | "staves"
  | "spears"
  | "staffs";

interface MasteryThemeDef {
  id: MasteryTreeId;
  label: string;
  tagline: string;
  color: string;
  /** Ordered bonus kinds for template indices 0..5 (index 0 = signature). */
  bonuses: readonly [
    MasteryBonusKind,
    MasteryBonusKind,
    MasteryBonusKind,
    MasteryBonusKind,
    MasteryBonusKind,
    MasteryBonusKind,
  ];
  /** Flavor names for template slots a..g (7). */
  names: readonly [string, string, string, string, string, string, string];
}

const THEMES: readonly MasteryThemeDef[] = [
  {
    id: "swords",
    label: "Swords",
    tagline: "One-handed & two-handed blades — the balanced duelist.",
    color: "#7dd3fc",
    bonuses: ["crit", "damage", "attackSpeed", "critDamage", "armorPen", "lifesteal"],
    names: ["Honed Edge", "Tempered Steel", "Flurry", "Vital Strike", "Sundering Cuts", "Bloodletting", "Master Swordsman"],
  },
  {
    id: "axes",
    label: "Axes",
    tagline: "One-handed & two-handed axes — brutal, reckless damage.",
    color: "#ef4444",
    bonuses: ["damage", "critDamage", "armorPen", "crit", "lifesteal", "attackSpeed"],
    names: ["Savage Swings", "Brutal Cleave", "Rending Blows", "Reckless Fury", "Gore Drinker", "Frenzied Chops", "Berserker's Edge"],
  },
  {
    id: "hammers",
    label: "Hammers",
    tagline: "One-handed & two-handed hammers — crushing, armor-shattering force.",
    color: "#f59e0b",
    bonuses: ["critDamage", "armorPen", "damage", "crit", "attackSpeed", "lifesteal"],
    names: ["Crushing Blow", "Plate Breaker", "Heavy Impact", "Concussive Strike", "Momentum", "Lifebreaker", "Earthshatter"],
  },
  {
    id: "guns",
    label: "Guns",
    tagline: "Firearms — armor-piercing precision at range.",
    color: "#94a3b8",
    bonuses: ["armorPen", "crit", "attackSpeed", "damage", "critDamage", "lifesteal"],
    names: ["Armor Piercer", "Steady Aim", "Rapid Fire", "Heavy Rounds", "Kill Shot", "Siphon Rounds", "Deadeye"],
  },
  {
    id: "bows",
    label: "Bows",
    tagline: "Bows — agile, fast-firing marksmanship.",
    color: "#22c55e",
    bonuses: ["attackSpeed", "crit", "damage", "critDamage", "armorPen", "lifesteal"],
    names: ["Quick Draw", "Eagle Eye", "Power Shot", "Vital Aim", "Bodkin Tips", "Leeching Arrows", "Master Archer"],
  },
  {
    id: "crossbows",
    label: "Crossbows",
    tagline: "Crossbows — heavy bolts that punch through armor.",
    color: "#b45309",
    bonuses: ["armorPen", "critDamage", "crit", "damage", "attackSpeed", "lifesteal"],
    names: ["Bolt Driver", "Punch Through", "Marksmanship", "Heavy Bolts", "Crank Loader", "Draining Bolts", "Siege Sniper"],
  },
  {
    id: "staves",
    label: "Staves",
    tagline: "Battle staves — disciplined, sweeping melee force.",
    color: "#14b8a6",
    bonuses: ["damage", "crit", "critDamage", "attackSpeed", "lifesteal", "armorPen"],
    names: ["Focused Force", "Keen Insight", "Empowered Strikes", "Whirling Staff", "Spirit Siphon", "Mind Over Armor", "Staff Grandmaster"],
  },
  {
    id: "spears",
    label: "Spears",
    tagline: "Spears & polearms — swift, impaling reach.",
    color: "#e879f9",
    bonuses: ["attackSpeed", "damage", "crit", "armorPen", "critDamage", "lifesteal"],
    names: ["Swift Thrusts", "Impaling Force", "Precise Lunge", "Phalanx Pierce", "Skewer", "Bloodspear", "Dragoon's Reach"],
  },
  {
    id: "staffs",
    label: "Staffs",
    tagline: "Arcane staffs — bursting spellcraft and soul-draining magic.",
    color: "#a855f7",
    bonuses: ["critDamage", "damage", "crit", "lifesteal", "attackSpeed", "armorPen"],
    names: ["Arcane Surge", "Mana Burn", "Spell Crit", "Soul Tap", "Quickcast", "Mage Ward Pierce", "Archmage's Fury"],
  },
];

// ── Generated trees ───────────────────────────────────────────────────────────
export interface MasteryNode {
  /** Globally unique node id (`${treeId}.${slot}`). */
  id: string;
  treeId: MasteryTreeId;
  slot: string;
  label: string;
  /** Derived from the bonus kind + per-rank magnitude (never hand-authored). */
  description: string;
  tier: number;
  col: number;
  maxRanks: number;
  bonusKind: MasteryBonusKind;
  /** Percent granted per rank. */
  perRank: number;
  /** Points required in lower tiers of this tree to unlock the node. */
  reqPoints: number;
  /** Full node ids in the next tier this node links to (star edges). */
  links: string[];
  signature: boolean;
}

export interface MasteryTree {
  id: MasteryTreeId;
  label: string;
  tagline: string;
  color: string;
  nodes: MasteryNode[];
  /** Total points to fully fill this tree (sum of every node's maxRanks). */
  maxPoints: number;
}

function describeBonus(kind: MasteryBonusKind, perRank: number, maxRanks: number): string {
  const def = MASTERY_BONUS_DEFS[kind];
  const per = `+${perRank}% ${def.label}`;
  return maxRanks > 1 ? `${per} per rank` : per;
}

function buildTree(theme: MasteryThemeDef): MasteryTree {
  const nodes: MasteryNode[] = TREE_TEMPLATE.map((t) => {
    const bonusKind =
      t.bonus === "signature" ? theme.bonuses[0] : theme.bonuses[t.bonus];
    const basePer = MASTERY_BONUS_DEFS[bonusKind].perRank;
    const signature = t.bonus === "signature";
    const perRank = signature ? basePer * CAPSTONE_MULT : basePer;
    const slotIndex = "abcdefg".indexOf(t.slot);
    return {
      id: `${theme.id}.${t.slot}`,
      treeId: theme.id,
      slot: t.slot,
      label: theme.names[slotIndex],
      description: describeBonus(bonusKind, perRank, t.maxRanks),
      tier: t.tier,
      col: t.col,
      maxRanks: t.maxRanks,
      bonusKind,
      perRank,
      reqPoints: t.reqPoints,
      links: t.links.map((s) => `${theme.id}.${s}`),
      signature,
    };
  });
  const maxPoints = nodes.reduce((sum, n) => sum + n.maxRanks, 0);
  return { id: theme.id, label: theme.label, tagline: theme.tagline, color: theme.color, nodes, maxPoints };
}

export const MASTERY_TREES: readonly MasteryTree[] = THEMES.map(buildTree);

export const MASTERY_TREE_BY_ID: Record<MasteryTreeId, MasteryTree> = Object.fromEntries(
  MASTERY_TREES.map((t) => [t.id, t]),
) as Record<MasteryTreeId, MasteryTree>;

// ── Point economy ─────────────────────────────────────────────────────────────
/** Hard cap on mastery points a character can ever spend across all trees. */
export const MASTERY_POOL_CAP = 100;

/** Allocation: treeId → nodeId → ranks. */
export type MasteryAllocation = Record<string, Record<string, number>>;

/** Mastery points earned = 1 per character level, clamped to the shared pool. */
export function masteryPointsForLevel(level: number): number {
  return Math.max(0, Math.min(MASTERY_POOL_CAP, Math.floor(level || 0)));
}

/** Total points spent across every tree. */
export function masteryPointsSpent(alloc: MasteryAllocation): number {
  let total = 0;
  for (const tree of Object.values(alloc)) {
    for (const ranks of Object.values(tree)) total += ranks > 0 ? ranks : 0;
  }
  return total;
}

/** Points spent in a single tree. */
export function masteryPointsSpentInTree(alloc: MasteryAllocation, treeId: string): number {
  const tree = alloc[treeId];
  if (!tree) return 0;
  let total = 0;
  for (const ranks of Object.values(tree)) total += ranks > 0 ? ranks : 0;
  return total;
}

/** Ranks currently allocated to one node. */
export function masteryNodeRank(alloc: MasteryAllocation, treeId: string, nodeId: string): number {
  return alloc[treeId]?.[nodeId] ?? 0;
}

/** Points spent in tiers strictly below `tier` of a tree (the unlock gate). */
function pointsBelowTier(alloc: MasteryAllocation, tree: MasteryTree, tier: number): number {
  const treeAlloc = alloc[tree.id];
  if (!treeAlloc) return 0;
  let total = 0;
  for (const node of tree.nodes) {
    if (node.tier >= tier) continue;
    const r = treeAlloc[node.id] ?? 0;
    if (r > 0) total += r;
  }
  return total;
}

/** Whether a node's tier is unlocked given the current allocation. */
export function masteryNodeUnlocked(alloc: MasteryAllocation, tree: MasteryTree, node: MasteryNode): boolean {
  return pointsBelowTier(alloc, tree, node.tier) >= node.reqPoints;
}

export interface MasteryAllocCheck {
  ok: boolean;
  reason?: string;
}

/** Can the player add one rank to this node right now? */
export function canAllocateMastery(
  alloc: MasteryAllocation,
  level: number,
  tree: MasteryTree,
  node: MasteryNode,
): MasteryAllocCheck {
  if (masteryPointsSpent(alloc) >= masteryPointsForLevel(level)) {
    return { ok: false, reason: "No mastery points available" };
  }
  if (masteryNodeRank(alloc, tree.id, node.id) >= node.maxRanks) {
    return { ok: false, reason: "Already at max rank" };
  }
  if (!masteryNodeUnlocked(alloc, tree, node)) {
    return { ok: false, reason: `Requires ${node.reqPoints} points in ${tree.label}` };
  }
  return { ok: true };
}

function cloneAlloc(alloc: MasteryAllocation): MasteryAllocation {
  const out: MasteryAllocation = {};
  for (const [treeId, ranks] of Object.entries(alloc)) out[treeId] = { ...ranks };
  return out;
}

/** Every allocated node still satisfies its unlock gate (no stranded points). */
function treeAllocValid(alloc: MasteryAllocation, tree: MasteryTree): boolean {
  const treeAlloc = alloc[tree.id];
  if (!treeAlloc) return true;
  for (const node of tree.nodes) {
    const r = treeAlloc[node.id] ?? 0;
    if (r > 0 && !masteryNodeUnlocked(alloc, tree, node)) return false;
  }
  return true;
}

/** Returns a NEW allocation with one rank added, or null if the add is illegal. */
export function allocateMasteryNode(
  alloc: MasteryAllocation,
  level: number,
  tree: MasteryTree,
  node: MasteryNode,
): MasteryAllocation | null {
  if (!canAllocateMastery(alloc, level, tree, node).ok) return null;
  const next = cloneAlloc(alloc);
  next[tree.id] = { ...(next[tree.id] ?? {}) };
  next[tree.id][node.id] = (next[tree.id][node.id] ?? 0) + 1;
  return next;
}

/** Can one rank be removed without stranding any higher-tier points? */
export function canDeallocateMastery(alloc: MasteryAllocation, tree: MasteryTree, node: MasteryNode): boolean {
  if (masteryNodeRank(alloc, tree.id, node.id) <= 0) return false;
  const next = cloneAlloc(alloc);
  next[tree.id] = { ...(next[tree.id] ?? {}) };
  next[tree.id][node.id] = (next[tree.id][node.id] ?? 0) - 1;
  return treeAllocValid(next, tree);
}

/** Returns a NEW allocation with one rank removed, or null if illegal. */
export function deallocateMasteryNode(
  alloc: MasteryAllocation,
  tree: MasteryTree,
  node: MasteryNode,
): MasteryAllocation | null {
  if (!canDeallocateMastery(alloc, tree, node)) return null;
  const next = cloneAlloc(alloc);
  next[tree.id] = { ...(next[tree.id] ?? {}) };
  const left = (next[tree.id][node.id] ?? 0) - 1;
  if (left <= 0) delete next[tree.id][node.id];
  else next[tree.id][node.id] = left;
  return next;
}

/** Returns a NEW allocation with one tree fully refunded. */
export function resetMasteryTree(alloc: MasteryAllocation, treeId: string): MasteryAllocation {
  const next = cloneAlloc(alloc);
  delete next[treeId];
  return next;
}

// ── Bonus aggregation + stat wiring ───────────────────────────────────────────
export type MasteryBonusTotals = Record<MasteryBonusKind, number>;

function emptyTotals(): MasteryBonusTotals {
  return { damage: 0, crit: 0, critDamage: 0, attackSpeed: 0, armorPen: 0, lifesteal: 0 };
}

/** Sum every allocated node's bonus across all trees, grouped by bonus kind. */
export function aggregateMasteryBonuses(alloc: MasteryAllocation): MasteryBonusTotals {
  const totals = emptyTotals();
  for (const tree of MASTERY_TREES) {
    const treeAlloc = alloc[tree.id];
    if (!treeAlloc) continue;
    for (const node of tree.nodes) {
      const r = treeAlloc[node.id] ?? 0;
      if (r > 0) totals[node.bonusKind] += node.perRank * r;
    }
  }
  return totals;
}

/**
 * Sum the bonuses from a SINGLE mastery tree, grouped by bonus kind. This is the
 * weapon-type-scoped counterpart to `aggregateMasteryBonuses`: mastery invested
 * in a weapon type only buffs weapons of THAT type, so the character sheet folds
 * in just the active weapon's tree (not every tree at once).
 */
export function aggregateMasteryBonusesForTree(
  alloc: MasteryAllocation,
  treeId: string,
): MasteryBonusTotals {
  const totals = emptyTotals();
  const tree = MASTERY_TREE_BY_ID[treeId as MasteryTreeId];
  if (!tree) return totals;
  const treeAlloc = alloc[tree.id];
  if (!treeAlloc) return totals;
  for (const node of tree.nodes) {
    const r = treeAlloc[node.id] ?? 0;
    if (r > 0) totals[node.bonusKind] += node.perRank * r;
  }
  return totals;
}

/**
 * Fold mastery bonus totals into a derived stat record (mutates in place). The
 * single source of the bonus→stat mapping lives in MASTERY_BONUS_DEFS, so the
 * character stat engine and the headless harness apply the exact same wiring.
 */
export function applyMasteryBonusesToStats(
  stats: Record<string, number>,
  totals: Partial<MasteryBonusTotals>,
): void {
  for (const def of Object.values(MASTERY_BONUS_DEFS)) {
    const v = totals[def.kind] ?? 0;
    if (!v) continue;
    if (stats[def.statKey] === undefined) continue;
    if (def.mode === "mult") stats[def.statKey] *= 1 + v / 100;
    else stats[def.statKey] += v;
  }
}
