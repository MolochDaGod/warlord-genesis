import cors from "cors";
import express from "express";
import {
  canonicalActiveCharacter,
  canonicalGuest,
  canonicalMe,
  mapActiveCharacter,
  mapBundleUser,
} from "./canonical.js";
import { getPlayerSave, upsertPlayerSave } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

const allowedOrigins = [
  "https://warlord-genesis.vercel.app",
  "https://grudgewarlords.com",
  "https://www.grudgewarlords.com",
  /^https:\/\/warlord-genesis.*\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const ok = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin),
      );
      cb(ok ? null : new Error("CORS blocked"), ok);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

function readToken(req) {
  const auth = req.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)grudge_auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setAuthCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60;
  res.setHeader(
    "Set-Cookie",
    `grudge_auth_token=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=None; Secure`,
  );
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "warlord-genesis-api",
    database: Boolean(process.env.DATABASE_URL),
    canonical: process.env.GRUDGE_API_URL || "grudge-api-production",
  });
});

/** Auth adapter — bundle expects flat user objects */
app.post("/api/grudge/auth/guest", async (req, res) => {
  try {
    const deviceId = req.body?.deviceId || null;
    const canonical = await canonicalGuest(req);
    const token = canonical.token || canonical.sessionToken;
    if (token) setAuthCookie(res, token);

    const user = mapBundleUser(canonical, "guest");
    if (deviceId) {
      await upsertPlayerSave({
        grudgeId: user.grudgeId,
        userId: canonical.userId || canonical.user?.id,
        deviceId,
        role: "guest",
        save: {},
      });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message || "Guest auth failed" });
  }
});

app.get("/api/grudge/auth/me", async (req, res) => {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const canonical = await canonicalMe(req, token);
    if (!canonical?.success) {
      return res.status(401).json({ error: canonical?.error || "Not authenticated" });
    }

    const role = canonical.username?.toLowerCase?.() === "guest" ? "guest" : "player";
    res.json(mapBundleUser(canonical, role));
  } catch (err) {
    res.status(500).json({ error: err.message || "Profile lookup failed" });
  }
});

app.post("/api/grudge/auth/logout", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    "grudge_auth_token=; Path=/; Max-Age=0; HttpOnly; SameSite=None; Secure",
  );
  res.json({ ok: true });
});

/** Player save — warlord-genesis progression in Postgres */
app.get("/api/grudge/player/save", async (req, res) => {
  try {
    const grudgeId = req.query.grudgeId;
    if (!grudgeId || typeof grudgeId !== "string") {
      return res.status(400).json({ error: "grudgeId required" });
    }
    const row = await getPlayerSave(grudgeId);
    if (!row) return res.json({ save: null });
    res.json({
      save: row.save_json,
      updatedAt: row.updated_at,
      role: row.role,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Load failed" });
  }
});

app.put("/api/grudge/player/save", async (req, res) => {
  try {
    const { grudgeId, userId, deviceId, role, save } = req.body || {};
    if (!grudgeId) return res.status(400).json({ error: "grudgeId required" });
    const row = await upsertPlayerSave({
      grudgeId,
      userId,
      deviceId,
      role,
      save: save ?? {},
    });
    res.json({ ok: true, updatedAt: row?.updated_at ?? new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message || "Save failed" });
  }
});

/** Canonical active character bridge */
app.get("/api/grudge/characters/active", async (req, res) => {
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const character = await canonicalActiveCharacter(req, token);
    res.json({ character: mapActiveCharacter(character) });
  } catch (err) {
    res.status(500).json({ error: err.message || "Character lookup failed" });
  }
});

app.listen(PORT, () => {
  console.log(`[warlord-genesis-api] listening on :${PORT}`);
  console.log(`[warlord-genesis-api] DATABASE_URL set: ${Boolean(process.env.DATABASE_URL)}`);
});