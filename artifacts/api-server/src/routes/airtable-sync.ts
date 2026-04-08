import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, projectsTable } from "@workspace/db";
import {
  syncFromAirtable,
  syncToAirtable,
  fetchAllRecords,
  recordToProduct,
  PRODUCT_STATUS_STEPS,
} from "../lib/airtable";

const router: IRouter = Router();

/**
 * POST /api/airtable/sync/:projectId
 * Pull from Airtable → upsert into DB (read-only fields)
 * Then push write-back fields → Airtable
 */
router.post("/airtable/sync/:projectId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.dataSource !== "airtable") {
    res.status(400).json({ error: "This project does not use Airtable sync" });
    return;
  }

  if (!project.airtableBaseId || !project.airtableTableId) {
    res.status(400).json({ error: "Project missing Airtable base/table ID" });
    return;
  }

  try {
    // Step 1: Pull from Airtable
    const pullResult = await syncFromAirtable(
      project.airtableBaseId,
      project.airtableTableId,
      projectId,
      project.brand, // filter by brand since Airtable has both brands
      db,
      productsTable
    );

    // Step 2: Push write-back fields to Airtable
    const writtenBack = await syncToAirtable(
      project.airtableBaseId,
      project.airtableTableId,
      projectId,
      db,
      productsTable
    );

    // Step 3: Update project sync metadata
    await db
      .update(projectsTable)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: `OK: ${pullResult.created}c/${pullResult.updated}u/${pullResult.unchanged}s, ${writtenBack}wb`,
      })
      .where(eq(projectsTable.id, projectId));

    res.json({
      pull: pullResult,
      writtenBack,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    // Update project with error status
    await db
      .update(projectsTable)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: `ERROR: ${err.message}`,
      })
      .where(eq(projectsTable.id, projectId));

    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/airtable/pull/:projectId
 * Pull-only: Airtable → DB (no write-back)
 */
router.post("/airtable/pull/:projectId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project || project.dataSource !== "airtable") {
    res.status(400).json({ error: "Not an Airtable project" });
    return;
  }

  if (!project.airtableBaseId || !project.airtableTableId) {
    res.status(400).json({ error: "Missing Airtable config" });
    return;
  }

  try {
    const result = await syncFromAirtable(
      project.airtableBaseId,
      project.airtableTableId,
      projectId,
      project.brand,
      db,
      productsTable
    );

    await db
      .update(projectsTable)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: `PULL: ${result.created}c/${result.updated}u`,
      })
      .where(eq(projectsTable.id, projectId));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/airtable/push/:projectId
 * Push-only: DB → Airtable (write-back fields)
 */
router.post("/airtable/push/:projectId", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId);
  if (isNaN(projectId)) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));

  if (!project || project.dataSource !== "airtable") {
    res.status(400).json({ error: "Not an Airtable project" });
    return;
  }

  if (!project.airtableBaseId || !project.airtableTableId) {
    res.status(400).json({ error: "Missing Airtable config" });
    return;
  }

  try {
    const writtenBack = await syncToAirtable(
      project.airtableBaseId,
      project.airtableTableId,
      projectId,
      db,
      productsTable
    );

    res.json({ writtenBack });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/airtable/create-project
 * Create a new Airtable-backed project + initial sync.
 * Body: { name, brand, season, baseId, tableId }
 */
router.post("/airtable/create-project", async (req, res): Promise<void> => {
  const { name, brand, season, baseId, tableId } = req.body;

  if (!name || !brand || !season || !baseId || !tableId) {
    res
      .status(400)
      .json({ error: "name, brand, season, baseId, and tableId are required" });
    return;
  }

  try {
    // Create the project
    const [project] = await db
      .insert(projectsTable)
      .values({
        name,
        brand,
        season,
        dataSource: "airtable",
        airtableBaseId: baseId,
        airtableTableId: tableId,
      })
      .returning();

    // Run initial sync
    const result = await syncFromAirtable(
      baseId,
      tableId,
      project.id,
      brand,
      db,
      productsTable
    );

    await db
      .update(projectsTable)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: `INIT: ${result.created} products imported`,
      })
      .where(eq(projectsTable.id, project.id));

    res.status(201).json({
      project,
      sync: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/airtable/preview
 * Preview Airtable data before creating a project.
 * Query: ?baseId=xxx&tableId=xxx&brand=xxx
 */
router.get("/airtable/preview", async (req, res): Promise<void> => {
  const { baseId, tableId, brand } = req.query;

  if (!baseId || !tableId) {
    res.status(400).json({ error: "baseId and tableId are required" });
    return;
  }

  try {
    const records = await fetchAllRecords(
      baseId as string,
      tableId as string,
      brand as string | undefined
    );

    // Summarize what we'd import
    const brands = new Set<string>();
    const genders = new Set<string>();
    const types = new Set<string>();

    for (const r of records) {
      if (r.fields.Brand) brands.add(String(r.fields.Brand));
      if (r.fields.Gender) genders.add(String(r.fields.Gender));
      if (r.fields["Product type"]) types.add(String(r.fields["Product type"]));
    }

    res.json({
      totalRecords: records.length,
      brands: [...brands],
      genders: [...genders],
      productTypes: [...types],
      sampleFields: records.length > 0 ? Object.keys(records[0].fields) : [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/airtable/status
 * Check if Airtable PAT is configured and valid.
 */
router.get("/airtable/status", async (_req, res): Promise<void> => {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    res.json({ configured: false, message: "AIRTABLE_PAT not set" });
    return;
  }

  res.json({
    configured: true,
    tokenPrefix: pat.substring(0, 8) + "...",
    productStatusSteps: PRODUCT_STATUS_STEPS,
  });
});

export default router;
