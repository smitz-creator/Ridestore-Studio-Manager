import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, plannerBlocksTable } from "@workspace/db";

const router: IRouter = Router();

const VALID_ROWS = ["Photo", "Philip", "Smitz", "Oskar", "Agnes"];
const VALID_CATEGORIES = ["gallery", "details", "mixed", "retouch", "deadline", "meeting", "other", "holiday"];

router.get("/planner/blocks", async (req, res): Promise<void> => {
  const year = parseInt(req.query.year as string) || 2026;
  const blocks = await db
    .select()
    .from(plannerBlocksTable)
    .where(eq(plannerBlocksTable.year, year));
  res.json(blocks);
});

router.post("/planner/blocks", async (req, res): Promise<void> => {
  const { weekNumber, year, dayIndex, row, label, category, isMilestone } = req.body;
  if (!label?.trim()) { res.status(400).json({ error: "Label is required" }); return; }
  if (weekNumber < 1 || weekNumber > 52) { res.status(400).json({ error: "Invalid week number" }); return; }
  if (dayIndex < 0 || dayIndex > 4) { res.status(400).json({ error: "Invalid day index" }); return; }
  if (!VALID_ROWS.includes(row)) { res.status(400).json({ error: "Invalid row" }); return; }
  if (!VALID_CATEGORIES.includes(category)) { res.status(400).json({ error: "Invalid category" }); return; }

  const [block] = await db
    .insert(plannerBlocksTable)
    .values({ weekNumber, year: year || 2026, dayIndex, row, label: label.trim(), category, isMilestone: isMilestone || false })
    .returning();
  res.json(block);
});

router.patch("/planner/blocks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const updates: any = {};
  if (req.body.label !== undefined) updates.label = req.body.label;
  if (req.body.category !== undefined) {
    if (!VALID_CATEGORIES.includes(req.body.category)) { res.status(400).json({ error: "Invalid category" }); return; }
    updates.category = req.body.category;
  }
  if (req.body.dayIndex !== undefined) updates.dayIndex = req.body.dayIndex;
  if (req.body.row !== undefined) updates.row = req.body.row;
  if (req.body.weekNumber !== undefined) updates.weekNumber = req.body.weekNumber;
  if (req.body.isMilestone !== undefined) updates.isMilestone = req.body.isMilestone;

  const [block] = await db
    .update(plannerBlocksTable)
    .set(updates)
    .where(eq(plannerBlocksTable.id, id))
    .returning();
  if (!block) { res.status(404).json({ error: "Block not found" }); return; }
  res.json(block);
});

router.delete("/planner/blocks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(plannerBlocksTable).where(eq(plannerBlocksTable.id, id));
  res.status(204).send();
});

export default router;
