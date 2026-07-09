import { Router, type IRouter } from "express";
import { createHash, randomUUID } from "node:crypto";
import { db, grudgeUsersTable, type GrudgeUserRow } from "@workspace/db";
import {
  SESSION_COOKIE,
  setSessionCookie,
  readUserId,
  findUserById,
  requireFirstParty,
} from "../lib/session";

// Puter is the primary identity provider. The client signs in with Puter and
// posts its `authToken`; we verify it against Puter's API and then own the
// account (and its derived Grudge ID) in our own database. The signed
// `gw_grudge` cookie holds our local user id — never a third-party token.
const PUTER_API = "https://api.puter.com";

const STARTING_GBUX_PLAYER = 1000;
const STARTING_GBUX_GUEST = 250;

const router: IRouter = Router();

interface PuterIdentity {
  uuid: string;
  username: string | null;
}

// Verify a Puter auth token by asking Puter who it belongs to. Throws on any
// invalid/expired token so callers never trust an unverified identity.
async function verifyPuterToken(token: string): Promise<PuterIdentity> {
  const res = await fetch(`${PUTER_API}/whoami`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Puter rejected the token (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  // Identity is keyed strictly on the Puter UUID. Fail closed if it is absent
  // rather than falling back to a mutable username.
  const uuid =
    typeof data["uuid"] === "string" && data["uuid"]
      ? (data["uuid"] as string)
      : "";
  if (!uuid) throw new Error("Puter identity missing a stable uuid");
  return {
    uuid,
    username:
      typeof data["username"] === "string"
        ? (data["username"] as string)
        : null,
  };
}

// Derive a stable, human-facing Grudge ID from whichever identity owns the
// account. Deterministic so the same Puter/guest identity always maps to the
// same Grudge ID.
function deriveGrudgeId(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 10);
  return `GW-${hex.toUpperCase()}`;
}

function toGrudgeUser(row: GrudgeUserRow, isNew = false) {
  return {
    id: row.id,
    username: row.puterUsername ?? row.grudgeId,
    grudgeId: row.grudgeId,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    gbuxBalance: String(row.gbuxBalance),
    role: row.role,
    isNew,
  };
}

// Sign in (or register) with a verified Puter identity.
router.post("/grudge/auth/puter", requireFirstParty, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = typeof body["token"] === "string" ? body["token"].trim() : "";
  if (!token) {
    res.status(400).json({ error: "Missing Puter sign-in token" });
    return;
  }

  let identity: PuterIdentity;
  try {
    identity = await verifyPuterToken(token);
  } catch (err) {
    req.log.warn({ err }, "Puter token verification failed");
    res.status(401).json({ error: "Puter sign-in could not be verified" });
    return;
  }

  try {
    const grudgeId = deriveGrudgeId(`puter:${identity.uuid}`);
    // Atomic upsert: avoids a select-then-insert race that could 500 on
    // concurrent first logins for the same identity.
    const upserted = await db
      .insert(grudgeUsersTable)
      .values({
        puterUuid: identity.uuid,
        puterUsername: identity.username,
        grudgeId,
        displayName: identity.username ?? grudgeId,
        gbuxBalance: STARTING_GBUX_PLAYER,
        role: "player",
      })
      .onConflictDoUpdate({
        target: grudgeUsersTable.puterUuid,
        set: {
          updatedAt: new Date(),
          ...(identity.username ? { puterUsername: identity.username } : {}),
        },
      })
      .returning();
    const row = upserted[0]!;
    const isNew = row.createdAt.getTime() === row.updatedAt.getTime();

    setSessionCookie(res, row.id);
    res.json(toGrudgeUser(row, isNew));
  } catch (err) {
    req.log.error({ err }, "Puter sign-in persistence failed");
    res.status(500).json({ error: "Could not create your account" });
  }
});

// Lightweight guest accounts, keyed by a client-generated device id.
router.post("/grudge/auth/guest", requireFirstParty, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const deviceId =
    typeof body["deviceId"] === "string" && body["deviceId"].length > 0
      ? body["deviceId"]
      : `gw-${randomUUID()}`;

  try {
    const grudgeId = deriveGrudgeId(`guest:${deviceId}`);
    const upserted = await db
      .insert(grudgeUsersTable)
      .values({
        deviceId,
        grudgeId,
        displayName: `Warlord ${grudgeId.slice(-4)}`,
        gbuxBalance: STARTING_GBUX_GUEST,
        role: "guest",
      })
      .onConflictDoUpdate({
        target: grudgeUsersTable.deviceId,
        set: { updatedAt: new Date() },
      })
      .returning();
    const row = upserted[0]!;
    const isNew = row.createdAt.getTime() === row.updatedAt.getTime();

    setSessionCookie(res, row.id);
    res.json(toGrudgeUser(row, isNew));
  } catch (err) {
    req.log.error({ err }, "Guest sign-in failed");
    res.status(500).json({ error: "Could not start a guest session" });
  }
});

router.get("/grudge/auth/me", async (req, res) => {
  const userId = readUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const row = await findUserById(userId);
    if (!row) {
      res.clearCookie(SESSION_COOKIE, { path: "/" });
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json(toGrudgeUser(row));
  } catch (err) {
    req.log.error({ err }, "Account lookup failed");
    res.status(500).json({ error: "Account lookup failed" });
  }
});

router.post("/grudge/auth/logout", requireFirstParty, (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

export default router;
