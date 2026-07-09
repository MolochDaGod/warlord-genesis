// ── Combat math (single source of truth) ──────────────────────────────────────
//
// Pure, framework-agnostic implementation of the GRUDGE combat model documented
// at https://info.grudge-studio.com/stats-guide.html. There are NO DOM/Node
// globals here (only `Math`) so this stays importable by the shared libs, the
// api-server, the Cloudflare worker, the /world UI, and the headless math
// harness alike.
//
// Consumers:
//   • the character stat engine (diminishing returns on allocated points),
//   • the /world action bar (per-skill damage display),
//   • any future damage resolution (resolveAttack is the full pipeline).

// ── Diminishing returns ───────────────────────────────────────────────────────
// The first 25 points in an attribute give full value, the next 25 (26–50) give
// half, and everything from point 51 up gives a quarter.
export const DR_FULL_CAP = 25;
export const DR_HALF_CAP = 50;

/** Allocated points → effective points after diminishing returns. */
export function effectivePoints(points: number): number {
  const p = Math.max(0, points);
  const full = Math.min(p, DR_FULL_CAP);
  const half = Math.min(Math.max(p - DR_FULL_CAP, 0), DR_HALF_CAP - DR_FULL_CAP);
  const quarter = Math.max(p - DR_HALF_CAP, 0);
  return full + half * 0.5 + quarter * 0.25;
}

/** TotalStat = base + perPointGain × EffectivePoints(points). */
export function totalStat(base: number, perPoint: number, points: number): number {
  return base + perPoint * effectivePoints(points);
}

// ── Defense mitigation ────────────────────────────────────────────────────────
// DamageTaken = Incoming × (100 − √Defense) / 100. √Defense is the percentage
// mitigated, clamped to [0, 100] — at 10000 defense a hit is fully negated.
export const DEFENSE_FULL_CAP = 10000;

/** Fraction (0..1) of incoming damage removed by a defense value. */
export function defenseMitigationPct(defense: number): number {
  return Math.min(100, Math.sqrt(Math.max(0, defense))) / 100;
}

/** Apply √defense mitigation to an incoming damage amount. */
export function mitigatedDamage(incoming: number, defense: number): number {
  return Math.max(0, incoming) * (1 - defenseMitigationPct(defense));
}

// ── Secondary effect caps ─────────────────────────────────────────────────────
// Lifesteal (drain), reflect, and absorb each cap at 50%.
export const SECONDARY_CAP = 0.5;

/** Clamp a secondary-effect fraction to the legal [0, 0.5] range. */
export function clampSecondary(frac: number): number {
  return Math.min(SECONDARY_CAP, Math.max(0, frac));
}

// ── Tiers (T1–T8; T5 Heroic, T8 Legendary per the guide) ──────────────────────
export type TierId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export interface TierDef {
  id: TierId;
  label: string;
  color: string;
}
// Guide pins T5 = Heroic and T8 = Legendary; the intermediate names are chosen to
// match the existing rarity ramp in the kit (common → legendary).
export const TIERS: readonly TierDef[] = [
  { id: 1, label: "Common", color: "#9aa0a6" },
  { id: 2, label: "Uncommon", color: "#4ade80" },
  { id: 3, label: "Rare", color: "#60a5fa" },
  { id: 4, label: "Epic", color: "#c084fc" },
  { id: 5, label: "Heroic", color: "#fb923c" },
  { id: 6, label: "Mythic", color: "#f43f5e" },
  { id: 7, label: "Ascended", color: "#22d3ee" },
  { id: 8, label: "Legendary", color: "#fde047" },
];

/** Resolve a (clamped) tier id to its definition. */
export function tierFor(id: number): TierDef {
  const i = Math.min(TIERS.length, Math.max(1, Math.round(id)));
  return TIERS[i - 1];
}

// ── Attack resolution (the 8-step pipeline) ───────────────────────────────────
export const ATTACK_VARIANCE = 0.25;

