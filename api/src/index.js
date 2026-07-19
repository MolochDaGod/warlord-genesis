import cors from "cors";
import express from "express";
import {
  canonicalActiveCharacter,
  canonicalGuest,
  canonicalMe,
  canonicalPuterLogin,
  mapActiveCharacter,
  mapBundleUser,
} from "./canonical.js";
import { getPlayerSave, upsertPlayerSave, resetAllPlayerSaves } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT) || 8787;

const allowedOrigins = [
  "https://warlord-genesis.vercel.app",
  "https://warstrat.grudge-studio.com",
  "https://www.warstrat.grudge-studio.com",
  "https://grudgewarlords.com",
  "https://www.grudgewarlords.com",
  /^https:\/\/warlord-genesis.*\.vercel\.app$/,
  /^https:\/\/.*\.warstrat\.grudge-studio\.com$/,
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
    const canonical = await canonicalGuest(req, deviceId);
    const token = canonical.token || canonical.sessionToken;
    if (token) setAuthCookie(res, token);

    const user = mapBundleUser(canonical, "guest");
    if (token) user.token = token;
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

app.post("/api/grudge/auth/puter", async (req, res) => {
  try {
    const puterId = req.body?.puterId || req.body?.puterUuid;
    const displayName = req.body?.displayName || req.body?.puterUsername;
    const email = req.body?.email;
    if (!puterId) {
      return res.status(400).json({ error: "puterId required" });
    }

    const canonical = await canonicalPuterLogin(req, { puterId, displayName, email });
    const token = canonical.token || canonical.sessionToken;
    if (token) setAuthCookie(res, token);

    const user = mapBundleUser(canonical, "player");
    res.json({ ...user, token });
  } catch (err) {
    res.status(500).json({ error: err.message || "Puter auth failed" });
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

/**
 * Fresh production season — wipe all Warlord Genesis player save rows.
 * Requires header X-Season-Reset: <SEASON_RESET_SECRET or PRODUCTION_SEASON>
 */
app.post("/api/admin/reset-season", async (req, res) => {
  try {
    const secret =
      process.env.SEASON_RESET_SECRET ||
      process.env.PRODUCTION_SEASON ||
      "prod-2026-07-fresh-v1";
    const provided =
      req.get("X-Season-Reset") || req.body?.secret || req.query?.secret;
    if (!provided || provided !== secret) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const result = await resetAllPlayerSaves();
    res.json({
      ok: true,
      season: process.env.PRODUCTION_SEASON || "prod-2026-07-fresh-v1",
      ...result,
      ts: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Reset failed" });
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

/**
 * Layered wallet model for Warlord Genesis:
 *  - matchCredits: session-only battle currency (client ECONOMY.startCredits)
 *  - gbux: meta progression (fleet account)
 *  - gold / premiumCurrency / characterTokens: fleet MMO purse
 *  - chain: Crossmint / Solana address when linked
 */
app.get("/api/grudge/wallet", async (req, res) => {
  try {
    const token = readToken(req);
    let account = null;
    if (token) {
      const r = await fetch(
        `${process.env.GRUDGE_API_URL?.replace(/\/$/, "") || "https://grudge-api-production-0d46.up.railway.app"}/api/account`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "X-Grudge-Client": "warlord-genesis",
          },
        },
      );
      if (r.ok) account = await r.json();
    }
    res.json({
      version: 1,
      match: {
        currency: "credits",
        startCredits: 300,
        incomePerSec: 7,
        note: "Match credits are session-only and never equal fleet gold/GBUX.",
      },
      meta: {
        gbux: Number(account?.gbuxBalance ?? 0),
        characterTokens: Number(account?.characterTokens ?? 0),
      },
      fleet: {
        gold: Number(account?.gold ?? 0),
        premiumCurrency: Number(account?.premiumCurrency ?? 0),
      },
      chain: {
        walletAddress: account?.walletAddress ?? null,
        walletType: account?.walletType ?? null,
        crossmintEmail: account?.crossmintEmail ?? null,
      },
      eraSlots: account?.eraSlots ?? {
        nexus: { max: 2, activeCharacterId: null },
        armada: { max: 2, activeCharacterId: null },
        warlords: { max: 5, activeCharacterId: null },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Wallet lookup failed" });
  }
});

/** Canonical shop + combat unit definitions (single-player + PvP aligned). */
app.get("/api/grudge/definitions/units", (_req, res) => {
  res.json({
    version: 1,
    shop: [
      { id: "footman", name: "Footman", cost: 80, kind: "unit", line: "melee", hp: 150, damage: 16, speed: 5.4 },
      { id: "archer", name: "Archer", cost: 120, kind: "unit", line: "ranged", hp: 90, damage: 20, speed: 5 },
      { id: "knight", name: "Knight", cost: 180, kind: "unit", line: "melee", hp: 320, damage: 26, speed: 4.6 },
    ],
    classes: ["warrior", "ranger", "mage", "worge"],
    races: {
      human: "western-kingdoms",
      barbarian: "barbarians",
      elf: "high-elves",
      dwarf: "dwarves",
      orc: "orcs",
      undead: "undead",
    },
    factions: ["crusade", "fabled", "legion"],
    economy: { startCredits: 300, incomePerSec: 7 },
  });
});

/** Game catalog for THIS title only — never the fleet retro ROM list. */
app.get("/api/games", (_req, res) => {
  res.json([
    {
      id: "grudge-warlords",
      title: "Warlord Genesis",
      slug: "warlord-genesis",
      platform: "web",
      category: "rts",
      isPlayable: true,
      isFeatured: true,
      description: "Three-lane RTS warcamp — Puter / Grudge ID login, lane deploy, Grudge Engine combat.",
      url: "https://warlord-genesis.vercel.app",
      embedUrl: "/play",
    },
  ]);
});

function emptyMeta() {
  return {
    onboardingDone: false,
    starterPrefabId: null,
    cards: [],
    lastDailyClaim: null,
    lastMatchReward: null,
  };
}

function profileDto(gameId, me, save) {
  const meta = save?.save_json ?? emptyMeta();
  // Prefer fleet GBUX when present; fall back to meta.gbux saved locally.
  const currency = Number(
    me?.gbuxBalance ?? me?.gbux ?? meta?.gbux ?? 0,
  );
  return {
    gameId,
    currency,
    meta: typeof meta === "object" && meta ? meta : emptyMeta(),
    updatedAt: save?.updated_at ?? new Date().toISOString(),
  };
}

/** Guest-friendly profile read — no auth → empty local-shaped profile (not 500). */
app.get("/api/games/:gameId/profile", async (req, res) => {
  try {
    if (req.params.gameId !== "grudge-warlords") {
      return res.status(404).json({ error: "Unknown game" });
    }
    const token = readToken(req);
    if (!token) {
      return res.json({
        gameId: "grudge-warlords",
        currency: 0,
        meta: emptyMeta(),
        updatedAt: new Date().toISOString(),
        anonymous: true,
      });
    }
    const me = await canonicalMe(req, token);
    const grudgeId = me?.grudgeId || me?.grudge_id || null;
    const save = grudgeId ? await getPlayerSave(grudgeId) : null;
    res.json(profileDto("grudge-warlords", me, save));
  } catch (err) {
    console.error("[profile GET]", err);
    // Soft-fail so lobby still boots offline
    res.json({
      gameId: "grudge-warlords",
      currency: 0,
      meta: emptyMeta(),
      updatedAt: new Date().toISOString(),
      error: err.message || "Profile load failed",
    });
  }
});

/**
 * PATCH /api/games/:gameId/profile
 * Body: { currency?, meta? } — merges meta into warlord_genesis_players.save_json.
 * Auth optional: without token we no-op success so unauthenticated lobby seed
 * does not spam 500s (localStorage remains SSOT until login).
 */
app.patch("/api/games/:gameId/profile", async (req, res) => {
  try {
    if (req.params.gameId !== "grudge-warlords") {
      return res.status(404).json({ error: "Unknown game" });
    }
    const token = readToken(req);
    const body = req.body || {};
    const metaPatch =
      body.meta && typeof body.meta === "object" ? body.meta : {};
    const currency =
      typeof body.currency === "number" && Number.isFinite(body.currency)
        ? body.currency
        : undefined;

    if (!token) {
      return res.json({
        gameId: "grudge-warlords",
        currency: currency ?? 0,
        meta: { ...emptyMeta(), ...metaPatch },
        updatedAt: new Date().toISOString(),
        anonymous: true,
        persisted: false,
      });
    }

    const me = await canonicalMe(req, token);
    const grudgeId = me?.grudgeId || me?.grudge_id;
    if (!grudgeId) {
      return res.status(401).json({ error: "No grudgeId on session" });
    }

    const existing = (await getPlayerSave(grudgeId))?.save_json ?? emptyMeta();
    const merged = {
      ...(typeof existing === "object" && existing ? existing : emptyMeta()),
      ...metaPatch,
    };
    if (currency !== undefined) merged.gbux = currency;

    const role =
      me?.username?.toLowerCase?.() === "guest" || me?.role === "guest"
        ? "guest"
        : "player";
    const row = await upsertPlayerSave({
      grudgeId,
      userId: me?.userId || me?.id || me?.user?.id,
      role,
      save: merged,
    });

    res.json(
      profileDto(
        "grudge-warlords",
        { ...me, gbuxBalance: currency ?? me?.gbuxBalance },
        row ? { save_json: merged, updated_at: row.updated_at } : null,
      ),
    );
  } catch (err) {
    console.error("[profile PATCH]", err);
    res.status(500).json({ error: err.message || "Profile save failed" });
  }
});

/** Match result — apply reward GBUX into save meta when authenticated. */
app.post("/api/games/:gameId/matches", async (req, res) => {
  try {
    if (req.params.gameId !== "grudge-warlords") {
      return res.status(404).json({ error: "Unknown game" });
    }
    const token = readToken(req);
    const body = req.body || {};
    if (!token) {
      return res.json({ ok: true, persisted: false, profile: null });
    }
    const me = await canonicalMe(req, token);
    const grudgeId = me?.grudgeId || me?.grudge_id;
    if (!grudgeId) {
      return res.json({ ok: true, persisted: false, profile: null });
    }
    const existing = (await getPlayerSave(grudgeId))?.save_json ?? emptyMeta();
    const meta = {
      ...(typeof existing === "object" && existing ? existing : emptyMeta()),
      ...(body.meta && typeof body.meta === "object" ? body.meta : {}),
    };
    if (typeof body.rewardGbux === "number") {
      meta.gbux = Number(meta.gbux || 0) + body.rewardGbux;
    }
    const row = await upsertPlayerSave({
      grudgeId,
      userId: me?.userId || me?.id,
      role: me?.role === "guest" ? "guest" : "player",
      save: meta,
    });
    res.json({
      ok: true,
      persisted: true,
      profile: profileDto("grudge-warlords", me, {
        save_json: meta,
        updated_at: row?.updated_at,
      }),
    });
  } catch (err) {
    console.error("[matches POST]", err);
    res.status(500).json({ error: err.message || "Match record failed" });
  }
});

app.listen(PORT, () => {
  console.log(`[warlord-genesis-api] listening on :${PORT}`);
  console.log(`[warlord-genesis-api] DATABASE_URL set: ${Boolean(process.env.DATABASE_URL)}`);
});