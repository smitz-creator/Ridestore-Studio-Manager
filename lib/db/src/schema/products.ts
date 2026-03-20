import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  gender: text("gender").notNull(),
  productType: text("product_type").notNull(),
  shortname: text("shortname").notNull(),
  style: text("style"),
  design: text("design"),
  keyCode: text("key_code"),
  colour: text("colour"),
  galleryShots: text("gallery_shots"),
  detailsShots: text("details_shots"),
  miscShots: text("misc_shots"),
  deliveryStatus: text("delivery_status").notNull().default("not_ordered"),
  factoryDelayed: boolean("factory_delayed").notNull().default(false),
  isReshoot: boolean("is_reshoot").notNull().default(false),
  uploadStatus: text("upload_status").notNull().default("not_started"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Product = typeof productsTable.$inferSelect;
