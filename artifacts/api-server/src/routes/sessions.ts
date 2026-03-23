import { Router, type IRouter } from "express";
import { eq, desc, gte, lt, inArray, and } from "drizzle-orm";
import { db, studioSessionsTable, usersTable, sessionProductsTable, productsTable, projectsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select({
      id: studioSessionsTable.id,
      date: studioSessionsTable.date,
      modelName: studioSessionsTable.modelName,
      brand: studioSessionsTable.brand,
      shotType: studioSessionsTable.shotType,
      notes: studioSessionsTable.notes,
      createdById: studioSessionsTable.createdById,
      createdByName: usersTable.name,
      createdAt: studioSessionsTable.createdAt,
    })
    .from(studioSessionsTable)
    .leftJoin(usersTable, eq(studioSessionsTable.createdById, usersTable.id))
    .orderBy(desc(studioSessionsTable.date));

  const allLinks = await db.select({ sessionId: sessionProductsTable.sessionId, productId: sessionProductsTable.productId }).from(sessionProductsTable);
  const countMap = new Map<number, number>();
  for (const l of allLinks) {
    countMap.set(l.sessionId, (countMap.get(l.sessionId) || 0) + 1);
  }

  const enriched = sessions.map(s => ({ ...s, productCount: countMap.get(s.id) || 0 }));
  res.json(enriched);
});

router.get("/sessions/:id/products", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const links = await db.select({ productId: sessionProductsTable.productId }).from(sessionProductsTable).where(eq(sessionProductsTable.sessionId, id));
  const productIds = links.map(l => l.productId);
  if (productIds.length === 0) { res.json([]); return; }

  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  res.json(products);
});

router.get("/wizard/products", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: productsTable.id,
      gender: productsTable.gender,
      productType: productsTable.productType,
      shortname: productsTable.shortname,
      keyCode: productsTable.keyCode,
      colour: productsTable.colour,
      uploadStatus: productsTable.uploadStatus,
      isCarryOver: productsTable.isCarryOver,
      projectId: productsTable.projectId,
      brand: projectsTable.brand,
    })
    .from(productsTable)
    .innerJoin(projectsTable, eq(productsTable.projectId, projectsTable.id))
    .orderBy(productsTable.shortname);

  res.json(rows);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const { date, modelName, brand, shotType, notes, createdById, productIds } = req.body;
  if (!date || !modelName || !brand || !shotType || !createdById) {
    res.status(400).json({ error: "date, modelName, brand, shotType, and createdById are required" });
    return;
  }

  const [session] = await db.insert(studioSessionsTable).values({
    date: new Date(date),
    modelName,
    brand,
    shotType,
    notes: notes || null,
    createdById,
  }).returning();

  if (Array.isArray(productIds) && productIds.length > 0) {
    const linkValues = productIds.map((pid: number) => ({ sessionId: session.id, productId: pid }));
    await db.insert(sessionProductsTable).values(linkValues);
  }

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, createdById));

  const linkCount = Array.isArray(productIds) ? productIds.length : 0;
  res.status(201).json({ ...session, createdByName: user?.name ?? "Unknown", productCount: linkCount });
});

router.patch("/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { date, modelName, brand, shotType, notes, productIds } = req.body;
  const updates: any = {};
  if (date) updates.date = new Date(date);
  if (modelName !== undefined) updates.modelName = modelName;
  if (brand !== undefined) updates.brand = brand;
  if (shotType !== undefined) updates.shotType = shotType;
  if (notes !== undefined) updates.notes = notes || null;
  const [session] = await db.update(studioSessionsTable).set(updates).where(eq(studioSessionsTable.id, id)).returning();
  if (!session) { res.status(404).json({ error: "Not found" }); return; }

  if (Array.isArray(productIds)) {
    await db.delete(sessionProductsTable).where(eq(sessionProductsTable.sessionId, id));
    if (productIds.length > 0) {
      const linkValues = productIds.map((pid: number) => ({ sessionId: id, productId: pid }));
      await db.insert(sessionProductsTable).values(linkValues);
    }
  }

  const actualLinks = await db.select({ productId: sessionProductsTable.productId }).from(sessionProductsTable).where(eq(sessionProductsTable.sessionId, id));
  const [user] = session.createdById
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, session.createdById))
    : [{ name: "Unknown" }];
  res.json({ ...session, createdByName: user?.name ?? "Unknown", productCount: actualLinks.length });
});

router.delete("/sessions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [session] = await db.delete(studioSessionsTable).where(eq(studioSessionsTable.id, id)).returning();
  if (!session) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sessions = await db
    .select({
      id: studioSessionsTable.id,
      date: studioSessionsTable.date,
      modelName: studioSessionsTable.modelName,
      brand: studioSessionsTable.brand,
      shotType: studioSessionsTable.shotType,
      notes: studioSessionsTable.notes,
      createdByName: usersTable.name,
    })
    .from(studioSessionsTable)
    .leftJoin(usersTable, eq(studioSessionsTable.createdById, usersTable.id))
    .orderBy(desc(studioSessionsTable.date));

  const upcoming = sessions.filter(s => new Date(s.date) >= today);
  const past = sessions.filter(s => new Date(s.date) < today);

  res.json({ upcoming: upcoming.reverse(), past });
});

export default router;
