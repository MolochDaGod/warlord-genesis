/**
 * Pre-game 6-slot ability loadout (Danger Room hotbar).
 * Heroes unlock abilities with card level in the warcamp — never mid-match.
 */
import { CLASS_BY_ID, classSkillById, type ClassId } from "@workspace/game-content";
import { ABILITIES, type AbilityId, type MeleeWeaponId, type RangedWeaponId } from "./config";
import { warlordSkillsForLoadout, type WarlordWeaponSkill } from "./warlordWeaponSkills";

export const HOTBAR_SIZE = 6;

/** Card level required to unlock hotbar slots 1–6. */
export const SLOT_UNLOCK_LEVEL = [1, 1, 2, 3, 4, 5] as const;

export type AbilityKind = "weapon" | "class" | "mobility";

export interface LoadoutAbility {
  id: string;
  kind: AbilityKind;
  label: string;
  description: string;
  icon: string;
  cooldown: number;
  unlockLevel: number;
  animKey?: string;
  baked?: string;
  weaponSkill?: WarlordWeaponSkill;
  mobility?: AbilityId;
}

const CLASS_TIER_TO_CARD: Record<number, number> = {
  0: 1,
  1: 2,
  5: 3,
  10: 4,
  15: 5,
  20: 6,
};

export function isSlotUnlocked(slotIndex: number, cardLevel: number): boolean {
  const need = SLOT_UNLOCK_LEVEL[slotIndex] ?? 99;
  return cardLevel >= need;
}

export function unlockedSlotCount(cardLevel: number): number {
  return SLOT_UNLOCK_LEVEL.filter((lvl) => cardLevel >= lvl).length;
}

export function emptySlots(): Array<string | null> {
  return [null, null, null, null, null, null];
}

export function normalizeSlots(raw: unknown): Array<string | null> {
  const src = Array.isArray(raw) ? raw : [];
  const out = emptySlots();
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const v = src[i];
    out[i] = typeof v === "string" && v.length > 0 ? v : null;
  }
  return out;
}

function mobilityAbility(id: AbilityId, unlockLevel: number): LoadoutAbility {
  const def = ABILITIES[id];
  return {
    id: `mobility.${id}`,
    kind: "mobility",
    label: def.name,
    description: id === "dash" ? "Burst forward." : "Ground slam around you.",
    icon: id === "dash" ? "↗" : "✸",
    cooldown: def.cooldown,
    unlockLevel,
    mobility: id,
  };
}

export function abilityPoolForHero(opts: {
  classId: ClassId;
  meleeId: MeleeWeaponId;
  rangedId: RangedWeaponId;
  cardLevel: number;
}): LoadoutAbility[] {
  const { classId, meleeId, rangedId, cardLevel } = opts;
  const pool: LoadoutAbility[] = [];

  pool.push(mobilityAbility("dash", 1));
  pool.push(mobilityAbility("slam", 2));

  const melee = warlordSkillsForLoadout(meleeId, rangedId, "melee");
  const ranged = warlordSkillsForLoadout(meleeId, rangedId, "ranged");
  const seenW = new Set<string>();
  for (const list of [melee, ranged]) {
    list.forEach((sk, i) => {
      if (seenW.has(sk.id)) return;
      seenW.add(sk.id);
      pool.push({
        id: sk.id,
        kind: "weapon",
        label: sk.label,
        description: sk.description,
        icon: sk.keyLabel,
        cooldown: sk.cooldown,
        unlockLevel: Math.min(6, i + 1),
        baked: sk.baked,
        animKey: sk.animKey,
        weaponSkill: sk,
      });
    });
  }

  const cls = CLASS_BY_ID[classId];
  for (const tier of cls.tiers) {
    const unlockLevel = CLASS_TIER_TO_CARD[tier.level] ?? 8;
    for (const s of tier.skills) {
      pool.push({
        id: s.id,
        kind: "class",
        label: s.label,
        description: s.description,
        icon: s.icon ?? "◆",
        cooldown: s.cooldown ?? 8,
        unlockLevel,
        animKey: s.animKey,
      });
    }
  }

  return pool.filter((a) => a.unlockLevel <= cardLevel);
}

export function resolveAbility(id: string | null | undefined, pool: LoadoutAbility[]): LoadoutAbility | null {
  if (!id) return null;
  return pool.find((a) => a.id === id) ?? null;
}

/** Fill empty unlocked slots from the pool (weapon first, then mobility, then class). */
export function defaultFillSlots(
  current: Array<string | null>,
  pool: LoadoutAbility[],
  cardLevel: number,
): Array<string | null> {
  const next = normalizeSlots(current);
  const used = new Set(next.filter(Boolean) as string[]);
  const prefer = [
    ...pool.filter((a) => a.kind === "weapon"),
    ...pool.filter((a) => a.kind === "mobility"),
    ...pool.filter((a) => a.kind === "class"),
  ];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    if (!isSlotUnlocked(i, cardLevel)) {
      next[i] = null;
      continue;
    }
    if (next[i] && pool.some((a) => a.id === next[i])) continue;
    const pick = prefer.find((a) => !used.has(a.id));
    next[i] = pick?.id ?? null;
    if (pick) used.add(pick.id);
  }
  return next;
}

export function slotHotkey(index: number): string {
  return String(index + 1);
}

export function classSkillIcon(id: string): string {
  return classSkillById(id)?.icon ?? "◆";
}
