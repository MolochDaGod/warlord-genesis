import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, grudgeUsersTable, type GrudgeUserRow } from "@workspace/db";

export const SESSION_COOKIE = "gw_grudge";
export const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, userId: number) {
  res.cookie(SESSION_COOKIE, String(userId), {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

export function readUserId(req: Request): number | null {
  const signed = req.signedCookies as Record<string, string> | undefined;
  const raw = signed?.[SESSION_COOKIE];
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function findUserById(id: number): Promise<GrudgeUserRow | null> {
  const rows = await db
    .select()
    .from(grudgeUsersTable)
    .where(eq(grudgeUsersTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** CSRF guard for state-changing routes from the first-party web client. */
export function requireFirstParty(req: Request, res: Response, next: NextFunction) {
  if (req.get("x-grudge-client") !== "web") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!readUserId(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}