import type { Faction, WorldIslandData } from "./aethermoor";

/** Display metadata for island NPC role tags (from Tactical-Infinity world data). */
export interface NpcRoleDef {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const NPC_ROLES: Record<string, NpcRoleDef> = {
  merchant: { id: "merchant", label: "Merchant", icon: "🛒", description: "Buys and sells goods." },
  healer: { id: "healer", label: "Healer", icon: "💚", description: "Restores health and removes ailments." },
  questgiver: { id: "questgiver", label: "Quest Giver", icon: "📜", description: "Offers missions and story arcs." },
  blacksmith: { id: "blacksmith", label: "Blacksmith", icon: "⚒️", description: "Forges weapons and armor." },
  trainer: { id: "trainer", label: "Trainer", icon: "🎯", description: "Teaches combat skills." },
  soldier: { id: "soldier", label: "Soldier", icon: "🛡️", description: "Faction guard patrol." },
  pirate: { id: "pirate", label: "Pirate", icon: "🏴‍☠️", description: "Lawless sailor — may trade or raid." },
  orc: { id: "orc", label: "Orc Warrior", icon: "👹", description: "Legion foot soldier." },
  undead: { id: "undead", label: "Undead", icon: "💀", description: "Risen servant of Madra." },
  necromancer: { id: "necromancer", label: "Necromancer", icon: "🔮", description: "Dark magic practitioner." },
  elf: { id: "elf", label: "Elf", icon: "🧝", description: "Fabled citizen of the eastern realms." },
  dwarf: { id: "dwarf", label: "Dwarf", icon: "⛏️", description: "Deepforge artisan or miner." },
  fisherman: { id: "fisherman", label: "Fisherman", icon: "🎣", description: "Sells catch and sea lore." },
  smuggler: { id: "smuggler", label: "Smuggler", icon: "📦", description: "Illicit goods broker." },
  seer: { id: "seer", label: "Seer", icon: "👁️", description: "Prophecy and divination." },
  barbarian: { id: "barbarian", label: "Barbarian", icon: "🪓", description: "Crusade berserker kin." },
  shaman: { id: "shaman", label: "Shaman", icon: "🔥", description: "Spirit caller and healer." },
  ranger: { id: "ranger", label: "Ranger", icon: "🏹", description: "Wildwood scout." },
  scholar: { id: "scholar", label: "Scholar", icon: "📚", description: "Keeper of ancient knowledge." },
  keeper: { id: "keeper", label: "Lighthouse Keeper", icon: "🗼", description: "Guides ships through storms." },
};

export interface IslandNpcSummary {
  role: string;
  label: string;
  icon: string;
  description: string;
}

export function npcsForIsland(island: WorldIslandData): IslandNpcSummary[] {
  return island.npcTypes.map((role) => {
    const def = NPC_ROLES[role];
    return def
      ? { role, label: def.label, icon: def.icon, description: def.description }
      : { role, label: role, icon: "👤", description: "Local inhabitant." };
  });
}

/** Quest-giver hero ids mapped to display names (from Grudge codex). */
export const QUEST_GIVER_NAMES: Record<string, string> = {
  hero_aurion: "Aurion the Wayfinder",
  hero_sigurd: "Sigurd Ironhelm",
  hero_kael: "Kael Stormbrand",
  hero_thrax: "Thrax Bloodfury",
  hero_theron: "Theron Wildwood",
};

export function factionLabel(faction: Faction): string {
  switch (faction) {
    case "crusade":
      return "Crusade (Odin's Realm)";
    case "fabled":
      return "Fabled (The Omni)";
    case "legion":
      return "Legion (Madra's Chaos)";
    case "pirate":
      return "Pirate Confederation";
    case "neutral":
      return "Neutral Territories";
  }
}