import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, commentsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/products/:productId/comments", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  const comments = await db
    .select({
      id: commentsTable.id,
      productId: commentsTable.productId,
      userId: commentsTable.userId,
      userName: usersTable.name,
      text: commentsTable.text,
      createdAt: commentsTable.createdAt,
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(eq(commentsTable.productId, productId))
    .orderBy(desc(commentsTable.createdAt));

  res.json(comments);
});

router.post("/products/:productId/comments", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  const { userId, text } = req.body;
  if (!userId || !text) {
    res.status(400).json({ error: "userId and text are required" });
    return;
  }

  const [comment] = await db.insert(commentsTable).values({ productId, userId, text }).returning();

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({ ...comment, userName: user?.name ?? "Unknown" });
});

export default router;
