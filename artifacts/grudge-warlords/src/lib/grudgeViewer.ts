import type { ClassId, PrefabRaceId } from "@workspace/game-content";
import { DEPLOY_PATH } from "./deployRoutes";

/** Canonical character viewer — same pipeline as in-match GRUDGE6 Bip001 loaders. */
export const GRUDGE_VIEWER_ORIGIN = "https://character.grudge-studio.com";

export function viewerUrl(raceId: PrefabRaceId, classId: ClassId): string {
  const params = new URLSearchParams({ race: raceId, class: classId });
  return `${GRUDGE_VIEWER_ORIGIN}/viewer?${params}`;
}

/** Deep-link back from the viewer into the warcamp lobby. */
export function lobbyHandoffUrl(
  raceId: PrefabRaceId,
  classId: ClassId,
  grudgeId?: string,
): string {
  const params = new URLSearchParams({ race: raceId, class: classId });
  if (grudgeId) params.set("grudgeId", grudgeId);
  return `${DEPLOY_PATH}?${params}`;
}