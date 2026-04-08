/**
 * Airtable Sync Service for Studio Manager
 *
 * Two-way sync:
 *   READ  (Airtable → App): 19 fields (product identity, delivery, logistics)
 *   WRITE (App → Airtable): 7 fields (shots, status, reviews, notes)
 *
 * Sync is per-project — each project stores its own baseId + tableId.
 * The PAT is a single env var shared across all projects.
 */

// ---------- Field mappings ----------

/** Airtable field name → DB column name (read-only, Airtable is source of truth) */
const AIRTABLE_TO_DB: Record<string, string> = {
  KEY: "keyCode",
  Shortname: "shortname",
  Gender: "gender",
  "Product type": "productType",
  Brand: "brand",
  Collection: "collection",
  "Life Cycle": "lifecycle",
  Design: "design",
  Style: "style",
  Color: "colour",
  "Color Category": "colorCategory",
  Image: "imageUrl",
  Size: "size",
  ETD: "etd",
  "ETD Status": "etdStatus",
  ETA: "eta",
  "Shipping Status": "shippingStatus",
  "Office Status": "officeStatus",
  "Design Changes": "designChanges",
};

/** DB column name → Airtable field name (write-back, app is source of truth) */
const DB_TO_AIRTABLE: Record<string, string> = {
  galleryShot: "Gallery Shot",
  detailShot: "Detail Shot",
  miscShot: "Misc Shot",
  studioNotes: "Studio Notes",
  productStatus: "Product Status",
  reviewSb: "Review Snowboard",
  reviewSki: "Review Ski",
};

/** Fields that are intentionally skipped during sync */
const SKIPPED_FIELDS = [
  "Style Number",
  "Insulation",
  "QTY",
  "Order ID",
  "Comments 1 Production",
  "Comments 2 Production",
  "Tracking Number",
  "ID",
  "Launch FW26 Summary 3",
];

// ---------- Product status pipeline ----------

export const PRODUCT_STATUS_STEPS = [
  "Not Started",
  "Sourced",
  "In Studio",
  "Selection",
  "Retouch",
  "Post Production",
  "Naming",
  "Ready to Upload",
  "Uploaded",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUS_STEPS)[number];

// ---------- API helpers ----------

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

function getToken(): string {
  const token = process.env.AIRTABLE_PAT;
  if (!token) throw new Error("AIRTABLE_PAT environment variable is not set");
  return token;
}

