import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

const SQL = `
CREATE TABLE IF NOT EXISTS warlord_genesis_players (
  grudge_id TEXT PRIMARY KEY,
  user_id TEXT,
  device_id TEXT,
  role TEXT NOT NULL DEFAULT 'player',
  save_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS warlord_genesis_players_device_idx
  ON warlord_genesis_players (device_id);

CREATE INDEX IF NOT EXISTS warlord_genesis_players_user_idx
  ON warlord_genesis_players (user_id);
`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("[migrate] DATABASE_URL missing — skip");
    process.exit(0);
  }
  await pool.query(SQL);
  console.log("[migrate] warlord_genesis_players ready");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] non-fatal:", err?.message || err);
  process.exit(0);
});