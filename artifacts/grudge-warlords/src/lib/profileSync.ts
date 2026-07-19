import {
  fetchGameProfile,
  saveGameProfile,
  recordMatch,
  WARLORDS_GAME_ID,
  type WarlordsMetaPayload,
} from "./gameProfile";
import { useMeta, type CardProgress, type MatchRewardSnapshot } from "../game/metaProgression";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastPushed = "";

function metaPayload(): WarlordsMetaPayload {
  const s = useMeta.getState();
  return {
    seasonId: s.seasonId,
    factionId: s.factionId,
    factionChosen: s.factionChosen,
    onboardingDone: s.onboardingDone,
    starterPrefabId: s.starterPrefabId,
    accountLevel: s.accountLevel,
    accountXp: s.accountXp,
    cards: s.cards,
    lastDailyClaim: s.lastDailyClaim,
    lastMatchReward: s.lastMatchReward,
    completedMissions: s.completedMissions,
  };
}

function schedulePush() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void pushProfile();
  }, 600);
}

async function pushProfile() {
  const s = useMeta.getState();
  const payload = JSON.stringify({ currency: s.gbux, meta: metaPayload() });
  if (payload === lastPushed) return;
  const saved = await saveGameProfile(WARLORDS_GAME_ID, {
    currency: s.gbux,
    meta: metaPayload() as Record<string, unknown>,
  });
  if (saved) lastPushed = payload;
}

/** Pull server profile into local meta (after login / restore). */
export async function hydrateMetaFromServer(): Promise<boolean> {
  const remote = await fetchGameProfile(WARLORDS_GAME_ID);
  if (!remote) return false;

  const meta = remote.meta as WarlordsMetaPayload;
  const local = useMeta.getState();

  // Fresh production season — ignore stale / unversioned server profiles
  if (!meta.seasonId || meta.seasonId !== local.seasonId) {
    console.info(
      "[profileSync] reset remote season",
      meta.seasonId ?? "(none)",
      "→",
      local.seasonId,
    );
    await pushProfile();
    return false;
  }

  const mergedCards = mergeCards(
    local.cards,
    Array.isArray(meta.cards) ? (meta.cards as CardProgress[]) : [],
  );

  useMeta.setState({
    factionId: (meta.factionId as typeof local.factionId) ?? local.factionId,
    factionChosen: Boolean(meta.factionChosen) || local.factionChosen,
    onboardingDone: Boolean(meta.onboardingDone) || local.onboardingDone,
    starterPrefabId: meta.starterPrefabId ?? local.starterPrefabId,
    gbux: Math.max(local.gbux, remote.currency, meta.gbux ?? 0),
    accountLevel: Math.max(local.accountLevel, meta.accountLevel ?? 1),
    accountXp: Math.max(local.accountXp, meta.accountXp ?? 0),
    cards: mergedCards,
    lastDailyClaim: meta.lastDailyClaim ?? local.lastDailyClaim,
    lastMatchReward:
      (meta.lastMatchReward as MatchRewardSnapshot | null) ?? local.lastMatchReward,
    completedMissions: Array.isArray(meta.completedMissions)
      ? Array.from(new Set([...local.completedMissions, ...meta.completedMissions]))
      : local.completedMissions,
  });

  useMeta.getState().ensureStarterUnlocked();

  lastPushed = JSON.stringify({ currency: useMeta.getState().gbux, meta: metaPayload() });
  return true;
}

function mergeCards(local: CardProgress[], remote: CardProgress[]): CardProgress[] {
  const byKey = new Map<string, CardProgress>();
  for (const c of remote) byKey.set(`${c.kind}:${c.id}`, { ...c });
  for (const c of local) {
    const k = `${c.kind}:${c.id}`;
    const r = byKey.get(k);
    if (!r) {
      byKey.set(k, c);
      continue;
    }
    byKey.set(k, {
      kind: c.kind,
      id: c.id,
      level: Math.max(r.level, c.level),
      shards: Math.max(r.shards, c.shards),
    });
  }
  return [...byKey.values()];
}

/** Debounced server sync on every meta mutation. */
export function startProfileSync() {
  useMeta.subscribe(() => schedulePush());
}

/** Record a finished match server-side (rewards already applied locally). */
export async function syncMatchResult(won: boolean, score: number, seed?: number) {
  const s = useMeta.getState();
  const reward = s.lastMatchReward;
  await recordMatch(WARLORDS_GAME_ID, {
    won,
    score,
    seed,
    rewardGbux: reward?.gbux ?? 0,
    meta: metaPayload() as Record<string, unknown>,
    matchMeta: reward ? { won, gbux: reward.gbux, at: reward.at } : { won },
  });
}