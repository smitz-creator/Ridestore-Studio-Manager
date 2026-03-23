import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";

export const plannerBlocksTable = pgTable("planner_blocks", {
  id: serial("id").primaryKey(),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  dayIndex: integer("day_index").notNull(),
  row: text("row").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  isMilestone: boolean("is_milestone").default(false),
  linkedSessionId: integer("linked_session_id"),
});

export type PlannerBlock = typeof plannerBlocksTable.$inferSelect;
