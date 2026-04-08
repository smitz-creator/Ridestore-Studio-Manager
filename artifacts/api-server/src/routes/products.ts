import { Router, type IRouter } from "express";
import { eq, and, ilike, or, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";

const router: IRouter = Router();

const REQUIRES_DETAILS = ["Jacket", "Pants", "Pant"];

function isMissingRequired(product: {
  productType: string;
  galleryShot: string | null;
  detailShot: string | null;
}): string | null {
  const needsGallery = !product.galleryShot?.trim();
  const needsDetails =
    REQUIRES_DETAILS.some((t) =>
      product.productType.toLowerCase().includes(t.toLowerCase())
    ) && !product.detailShot?.trim();
  if (needsGallery && needsDetails) return "Missing Gallery & Details";
  if (needsGallery) return "Missing Gallery";
  if (needsDetails) return "Missing Details";
  return null;
}

// Product Status pipeline steps (Airtable projects)
const PRODUCT_STATUS_STEPS = [
  "Not Started",
  "Sourced",
  "In Studio",
  "Selection",
  "Retouch",
  "Post Production",
  "Naming",
  "Ready to Upload",
  "Uploaded",
];

// Legacy upload status values (Excel projects)
const VALID_UPLOAD_STATUSES = [
  "not_started",
  "in_the_studio",
  "ready_for_selection",
  "ready_for_retouch",
  "in_post_production",
  "post_production_done",
  "ready_for_upload",
  "uploaded",
];

const UPLOAD_AT_OR_BEYOND_READY = ["ready_for_upload", "uploaded"];
const STATUS_AT_OR_BEYOND_READY = ["Ready to Upload", "Uploaded"];

const VALID_DELIVERY_STATUSES = [
  "not_ordered",
  "ordered",
  "in_transit",
  "delayed_at_factory",
  "delivered",
];

// ============ GET /products ============
router.get("/products", async (req, res): Promise<void> => {
  const {
    projectId,
    gender,
    productType,
    shortname,
    brand,
    deliveryStatus,
    uploadStatus,
    productStatus,
    delayed,
    reshoot,
    carryOver,
    shotMissing,
    hasShots,
    search,
    lifecycle,
    shippingStatus,
    officeStatus,
  } = req.query;

  const conditions: any[] = [];

  if (projectId)
    conditions.push(eq(productsTable.projectId, parseInt(projectId as string)));
  if (gender) conditions.push(eq(productsTable.gender, gender as string));
  if (productType)
    conditions.push(eq(productsTable.productType, productType as string));
  if (shortname)
    conditions.push(eq(productsTable.shortname, shortname as string));
  if (brand) conditions.push(eq(productsTable.brand, brand as string));
  if (lifecycle)
    conditions.push(eq(productsTable.lifecycle, lifecycle as string));

  // Status filters — support both legacy and new pipeline
  if (deliveryStatus)
    conditions.push(
      eq(productsTable.deliveryStatus, deliveryStatus as string)
    );
  if (uploadStatus)
    conditions.push(eq(productsTable.uploadStatus, uploadStatus as string));
  if (productStatus)
    conditions.push(eq(productsTable.productStatus, productStatus as string));
  if (shippingStatus)
    conditions.push(
      eq(productsTable.shippingStatus, shippingStatus as string)
    );
  if (officeStatus)
    conditions.push(eq(productsTable.officeStatus, officeStatus as string));

  if (delayed === "true")
    conditions.push(eq(productsTable.factoryDelayed, true));
  if (reshoot === "true")
    conditions.push(eq(productsTable.isReshoot, true));
  if (carryOver === "true")
    conditions.push(eq(productsTable.isCarryOver, true));

  if (shotMissing === "carry_over")
    conditions.push(eq(productsTable.isCarryOver, true));

  if (shotMissing === "gallery")
    conditions.push(
      or(isNull(productsTable.galleryShot), eq(productsTable.galleryShot, ""))
    );
  if (shotMissing === "details")
    conditions.push(
      or(isNull(productsTable.detailShot), eq(productsTable.detailShot, ""))
    );
  if (shotMissing === "misc")
    conditions.push(
      or(isNull(productsTable.miscShot), eq(productsTable.miscShot, ""))
    );
  if (shotMissing === "required") {
    const galleryEmpty = or(
      isNull(productsTable.galleryShot),
      sql`trim(${productsTable.galleryShot}) = ''`
    );
    const detailsEmpty = or(
      isNull(productsTable.detailShot),
      sql`trim(${productsTable.detailShot}) = ''`
    );
    const isJacketPants = or(
      ilike(productsTable.productType, "%jacket%"),
      ilike(productsTable.productType, "%pants%"),
      ilike(productsTable.productType, "%pant%")
    );
    conditions.push(eq(productsTable.isCarryOver, false));
    conditions.push(or(galleryEmpty!, and(isJacketPants!, detailsEmpty!)));
  }

  const notEmpty = (col: any) =>
    and(sql`${col} IS NOT NULL`, sql`trim(${col}) != ''`);
  if (hasShots === "gallery") conditions.push(notEmpty(productsTable.galleryShot)!);
  if (hasShots === "details") conditions.push(notEmpty(productsTable.detailShot)!);
  if (hasShots === "misc") conditions.push(notEmpty(productsTable.miscShot)!);
  if (hasShots === "any")
    conditions.push(
      or(
        notEmpty(productsTable.galleryShot),
        notEmpty(productsTable.detailShot),
        notEmpty(productsTable.miscShot)
      )!
    );

  // *** MULTI-WORD SEARCH FIX ***
  // Split search into words. Each word must match at least one column.
  // All words must match (AND). Each word checks across columns (OR).
  if (search) {
    const words = (search as string).trim().split(/\s+/);
    for (const word of words) {
      const s = `%${word}%`;
      conditions.push(
        or(
          ilike(productsTable.shortname, s),
          ilike(productsTable.keyCode, s),
          ilike(productsTable.colour, s),
          ilike(productsTable.style, s),
          ilike(productsTable.design, s),
          ilike(productsTable.brand, s)
        )
      );
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const products = await db
    .select()
    .from(productsTable)
    .where(whereClause)
    .orderBy(productsTable.shortname, productsTable.colour);

  res.json(products);
});

// ============ POST /products ============
router.post("/products", async (req, res): Promise<void> => {
  const { projectId, gender, productType, shortname } = req.body;
  if (!projectId || !gender || !productType || !shortname) {
    res
      .status(400)
      .json({
        error: "projectId, gender, productType, and shortname are required",
      });
    return;
  }

  const values: Record<string, any> = { projectId, gender, productType, shortname };
  const optionalFields = [
    "style", "design", "keyCode", "colour", "brand",
    "collection", "lifecycle", "colorCategory", "imageUrl",
    "size", "etd", "etdStatus", "eta",
    "shippingStatus", "officeStatus", "designChanges",
    "galleryShot", "detailShot", "miscShot", "studioNotes",
    "productStatus", "reviewSb", "reviewSki",
    "deliveryStatus", "factoryDelayed", "uploadStatus",
    "isCarryOver", "isReshoot", "airtableRecordId",
  ];

  for (const f of optionalFields) {
    if (req.body[f] !== undefined) values[f] = req.body[f];
  }

  const [product] = await db
    .insert(productsTable)
    .values(values)
    .returning();
  res.status(201).json(product);
});

// ============ PATCH /products/bulk-update ============
router.patch("/products/bulk-update", async (req, res): Promise<void> => {
  const { productIds, updates } = req.body;
  if (!Array.isArray(productIds) || !productIds.length) {
    res.status(400).json({ error: "productIds array required" });
    return;
  }
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    res.status(400).json({ error: "updates object required" });
    return;
  }

  const setData: Record<string, any> = {};

  // Product Status (new pipeline)
  if ("productStatus" in updates) {
    if (!PRODUCT_STATUS_STEPS.includes(updates.productStatus)) {
      res.status(400).json({ error: "Invalid productStatus" });
      return;
    }
    setData.productStatus = updates.productStatus;
  }

  // Legacy upload status
  if ("uploadStatus" in updates) {
    if (!VALID_UPLOAD_STATUSES.includes(updates.uploadStatus)) {
      res.status(400).json({ error: "Invalid uploadStatus" });
      return;
    }
    setData.uploadStatus = updates.uploadStatus;
  }

  if ("deliveryStatus" in updates) {
    if (!VALID_DELIVERY_STATUSES.includes(updates.deliveryStatus)) {
      res.status(400).json({ error: "Invalid deliveryStatus" });
      return;
    }
    setData.deliveryStatus = updates.deliveryStatus;
  }

  if ("factoryDelayed" in updates) setData.factoryDelayed = !!updates.factoryDelayed;
  if ("isReshoot" in updates) setData.isReshoot = !!updates.isReshoot;
  if ("isCarryOver" in updates) setData.isCarryOver = !!updates.isCarryOver;

  // Shot fields (new names)
  const shotFields = ["galleryShot", "detailShot", "miscShot"] as const;
  for (const f of shotFields) {
    if (f in updates) {
      setData[f] = typeof updates[f] === "string" ? updates[f] : "";
    }
  }

  // Text fields
  const textFields = ["studioNotes", "reviewSb", "reviewSki"] as const;
  for (const f of textFields) {
    if (f in updates) {
      setData[f] = typeof updates[f] === "string" ? updates[f] : "";
    }
  }

  if (Object.keys(setData).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  // Check if clearing shot fields would require status revert
  const clearingShotField = shotFields.some(
    (f) => f in setData && !setData[f]?.trim()
  );

  if (clearingShotField) {
    const products = await db
      .select()
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));
    await db
      .update(productsTable)
      .set(setData)
      .where(inArray(productsTable.id, productIds));

    const revertIds: number[] = [];
    const revertProducts: {
      id: number;
      shortname: string;
      keyCode: string | null;
      reason: string;
    }[] = [];

    for (const p of products) {
      // Check both old and new status systems
      const atOrBeyondReady =
        UPLOAD_AT_OR_BEYOND_READY.includes(p.uploadStatus ?? "") ||
        STATUS_AT_OR_BEYOND_READY.includes(p.productStatus);
      if (!atOrBeyondReady) continue;
      if (p.isCarryOver) continue;
      const simulated = { ...p, ...setData };
      const missing = isMissingRequired(simulated);
      if (missing) {
        revertIds.push(p.id);
        revertProducts.push({
          id: p.id,
          shortname: p.shortname,
          keyCode: p.keyCode,
          reason: missing,
        });
      }
    }

    if (revertIds.length > 0) {
      await db
        .update(productsTable)
        .set({ uploadStatus: "not_started", productStatus: "Not Started" })
        .where(inArray(productsTable.id, revertIds));
    }

    res.json({
      updated: productIds.length,
      reverted: revertIds.length,
      revertedProducts: revertProducts,
    });
    return;
  }

  // Validation for advancing status
  const advancingNewStatus =
    setData.productStatus &&
    STATUS_AT_OR_BEYOND_READY.includes(setData.productStatus);
  const advancingOldStatus =
    setData.uploadStatus &&
    UPLOAD_AT_OR_BEYOND_READY.includes(setData.uploadStatus);

  if (advancingNewStatus || advancingOldStatus) {
    const products = await db
      .select()
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));

    const passIds: number[] = [];
    const failProducts: {
      id: number;
      shortname: string;
      keyCode: string | null;
      reason: string;
    }[] = [];

    for (const p of products) {
      const simulated = { ...p, ...setData };
      if (simulated.isCarryOver) {
        passIds.push(p.id);
        continue;
      }
      const missing = isMissingRequired(simulated);
      if (missing) {
        failProducts.push({
          id: p.id,
          shortname: p.shortname,
          keyCode: p.keyCode,
          reason: missing,
        });
      } else {
        passIds.push(p.id);
      }
    }

    if (passIds.length > 0) {
      await db
        .update(productsTable)
        .set(setData)
        .where(inArray(productsTable.id, passIds));
    }
    if (failProducts.length > 0) {
      const failIds = failProducts.map((f) => f.id);
      await db
        .update(productsTable)
        .set({ uploadStatus: "not_started", productStatus: "Not Started" })
        .where(inArray(productsTable.id, failIds));
    }

    res.json({
      updated: passIds.length,
      reverted: failProducts.length,
      revertedProducts: failProducts,
    });
    return;
  }

  await db
    .update(productsTable)
    .set(setData)
    .where(inArray(productsTable.id, productIds));
  res.json({ updated: productIds.length, reverted: 0, revertedProducts: [] });
});

