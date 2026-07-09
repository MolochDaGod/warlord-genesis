import {
  pgTable,
  serial,
  integer,
  text,
  bigint,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { grudgeUsersTable } from "./grudgeUsers";

/** Match outcome log — one row per recorded match per user. */
export const matchResultsTable = pgTable("match_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => grudgeUsersTable.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  seed: bigint("seed", { mode: "number" }),
  mode: text("mode"),
  won: boolean("won").notNull(),
  score: integer("score"),
  metaJson: jsonb("meta_json"),
  playedAt: timestamp("played_at").notNull().defaultNow(),
});

export const insertMatchResultSchema = createInsertSchema(matchResultsTable).omit({
  id: true,
  playedAt: true,
});
export type InsertMatchResult = z.infer<typeof insertMatchResultSchema>;
export type MatchResultRow = typeof matchResultsTable.$inferSelect;