async function airtableFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${AIRTABLE_API_BASE}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Airtable API ${resp.status}: ${body}`);
  }

  return resp.json();
}

// ---------- Types ----------

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
  writtenBack: number;
}

// ---------- Read: Airtable → App ----------

/**
 * Fetch ALL records from an Airtable table (handles pagination).
 * Optionally filter by brand.
 */
export async function fetchAllRecords(
  baseId: string,
  tableId: string,
  filterBrand?: string
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    if (filterBrand) {
      params.set(
        "filterByFormula",
        `{Brand} = "${filterBrand}"`
      );
    }

    const data: AirtableListResponse = await airtableFetch(
      `/${baseId}/${tableId}?${params}`
    );

    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

/**
 * Convert an Airtable record to a flat DB-ready object.
 * Only maps fields defined in AIRTABLE_TO_DB.
 */
export function recordToProduct(
  record: AirtableRecord,
  projectId: number
): Record<string, any> {
  const product: Record<string, any> = {
    projectId,
    airtableRecordId: record.id,
  };

  for (const [atField, dbField] of Object.entries(AIRTABLE_TO_DB)) {
    const value = record.fields[atField];
    if (value !== undefined && value !== null) {
      // Airtable Image field can be an array of attachment objects
      if (atField === "Image" && Array.isArray(value) && value.length > 0) {
        product[dbField] = value[0].url || "";
      } else {
        product[dbField] = String(value).trim();
      }
    }
  }

  // Also grab write-back fields if they exist in Airtable (initial seed)
  for (const [dbField, atField] of Object.entries(DB_TO_AIRTABLE)) {
    const value = record.fields[atField];
    if (value !== undefined && value !== null && String(value).trim()) {
      product[dbField] = String(value).trim();
    }
  }

  // Derive carryOver from lifecycle
  if (product.lifecycle) {
    const lc = product.lifecycle.toLowerCase();
    product.isCarryOver = lc.includes("carry") || lc.includes("co ");
  }

  // Ensure required fields have defaults
  if (!product.shortname) product.shortname = "Unknown";
  if (!product.gender) product.gender = "Unisex";
  if (!product.productType) product.productType = "Unknown";
  if (!product.brand) product.brand = "";

  return product;
}

// ---------- Write-back: App → Airtable ----------

/**
 * Push write-back fields for a single product to Airtable.
 */
export async function writeBackProduct(
  baseId: string,
  tableId: string,
  airtableRecordId: string,
  product: Record<string, any>
): Promise<void> {
  const fields: Record<string, any> = {};

  for (const [dbField, atField] of Object.entries(DB_TO_AIRTABLE)) {
    if (product[dbField] !== undefined && product[dbField] !== null) {
      fields[atField] = String(product[dbField]);
    }
  }

  if (Object.keys(fields).length === 0) return;

  await airtableFetch(`/${baseId}/${tableId}`, {
    method: "PATCH",
    body: JSON.stringify({
      records: [{ id: airtableRecordId, fields }],
    }),
  });
}

/**
 * Batch write-back multiple products (max 10 per Airtable API call).
 */
export async function batchWriteBack(
  baseId: string,
  tableId: string,
  products: Array<{ airtableRecordId: string; [key: string]: any }>
): Promise<number> {
  let written = 0;

  // Airtable batch limit = 10 records per request
  for (let i = 0; i < products.length; i += 10) {
    const batch = products.slice(i, i + 10);
    const records = batch
      .filter((p) => p.airtableRecordId)
      .map((p) => {
        const fields: Record<string, any> = {};
        for (const [dbField, atField] of Object.entries(DB_TO_AIRTABLE)) {
          if (p[dbField] !== undefined && p[dbField] !== null) {
            fields[atField] = String(p[dbField]);
          }
        }
        return { id: p.airtableRecordId, fields };
      })
      .filter((r) => Object.keys(r.fields).length > 0);

    if (records.length === 0) continue;

    await airtableFetch(`/${baseId}/${tableId}`, {
      method: "PATCH",
      body: JSON.stringify({ records }),
    });

    written += records.length;
  }

  return written;
}

// ---------- Full sync orchestration ----------

/**
 * Import: pull all Airtable records, upsert into DB.
 * Uses airtable_record_id as the match key.
 */
export async function syncFromAirtable(
  baseId: string,
  tableId: string,
  projectId: number,
  filterBrand?: string,
  db?: any,
  productsTable?: any
): Promise<SyncResult> {
  const { eq, and } = await import("drizzle-orm");

  const records = await fetchAllRecords(baseId, tableId, filterBrand);
  const result: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: [],
    writtenBack: 0,
  };

  for (const record of records) {
    try {
      const productData = recordToProduct(record, projectId);

      // Check if product already exists by airtable_record_id
      const [existing] = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.projectId, projectId),
            eq(productsTable.airtableRecordId, record.id)
          )
        );

      if (existing) {
        // Update read-only fields, preserve write-back fields
        const updates: Record<string, any> = {};
        for (const [_atField, dbField] of Object.entries(AIRTABLE_TO_DB)) {
          if (productData[dbField] !== undefined) {
            // Only update if value actually changed
            if (String(existing[dbField] ?? "") !== String(productData[dbField] ?? "")) {
              updates[dbField] = productData[dbField];
            }
          }
        }
        // Update carryOver flag
        if (productData.isCarryOver !== undefined && productData.isCarryOver !== existing.isCarryOver) {
          updates.isCarryOver = productData.isCarryOver;
        }

        if (Object.keys(updates).length > 0) {
          updates.lastSyncedAt = new Date();
          await db
            .update(productsTable)
            .set(updates)
            .where(eq(productsTable.id, existing.id));
          result.updated++;
        } else {
          result.unchanged++;
        }
      } else {
        // Create new product
        productData.lastSyncedAt = new Date();
        if (!productData.productStatus) productData.productStatus = "Not Started";
        await db.insert(productsTable).values(productData);
        result.created++;
      }
    } catch (err: any) {
      result.errors.push(`Record ${record.id}: ${err.message}`);
    }
  }

  return result;
}

/**
 * Export: push write-back fields from DB → Airtable for all dirty products.
 */
export async function syncToAirtable(
  baseId: string,
  tableId: string,
  projectId: number,
  db: any,
  productsTable: any
): Promise<number> {
  const { eq, and, isNotNull } = await import("drizzle-orm");

  const products = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.projectId, projectId),
        isNotNull(productsTable.airtableRecordId)
      )
    );

  return batchWriteBack(
    baseId,
    tableId,
    products
  );
}
