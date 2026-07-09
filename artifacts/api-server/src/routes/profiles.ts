import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  gameProfilesTable,
  matchResultsTable,
  isKnownGameId,
  type GameProfileRow,
} from "@workspace/db";
import {
  readUserId,
  requireAuth,
  requireFirstParty,
  findUserById,
} from "../lib/session";

const router: IRouter = Router();

function paramGameId(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return "";
}

const DEFAULT_WARLORDS_META = {
  onboardingDone: false,
  starterPrefabId: null,
  cards: [],
  lastDailyClaim: null,
};

function defaultCurrencyForUser(role: string): number {
  return role === "guest" ? 250 : 500;
}

async function getOrCreateProfile(
  userId: number,
  gameId: string,
): Promise<GameProfileRow> {
  const existing = await db
    .select()
    .from(gameProfilesTable)
    .where(and(eq(gameProfilesTable.userId, userId), eq(gameProfilesTable.gameId, gameId)))
    .limit(1);

  if (existing[0]) return existing[0];

  const user = await findUserById(userId);
  const currency = Math.max(
    user?.gbuxBalance ?? 0,
    defaultCurrencyForUser(user?.role ?? "player"),
  );

  const inserted = await db
    .insert(gameProfilesTable)
    .values({
      userId,
      gameId,
      currency,
      metaJson: gameId === "grudge-warlords" ? DEFAULT_WARLORDS_META : {},
    })
    .returning();

  return inserted[0]!;
}

function toProfileDto(row: GameProfileRow) {
  return {
    gameId: row.gameId,
    currency: row.currency,
    meta: row.metaJson,
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/games/:gameId/profile", requireAuth, async (req, res) => {
  const gameId = paramGameId(req.params.gameId);
  if (!isKnownGameId(gameId)) {
    res.status(404).json({ error: "Unknown game" });
    return;
  }
  const userId = readUserId(req)!;
  try {
    const row = await getOrCreateProfile(userId, gameId);
    res.json(toProfileDto(row));
  } catch (err) {
    req.log.error({ err, gameId }, "Profile load failed");
    res.status(500).json({ error: "Profile load failed" });
  }
});

router.patch("/games/:gameId/profile", requireAuth, requireFirstParty, async (req, res) => {
  const gameId = paramGameId(req.params.gameId);
  if (!isKnownGameId(gameId)) {
    res.status(404).json({ error: "Unknown game" });
    return;
  }
  const userId = readUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const row = await getOrCreateProfile(userId, gameId);
    const nextCurrency =
      typeof body.currency === "number" && Number.isFinite(body.currency)
        ? Math.max(0, Math.floor(body.currency))
        : row.currency;
    const nextMeta =
      body.meta !== null && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? { ...(row.metaJson as Record<string, unknown>), ...(body.meta as Record<string, unknown>) }
        : row.metaJson;

    const updated = await db
      .update(gameProfilesTable)
      .set({
        currency: nextCurrency,
        metaJson: nextMeta,
        updatedAt: new Date(),
      })
      .where(eq(gameProfilesTable.id, row.id))
      .returning();

    res.json(toProfileDto(updated[0]!));
  } catch (err) {
    req.log.error({ err, gameId }, "Profile save failed");
    res.status(500).json({ error: "Profile save failed" });
  }
});

router.post("/games/:gameId/matches", requireAuth, requireFirstParty, async (req, res) => {
  const gameId = paramGameId(req.params.gameId);
  if (!isKnownGameId(gameId)) {
    res.status(404).json({ error: "Unknown game" });
    return;
  }
  const userId = readUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const won = body.won === true;

  try {
    const row = await getOrCreateProfile(userId, gameId);
    const rewardGbux =
      typeof body.rewardGbux === "number" && Number.isFinite(body.rewardGbux)
        ? Math.floor(body.rewardGbux)
        : 0;
    const nextCurrency = Math.max(0, row.currency + rewardGbux);
    const nextMeta =
      body.meta !== null && typeof body.meta === "object" && !Array.isArray(body.meta)
        ? { ...(row.metaJson as Record<string, unknown>), ...(body.meta as Record<string, unknown>) }
        : row.metaJson;

    const [profile] = await db
      .update(gameProfilesTable)
      .set({
        currency: nextCurrency,
        metaJson: nextMeta,
        updatedAt: new Date(),
      })
      .where(eq(gameProfilesTable.id, row.id))
      .returning();

    await db.insert(matchResultsTable).values({
      userId,
      gameId,
      seed: typeof body.seed === "number" ? body.seed : null,
      mode: typeof body.mode === "string" ? body.mode : null,
      won,
      score: typeof body.score === "number" ? Math.floor(body.score) : null,
      metaJson: body.matchMeta ?? null,
    });

    res.json({
      ok: true,
      profile: toProfileDto(profile!),
    });
  } catch (err) {
    req.log.error({ err, gameId }, "Match record failed");
    res.status(500).json({ error: "Match record failed" });
  }
});

export default router;