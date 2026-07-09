// ── GRUDGE NPC spec ───────────────────────────────────────────────────────────
//
// An NpcSpec is the authored, versioned description of a world NPC — a hero, a
// vendor, a quest-giver, or a trigger actor. It WRAPS an EntitySpec (the
// combat/identity payload: race/class/level/weapon/ai/systems/equipment) under
// `base` and layers the world-authoring fields on top: how its level behaves, who
// it sides with, how far it notices and defends, what it carries, what missions it
// offers, and how it talks.
//
// Like EntitySpec it is pure data with a deterministic GRUDGE ID and a portable
// wire code, and like the rest of game-content it relies only on lib.es5
// primitives (no DOM/Node globals) so the SAME module runs in browser apps, node
// build scripts, and the Cloudflare Worker that serves it.

import { grudgeId } from "./ids";
import type { EntitySpec, SpecItem, EntityFaction } from "./entitySpec";
import {
  canonicalSpec,
  canonicalItem,
  encodeB64urlJson,
  decodeB64urlJson,
  makeEntitySpec,
  isEntitySpecShape,
  ENTITY_FACTIONS,
} from "./entitySpec";

/** Bump when the NPC spec shape changes in a non-backward-compatible way. */
export const NPC_SPEC_VERSION = 1;

/**
 * How an NPC's level / damage behaves in the world:
 *  • player     — scales and fights like a player character (uses `base.level`).
 *  • vendor     — non-combatant shopkeeper; `inventory` is the stock.
 *  • invincible — cannot be killed (lore bosses, hub guards).
 *  • trigger    — no combat body; an actor that fires script / missions on use.
 */
export type NpcLevelMode = "player" | "vendor" | "invincible" | "trigger";

export interface NpcMissionRef {
  id: string;
  title: string;
  summary?: string;
  /** Item / quest ids required to complete. Order-independent. */
  requires?: string[];
  /** Reward item ids granted on completion. Order-independent. */
  rewards?: string[];
}

export interface NpcAiChat {
  /** Short persona descriptor that drives scripted / generated dialog. */
  persona: string;
  /** Canned lines — the scripted fallback before any LLM wiring exists. */
  lines: string[];
}

export interface NpcSpec {
  /** Spec format version (NPC_SPEC_VERSION). */
  v: number;
  /** Stable slug (matches the prefab id when compiled from a prefab). */
  id: string;
  name: string;
  title?: string;
  /** Combat / identity payload. */
  base: EntitySpec;
  levelMode: NpcLevelMode;
  faction: EntityFaction;
  /** World units at which the NPC notices / aggros. */
  aggroRadius: number;
  /** World units within which the NPC defends allies / objectives. */
  protectRadius: number;
  /** Carried / sellable items (vendor stock, loot seed). */
  inventory: SpecItem[];
  missions: NpcMissionRef[];
  aiChat: NpcAiChat;
  lore?: string;
}

const LEVEL_MODES: readonly NpcLevelMode[] = [
  "player",
  "vendor",
  "invincible",
  "trigger",
];

/** Build an NpcSpec from a partial, filling sensible defaults. */
export function makeNpcSpec(
  partial: Partial<NpcSpec> & Pick<NpcSpec, "id" | "name" | "base" | "faction">,
): NpcSpec {
  const spec: NpcSpec = {
    v: NPC_SPEC_VERSION,
    id: partial.id,
    name: partial.name,
    base: makeEntitySpec(partial.base),
    levelMode: partial.levelMode ?? "player",
    faction: partial.faction,
    aggroRadius: partial.aggroRadius ?? 12,
    protectRadius: partial.protectRadius ?? 8,
    inventory: partial.inventory ? [...partial.inventory] : [],
    missions: partial.missions ? partial.missions.map((m) => ({ ...m })) : [],
    aiChat: partial.aiChat
      ? { persona: partial.aiChat.persona, lines: [...partial.aiChat.lines] }
      : { persona: "", lines: [] },
  };
  if (partial.title != null) spec.title = partial.title;
  if (partial.lore != null) spec.lore = partial.lore;
  return spec;
}

