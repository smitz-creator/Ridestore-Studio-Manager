import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, productsTable, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router: IRouter = Router();

const SHEET_TO_BRAND: Record<string, string> = {
  DOPE: "Dope Snow",
  MONTEC: "Montec",
};

const BRAND_TO_SHEET: Record<string, string> = {
  "Dope Snow": "DOPE",
  Montec: "MONTEC",
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
  return "not_started";
}

function cellStr(val: any): string {
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

function parseSeason(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, "");
  const patterns = [
    /\b(FW|SS|AW|HW)\s*'?(\d{2,4})\b/i,
    /\b(Fall|Winter|Spring|Summer|Autumn)\s*'?(\d{2,4})\b/i,
    /\b(20\d{2})\b/,
  ];
  for (const pat of patterns) {
    const m = noExt.match(pat);
    if (m) {
      const prefix = m[1].toUpperCase();
      if (["FW", "SS", "AW", "HW"].includes(prefix) || ["FALL", "WINTER", "SPRING", "SUMMER", "AUTUMN"].includes(prefix)) {
        const yr = m[2].length === 2 ? `20${m[2]}` : m[2];
        const seasonPrefix = prefix === "FALL" || prefix === "AUTUMN" ? "FW" : prefix === "SPRING" || prefix === "SUMMER" ? "SS" : prefix;
        return `${seasonPrefix}${yr.slice(-2)}`;
      }
      return m[0];
    }
  }
  return "";
}

function parseSheetProducts(sheet: XLSX.WorkSheet, projectId: number) {
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) return { products: [], skipped: 0, rowCount: 0 };

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

  return { products, skipped, rowCount: rows.length };
}

router.post("/import/preview", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    res.status(400).json({ error: "Could not parse Excel file" });
    return;
  }

  const detectedSeason = parseSeason(req.file.originalname || "");

  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    const brand = SHEET_TO_BRAND[name.toUpperCase()] || name;
    return { sheetName: name, brand, rowCount: rows.length };
  });

  res.json({ sheets, detectedSeason, filename: req.file.originalname });
});

router.post("/import/execute", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const season = req.body.season;
  let selectedSheets: string[];
  try {
    selectedSheets = JSON.parse(req.body.selectedSheets || "[]");
    if (!Array.isArray(selectedSheets) || !selectedSheets.every(s => typeof s === "string")) throw new Error();
    selectedSheets = [...new Set(selectedSheets)];
  } catch {
    res.status(400).json({ error: "Invalid selectedSheets" }); return;
  }
  if (!season) { res.status(400).json({ error: "Season is required" }); return; }
  if (selectedSheets.length === 0) { res.status(400).json({ error: "No sheets selected" }); return; }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: "buffer" });
  } catch {
    res.status(400).json({ error: "Could not parse Excel file" });
    return;
  }

  const results: { sheetName: string; brand: string; projectName: string; imported: number; skipped: number }[] = [];

  for (const sheetName of selectedSheets) {
    if (!workbook.SheetNames.includes(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const brand = SHEET_TO_BRAND[sheetName.toUpperCase()] || sheetName;
    const projectName = `${brand} ${season}`;

    const [project] = await db.insert(projectsTable).values({ name: projectName, brand, season }).returning();
    const { products, skipped } = parseSheetProducts(sheet, project.id);

    let imported = 0;
    if (products.length > 0) {
      const inserted = await db.insert(productsTable).values(products).returning();
      imported = inserted.length;
    }

    results.push({ sheetName, brand, projectName, imported, skipped });
  }

  res.json({ results });
});

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

  const sheetName = BRAND_TO_SHEET[project.brand];
  let sheetUsed: string;

  if (sheetName && workbook.SheetNames.includes(sheetName)) {
    sheetUsed = sheetName;
  } else {
    sheetUsed = workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[sheetUsed];
  if (!sheet) {
    res.status(400).json({ error: "No sheets found in workbook" });
    return;
  }

  const { products, skipped } = parseSheetProducts(sheet, projectId);

  if (products.length === 0) {
    res.status(400).json({ error: "No valid products found in the sheet" });
    return;
  }

  const inserted = await db.insert(productsTable).values(products).returning();

  res.json({ imported: inserted.length, skipped, sheetUsed });
});

export default router;
