// ── GRUDGE spawn descriptor ───────────────────────────────────────────────────
//
// A typed, versioned description of "all the things we want to put out" when we
// spawn an entity — e.g. a human ranger, level 10, bow, medium AI difficulty,
// defensive behavior, with pathfinding / controller / animations included.
//
// Design principle: a UUID is an opaque *handle*, never a data bag. So identity
// and spec are separated into layers:
//
//   • EntitySpec   — the typed, versioned payload (this file). The source of truth.
//   • GRUDGE ID    — `GRDG-XXXXXX`, deterministic, human-facing, hashed from the
//                    *canonical* spec. Same build → same id (see `specGrudgeId`).
//   • Spawn code   — a portable, copy-pasteable token that CARRIES the whole spec.
//                    Compact wire form `GRDG1.<base64url>` (round-trips) plus a
//                    one-way human-readable debug form (`specToReadable`).
//   • Instance UUID— `generateGrudgeUUID("HERO")` from ids.ts, one per live entity.
//
// Animations / skills / stats are DERIVED from race+class+weapon at spawn time
// (the prefab system already does this) and are intentionally NOT stored here —
// the spec only records *that* they are included. This keeps the payload light.

import { hash32, grudgeId } from "./ids";
import type { ApiWeaponId } from "./apiWeaponMatrix";
import type { ClassId } from "./classes";
import type { WeaponType } from "./index";

/** Bump when the spec shape changes in a non-backward-compatible way. */
export const ENTITY_SPEC_VERSION = 1;

export type EntityRaceId =
  | "human"
  | "barbarian"
  | "dwarf"
  | "elf"
  | "orc"
  | "undead";

export type AiDifficulty = "easy" | "medium" | "hard" | "elite";
export type AiBehavior =
  | "defensive"
  | "aggressive"
  | "passive"
  | "support"
  | "patrol";
export type EntityFaction = "crusade" | "fabled" | "legion" | "neutral";

/** Runtime list of valid factions (decode/validation guard). */
export const ENTITY_FACTIONS: readonly EntityFaction[] = [
  "crusade",
  "fabled",
  "legion",
  "neutral",
];

const RACES: readonly EntityRaceId[] = [
  "human",
  "barbarian",
  "dwarf",
  "elf",
  "orc",
  "undead",
];
const CLASSES: readonly ClassId[] = ["mage", "warrior", "ranger", "worge"];

/** Authoritative runtime lists of valid spec race/class ids (decode + drift checks). */
export const ENTITY_RACE_IDS: readonly EntityRaceId[] = RACES;
export const ENTITY_CLASS_IDS: readonly ClassId[] = CLASSES;

// ── Equipment ─────────────────────────────────────────────────────────────────
//
// Every equipped item is itself addressable: its fingerprint changes whenever it
// is upgraded (tier), enhanced, or enchanted, so a piece of gear has a stable id
// that *updates as the gear updates*. The combination of all equipped slots rolls
// up into a single deterministic `equipmentHash` — a lightweight, accurate way to
// pass "the whole loadout" without serializing every stat.

export interface SpecItem {
  /** Base item slug, e.g. "item.bow.longbow". */
  id: string;
  /** Upgrade tier (0 = base). */
  tier: number;
  /** Enhancement ids (forge/temper upgrades). Order-independent. */
  enhancements: string[];
  /** Enchantment ids (magical affixes). Order-independent. */
  enchantments: string[];
}

/** slot id (e.g. "mainhand") → equipped item. */
export type SpecEquipment = Record<string, SpecItem>;

/** Canonical, order-independent string for a single item. */
export function canonicalItem(item: SpecItem): string {
  const enh = [...item.enhancements].sort();
  const ench = [...item.enchantments].sort();
  return `${item.id}#t${item.tier}|enh:${enh.join(",")}|ench:${ench.join(",")}`;
}

/**
 * Deterministic fingerprint for an item. Changes whenever the item is tiered up,
 * enhanced, or enchanted — so it doubles as a "this exact item state" id.
 */
export function itemFingerprint(item: SpecItem): string {
  return `ITM-${hash32(canonicalItem(item))}`;
}

/** Canonical string for a full loadout (slots sorted, each item canonicalized). */
export function canonicalEquipment(equip: SpecEquipment): string {
  return Object.keys(equip)
    .sort()
    .map((slot) => `${slot}=${canonicalItem(equip[slot]!)}`)
    .join(";");
}

/**
 * Deterministic rollup of ALL equipped gear — the "equipment hash". Two characters
 * with the same gear (same tiers/enhancements/enchantments in the same slots)
 * share an equipment hash; change any one piece and the hash changes.
 */
export function equipmentHash(equip: SpecEquipment): string {
  return `EQP-${hash32(canonicalEquipment(equip))}`;
}

// ── Entity spec ───────────────────────────────────────────────────────────────

