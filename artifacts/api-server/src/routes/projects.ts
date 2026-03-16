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
    })
    .from(productsTable)
    .groupBy(productsTable.projectId);
  const stats: Record<number, { total: number; uploaded: number; delayed: number }> = {};
  for (const r of rows) {
    stats[r.projectId] = { total: r.total, uploaded: r.uploaded, delayed: r.delayed };
  }
  const result = projects.map(p => ({
    ...p,
    stats: stats[p.id] || { total: 0, uploaded: 0, delayed: 0 },
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