// ============ GET /products/:id ============
router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id));
  if (!product) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(product);
});

// ============ PATCH /products/:id ============
router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const allowedFields = [
    "gender", "productType", "shortname", "style", "design", "keyCode",
    "colour", "brand", "collection", "lifecycle", "colorCategory",
    "galleryShot", "detailShot", "miscShot", "studioNotes",
    "productStatus", "reviewSb", "reviewSki",
    "deliveryStatus", "factoryDelayed", "isReshoot", "isCarryOver",
    "uploadStatus", "shippingStatus", "officeStatus",
  ] as const;

  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [product] = await db
    .update(productsTable)
    .set(updates)
    .where(eq(productsTable.id, id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Revert check for both status systems
  const advancingNew =
    updates.productStatus &&
    STATUS_AT_OR_BEYOND_READY.includes(updates.productStatus);
  const advancingOld =
    updates.uploadStatus &&
    UPLOAD_AT_OR_BEYOND_READY.includes(updates.uploadStatus);

  if ((advancingNew || advancingOld) && !product.isCarryOver) {
    const missing = isMissingRequired(product);
    if (missing) {
      const [reverted] = await db
        .update(productsTable)
        .set({ uploadStatus: "not_started", productStatus: "Not Started" })
        .where(eq(productsTable.id, id))
        .returning();
      res.json({ ...reverted, _reverted: true, _missingReason: missing });
      return;
    }
  }

  res.json(product);
});

// ============ DELETE /products/:id ============
router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
