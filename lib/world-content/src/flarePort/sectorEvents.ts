/**
 * 9-sector event / instance placement map for Flare-port content.
 * Binds dark elves, whisps, missions, and dungeons to SECTOR_META cells.
 */

import { SECTOR_META, type SectorMeta } from "../sectors";
import { DARK_ELF_EVENT_SITES, DARK_ELF_UNITS } from "./darkElves";
import { whispsForSector, type WhispDef } from "./whisp";
import { missionsForSector, type IslandMission } from "./missions";
import { dungeonsForSector, type DungeonDef } from "./dungeons";

export interface SectorContentBundle {
  sector: SectorMeta;
  darkElfUnitIds: string[];
  eventSiteIds: string[];
  whisps: WhispDef[];
  missions: IslandMission[];
  dungeons: DungeonDef[];
  /** Lobby / warcamp teaser lines */
  lobbyHooks: string[];
}

export function buildSectorContent(sectorId: string): SectorContentBundle | null {
  const sector = SECTOR_META.find((s) => s.id === sectorId);
  if (!sector) return null;

  const darkElfUnitIds = DARK_ELF_UNITS.filter((u) =>
    u.sectorIds.includes(sectorId),
  ).map((u) => u.id);

  const eventSiteIds = DARK_ELF_EVENT_SITES.filter(
    (e) => e.sectorId === sectorId,
  ).map((e) => e.id);

  const whisps = whispsForSector(sectorId);
  const missions = missionsForSector(sectorId);
  const dungeons = dungeonsForSector(sectorId);

  const lobbyHooks: string[] = [];
  if (eventSiteIds.length) {
    lobbyHooks.push(`${sector.name}: ${eventSiteIds.length} dark-elf event site(s)`);
  }
  if (dungeons.length) {
    lobbyHooks.push(
      ...dungeons.map((d) => `Dungeon: ${d.name} (Lv ${d.recommendedLevel}+)`),
    );
  }
  if (missions.some((m) => m.surfaces.includes("lobby"))) {
    lobbyHooks.push(
      ...missions
        .filter((m) => m.surfaces.includes("lobby"))
        .map((m) => `Mission: ${m.title}`),
    );
  }

  return {
    sector,
    darkElfUnitIds,
    eventSiteIds,
    whisps,
    missions,
    dungeons,
    lobbyHooks,
  };
}

/** All 9 sectors with Flare-port content attached. */
export function buildAllSectorContent(): SectorContentBundle[] {
  return SECTOR_META.map((s) => buildSectorContent(s.id)!).filter(Boolean);
}

/** Home-island surface = center sector + home-only missions/dungeons. */
export function homeIslandContent(): {
  missions: IslandMission[];
  dungeons: DungeonDef[];
  eventSiteIds: string[];
  whisps: WhispDef[];
} {
  const c = buildSectorContent("c")!;
  return {
    missions: c.missions.filter(
      (m) =>
        m.zoneRestriction === "home" ||
        m.surfaces.includes("home-island"),
    ),
    dungeons: c.dungeons,
    eventSiteIds: c.eventSiteIds,
    whisps: c.whisps,
  };
}

/** Instance entry points (dungeon portals) for matchmaking / lobby list. */
export function listInstanceEntries(): Array<{
  id: string;
  name: string;
  sectorId: string;
  recommendedLevel: number;
  kind: "dungeon" | "event";
  missionIds: string[];
}> {
  const out: Array<{
    id: string;
    name: string;
    sectorId: string;
    recommendedLevel: number;
    kind: "dungeon" | "event";
    missionIds: string[];
  }> = [];

  for (const bundle of buildAllSectorContent()) {
    for (const d of bundle.dungeons) {
      out.push({
        id: d.id,
        name: d.name,
        sectorId: d.sectorId,
        recommendedLevel: d.recommendedLevel,
        kind: "dungeon",
        missionIds: d.missionIds,
      });
    }
  }
  for (const site of DARK_ELF_EVENT_SITES) {
    out.push({
      id: site.id,
      name: site.name,
      sectorId: site.sectorId,
      recommendedLevel: 5,
      kind: "event",
      missionIds: site.missionIds,
    });
  }
  return out;
}
