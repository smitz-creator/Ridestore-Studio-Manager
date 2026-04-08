import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, projectsTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.updatedAt));

  const rows = await db
    .select({
      projectId: productsTable.projectId,
      total: sql<number>`count(*)::int`,

      // New product status pipeline counts
      notStarted: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Not Started')::int`,
      sourced: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Sourced')::int`,
      inStudio: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'In Studio')::int`,
      selection: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Selection')::int`,
      retouch: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Retouch')::int`,
      postProduction: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Post Production')::int`,
      naming: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Naming')::int`,
      readyToUpload: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Ready to Upload')::int`,
      uploaded: sql<number>`count(*) filter (where ${productsTable.productStatus} = 'Uploaded')::int`,

      // Shot coverage
      hasGallery: sql<number>`count(*) filter (where ${productsTable.galleryShot} is not null and ${productsTable.galleryShot} != '')::int`,
      hasDetails: sql<number>`count(*) filter (where ${productsTable.detailShot} is not null and ${productsTable.detailShot} != '')::int`,
      hasMisc: sql<number>`count(*) filter (where ${productsTable.miscShot} is not null and ${productsTable.miscShot} != '')::int`,

      // Delivery
      carryOvers: sql<number>`count(*) filter (where ${productsTable.isCarryOver} = true)::int`,

      // Legacy counts (for old Excel projects)
      legacyUploaded: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'uploaded')::int`,
      delayed: sql<number>`count(*) filter (where ${productsTable.factoryDelayed} = true)::int`,
    })
    .from(productsTable)
    .groupBy(productsTable.projectId);

  const defaultStats = {
    total: 0,
    notStarted: 0,
    sourced: 0,
    inStudio: 0,
    selection: 0,
    retouch: 0,
    postProduction: 0,
    naming: 0,
    readyToUpload: 0,
    uploaded: 0,
    hasGallery: 0,
    hasDetails: 0,
    hasMisc: 0,
    carryOvers: 0,
    legacyUploaded: 0,
    delayed: 0,
  };

  const stats: Record<number, typeof defaultStats> = {};
  for (const r of rows) {
    stats[r.projectId] = {
      total: r.total,
      notStarted: r.notStarted,
      sourced: r.sourced,
      inStudio: r.inStudio,
      selection: r.selection,
      retouch: r.retouch,
      postProduction: r.postProduction,
      naming: r.naming,
      readyToUpload: r.readyToUpload,
      uploaded: r.uploaded,
      hasGallery: r.hasGallery,
      hasDetails: r.hasDetails,
      hasMisc: r.hasMisc,
      carryOvers: r.carryOvers,
      legacyUploaded: r.legacyUploaded,
      delayed: r.delayed,
    };
  }

  const result = projects.map((p) => ({
    ...p,
    stats: stats[p.id] || defaultStats,
  }));
  res.json(result);
});

router.post("/projects", async (req, res): Promise<void> => {
  const { name, brand, season, dataSource, airtableBaseId, airtableTableId } =
    req.body;
  if (!name || !brand || !season) {
    res.status(400).json({ error: "name, brand, and season are required" });
    return;
  }
  const values: Record<string, any> = { name, brand, season };
  if (dataSource) values.dataSource = dataSource;
  if (airtableBaseId) values.airtableBaseId = airtableBaseId;
  if (airtableTableId) values.airtableTableId = airtableTableId;

  const [project] = await db
    .insert(projectsTable)
    .values(values)
    .returning();
  res.status(201).json(project);
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(project);
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const allowedFields = [
    "name",
    "brand",
    "season",
    "dataSource",
    "airtableBaseId",
    "airtableTableId",
  ] as const;
  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in req.body) updates[key] = req.body[key];
  }
  const [project] = await db
    .update(projectsTable)
    .set(updates)
    .where(eq(projectsTable.id, id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(project);
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [project] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, id))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
