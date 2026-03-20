import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, projectsTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt));
  const rows = await db
    .select({
      projectId: productsTable.projectId,
      total: sql<number>`count(*)::int`,
      uploaded: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'uploaded')::int`,
      delayed: sql<number>`count(*) filter (where ${productsTable.factoryDelayed} = true)::int`,
      notStarted: sql<number>`count(*) filter (where ${productsTable.uploadStatus} not in ('uploaded', 'ready_for_retouch', 'in_post_production', 'post_production_done', 'ready_for_upload', 'in_the_studio', 'ready_for_selection'))::int`,
      inTheStudio: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'in_the_studio')::int`,
      readyForSelection: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'ready_for_selection')::int`,
      readyForRetouch: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'ready_for_retouch')::int`,
      inPostProduction: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'in_post_production')::int`,
      postProductionDone: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'post_production_done')::int`,
      readyForUpload: sql<number>`count(*) filter (where ${productsTable.uploadStatus} = 'ready_for_upload')::int`,
      hasGallery: sql<number>`count(*) filter (where ${productsTable.galleryShots} is not null and ${productsTable.galleryShots} != '')::int`,
      hasDetails: sql<number>`count(*) filter (where ${productsTable.detailsShots} is not null and ${productsTable.detailsShots} != '')::int`,
      hasMisc: sql<number>`count(*) filter (where ${productsTable.miscShots} is not null and ${productsTable.miscShots} != '')::int`,
    })
    .from(productsTable)
    .groupBy(productsTable.projectId);
  const defaultStats = { total: 0, uploaded: 0, delayed: 0, notStarted: 0, inTheStudio: 0, readyForSelection: 0, readyForRetouch: 0, inPostProduction: 0, postProductionDone: 0, readyForUpload: 0, hasGallery: 0, hasDetails: 0, hasMisc: 0 };
  const stats: Record<number, typeof defaultStats> = {};
  for (const r of rows) {
    stats[r.projectId] = { total: r.total, uploaded: r.uploaded, delayed: r.delayed, notStarted: r.notStarted, inTheStudio: r.inTheStudio, readyForSelection: r.readyForSelection, readyForRetouch: r.readyForRetouch, inPostProduction: r.inPostProduction, postProductionDone: r.postProductionDone, readyForUpload: r.readyForUpload, hasGallery: r.hasGallery, hasDetails: r.hasDetails, hasMisc: r.hasMisc };
  }
  const result = projects.map(p => ({
    ...p,
    stats: stats[p.id] || defaultStats,
  }));
  res.json(result);
});

router.post("/projects", async (req, res): Promise<void> => {
  const { name, brand, season } = req.body;
  if (!name || !brand || !season) {
    res.status(400).json({ error: "name, brand, and season are required" });
    return;
  }
  const [project] = await db.insert(projectsTable).values({ name, brand, season }).returning();
  res.status(201).json(project);
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  res.json(project);
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const allowedFields = ["name", "brand", "season"] as const;
  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in req.body) updates[key] = req.body[key];
  }
  const [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  res.json(project);
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [project] = await db.delete(projectsTable).where(eq(projectsTable.id, id)).returning();
  if (!project) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
