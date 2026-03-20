import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";

export const retouchSessionsTable = pgTable("retouch_sessions", {
  id: serial("id").primaryKey(),
  sessionName: text("session_name").notNull().unique(),
  sentTo: text("sent_to"),
  carryOversSourced: boolean("carry_overs_sourced").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type RetouchSession = typeof retouchSessionsTable.$inferSelect;
