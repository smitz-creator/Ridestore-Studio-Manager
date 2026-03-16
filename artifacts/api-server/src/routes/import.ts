import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, productsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router: IRouter = Router();

const BRAND_SHEET_MAP: Record<string, string> = {
  "Dope Snow": "DOPE",
  "Montec": "MONTEC",
};

function normalizeDeliveryStatus(raw: string | undefined | null): string {
  if (!raw) return "not_ordered";
  const lower = raw.toString().toLowerCase().trim();
  if (lower.includes("delivered") || lower.includes("in gbg")) return "delivered";
  if (lower.includes("delayed") || lower.includes("factory")) return "delayed_at_factory";
  if (lower.includes("in transit") || lower.includes("transit")) return "in_transit";
  if (lower.includes("ordered")) return "ordered";
  return "not_ordered";
}

function normalizeUploadStatus(raw: string | undefined | null): string {
  if (!raw) return "not_started";
  const lower = raw.toString().toLowerCase().trim();
  if (lower === "yes" || lower === "uploaded" || lower === "done") return "uploaded";
  if (lower === "in progress" || lower === "wip") return "in_progress";
  return "not_started";
}

function cellStr(val: any): string {
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

router.post("/projects/:id/import", upload.single("file"), async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.id);
  if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project id" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    res.status(400).json({ error: "Could not parse Excel file" });
    return;
  }

  const sheetName = BRAND_SHEET_MAP[project.brand];
  let sheet: XLSX.WorkSheet | undefined;

  if (sheetName && workbook.SheetNames.includes(sheetName)) {
    sheet = workbook.Sheets[sheetName];
  } else {
    sheet = workbook.Sheets[workbook.SheetNames[0]];
  }

  if (!sheet) {
    res.status(400).json({ error: "No sheets found in workbook" });
    return;
  }

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) {
    res.status(400).json({ error: "Sheet is empty" });
    return;
  }

  const normalizeHeader = (h: string) => h.toString().toLowerCase().trim();
  const headerMap = Object.keys(rows[0]).reduce((acc, key) => {
    acc[normalizeHeader(key)] = key;
    return acc;
  }, {} as Record<string, string>);

  const getField = (row: any, ...possibleNames: string[]): string => {
    for (const name of possibleNames) {
      const actualKey = headerMap[normalizeHeader(name)];
      if (actualKey && row[actualKey] !== undefined && row[actualKey] !== null) {
        return cellStr(row[actualKey]);
      }
    }
    return "";
  };

  const products: any[] = [];
  let skipped = 0;

  for (const row of rows) {
    const shortname = getField(row, "SHORTNAME", "SHORT NAME", "SHORT_NAME", "Model");
    const productType = getField(row, "PRODUCT TYPE", "PRODUCT_TYPE", "TYPE", "Product Type");

    if (!shortname && !productType) {
      skipped++;
      continue;
    }

    const gender = getField(row, "GENDER", "Gender") || "Unisex";
    const deliveryRaw = getField(row, "DELIVERY STATUS", "DELIVERY_STATUS", "Delivery Status", "DELIVERY");
    const uploadRaw = getField(row, "UPLOADED", "Upload Status", "UPLOAD STATUS");

    products.push({
      projectId,
      gender,
      productType: productType || "Unknown",
      shortname: shortname || "Unknown",
      style: getField(row, "STYLE", "Style") || null,
      design: getField(row, "DESIGN", "Design") || null,
      keyCode: getField(row, "KEY", "KEY CODE", "KEY_CODE", "Key Code", "KEYCODE") || null,
      colour: getField(row, "COLOUR", "COLOR", "Colour", "Color") || null,
      galleryShots: getField(row, "GALLERY SHOT", "GALLERY SHOTS", "GALLERY_SHOT", "Gallery Shot") || null,
      detailsShots: getField(row, "DETAILS SHOT", "DETAILS SHOTS", "DETAIL SHOT", "DETAILS_SHOT", "Details Shot") || null,
      miscShots: getField(row, "INSIDE PICS TAKEN", "INSIDE_PICS_TAKEN", "MISC SHOTS", "MISC", "Inside Pics Taken") || null,
      deliveryStatus: normalizeDeliveryStatus(deliveryRaw),
      factoryDelayed: normalizeDeliveryStatus(deliveryRaw) === "delayed_at_factory",
      uploadStatus: normalizeUploadStatus(uploadRaw),
    });
  }

  if (products.length === 0) {
    res.status(400).json({ error: "No valid products found in the sheet" });
    return;
  }

  const inserted = await db.insert(productsTable).values(products).returning();

  res.json({
    imported: inserted.length,
    skipped,
    sheetUsed: sheetName || workbook.SheetNames[0],
  });
});

export default router;
