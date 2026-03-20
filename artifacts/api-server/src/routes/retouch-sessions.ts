import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, retouchSessionsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/retouch-sessions", async (_req, res): Promise<void> => {
  const sessions = await db.select().from(retouchSessionsTable);
  res.json(sessions);
});

router.patch("/retouch-sessions/:sessionName", async (req, res): Promise<void> => {
  const { sessionName } = req.params;
  const { sentTo, carryOversSourced } = req.body;
  const updates: Record<string, any> = {};
  if (sentTo !== undefined) updates.sentTo = sentTo;
  if (carryOversSourced !== undefined) updates.carryOversSourced = carryOversSourced;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields" });
    return;
  }

  const existing = await db.select().from(retouchSessionsTable).where(eq(retouchSessionsTable.sessionName, sessionName));

  if (existing.length > 0) {
    const [updated] = await db.update(retouchSessionsTable)
      .set(updates)
      .where(eq(retouchSessionsTable.sessionName, sessionName))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(retouchSessionsTable)
      .values({ sessionName, ...updates })
      .returning();
    res.json(created);
  }
});

export default router;
