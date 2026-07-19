/**
 * Warlords Era 8-attribute catalog + icon URLs.
 *
 * HARD RULE: attribute icons come ONLY from icons/sigils/{id}.png
 * (source art: C:\Users\nugye\Pictures\sigils\sigils\*.png).
 * Never use skill/weapon/profession packs for attribute tooltips or badges.
 */

export const ATTR_IDS = [
  "strength",
  "vitality",
  "endurance",
  "intellect",
  "wisdom",
  "dexterity",
  "agility",
  "tactics",
] as const;

export type AttrId = (typeof ATTR_IDS)[number];

export const ATTR_ABBREV: Record<AttrId, string> = {
  strength: "STR",
  vitality: "VIT",
  endurance: "END",
  intellect: "INT",
  wisdom: "WIS",
  dexterity: "DEX",
  agility: "AGI",
  tactics: "TAC",
};

export const ATTR_LABEL: Record<AttrId, string> = {
  strength: "Strength",
  vitality: "Vitality",
  endurance: "Endurance",
  intellect: "Intellect",
  wisdom: "Wisdom",
  dexterity: "Dexterity",
  agility: "Agility",
  tactics: "Tactics",
};

/** CDN + local paths for the canonical sigil set. */
const CDN = "https://assets.grudge-studio.com";
const LOCAL = `${import.meta.env.BASE_URL}icons/attributes/`;

export function attrIconUrl(id: AttrId | string, preferLocal = false): string {
  const key = String(id).toLowerCase() as AttrId;
  if (!ATTR_IDS.includes(key)) {
    // Unknown id — still attempt sigil path (never a random weapon icon).
    return preferLocal ? `${LOCAL}${key}.png` : `${CDN}/icons/sigils/${key}.png`;
  }
  return preferLocal ? `${LOCAL}${key}.png` : `${CDN}/icons/sigils/${key}.png`;
}

/** Tooltip / accessibility label for UI. */
export function attrTooltip(id: AttrId | string, value?: number): string {
  const key = String(id).toLowerCase() as AttrId;
  const name = ATTR_LABEL[key] ?? id;
  const ab = ATTR_ABBREV[key] ?? String(id).slice(0, 3).toUpperCase();
  if (value === undefined || value === null) return `${ab} — ${name}`;
  return `${ab} ${value} — ${name}`;
}

export function isAttrId(v: string): v is AttrId {
  return (ATTR_IDS as readonly string[]).includes(v);
}
