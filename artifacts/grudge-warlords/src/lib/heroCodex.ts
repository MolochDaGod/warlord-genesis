import type { ClassId, PrefabCharacter, PrefabRaceId } from "@workspace/game-content";
import { PREFAB_BY_ID } from "@workspace/game-content";
import codexBundle from "../data/heroCodexSite.json";

export const HERO_CODEX_ORIGIN = "https://grudge-heros.puter.site";

export interface CodexAbility {
  name: string;
  icon: string;
  description: string;
  manaCost: number;
}

export interface CodexHeroEntry {
  id: string;
  name: string;
  title: string;
  race: string;
  className: string;
  faction: string;
  factionColor: string;
  rarity: string;
  portrait: string;
  lore: string;
  backstory: string;
  quote: string;
  primaryAttribute: string;
  abilities: CodexAbility[];
  racialTraits: Array<{ name: string; effect: string }>;
  strengths: string[];
  weaknesses: string[];
  combatStyle: string;
  weapons: string;
  alignment: string;
  difficulty: string;
  flavorText: string;
}

const CODEX_BY_ID = new Map<string, CodexHeroEntry>(
  (codexBundle.heroes as CodexHeroEntry[]).map((h) => [h.id, h]),
);

/** Codex grid id: `human_warrior`, `orc_worg`, etc. */
export function codexIdForPrefab(raceId: PrefabRaceId, classId: ClassId): string {
  const cls = classId === "worge" ? "worg" : classId;
  return `${raceId}_${cls}`;
}

export function codexEntryForPrefab(prefabId: string): CodexHeroEntry | null {
  const p = PREFAB_BY_ID[prefabId];
  if (!p) return null;
  return CODEX_BY_ID.get(codexIdForPrefab(p.raceId, p.classId)) ?? null;
}

export function codexEntryForCharacter(p: PrefabCharacter): CodexHeroEntry | null {
  return CODEX_BY_ID.get(codexIdForPrefab(p.raceId, p.classId)) ?? null;
}

export function heroPortraitUrl(entry: CodexHeroEntry): string {
  return `${HERO_CODEX_ORIGIN}/hero-portraits/${entry.id}.png`;
}

export function heroPortraitFallback(entry: CodexHeroEntry): string {
  return `${HERO_CODEX_ORIGIN}/${entry.portrait}`;
}

export function heroCodexPageUrl(entry: CodexHeroEntry): string {
  return `${HERO_CODEX_ORIGIN}/#${entry.id}`;
}

/** System prompt for in-character AI overlay on hero showcase. */
export function heroAiSystemPrompt(prefabId: string): string {
  const p = PREFAB_BY_ID[prefabId];
  const c = codexEntryForPrefab(prefabId);
  if (!p && !c) {
    return "You are a Grudge Warlords guide. Answer briefly about strategy and lore.";
  }
  const lines = [
    `You are ${c?.name ?? p?.name}, ${c?.title ?? p?.title} — speaking in first person from the Grudge universe.`,
    c?.quote ? `Signature quote: ${c.quote}` : "",
    c?.lore ?? p?.lore ?? "",
    c?.backstory ? `Backstory: ${c.backstory}` : "",
    c?.combatStyle ? `Combat style: ${c.combatStyle}` : "",
    c?.weapons ? `Weapons: ${c.weapons}` : "",
    c?.abilities?.length
      ? `Abilities: ${c.abilities.map((a) => `${a.name} (${a.description})`).join("; ")}`
      : "",
    "Stay in character. Keep answers under 120 words unless asked for detail. Help the player understand your skills, build, and role in Warlords.",
  ].filter(Boolean);
  return lines.join("\n\n");
}

export function allCodexHeroes(): CodexHeroEntry[] {
  return codexBundle.heroes as CodexHeroEntry[];
}