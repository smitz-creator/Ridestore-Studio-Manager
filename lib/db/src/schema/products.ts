import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),

  // === Core identity (used by both Excel + Airtable) ===
  keyCode: text("key_code"),
  shortname: text("shortname").notNull(),
  gender: text("gender").notNull(),
  productType: text("product_type").notNull(),
  brand: text("brand").notNull().default(""),
  style: text("style"),
  design: text("design"),
  colour: text("colour"),

  // === Airtable-synced fields (new for FW26+) ===
  collection: text("collection"),
  lifecycle: text("lifecycle"),
  colorCategory: text("color_category"),
  imageUrl: text("image_url"),
  size: text("size"),
  etd: text("etd"),
  etdStatus: text("etd_status"),
  eta: text("eta"),
  shippingStatus: text("shipping_status"),
  officeStatus: text("office_status"),
  designChanges: text("design_changes").default(""),

  // === Shot session stamps (write-back to Airtable) ===
  galleryShot: text("gallery_shot").default(""),
  detailShot: text("detail_shot").default(""),
  miscShot: text("misc_shot").default(""),
  studioNotes: text("studio_notes").default(""),
  reviewSb: text("review_sb").default(""),
  reviewSki: text("review_ski").default(""),

  // === Product status — the new 9-step pipeline ===
  productStatus: text("product_status").notNull().default("Not Started"),

  // === Local-only flags ===
  isCarryOver: boolean("is_carry_over").notNull().default(false),
  isReshoot: boolean("is_reshoot").notNull().default(false),

  // === Airtable sync metadata ===
  airtableRecordId: text("airtable_record_id"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

  // === Legacy fields (for old Excel-imported seasons) ===
  deliveryStatus: text("delivery_status").default("not_ordered"),
  factoryDelayed: boolean("factory_delayed").notNull().default(false),
  uploadStatus: text("upload_status").default("not_started"),
  preProductionStatus: text("pre_production_status").default("pending"),

  // === Timestamps ===
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Product = typeof productsTable.$inferSelect;
