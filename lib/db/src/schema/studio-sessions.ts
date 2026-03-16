import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const studioSessionsTable = pgTable("studio_sessions", {
  id: serial("id").primaryKey(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  modelName: text("model_name").notNull(),
  brand: text("brand").notNull(),
  shotType: text("shot_type").notNull(),
  notes: text("notes"),
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StudioSession = typeof studioSessionsTable.$inferSelect;
