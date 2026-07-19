#!/usr/bin/env node
/**
 * Generate vercel.json with Grudge fleet API rewrites + warlord-genesis API proxy.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "deploy-manifest.json");
const manifest = existsSync(MANIFEST_PATH)
  ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
  : {};
const GW_CORE_FILE = (manifest.bundleFile ?? "assets/gw-core-20260713.js").replace(/^\//, "");
const GW_CORE_PIN = `/${GW_CORE_FILE}?h=${manifest.bundleCacheHash ?? "b6"}`;
const GAME_DATA =
  process.env.GRUDGE_API_URL?.replace(/\/$/, "") ||
  "https://grudge-api-production-0d46.up.railway.app";
const WARLORD_API =
  process.env.WARLORD_GENESIS_API_URL?.replace(/\/$/, "") ||
  "https://warlord-genesis-api-production-3b5a.up.railway.app";
const WARLORD_MP =
  process.env.WARLORD_MP_URL?.replace(/\/$/, "") || "https://warlord-mp.up.railway.app";

const PREFIXES = [
  "health",
  "characters",
  "party",
  "account",
  "island",
  "islands",
  "inventory",
  "wallet",
  "nfts",
  "professions",
  "missions",
  "player",
  "resources",
  "sprites",
  "fleet",
  "lore",
  "combat",
  "rts",
  "races",
  "classes",
  "items",
  /** Fleet Treaty — friends, DMs, groups, server chat (Railway SSOT) */
  "treaty",
];

const AUTH_GATEWAY = "https://id.grudge-studio.com";

const AUTH_PATHS = [
  "puter",
  "puter-sso",
  "guest",
  "login",
  "register",
  "me",
  "scoped-profile",
  "discord/start",
  "verify",
  "session/exchange",
  "popup-token",
  "grudge-bridge",
  "wallet",
  "puter-link",
  "complete-profile",
];

const OBJECTSTORE = "https://objectstore.grudge-studio.com";

/** KayKit creeps, GRUDGE6 FBX heroes, projectiles — live on ObjectStore, not in this static deploy. */
const OBJECTSTORE_MODEL_PREFIXES = [
  "kaykit",
  "characters",
  "grudge6",
  "units",
  "projectiles",
  "rts",
];

/** client.grudge-studio.com mirrors R2 and hosts baked anims + grudge-nexus assets assets.grudge-studio.com lacks. */
const ASSET_CDN = "https://client.grudge-studio.com";

const rewrites = [
  { source: "/api/grudge/:path*", destination: `${WARLORD_API}/api/grudge/:path*` },
  // Fixed tower GLBs ship from this deploy — CDN copies are Assimp/non-standard and crash GLTFLoader.
  {
    source: "/api/assets/models/maps/:theme/:file",
    destination: "/models/towers/:theme/:file",
  },
  {
    source: "/api/assets/grudge-nexus/models/maps/:theme/:file",
    destination: "/models/towers/:theme/:file",
  },
  {
    source: "/api/assets/grudge-nexus/textures/Color_Palette.png",
    destination: "/models/units/Color_Palette.png",
  },
  {
    source: "/api/assets/grudge-nexus/models/rts/units/:file",
    destination: "/models/units/:file",
  },
  /** GRUDGE6 faction hero GLBs (~240MB) — too large for Vercel static output; proxy from git raw. */
  {
    source: "/models/heroes/grudge6/:file",
    destination:
      "https://raw.githubusercontent.com/MolochDaGod/warlord-genesis/main/models/heroes/grudge6/:file",
  },
  /** GRUDGE6 race atlases — local /textures/grudge6 fallback proxies to canonical R2 CDN. */
  {
    source: "/textures/grudge6/:race/:file",
    destination: "https://assets.grudge-studio.com/assets/:race/textures/:file",
  },
  {
    source: "/textures/WK_Standard_Units.webp",
    destination:
      "https://assets.grudge-studio.com/assets/western-kingdoms/textures/WK_Standard_Units.webp",
  },
  { source: "/api/assets/:path*", destination: `${ASSET_CDN}/:path*` },
  {
    source: "/api/objectstore/:path*",
    destination: `${OBJECTSTORE}/api/:path*`,
  },
  {
    source: "/assets/skills/:path*",
    destination: `${OBJECTSTORE}/assets/skills/:path*`,
  },
  {
    source: "/media/heroes/portraits/:path*",
    destination: `${OBJECTSTORE}/heroes/portraits/:path*`,
  },
  {
    source: "/media/heroes/videos/:path*",
    destination: `${OBJECTSTORE}/heroes/videos/:path*`,
  },
];

for (const prefix of OBJECTSTORE_MODEL_PREFIXES) {
  rewrites.push({
    source: `/models/${prefix}/:path*`,
    destination: `${OBJECTSTORE}/models/${prefix}/:path*`,
  });
}

