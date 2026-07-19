import {
  getGameProfile,
  patchGameProfile,
  recordMatch as recordMatchApi,
  type GameProfile,
  type MatchRecord,
} from "@workspace/api-client-react";

/** Must match `GAME_IDS.WARLORDS` in `@workspace/db`. */
export const WARLORDS_GAME_ID = "grudge-warlords";

export type GameProfileDto = GameProfile;

export interface WarlordsMetaPayload {
  seasonId?: string;
  factionId?: string | null;
  factionChosen?: boolean;
  onboardingDone?: boolean;
  starterPrefabId?: string | null;
  gbux?: number;
  accountLevel?: number;
  accountXp?: number;
  cards?: unknown[];
  lastDailyClaim?: string | null;
  lastMatchReward?: unknown | null;
  completedMissions?: string[];
}

const MUTATE_HEADERS: RequestInit = {
  headers: { "X-Grudge-Client": "web" },
};

export async function fetchGameProfile(gameId: string = WARLORDS_GAME_ID): Promise<GameProfileDto | null> {
  try {
    return await getGameProfile(gameId);
  } catch {
    return null;
  }
}

export async function saveGameProfile(
  gameId: string,
  patch: { currency?: number; meta?: Record<string, unknown> },
): Promise<GameProfileDto | null> {
  try {
    return await patchGameProfile(gameId, patch, MUTATE_HEADERS);
  } catch {
    return null;
  }
}

export async function recordMatch(
  gameId: string,
  body: {
    won: boolean;
    rewardGbux?: number;
    seed?: number;
    mode?: string;
    score?: number;
    meta?: Record<string, unknown>;
    matchMeta?: Record<string, unknown>;
  },
): Promise<GameProfileDto | null> {
  try {
    const res = await recordMatchApi(gameId, body as MatchRecord, MUTATE_HEADERS);
    return res.profile;
  } catch {
    return null;
  }
}