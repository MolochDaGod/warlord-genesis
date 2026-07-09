// ── Harvest tools ─────────────────────────────────────────────────────────────
//
// Tools are only equipped in harvest mode. Each tool attaches to a hand bone
// socket, plays a harvest animation, and gathers a set of harvest node types.
// This is the data contract the game uses to (a) parent the tool mesh to the
// right hand bone and (b) route the correct gather animation per node.

import type { WeaponType } from "./index";

export type HandSocket = "rightHand" | "leftHand";

export interface HarvestToolDef {
  id: string;
  label: string;
  /** Weapon family the tool behaves as (drives skill tree + swing). */
  type: WeaponType;
  /** Hand bone the tool mesh parents to. */
  socket: HandSocket;
  /** Animation key (animations.ts) played while gathering. */
  animKey: string;
  /** Harvest node ids/types this tool can gather. */
  gathers: string[];
  /** Optional GLTF/GLB model path under the shared assets. */
  model?: string;
  /** Emoji glyph used as a placeholder icon until a real tool icon ships. */
  glyph?: string;
  /**
   * SEAM: true when the real 3D tool mesh + gather animation clip are not yet
   * shipped. UI surfaces an "awaiting asset" badge and the viewer falls back to
   * the placeholder gather clip instead of equipping a mesh that doesn't exist.
   */
  awaitingAsset?: boolean;
  description: string;
}

export const HARVEST_TOOLS: HarvestToolDef[] = [
  {
    id: "tool.pickaxe",
    label: "Pickaxe",
    type: "pick",
    socket: "rightHand",
    animKey: "mine",
    gathers: ["node.ore", "node.stone", "node.crystal"],
    model: "tools/pickaxe/pickaxe.glb",
    glyph: "⛏️",
    awaitingAsset: false,
    description: "Mines ore, stone and crystal nodes.",
  },
  {
    id: "tool.axe",
    label: "Felling Axe",
    type: "axe",
    socket: "rightHand",
    animKey: "chop_tree",
    gathers: ["node.tree", "node.deadwood"],
    model: "tools/axe/axe.glb",
    glyph: "🪓",
    awaitingAsset: false,
    description: "Chops trees and gathers wood.",
  },
  {
    id: "tool.sickle",
    label: "Sickle",
    type: "other",
    socket: "rightHand",
    animKey: "harvest",
    gathers: ["node.fiber", "node.herb", "node.crop"],
    model: "tools/scythe/scythe.glb",
    glyph: "🌾",
    awaitingAsset: false,
    description: "Harvests fiber, herbs and crops.",
  },
  {
    id: "tool.hoe",
    label: "Hoe",
    type: "other",
    socket: "rightHand",
    animKey: "plant_seed",
    gathers: ["node.soil"],
    model: "tools/hoe/hoe.glb",
    glyph: "🪏",
    awaitingAsset: false,
    description: "Tills soil and plants seeds.",
  },
  {
    id: "tool.watering_can",
    label: "Watering Can",
    type: "other",
    socket: "rightHand",
    animKey: "watering",
    gathers: ["node.crop"],
    model: "tools/watering-can/watering-can.glb",
    glyph: "🪣",
    awaitingAsset: false,
    description: "Waters planted crops.",
  },
  {
    id: "tool.fishingrod",
    label: "Fishing Rod",
    type: "fishing",
    socket: "rightHand",
    animKey: "fish",
    gathers: ["node.fish"],
    // First harvest tool with a real mesh. Path is relative to the viewer's
    // public assets root; the viewer prefixes it with BASE_URL + "assets/".
    model: "tools/fishing-rod/FishingRod_A.glb",
    glyph: "🎣",
    awaitingAsset: false,
    description: "Cast into fishing spots to reel in fish.",
  },
];

export const HARVEST_TOOL_BY_ID: Record<string, HarvestToolDef> = Object.fromEntries(
  HARVEST_TOOLS.map((t) => [t.id, t]),
);

/** The order tools cycle through with the "harvest_cycle" action. */
export const TOOL_CYCLE_ORDER: string[] = HARVEST_TOOLS.map((t) => t.id);

