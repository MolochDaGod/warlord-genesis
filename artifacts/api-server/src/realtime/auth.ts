// Best-effort identity for a WebSocket upgrade. We reuse the existing signed
// `gw_grudge` session cookie (Puter-primary auth) so a connection inherits the
// player's Grudge identity. If no valid cookie is present we fall back to a
// per-connection guest name, which keeps the lobby usable (and lets two tabs on
// one device test a 1v1). Identity here is for display only; the matchable unit
// is the connection, never a deduped account.

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, grudgeUsersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const COOKIE = "gw_grudge";

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

// Replicates cookie-signature's HMAC-SHA256 scheme used by cookie-parser.
function unsign(input: string, secret: string): string | null {
  const dot = input.lastIndexOf(".");
  if (dot < 0) return null;
  const val = input.slice(0, dot);
  const expected =
    val +
    "." +
    createHmac("sha256", secret).update(val).digest("base64").replace(/=+$/, "");
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? val : null;
}

export interface ConnIdentity {
  userId: number | null;
}

/** Synchronously resolve the local user id from the upgrade request cookies. */
export function identityFromCookies(cookieHeader: string | undefined): ConnIdentity {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) return { userId: null };
  const cookies = parseCookies(cookieHeader);
  let raw = cookies[COOKIE];
  if (!raw) return { userId: null };
  if (raw.startsWith("s:")) raw = raw.slice(2);
  const unsigned = unsign(raw, secret);
  if (!unsigned) return { userId: null };
  const id = Number(unsigned);
  return { userId: Number.isInteger(id) && id > 0 ? id : null };
}

/** Look up a friendly display name for a resolved user id (best effort). */
export async function resolveName(userId: number | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const rows = await db
      .select()
      .from(grudgeUsersTable)
      .where(eq(grudgeUsersTable.id, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return row.displayName ?? row.puterUsername ?? row.grudgeId ?? null;
  } catch (err) {
    logger.warn({ err }, "realtime: name lookup failed");
    return null;
  }
}
