import { Router, type IRouter } from "express";
import { eq, inArray, or, and } from "drizzle-orm";
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
    .where(or(
      eq(productsTable.isCarryOver, true),
      eq(productsTable.preProductionStatus, "kept"),
      eq(productsTable.preProductionStatus, "reshoot"),
      eq(productsTable.preProductionStatus, "finalized")
    ));

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

const PRODUCT_TYPE_MAP: Record<string, string> = {
  "snowboard jacket": "JACKET",
  "snowboard pants": "PANTS",
  "base layer pant": "BASELAYER",
  "base layer top": "BASELAYER",
  "fleece hoodie": "FLEECE",
  "fleece sweater": "FLEECE",
  "beanie": "BEANIE",
  "facemask": "FACEMASK",
  "ski gloves": "GLOVES",
  "ski goggle": "GOGGLE",
  "snow mittens": "MITTENS",
  "replacement lens ski": "LENS",
};

const BRAND_MAP: Record<string, string> = {
  "dope snow": "DOPE",
  "montec": "MONTEC",
};

function getProductTypeShort(productType: string | null): string {
  if (!productType) return "PRODUCT";
  const key = productType.toLowerCase();
  return PRODUCT_TYPE_MAP[key] || productType.toUpperCase().replace(/\s+/g, "");
}

function getBrandShort(brand: string): string {
  const key = brand.toLowerCase();
  return BRAND_MAP[key] || brand.toUpperCase().replace(/\s+/g, "");
}

router.post("/pre-production/resolve-keycodes", async (req, res): Promise<void> => {
  const { keyCodes } = req.body;
  if (!keyCodes || !Array.isArray(keyCodes) || keyCodes.length === 0) {
    res.status(400).json({ error: "Missing keyCodes array" });
    return;
  }

  const allProducts = await db
    .select({ id: productsTable.id, keyCode: productsTable.keyCode })
    .from(productsTable);

  const result: Record<string, number> = {};
  const toMarkCarryOver: number[] = [];

  for (const kc of keyCodes) {
    const product = allProducts.find(p =>
      p.keyCode && p.keyCode.toLowerCase() === kc.toLowerCase()
    );
    if (product) {
      result[kc.toLowerCase()] = product.id;
      toMarkCarryOver.push(product.id);
    }
  }

  if (toMarkCarryOver.length > 0) {
    await db.update(productsTable)
      .set({ isCarryOver: true, preProductionStatus: "pending" })
      .where(
        and(
          inArray(productsTable.id, toMarkCarryOver),
          eq(productsTable.isCarryOver, false)
        )
      );
  }

  res.json(result);
});

router.post("/pre-production/auto-populate-shots", async (req, res): Promise<void> => {
  const { productIds } = req.body;
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    res.status(400).json({ error: "Missing productIds array" });
    return;
  }

  const products = await db
    .select({
      id: productsTable.id,
      projectId: productsTable.projectId,
      productType: productsTable.productType,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const images = await db
    .select({
      productId: preProductionImagesTable.productId,
      imageType: preProductionImagesTable.imageType,
    })
    .from(preProductionImagesTable)
    .where(inArray(preProductionImagesTable.productId, productIds));

  const imagesByProduct = new Map<number, { hasGallery: boolean; hasDetail: boolean }>();
  for (const img of images) {
    const entry = imagesByProduct.get(img.productId) || { hasGallery: false, hasDetail: false };
    if (img.imageType === "gallery") entry.hasGallery = true;
    if (img.imageType === "detail") entry.hasDetail = true;
    imagesByProduct.set(img.productId, entry);
  }

  const projectIds = [...new Set(products.map(p => p.projectId))];
  let projects: any[] = [];
  if (projectIds.length > 0) {
    projects = await db.select({ id: projectsTable.id, brand: projectsTable.brand })
      .from(projectsTable)
      .where(inArray(projectsTable.id, projectIds));
  }
  const brandMap = new Map(projects.map((p: any) => [p.id, p.brand]));

  let updated = 0;
  for (const product of products) {
    const imgInfo = imagesByProduct.get(product.id);
    if (!imgInfo) continue;

    const brand = brandMap.get(product.projectId) || "UNKNOWN";
    const brandShort = getBrandShort(brand);
    const typeShort = getProductTypeShort(product.productType);
    const sessionName = `${brandShort}_${typeShort} Carry Over`;

    const updates: Record<string, any> = {};
    if (imgInfo.hasGallery) updates.galleryShots = sessionName;
    if (imgInfo.hasDetail) updates.detailsShots = sessionName;

    if (Object.keys(updates).length > 0) {
      await db.update(productsTable)
        .set(updates)
        .where(eq(productsTable.id, product.id));
      updated++;
    }
  }

  res.json({ ok: true, updated });
});

router.post("/pre-production/finalize", async (_req, res): Promise<void> => {
  await db.update(productsTable)
    .set({ preProductionStatus: "finalized" })
    .where(eq(productsTable.preProductionStatus, "kept"));

  res.json({ ok: true, message: "Pre-production review finalized" });
});

export default router;