// ── Bare-hand fallback ────────────────────────────────────────────────────────
//
// When no tool is equipped (or the player un-equips), gathering still works for
// the simplest forageable nodes. This needs no 3D mesh — only a gather anim —
// so it's the safe default the viewer falls back to before any tool asset ships.
export const BARE_HAND_TOOL: HarvestToolDef = {
  id: "tool.hand",
  label: "Bare Hands",
  type: "other",
  socket: "rightHand",
  animKey: "harvest",
  gathers: ["node.fiber", "node.herb", "node.deadwood"],
  glyph: "✋",
  awaitingAsset: false,
  description: "Forage loose fiber, herbs and deadwood by hand — no tool needed.",
};

/** Tools plus the bare-hand fallback, for pickers that offer "unequip". */
export const HARVEST_TOOLS_WITH_HAND: HarvestToolDef[] = [BARE_HAND_TOOL, ...HARVEST_TOOLS];

// ── Harvest node catalog ──────────────────────────────────────────────────────
//
// The single source of truth for the gatherable node *kinds* referenced by every
// tool's `gathers` array. Both apps read this to label nodes, pick icons, and map
// a node back to the tool that works it.
export interface HarvestNodeKind {
  /** Stable id used in tool.gathers (e.g. "node.ore"). */
  id: string;
  label: string;
  /** Tool id that gathers this node (primary). */
  tool: string;
  /** Raw material/resource produced (display label). */
  resource: string;
  /** Emoji glyph placeholder until a real node icon ships. */
  glyph: string;
  /** Theme color hint (hex) for UI accents. */
  color: string;
}

export const HARVEST_NODE_KINDS: HarvestNodeKind[] = [
  { id: "node.ore", label: "Ore Vein", tool: "tool.pickaxe", resource: "Metal Ore", glyph: "🪨", color: "#b08d57" },
  { id: "node.stone", label: "Stone Deposit", tool: "tool.pickaxe", resource: "Stone", glyph: "🗿", color: "#9aa0a6" },
  { id: "node.crystal", label: "Crystal Cluster", tool: "tool.pickaxe", resource: "Crystal", glyph: "💎", color: "#60a5fa" },
  { id: "node.tree", label: "Tree", tool: "tool.axe", resource: "Wood", glyph: "🌲", color: "#4ade80" },
  { id: "node.deadwood", label: "Deadwood", tool: "tool.axe", resource: "Kindling", glyph: "🪵", color: "#a16207" },
  { id: "node.fiber", label: "Fiber Plant", tool: "tool.sickle", resource: "Fiber", glyph: "🌿", color: "#84cc16" },
  { id: "node.herb", label: "Herb", tool: "tool.sickle", resource: "Herb", glyph: "🍃", color: "#22c55e" },
  { id: "node.crop", label: "Crop", tool: "tool.sickle", resource: "Produce", glyph: "🌽", color: "#facc15" },
  { id: "node.soil", label: "Tilled Soil", tool: "tool.hoe", resource: "Plot", glyph: "🟫", color: "#92400e" },
  { id: "node.fish", label: "Fishing Spot", tool: "tool.fishingrod", resource: "Fish", glyph: "🐟", color: "#38bdf8" },
  { id: "node.hide", label: "Beast Carcass", tool: "tool.knife", resource: "Hide & Meat", glyph: "🥩", color: "#b45309" },
];

export const HARVEST_NODE_BY_ID: Record<string, HarvestNodeKind> = Object.fromEntries(
  HARVEST_NODE_KINDS.map((n) => [n.id, n]),
);

/** All node defs a given tool can gather (resolves ids → defs, drops unknowns). */
export function nodesForTool(toolId: string): HarvestNodeKind[] {
  const tool = toolId === BARE_HAND_TOOL.id ? BARE_HAND_TOOL : HARVEST_TOOL_BY_ID[toolId];
  if (!tool) return [];
  return tool.gathers.map((id) => HARVEST_NODE_BY_ID[id]).filter((n): n is HarvestNodeKind => Boolean(n));
}

/**
 * The tool that works a node. Prefers the node's declared `tool`; falls back to
 * the first tool whose `gathers` includes it, then to bare hands when nothing
 * else applies (so a node is never un-gatherable).
 */
export function toolForNode(nodeId: string): HarvestToolDef {
  const node = HARVEST_NODE_BY_ID[nodeId];
  if (node && HARVEST_TOOL_BY_ID[node.tool]) return HARVEST_TOOL_BY_ID[node.tool];
  const byGather = HARVEST_TOOLS.find((t) => t.gathers.includes(nodeId));
  if (byGather) return byGather;
  return BARE_HAND_TOOL;
}
