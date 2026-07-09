// ── GRUDGE identity ───────────────────────────────────────────────────────────
//
// One shared identity scheme so a character authored in the character-viewer can
// be understood by the playable game artifact.
//
//  • Slug      — stable, URL-safe definition id (never changes once minted).
//  • GRUDGE ID — short, deterministic, human-facing character code (GRDG-XXXXXX).
//  • UUID      — prefixed instance id: {PREFIX}-{TIMESTAMP}-{SEQUENCE}-{HASH}.
//
// Definitions are referenced by slug; instances (a specific saved hero, a
// crafted item) are referenced by UUID.

export type GrudgeUUIDPrefix =
  | "ITEM" // weapon · armor · consumable
  | "MAT" // crafting material
  | "HERO" // player hero
  | "MOB" // enemy · boss
  | "SKIL" // ability · skill
  | "SPRT" // sprite · icon asset
  | "MISS"; // mission · quest

/** URL-safe, lowercase, hyphenated identifier. Stable across data updates. */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Small deterministic 32-bit hash (FNV-1a) → uppercase hex. */
export function hash32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Deterministic, human-facing character code derived from a seed (e.g. the
 * race+class+picks signature). Same seed → same code, across viewer and game.
 */
export function grudgeId(seed: string): string {
  return `GRDG-${hash32(seed).slice(0, 6)}`;
}

let __seq = 0;

/**
 * Instance UUID: {PREFIX}-{TIMESTAMP}-{SEQUENCE}-{HASH}.
 * Use for persistent instances (saved heroes, crafted items), not definitions.
 */
export function generateGrudgeUUID(prefix: GrudgeUUIDPrefix): string {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const seq = (__seq++).toString().padStart(6, "0");
  const h = hash32(`${prefix}-${ts}-${seq}-${Math.random()}`);
  return `${prefix}-${ts}-${seq}-${h}`;
}

export interface ParsedGrudgeUUID {
  prefix: string;
  timestamp: string;
  sequence: string;
  hash: string;
}

export function parseGrudgeUUID(uuid: string): ParsedGrudgeUUID | null {
  const m = uuid.match(/^([A-Z]+)-(\d{14})-(\d{6})-([0-9A-F]{8})$/);
  if (!m) return null;
  return { prefix: m[1], timestamp: m[2], sequence: m[3], hash: m[4] };
}
