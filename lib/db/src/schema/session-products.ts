import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { studioSessionsTable } from "./studio-sessions";
import { productsTable } from "./products";

export const sessionProductsTable = pgTable("session_products", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => studioSessionsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("session_product_unique").on(table.sessionId, table.productId),
]);

export type SessionProduct = typeof sessionProductsTable.$inferSelect;
