import type { Faction } from "@workspace/world-content";

const ROSTER_KEY = "gw_roster_v2";

/** Read the player's faction from Warlords roster persistence (shared localStorage). */
export function readPlayerFaction(): Faction {
  try {
    const raw = localStorage.getItem(ROSTER_KEY) ?? localStorage.getItem("gw_roster_v1");
    if (!raw) return "crusade";
    const data = JSON.parse(raw) as { factionId?: string };
    const id = data.factionId;
    if (id === "crusade" || id === "fabled" || id === "legion") return id;
    return "crusade";
  } catch {
    return "crusade";
  }
}