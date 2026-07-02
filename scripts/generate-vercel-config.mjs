#!/usr/bin/env node
/**
 * Generate vercel.json with Grudge fleet API rewrites + warlord-genesis API proxy.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME_DATA =
  process.env.GRUDGE_API_URL?.replace(/\/$/, "") ||
  "https://grudge-api-production-0d46.up.railway.app";
const WARLORD_API =
  process.env.WARLORD_GENESIS_API_URL?.replace(/\/$/, "") ||
  "https://warlord-genesis-api-production.up.railway.app";

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
];

const AUTH_PATHS = [
  "puter",
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

const rewrites = [
  { source: "/api/grudge/:path*", destination: `${WARLORD_API}/api/grudge/:path*` },
  { source: "/api/assets/:path*", destination: "https://assets.grudge-studio.com/:path*" },
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

rewrites.push(
  { source: "/api/auth/:path*", destination: "https://id.grudge-studio.com/auth/:path*" },
  { source: "/api/ai/:path*", destination: "https://ai.grudge-studio.com/:path*" },
  { source: "/api/:path*", destination: "https://api.grudge-studio.com/api/:path*" },
  {
    source: "/((?!assets/|models/|media/|textures/|api/|favicon\\.svg).*)",
    destination: "/index.html",
  },
);

const config = {
  buildCommand: "node scripts/patch-bundle.mjs && node scripts/generate-vercel-config.mjs",
  installCommand: "",
  outputDirectory: ".",
  framework: null,
  headers: [
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
  ],
  rewrites,
};

writeFileSync(join(ROOT, "vercel.json"), JSON.stringify(config, null, 2) + "\n");
console.log("[vercel] wrote vercel.json with", rewrites.length, "rewrites");