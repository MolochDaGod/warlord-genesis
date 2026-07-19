#!/usr/bin/env node
/**
 * Reset Warlord Genesis player saves for a fresh production season.
 *
 * Usage:
 *   SEASON_RESET_SECRET=prod-2026-07-fresh-v1 node scripts/reset-production-season.mjs
 *   API_URL=https://warlord-genesis-api-production.up.railway.app node scripts/reset-production-season.mjs
 */

const API =
  process.env.API_URL ||
  process.env.WARLORD_GENESIS_API_URL ||
  "https://warlord-genesis-api-production.up.railway.app";
const SECRET =
  process.env.SEASON_RESET_SECRET ||
  process.env.PRODUCTION_SEASON ||
  "prod-2026-07-fresh-v1";

const url = `${API.replace(/\/$/, "")}/api/admin/reset-season`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Season-Reset": SECRET,
  },
  body: JSON.stringify({ secret: SECRET }),
});

const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
