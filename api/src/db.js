import pg from "pg";

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function upsertPlayerSave({
  grudgeId,
  userId,
  deviceId,
  role,
  save,
}) {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(
    `INSERT INTO warlord_genesis_players (grudge_id, user_id, device_id, role, save_json, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (grudge_id) DO UPDATE SET
       user_id = COALESCE(EXCLUDED.user_id, warlord_genesis_players.user_id),
       device_id = COALESCE(EXCLUDED.device_id, warlord_genesis_players.device_id),
       role = EXCLUDED.role,
       save_json = EXCLUDED.save_json,
       updated_at = NOW()
     RETURNING save_json, updated_at`,
    [grudgeId, userId ?? null, deviceId ?? null, role ?? "player", JSON.stringify(save ?? {})],
  );
  return rows[0] ?? null;
}

export async function getPlayerSave(grudgeId) {
  const db = getPool();
  if (!db) return null;
  const { rows } = await db.query(
    `SELECT grudge_id, user_id, device_id, role, save_json, updated_at
     FROM warlord_genesis_players WHERE grudge_id = $1 LIMIT 1`,
    [grudgeId],
  );
  return rows[0] ?? null;
}

/** Wipe all Warlord Genesis player saves (fresh production season). */
export async function resetAllPlayerSaves() {
  const db = getPool();
  if (!db) return { ok: false, error: "no database" };
  const { rowCount } = await db.query(`TRUNCATE warlord_genesis_players`);
  return { ok: true, truncated: rowCount ?? 0 };
}