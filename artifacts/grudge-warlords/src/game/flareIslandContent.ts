/**
 * Client façade for Flare-Boss → Warlords Era island content.
 * Re-exports catalog + small helpers for lobby / play / future island scenes.
 */

import {
  DARK_ELF_UNITS,
  DARK_ELF_EVENT_SITES,
  DARK_ELF_BY_ID,
  darkElfTintSpec,
  WHISP_DEFS,
  WHISP_BY_ID,
  whispBehavior,
  whispIconUrl,
  ISLAND_MISSIONS,
  ISLAND_MISSION_BY_ID,
  missionsForSurface,
  createMissionRun,
  isMissionRunComplete,
  DUNGEON_CATALOG,
  getDungeon,
  listInstanceEntries,
  homeIslandContent,
  buildAllSectorContent,
  buildSectorContent,
  buildRoomSpawnList,
  resolveSpawnCombat,
  FLARE_PORT_VERSION,
  type IslandMission,
  type DungeonDef,
  type WhispInstance,
  type PlayerMissionRun,
} from "@workspace/world-content";

export {
  DARK_ELF_UNITS,
  DARK_ELF_EVENT_SITES,
  DARK_ELF_BY_ID,
  darkElfTintSpec,
  WHISP_DEFS,
  WHISP_BY_ID,
  whispBehavior,
  whispIconUrl,
  ISLAND_MISSIONS,
  ISLAND_MISSION_BY_ID,
  missionsForSurface,
  createMissionRun,
  isMissionRunComplete,
  DUNGEON_CATALOG,
  getDungeon,
  listInstanceEntries,
  homeIslandContent,
  buildAllSectorContent,
  buildSectorContent,
  buildRoomSpawnList,
  resolveSpawnCombat,
  FLARE_PORT_VERSION,
};

export type { IslandMission, DungeonDef, WhispInstance, PlayerMissionRun };

const MISSION_STORAGE_KEY = "gw_island_missions_v1";

export function loadMissionRuns(): Record<string, PlayerMissionRun> {
  try {
    const raw = localStorage.getItem(MISSION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PlayerMissionRun>;
  } catch {
    return {};
  }
}

export function saveMissionRuns(runs: Record<string, PlayerMissionRun>) {
  try {
    localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(runs));
  } catch {
    /* ignore */
  }
}

export function activateMission(missionId: string): PlayerMissionRun | null {
  const def = ISLAND_MISSION_BY_ID[missionId];
  if (!def) return null;
  const runs = loadMissionRuns();
  if (runs[missionId]?.state === "completed") return runs[missionId]!;
  const run = createMissionRun(missionId);
  runs[missionId] = run;
  saveMissionRuns(runs);
  return run;
}

export function bumpMissionObjective(
  missionId: string,
  objectiveId: string,
  amount = 1,
): PlayerMissionRun | null {
  const def = ISLAND_MISSION_BY_ID[missionId];
  if (!def) return null;
  const runs = loadMissionRuns();
  let run = runs[missionId];
  if (!run || run.state !== "active") {
    run = createMissionRun(missionId);
  }
  run.objectiveProgress[objectiveId] =
    (run.objectiveProgress[objectiveId] ?? 0) + amount;
  if (isMissionRunComplete(def, run)) {
    run.state = "completed";
    run.completedAt = Date.now();
  }
  runs[missionId] = run;
  saveMissionRuns(runs);
  return run;
}

/** Lobby summary cards */
export function lobbyContentCards(): Array<{
  id: string;
  title: string;
  subtitle: string;
  kind: "mission" | "dungeon" | "event" | "whisp";
  href?: string;
}> {
  const cards: Array<{
    id: string;
    title: string;
    subtitle: string;
    kind: "mission" | "dungeon" | "event" | "whisp";
    href?: string;
  }> = [];

  for (const m of missionsForSurface("lobby")) {
    cards.push({
      id: m.id,
      title: m.title,
      subtitle: `Lv ${m.recommendedLevel} · ${m.category}`,
      kind: "mission",
      href: `/missions#${m.id}`,
    });
  }

  for (const entry of listInstanceEntries().filter((e) => e.kind === "dungeon")) {
    cards.push({
      id: entry.id,
      title: entry.name,
      subtitle: `Dungeon · sector ${entry.sectorId.toUpperCase()} · Lv ${entry.recommendedLevel}+`,
      kind: "dungeon",
      href: `/dungeon/${entry.id}`,
    });
  }

  for (const site of DARK_ELF_EVENT_SITES) {
    cards.push({
      id: site.id,
      title: site.name,
      subtitle: site.description.slice(0, 80),
      kind: "event",
      href: `/events#${site.id}`,
    });
  }

  cards.push({
    id: "whisp_roster",
    title: "Whisp companions",
    subtitle: `${WHISP_DEFS.length} elemental whisps — rescue on islands & dungeons`,
    kind: "whisp",
    href: "/missions#whisps",
  });

  return cards;
}