export interface EntitySpec {
  /** Spec format version (ENTITY_SPEC_VERSION). */
  v: number;
  race: EntityRaceId;
  class: ClassId;
  level: number;
  weapon: WeaponType;
  /** Live API weapon id when known (canonical prefab loadouts). */
  apiWeapon?: ApiWeaponId;
  /** Off-hand modifier (SHIELD / TOME) when equipped. */
  offhand?: ApiWeaponId;
  ai: {
    difficulty: AiDifficulty;
    behavior: AiBehavior;
  };
  /** Which engine systems travel with this entity when spawned. */
  systems: {
    pathfinding: boolean;
    controller: boolean;
    animations: boolean;
  };
  faction?: EntityFaction;
  /** Optional worge animal-form override (e.g. "bear" / "boar" / "goat"). */
  form?: string;
  /** Optional body scale multiplier (1 = default). */
  scale?: number;
  /** Optional equipment loadout (slot id → item). */
  equipment?: SpecEquipment;
}

/** Build a spec from a partial, filling sensible defaults. Drops unknown fields. */
export function makeEntitySpec(
  partial: Partial<EntitySpec> & Pick<EntitySpec, "race" | "class">,
): EntitySpec {
  const spec: EntitySpec = {
    v: ENTITY_SPEC_VERSION,
    race: partial.race,
    class: partial.class,
    level: partial.level ?? 1,
    weapon: partial.weapon ?? "sword",
    ai: {
      difficulty: partial.ai?.difficulty ?? "medium",
      behavior: partial.ai?.behavior ?? "defensive",
    },
    systems: {
      pathfinding: partial.systems?.pathfinding ?? true,
      controller: partial.systems?.controller ?? true,
      animations: partial.systems?.animations ?? true,
    },
  };
  if (partial.apiWeapon) spec.apiWeapon = partial.apiWeapon;
  if (partial.offhand) spec.offhand = partial.offhand;
  if (partial.faction) spec.faction = partial.faction;
  if (partial.form) spec.form = partial.form;
  if (partial.scale != null) spec.scale = partial.scale;
  if (partial.equipment && Object.keys(partial.equipment).length) {
    spec.equipment = partial.equipment;
  }
  return spec;
}

/** Stable, canonical string for a whole spec (drives the deterministic GRUDGE ID). */
export function canonicalSpec(spec: EntitySpec): string {
  const parts = [
    `v${spec.v}`,
    `race:${spec.race}`,
    `class:${spec.class}`,
    `lvl:${spec.level}`,
    `wpn:${spec.weapon}`,
    `ai:${spec.ai.difficulty}/${spec.ai.behavior}`,
    `sys:${spec.systems.pathfinding ? 1 : 0}${spec.systems.controller ? 1 : 0}${
      spec.systems.animations ? 1 : 0
    }`,
  ];
  if (spec.apiWeapon) parts.push(`api:${spec.apiWeapon}`);
  if (spec.offhand) parts.push(`off:${spec.offhand}`);
  if (spec.faction) parts.push(`fac:${spec.faction}`);
  if (spec.form) parts.push(`form:${spec.form}`);
  if (spec.scale != null) parts.push(`scale:${spec.scale}`);
  if (spec.equipment && Object.keys(spec.equipment).length) {
    parts.push(`eqp:${equipmentHash(spec.equipment)}`);
  }
  return parts.join("|");
}

/** Deterministic, human-facing GRUDGE ID for a spec (`GRDG-XXXXXX`). */
export function specGrudgeId(spec: EntitySpec): string {
  return grudgeId(canonicalSpec(spec));
}

// ── Portable spawn code (compact wire form) ───────────────────────────────────

const SPAWN_CODE_PREFIX = "GRDG1.";
const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charAt(i)] = i;

// Self-contained UTF-8 codec (no TextEncoder/TextDecoder). game-content is a
// shared lib compiled without DOM/Node global typings, so the spawn-code codec
// must rely only on lib.es5 primitives (charCodeAt / String.fromCharCode) to
// stay portable across every consumer (browser apps + node scripts).
function utf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

function utf8Decode(bytes: number[]): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if (b0 < 0xe0) {
      const b1 = (bytes[i++] ?? 0) & 0x3f;
      out += String.fromCharCode(((b0 & 0x1f) << 6) | b1);
    } else if (b0 < 0xf0) {
      const b1 = (bytes[i++] ?? 0) & 0x3f;
      const b2 = (bytes[i++] ?? 0) & 0x3f;
      out += String.fromCharCode(((b0 & 0x0f) << 12) | (b1 << 6) | b2);
    } else {
      const b1 = (bytes[i++] ?? 0) & 0x3f;
      const b2 = (bytes[i++] ?? 0) & 0x3f;
      const b3 = (bytes[i++] ?? 0) & 0x3f;
      const cp =
        (((b0 & 0x07) << 18) | (b1 << 12) | (b2 << 6) | b3) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

function bytesToB64url(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = hasB1 ? bytes[i + 1] ?? 0 : 0;
    const b2 = hasB2 ? bytes[i + 2] ?? 0 : 0;
    out += B64.charAt(b0 >> 2);
    out += B64.charAt(((b0 & 3) << 4) | (b1 >> 4));
    if (hasB1) out += B64.charAt(((b1 & 15) << 2) | (b2 >> 6));
    if (hasB2) out += B64.charAt(b2 & 63);
  }
  return out;
}

