import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";

const REQUIRES_DETAILS = ["Jacket", "Pants", "Pant"];
const UPLOAD_AT_OR_BEYOND_READY = ["ready_for_upload", "uploaded"];

function isMissingRequired(product: { productType: string; galleryShots: string | null; detailsShots: string | null }): string | null {
  const needsGallery = !product.galleryShots?.trim();
  const needsDetails = REQUIRES_DETAILS.some(t => product.productType.toLowerCase().includes(t.toLowerCase())) && !product.detailsShots?.trim();
  if (needsGallery && needsDetails) return "Missing Gallery & Details";
  if (needsGallery) return "Missing Gallery";
  if (needsDetails) return "Missing Details";
  return null;
}

const router: IRouter = Router();

interface CaptureSession {
  sessionName: string;
  shotTypes: ("Gallery" | "Details" | "Misc")[];
  productIds: number[];
  count: number;
  date: string | null;
  statusBreakdown: Record<string, number>;
}

function parseSessionDate(name: string): string | null {
  const match = name.match(/(\d{1,2})[./](\d{1,2})(?:\s|$|[^0-9])/);
  if (!match) return null;
  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

router.get("/capture-sessions", async (_req, res): Promise<void> => {
  const products = await db.select({
    id: productsTable.id,
    galleryShots: productsTable.galleryShots,
    detailsShots: productsTable.detailsShots,
    miscShots: productsTable.miscShots,
    uploadStatus: productsTable.uploadStatus,
    shortname: productsTable.shortname,
    projectId: productsTable.projectId,
  }).from(productsTable);

  const sessionsMap = new Map<string, CaptureSession>();

  for (const p of products) {
    const shotFields: Array<{ name: string; type: "Gallery" | "Details" | "Misc" }> = [];
    if (p.galleryShots?.trim()) shotFields.push({ name: p.galleryShots.trim(), type: "Gallery" });
    if (p.detailsShots?.trim()) shotFields.push({ name: p.detailsShots.trim(), type: "Details" });
    if (p.miscShots?.trim()) shotFields.push({ name: p.miscShots.trim(), type: "Misc" });

    const addedToSession = new Set<string>();

    for (const field of shotFields) {
      const key = field.name;
      if (!sessionsMap.has(key)) {
        sessionsMap.set(key, {
          sessionName: field.name,
          shotTypes: [],
          productIds: [],
          count: 0,
          date: parseSessionDate(field.name),
          statusBreakdown: {},
        });
      }
      const session = sessionsMap.get(key)!;
      if (!session.shotTypes.includes(field.type)) {
        session.shotTypes.push(field.type);
      }
      if (!addedToSession.has(key)) {
        session.productIds.push(p.id);
        session.count++;
        session.statusBreakdown[p.uploadStatus] = (session.statusBreakdown[p.uploadStatus] || 0) + 1;
        addedToSession.add(key);
      }
    }
  }

  const sessions = [...sessionsMap.values()].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.sessionName.localeCompare(b.sessionName);
  });

  res.json(sessions);
});

router.patch("/capture-sessions/bulk-status", async (req, res): Promise<void> => {
  const { productIds, uploadStatus } = req.body;
  const validStatuses = ["not_started", "in_the_studio", "ready_for_selection", "ready_for_retouch", "in_post_production", "post_production_done", "ready_for_upload", "uploaded"];
  if (!Array.isArray(productIds) || !productIds.length || !validStatuses.includes(uploadStatus)) {
    res.status(400).json({ error: "productIds (array) and valid uploadStatus required" });
    return;
  }

  if (UPLOAD_AT_OR_BEYOND_READY.includes(uploadStatus)) {
    const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
    const passIds: number[] = [];
    const revertIds: number[] = [];

    for (const p of products) {
      if (p.isCarryOver) {
        passIds.push(p.id);
        continue;
      }
      const missing = isMissingRequired(p);
      if (missing) {
        revertIds.push(p.id);
      } else {
        passIds.push(p.id);
      }
    }

    if (passIds.length > 0) {
      await db.update(productsTable).set({ uploadStatus }).where(inArray(productsTable.id, passIds));
    }
    if (revertIds.length > 0) {
      await db.update(productsTable).set({ uploadStatus: "not_started" }).where(inArray(productsTable.id, revertIds));
    }
    res.json({ updated: passIds.length, reverted: revertIds.length });
    return;
  }

  await db.update(productsTable).set({ uploadStatus }).where(inArray(productsTable.id, productIds));
  res.json({ updated: productIds.length });
});

export default router;
