import {
  pgTable,
  serial,
  text,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A Grudge Warlords account. The authoritative identity is the Puter user
// (`puterUuid`); guests are keyed by a client-generated `deviceId` instead.
// The human-facing `grudgeId` is derived from whichever identity created the
// row and is stable for the lifetime of the account.
export const grudgeUsersTable = pgTable("grudge_users", {
  id: serial("id").primaryKey(),
  puterUuid: text("puter_uuid").unique(),
  puterUsername: text("puter_username"),
  deviceId: text("device_id").unique(),
  grudgeId: text("grudge_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  gbuxBalance: bigint("gbux_balance", { mode: "number" })
    .notNull()
    .default(0),
  role: text("role").notNull().default("player"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGrudgeUserSchema = createInsertSchema(grudgeUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGrudgeUser = z.infer<typeof insertGrudgeUserSchema>;
export type GrudgeUserRow = typeof grudgeUsersTable.$inferSelect;