function b64urlToBytes(str: string): number[] {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const c = B64_LOOKUP[str.charAt(i)];
    if (c === undefined) continue;
    buffer = (buffer << 6) | c;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

/** Generic URL-safe base64url JSON codec — shared by every GRUDGE wire code. */
export function encodeB64urlJson(value: unknown): string {
  return bytesToB64url(utf8Bytes(JSON.stringify(value)));
}

/** Inverse of `encodeB64urlJson`. Throws on malformed input (callers guard). */
export function decodeB64urlJson(text: string): unknown {
  return JSON.parse(utf8Decode(b64urlToBytes(text)));
}

/** Encode a spec into a compact, copy-pasteable, URL-safe spawn code. */
export function encodeSpawnCode(spec: EntitySpec): string {
  return SPAWN_CODE_PREFIX + encodeB64urlJson(spec);
}

export function isEntitySpecShape(o: unknown): o is EntitySpec {
  if (!o || typeof o !== "object") return false;
  const s = o as Record<string, unknown>;
  return (
    typeof s.v === "number" &&
    typeof s.race === "string" &&
    RACES.includes(s.race as EntityRaceId) &&
    typeof s.class === "string" &&
    CLASSES.includes(s.class as ClassId) &&
    typeof s.level === "number" &&
    typeof s.weapon === "string" &&
    typeof s.ai === "object" &&
    s.ai !== null &&
    typeof s.systems === "object" &&
    s.systems !== null &&
    (s.faction === undefined ||
      (typeof s.faction === "string" &&
        ENTITY_FACTIONS.includes(s.faction as EntityFaction)))
  );
}

/**
 * Decode a spawn code back into a normalized spec, or null if it is malformed /
 * not a GRUDGE spawn code. Unknown future fields are dropped (normalized to v1).
 */
export function decodeSpawnCode(code: string): EntitySpec | null {
  if (typeof code !== "string" || !code.startsWith(SPAWN_CODE_PREFIX)) {
    return null;
  }
  try {
    const parsed = decodeB64urlJson(code.slice(SPAWN_CODE_PREFIX.length));
    if (!isEntitySpecShape(parsed)) return null;
    return makeEntitySpec(parsed);
  } catch {
    return null;
  }
}

// ── Readable debug form (one-way) ─────────────────────────────────────────────

/**
 * Human-readable, one-way rendering of a spec for debugging / inspection, e.g.
 * `human.ranger.l10.bow.ai-medium.defensive+path+ctrl+anim`. Not a wire format —
 * use `encodeSpawnCode` / `decodeSpawnCode` to round-trip.
 */
export function specToReadable(spec: EntitySpec): string {
  const flags = [
    spec.systems.pathfinding ? "path" : null,
    spec.systems.controller ? "ctrl" : null,
    spec.systems.animations ? "anim" : null,
  ]
    .filter(Boolean)
    .join("+");
  let s = `${spec.race}.${spec.class}.l${spec.level}.${spec.weapon}.ai-${spec.ai.difficulty}.${spec.ai.behavior}`;
  if (flags) s += `+${flags}`;
  if (spec.faction) s += `.${spec.faction}`;
  if (spec.form) s += `.form-${spec.form}`;
  if (spec.equipment && Object.keys(spec.equipment).length) {
    s += `.${equipmentHash(spec.equipment).toLowerCase()}`;
  }
  return s;
}

// ── Bundled descriptor ────────────────────────────────────────────────────────

export interface SpawnDescriptor {
  spec: EntitySpec;
  /** Deterministic GRUDGE ID (`GRDG-XXXXXX`). */
  grudgeId: string;
  /** Equipment rollup hash, or null when nothing is equipped. */
  equipmentHash: string | null;
  /** Compact, round-trippable spawn code. */
  code: string;
  /** One-way readable debug string. */
  readable: string;
}

/** Resolve every derived identity/codec output for a spec in one call. */
export function describeSpec(spec: EntitySpec): SpawnDescriptor {
  const hasGear = !!(spec.equipment && Object.keys(spec.equipment).length);
  return {
    spec,
    grudgeId: specGrudgeId(spec),
    equipmentHash: hasGear ? equipmentHash(spec.equipment!) : null,
    code: encodeSpawnCode(spec),
    readable: specToReadable(spec),
  };
}