for (const prefix of PREFIXES) {
  rewrites.push(
    { source: `/api/${prefix}`, destination: `${GAME_DATA}/api/${prefix}` },
    { source: `/api/${prefix}/:path*`, destination: `${GAME_DATA}/api/${prefix}/:path*` },
  );
}

for (const segment of AUTH_PATHS) {
  rewrites.push({
    source: `/api/auth/${segment}`,
    destination: `${GAME_DATA}/api/auth/${segment}`,
  });
}

/** Canonical fleet auth proxy — id hub, not deprecated api.grudge-studio.com */
rewrites.push(
  { source: "/auth/callback", destination: "/index.html" },
  { source: "/api/auth/:path*", destination: `${AUTH_GATEWAY}/api/auth/:path*` },
  { source: "/auth/:path*", destination: `${AUTH_GATEWAY}/auth/:path*` },
  // Login SPA is proxied from id hub. Relative assets on /login must also proxy or
  // they hit this game's SPA catch-all as text/html (broken bg, logos, brand).
  { source: "/login", destination: `${AUTH_GATEWAY}/login` },
  { source: "/auth-bg-racalvin.jpg", destination: `${AUTH_GATEWAY}/auth-bg-racalvin.jpg` },
  { source: "/grudge-id-logo.png", destination: `${AUTH_GATEWAY}/grudge-id-logo.png` },
  { source: "/brand/logo.png", destination: `${AUTH_GATEWAY}/brand/logo.png` },
  { source: "/brand/:path*", destination: `${AUTH_GATEWAY}/brand/:path*` },
  { source: "/api/ai/:path*", destination: "https://ai.grudge-studio.com/:path*" },
  // Game profiles / matches / leaderboards for this title — NOT grudge-studio.com (retro ROM catalog).
  { source: "/api/games", destination: `${WARLORD_API}/api/games` },
  { source: "/api/games/:path*", destination: `${WARLORD_API}/api/games/:path*` },
  // Fleet map for dashboards
  { source: "/api/grudge/fleet", destination: `${WARLORD_API}/api/grudge/fleet` },
  // MOBA / PvP multipath health (Socket.IO server — set WARLORD_MP_URL when live)
  { source: "/api/mp/health", destination: `${WARLORD_MP}/health` },
  // Unknown fleet APIs → grudge-api (account/characters already rewritten above).
  // Never proxy to grudge-studio.com — that host serves NES/NDS listings as /api/games.
  { source: "/api/:path*", destination: `${GAME_DATA}/api/:path*` },
  {
    source:
      "/((?!assets/|models/|media/|textures/|anims/|api/|sdk/|favicon\\.svg|favicon\\.png|favicon-|apple-touch|fleet-|leaderboards|auth-bg|grudge-id-logo|brand/|grudge-game-bootstrap).*)",
    destination: "/index.html",
  },
);

/** Vercel has no local machine paths (vfc-build, Character-Animator-Mapper). Assets ship from git. */
const CI_BUILD = "node scripts/ci-build.mjs";

const config = {
  buildCommand: CI_BUILD,
  installCommand: "",
  outputDirectory: ".",
  framework: null,
  // Dead bundle URLs → Sprite-safe core (filename browsers have never cached).
  redirects: [
    {
      source: "/assets/index-warlord-fix3.js",
      destination: GW_CORE_PIN,
      permanent: true,
    },
    {
      source: "/index-warlord-fix3.js",
      destination: GW_CORE_PIN,
      permanent: true,
    },
    {
      source: "/assets/index-warlord-fix95.js",
      destination: GW_CORE_PIN,
      permanent: true,
    },
  ],
  headers: [
    {
      source: "/index.html",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        { key: "Pragma", value: "no-cache" },
      ],
    },
    {
      source: "/",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        { key: "Pragma", value: "no-cache" },
      ],
    },
    {
      source: "/force-reload.html",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
      ],
    },
    {
      source: "/assets/gw-core-(.*).js",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        { key: "Pragma", value: "no-cache" },
        { key: "CDN-Cache-Control", value: "no-store" },
      ],
    },
    {
      source: "/assets/index-warlord-(.*).js",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        { key: "Pragma", value: "no-cache" },
        { key: "CDN-Cache-Control", value: "no-store" },
      ],
    },
    {
      source: "/assets/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
    },
    {
      source: "/models/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
    },
    {
      source: "/textures/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
    },
    {
      source: "/anims/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
    },
  ],
  rewrites,
};

writeFileSync(join(ROOT, "vercel.json"), JSON.stringify(config, null, 2) + "\n");
console.log(
  "[vercel] wrote vercel.json with",
  rewrites.length,
  "rewrites,",
  config.redirects.length,
  "redirects",
);