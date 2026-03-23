import { Router, type IRouter } from "express";
import { eq, desc, gte, lt } from "drizzle-orm";
import { db, studioSessionsTable, usersTable } from "@workspace/db";

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

  res.json(sessions);
});

router.post("/sessions", async (req, res): Promise<void> => {
  const { date, modelName, brand, shotType, notes, createdById } = req.body;
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

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, createdById));

  res.status(201).json({ ...session, createdByName: user?.name ?? "Unknown" });
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
