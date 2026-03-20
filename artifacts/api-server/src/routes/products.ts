import { Router, type IRouter } from "express";
import { eq, and, ilike, or, isNull, inArray, sql } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";

const router: IRouter = Router();

const REQUIRES_DETAILS = ["Jacket", "Pants", "Pant"];

function isMissingRequired(product: { productType: string; galleryShots: string | null; detailsShots: string | null }): string | null {
  const needsGallery = !product.galleryShots?.trim();
  const needsDetails = REQUIRES_DETAILS.some(t => product.productType.toLowerCase().includes(t.toLowerCase())) && !product.detailsShots?.trim();
  if (needsGallery && needsDetails) return "Missing Gallery & Details";
  if (needsGallery) return "Missing Gallery";
  if (needsDetails) return "Missing Details";
  return null;
}

const UPLOAD_AT_OR_BEYOND_READY = ["ready_for_upload", "uploaded"];

router.get("/products", async (req, res): Promise<void> => {
  const { projectId, gender, productType, shortname, deliveryStatus, uploadStatus, delayed, reshoot, shotMissing, search } = req.query;

  const conditions: any[] = [];

  if (projectId) conditions.push(eq(productsTable.projectId, parseInt(projectId as string)));
  if (gender) conditions.push(eq(productsTable.gender, gender as string));
  if (productType) conditions.push(eq(productsTable.productType, productType as string));
  if (shortname) conditions.push(eq(productsTable.shortname, shortname as string));
  if (deliveryStatus) conditions.push(eq(productsTable.deliveryStatus, deliveryStatus as string));
  if (uploadStatus) conditions.push(eq(productsTable.uploadStatus, uploadStatus as string));
  if (delayed === "true") conditions.push(eq(productsTable.factoryDelayed, true));
  if (reshoot === "true") conditions.push(eq(productsTable.isReshoot, true));

  if (shotMissing === "gallery") conditions.push(or(isNull(productsTable.galleryShots), eq(productsTable.galleryShots, "")));
  if (shotMissing === "details") conditions.push(or(isNull(productsTable.detailsShots), eq(productsTable.detailsShots, "")));
  if (shotMissing === "misc") conditions.push(or(isNull(productsTable.miscShots), eq(productsTable.miscShots, "")));
  if (shotMissing === "required") {
    const galleryEmpty = or(isNull(productsTable.galleryShots), sql`trim(${productsTable.galleryShots}) = ''`);
    const detailsEmpty = or(isNull(productsTable.detailsShots), sql`trim(${productsTable.detailsShots}) = ''`);
    const isJacketPants = or(
      ilike(productsTable.productType, "%jacket%"),
      ilike(productsTable.productType, "%pants%"),
      ilike(productsTable.productType, "%pant%"),
    );
    conditions.push(or(
      galleryEmpty!,
      and(isJacketPants!, detailsEmpty!),
    ));
  }

  if (search) {
    const s = `%${search}%`;
    conditions.push(
      or(
        ilike(productsTable.shortname, s),
        ilike(productsTable.keyCode, s),
        ilike(productsTable.colour, s),
        ilike(productsTable.style, s),
        ilike(productsTable.design, s),
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const products = await db.select().from(productsTable).where(whereClause).orderBy(productsTable.id);
  res.json(products);
});

router.post("/products", async (req, res): Promise<void> => {
  const { projectId, gender, productType, shortname } = req.body;
  if (!projectId || !gender || !productType || !shortname) {
    res.status(400).json({ error: "projectId, gender, productType, and shortname are required" });
    return;
  }
  const values: Record<string, any> = { projectId, gender, productType, shortname };
  if (req.body.style) values.style = req.body.style;
  if (req.body.design) values.design = req.body.design;
  if (req.body.keyCode) values.keyCode = req.body.keyCode;
  if (req.body.colour) values.colour = req.body.colour;
  if (req.body.deliveryStatus) values.deliveryStatus = req.body.deliveryStatus;
  if (req.body.factoryDelayed !== undefined) values.factoryDelayed = req.body.factoryDelayed;
  if (req.body.uploadStatus) values.uploadStatus = req.body.uploadStatus;
  const [product] = await db.insert(productsTable).values(values).returning();
  res.status(201).json(product);
});

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
  const validUploadStatuses = ["not_started", "in_the_studio", "ready_for_selection", "ready_for_retouch", "in_post_production", "post_production_done", "ready_for_upload", "uploaded"];
  const validDeliveryStatuses = ["not_ordered", "ordered", "in_transit", "delayed_at_factory", "delivered"];
  const setData: Record<string, any> = {};
  if ("uploadStatus" in updates) {
    if (!validUploadStatuses.includes(updates.uploadStatus)) {
      res.status(400).json({ error: "Invalid uploadStatus" });
      return;
    }
    setData.uploadStatus = updates.uploadStatus;
  }
  if ("deliveryStatus" in updates) {
    if (!validDeliveryStatuses.includes(updates.deliveryStatus)) {
      res.status(400).json({ error: "Invalid deliveryStatus" });
      return;
    }
    setData.deliveryStatus = updates.deliveryStatus;
  }
  if ("factoryDelayed" in updates) {
    setData.factoryDelayed = !!updates.factoryDelayed;
  }
  if ("isReshoot" in updates) {
    setData.isReshoot = !!updates.isReshoot;
  }
  const shotFields = ["galleryShots", "detailsShots", "miscShots"] as const;
  for (const f of shotFields) {
    if (f in updates) {
      const val = updates[f];
      setData[f] = (typeof val === "string" ? val : "") ;
    }
  }
  if (Object.keys(setData).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const clearingShotField = shotFields.some(f => f in setData && !setData[f]?.trim());

  if (clearingShotField) {
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
    await db.update(productsTable).set(setData).where(inArray(productsTable.id, productIds));

    const revertIds: number[] = [];
    const revertProducts: { id: number; shortname: string; keyCode: string | null; reason: string }[] = [];
    for (const p of products) {
      if (!UPLOAD_AT_OR_BEYOND_READY.includes(p.uploadStatus)) continue;
      const simulated = { ...p, ...setData };
      const missing = isMissingRequired(simulated);
      if (missing) {
        revertIds.push(p.id);
        revertProducts.push({ id: p.id, shortname: p.shortname, keyCode: p.keyCode, reason: missing });
      }
    }
    if (revertIds.length > 0) {
      await db.update(productsTable).set({ uploadStatus: "not_started" }).where(inArray(productsTable.id, revertIds));
    }
    res.json({ updated: productIds.length, reverted: revertIds.length, revertedProducts: revertProducts });
    return;
  }

  if (setData.uploadStatus && UPLOAD_AT_OR_BEYOND_READY.includes(setData.uploadStatus)) {
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
    const passIds: number[] = [];
    const failProducts: { id: number; shortname: string; keyCode: string | null; reason: string }[] = [];

    for (const p of products) {
      const missing = isMissingRequired(p);
      if (missing) {
        failProducts.push({ id: p.id, shortname: p.shortname, keyCode: p.keyCode, reason: missing });
      } else {
        passIds.push(p.id);
      }
    }

    if (passIds.length > 0) {
      await db.update(productsTable).set(setData).where(inArray(productsTable.id, passIds));
    }
    if (failProducts.length > 0) {
      const failIds = failProducts.map(f => f.id);
      await db.update(productsTable).set({ uploadStatus: "not_started" }).where(inArray(productsTable.id, failIds));
    }

    res.json({
      updated: passIds.length,
      reverted: failProducts.length,
      revertedProducts: failProducts,
    });
    return;
  }

  await db.update(productsTable).set(setData).where(inArray(productsTable.id, productIds));
  res.json({ updated: productIds.length, reverted: 0, revertedProducts: [] });
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.json(product);
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const allowedFields = ["gender", "productType", "shortname", "style", "design", "keyCode", "colour", "galleryShots", "detailsShots", "miscShots", "deliveryStatus", "factoryDelayed", "isReshoot", "uploadStatus"] as const;
  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

  const [product] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Not found" }); return; }

  if (updates.uploadStatus && UPLOAD_AT_OR_BEYOND_READY.includes(updates.uploadStatus)) {
    const missing = isMissingRequired(product);
    if (missing) {
      const [reverted] = await db.update(productsTable)
        .set({ uploadStatus: "not_started" })
        .where(eq(productsTable.id, id))
        .returning();
      res.json({ ...reverted, _reverted: true, _missingReason: missing });
      return;
    }
  }

  res.json(product);
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [product] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