export interface AttackParams {
  /** Pre-mitigation base damage (level + attributes + equipment + skill power). */
  baseDamage: number;
  /** Defender's defense (physical) or resistance (magical). */
  defenderDefense?: number;
  /** Flat defense ignored by the attacker (armour penetration). */
  armorPenFlat?: number;
  /** Fraction of defense ignored, 0..1 (defense break). */
  armorPenPct?: number;
  /** Crit multiplier on a crit (e.g. 1.5 = +50% damage). */
  critMult?: number;
  /** Crit chance, 0..1. */
  critChance?: number;
  /** Block chance, 0..1. */
  blockChance?: number;
  /** Fraction of damage removed by a block, 0..1. */
  blockReduction?: number;
  /** Lifesteal fraction healed to the attacker (capped 50%). */
  drain?: number;
  /** Fraction reflected back to the attacker (capped 50%; not on a blocked hit). */
  reflect?: number;
  /** Fraction absorbed by the defender into a resource/shield (capped 50%). */
  absorb?: number;
  /** Deterministic rolls (0..1). Omit any to fall back to `rng`/Math.random. */
  varianceRoll?: number;
  blockRoll?: number;
  critRoll?: number;
  rng?: () => number;
}

export interface AttackResult {
  base: number;
  effectiveDefense: number;
  afterMitigation: number;
  afterVariance: number;
  blocked: boolean;
  crit: boolean;
  /** Damage dealt before the defender's absorb is applied. */
  damage: number;
  /** Final damage applied to the defender (after absorb). */
  netDamage: number;
  /** Health healed back to the attacker (lifesteal). */
  drainHeal: number;
  /** Damage reflected back to the attacker. */
  reflectDamage: number;
  /** Damage absorbed by the defender. */
  absorbed: number;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Resolve one attack through the full 8-step pipeline:
 *   1. base damage
 *   2. defense break (armour penetration reduces effective defense)
 *   3. √defense mitigation
 *   4. ±25% damage variance
 *   5. block check (BEFORE crit — a blocked hit can neither crit nor reflect)
 *   6. crit check (unblocked hits only)
 *   7. apply
 *   8. trigger drain / reflect / absorb (each capped at 50%)
 */
export function resolveAttack(p: AttackParams): AttackResult {
  const rng = p.rng ?? Math.random;
  const varianceRoll = p.varianceRoll ?? rng();
  const blockRoll = p.blockRoll ?? rng();
  const critRoll = p.critRoll ?? rng();

  const base = Math.max(0, p.baseDamage);

  // 1–2: base + defense break.
  const rawDefense = Math.max(0, p.defenderDefense ?? 0);
  const effectiveDefense = Math.max(
    0,
    rawDefense * (1 - clamp01(p.armorPenPct ?? 0)) - Math.max(0, p.armorPenFlat ?? 0),
  );

  // 3: √defense mitigation.
  const afterMitigation = mitigatedDamage(base, effectiveDefense);

  // 4: ±25% variance (roll 0 → −25%, 0.5 → 0, 1 → +25%).
  const varianceMult = 1 + (clamp01(varianceRoll) * 2 - 1) * ATTACK_VARIANCE;
  const afterVariance = afterMitigation * varianceMult;

  // 5: block (before crit).
  const blocked = blockRoll < clamp01(p.blockChance ?? 0);
  let dmg = blocked ? afterVariance * (1 - clamp01(p.blockReduction ?? 0)) : afterVariance;

  // 6: crit (unblocked only).
  const crit = !blocked && critRoll < clamp01(p.critChance ?? 0);
  if (crit) dmg *= Math.max(1, p.critMult ?? 1.5);

  // 7: apply.
  const damage = Math.max(0, dmg);

  // 8: trigger effects.
  const absorbed = damage * clampSecondary(p.absorb ?? 0);
  const netDamage = Math.max(0, damage - absorbed);
  const drainHeal = damage * clampSecondary(p.drain ?? 0);
  const reflectDamage = blocked ? 0 : damage * clampSecondary(p.reflect ?? 0);

  return {
    base,
    effectiveDefense,
    afterMitigation,
    afterVariance,
    blocked,
    crit,
    damage,
    netDamage,
    drainHeal,
    reflectDamage,
    absorbed,
  };
}
