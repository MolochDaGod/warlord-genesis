import {
  pgTable,
  serial,
  integer,
  text,
  bigint,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { grudgeUsersTable } from "./grudgeUsers";

/** Per-game progression — currency + opaque meta blob (shards, cards, onboarding). */
export const gameProfilesTable = pgTable(
  "game_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => grudgeUsersTable.id, { onDelete: "cascade" }),
    gameId: text("game_id").notNull(),
    currency: bigint("currency", { mode: "number" }).notNull().default(0),
    metaJson: jsonb("meta_json").notNull().default({}),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("game_profiles_user_game_idx").on(t.userId, t.gameId)],
);

export const insertGameProfileSchema = createInsertSchema(gameProfilesTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertGameProfile = z.infer<typeof insertGameProfileSchema>;
export type GameProfileRow = typeof gameProfilesTable.$inferSelect;