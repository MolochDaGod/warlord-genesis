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

rewrites.push(
  { source: "/api/auth/:path*", destination: "https://id.grudge-studio.com/auth/:path*" },
  { source: "/api/ai/:path*", destination: "https://ai.grudge-studio.com/:path*" },
  { source: "/api/:path*", destination: "https://api.grudge-studio.com/api/:path*" },
  {
    source: "/((?!assets/|models/|media/|textures/|anims/|api/|favicon\\.svg).*)",
    destination: "/index.html",
  },
);

/** Vercel has no local machine paths (vfc-build, Character-Animator-Mapper). Assets ship from git. */
const CI_BUILD =
  "node scripts/stage-textures.mjs && node scripts/stage-icons.mjs && node scripts/fix-glb-header.mjs models/towers && node scripts/fix-glb-header.mjs models/heroes && node scripts/fix-glb-header.mjs models/pets && node scripts/fix-glb-header.mjs models/anims && node scripts/validate-tower-glbs.mjs && node scripts/patch-bundle.mjs && node scripts/generate-vercel-config.mjs && node scripts/verify-deploy.mjs";

const config = {
  buildCommand: CI_BUILD,
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
    {
      source: "/anims/(.*)",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
    },
  ],
  rewrites,
};

writeFileSync(join(ROOT, "vercel.json"), JSON.stringify(config, null, 2) + "\n");
console.log("[vercel] wrote vercel.json with", rewrites.length, "rewrites");