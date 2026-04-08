import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  season: text("season").notNull(),

  // "excel" for old imports, "airtable" for FW26+
  dataSource: text("data_source").notNull().default("excel"),

  // Airtable connection info (only for airtable projects)
  airtableBaseId: text("airtable_base_id"),
  airtableTableId: text("airtable_table_id"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Project = typeof projectsTable.$inferSelect;
