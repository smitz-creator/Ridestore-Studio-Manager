import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const preProductionImagesTable = pgTable("pre_production_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  imageType: text("image_type").notNull().default("gallery"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PreProductionImage = typeof preProductionImagesTable.$inferSelect;
