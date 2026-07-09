#!/usr/bin/env node
/**
 * Apply 001_unify_fleet_characters.sql to Railway Postgres.
 * Usage: DATABASE_URL=postgres://... node scripts/run-fleet-migration.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "migrations", "001_unify_fleet_characters.sql");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
  const { rows } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name IN ('game_era', 'active_for_era', 'prefab_id')
    ORDER BY column_name
  `);
  const { rows: activeCount } = await client.query(
    `SELECT COUNT(*)::int AS n FROM characters WHERE active_for_era = true`,
  );
  await client.query("COMMIT");
  console.log("Migration OK");
  console.log("Columns present:", rows.map((r) => r.column_name).join(", "));
  console.log("Active-for-era rows:", activeCount[0]?.n ?? 0);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end();
}