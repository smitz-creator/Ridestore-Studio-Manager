import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, productsTable, preProductionImagesTable, projectsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/pre-production/products", async (_req, res): Promise<void> => {
  const products = await db
    .select({
      id: productsTable.id,
      projectId: productsTable.projectId,
      shortname: productsTable.shortname,
      keyCode: productsTable.keyCode,
      colour: productsTable.colour,
      gender: productsTable.gender,
      productType: productsTable.productType,
      isCarryOver: productsTable.isCarryOver,
      uploadStatus: productsTable.uploadStatus,
      galleryShots: productsTable.galleryShots,
      detailsShots: productsTable.detailsShots,
      style: productsTable.style,
      design: productsTable.design,
      preProductionStatus: productsTable.preProductionStatus,
    })
    .from(productsTable)
    .where(eq(productsTable.isCarryOver, true));

  const productIds = products.map(p => p.id);
  let images: any[] = [];
  if (productIds.length > 0) {
    images = await db
      .select()
      .from(preProductionImagesTable)
      .where(inArray(preProductionImagesTable.productId, productIds));
  }

  const imagesByProduct = new Map<number, any[]>();
  for (const img of images) {
    if (!imagesByProduct.has(img.productId)) imagesByProduct.set(img.productId, []);
    imagesByProduct.get(img.productId)!.push(img);
  }

  const projectIds = [...new Set(products.map(p => p.projectId))];
  let projects: any[] = [];
  if (projectIds.length > 0) {
    projects = await db.select({ id: projectsTable.id, brand: projectsTable.brand })
      .from(projectsTable)
      .where(inArray(projectsTable.id, projectIds));
  }
  const brandMap = new Map(projects.map(p => [p.id, p.brand]));

  const enriched = products.map(p => ({
    ...p,
    brand: brandMap.get(p.projectId) || "Unknown",
    images: imagesByProduct.get(p.id) || [],
  }));

  res.json(enriched);
});

router.post("/pre-production/images", async (req, res): Promise<void> => {
  const { productId, objectPath, fileName, imageType } = req.body;
  if (!productId || !objectPath || !fileName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [image] = await db.insert(preProductionImagesTable).values({
    productId,
    objectPath,
    fileName,
    imageType: imageType || "gallery",
  }).returning();

  res.json(image);
});

router.delete("/pre-production/images/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(preProductionImagesTable).where(eq(preProductionImagesTable.id, id));
  res.json({ ok: true });
});

router.post("/pre-production/review", async (req, res): Promise<void> => {
  const { productId, decision } = req.body;
  if (!productId || !decision) {
    res.status(400).json({ error: "Missing productId or decision" });
    return;
  }

  if (decision === "keep") {
    await db.update(productsTable)
      .set({ isCarryOver: true, preProductionStatus: "kept" })
      .where(eq(productsTable.id, productId));
  } else if (decision === "reshoot") {
    await db.update(productsTable)
      .set({
        isCarryOver: false,
        galleryShots: null,
        detailsShots: null,
        uploadStatus: "not_started",
        preProductionStatus: "reshoot",
      })
      .where(eq(productsTable.id, productId));
  }

  res.json({ ok: true, decision });
});

router.post("/pre-production/finalize", async (_req, res): Promise<void> => {
  await db.update(productsTable)
    .set({ preProductionStatus: "finalized" })
    .where(eq(productsTable.preProductionStatus, "kept"));

  res.json({ ok: true, message: "Pre-production review finalized" });
});

export default router;