// ── Canonicalization + deterministic id ───────────────────────────────────────

function canonicalMission(m: NpcMissionRef): string {
  const req = [...(m.requires ?? [])].sort();
  const rew = [...(m.rewards ?? [])].sort();
  return `${m.id}|req:${req.join(",")}|rew:${rew.join(",")}`;
}

/** Stable, canonical string for an NpcSpec (drives the deterministic GRUDGE ID). */
export function canonicalNpcSpec(spec: NpcSpec): string {
  const inv = spec.inventory.map(canonicalItem).sort();
  const missions = spec.missions.map(canonicalMission).sort();
  return [
    `nv${spec.v}`,
    `id:${spec.id}`,
    `base:${canonicalSpec(spec.base)}`,
    `mode:${spec.levelMode}`,
    `fac:${spec.faction}`,
    `aggro:${spec.aggroRadius}`,
    `protect:${spec.protectRadius}`,
    `inv:${inv.join(";")}`,
    `mis:${missions.join(";")}`,
    `persona:${spec.aiChat.persona}`,
  ].join("|");
}

/** Deterministic, human-facing GRUDGE ID for an NpcSpec (`GRDG-XXXXXX`). */
export function npcSpecGrudgeId(spec: NpcSpec): string {
  return grudgeId(canonicalNpcSpec(spec));
}

// ── Portable NPC code (compact wire form) ─────────────────────────────────────

const NPC_CODE_PREFIX = "GRDGN1.";

/** Encode an NpcSpec into a compact, copy-pasteable, URL-safe code. */
export function encodeNpcCode(spec: NpcSpec): string {
  return NPC_CODE_PREFIX + encodeB64urlJson(spec);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isSpecItemShape(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const it = v as Record<string, unknown>;
  return typeof it.id === "string" && typeof it.tier === "number";
}

function isMissionShape(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.id === "string" && typeof m.title === "string";
}

function isAiChatShape(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.persona === "string" && isStringArray(c.lines);
}

function isNpcSpecShape(o: unknown): o is NpcSpec {
  if (!o || typeof o !== "object") return false;
  const s = o as Record<string, unknown>;
  return (
    typeof s.v === "number" &&
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    isEntitySpecShape(s.base) &&
    typeof s.levelMode === "string" &&
    LEVEL_MODES.includes(s.levelMode as NpcLevelMode) &&
    typeof s.faction === "string" &&
    ENTITY_FACTIONS.includes(s.faction as EntityFaction) &&
    Array.isArray(s.inventory) &&
    s.inventory.every(isSpecItemShape) &&
    Array.isArray(s.missions) &&
    s.missions.every(isMissionShape) &&
    isAiChatShape(s.aiChat)
  );
}

/**
 * Decode an NPC code back into a normalized NpcSpec, or null if it is malformed /
 * not a GRUDGE NPC code. Unknown future fields are dropped (normalized to v1).
 */
export function decodeNpcCode(code: string): NpcSpec | null {
  if (typeof code !== "string" || !code.startsWith(NPC_CODE_PREFIX)) return null;
  try {
    const parsed = decodeB64urlJson(code.slice(NPC_CODE_PREFIX.length));
    if (!isNpcSpecShape(parsed)) return null;
    return makeNpcSpec(parsed);
  } catch {
    return null;
  }
}

// ── Bundled descriptor ────────────────────────────────────────────────────────

export interface NpcDescriptor {
  spec: NpcSpec;
  /** Deterministic GRUDGE ID (`GRDG-XXXXXX`). */
  grudgeId: string;
  /** Compact, round-trippable NPC code. */
  code: string;
}

/** Resolve every derived identity/codec output for an NpcSpec in one call. */
export function describeNpc(spec: NpcSpec): NpcDescriptor {
  return {
    spec,
    grudgeId: npcSpecGrudgeId(spec),
    code: encodeNpcCode(spec),
  };
}
