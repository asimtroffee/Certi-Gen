import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import type { FieldConfig } from "@/src/components/CanvasEditor";

export const NAME_PATTERNS = ["name", "student name", "full name", "nama murid", "nama pelajar", "nama guru", "nama"];
export const EMAIL_PATTERNS = ["email", "email address", "e-mel"];
export const MAX_STUDENTS = 200;

export function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

export function detectColumn(headers: string[], patterns: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const pattern of patterns) {
    const idx = lower.findIndex((h) => h.includes(pattern));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function autoMapColumns(parsedHeaders: string[], templateConfig: FieldConfig[]) {
  const autoMap: Record<string, string> = {};
  const nameCol = detectColumn(parsedHeaders, NAME_PATTERNS);
  const emailCol = detectColumn(parsedHeaders, EMAIL_PATTERNS);

  templateConfig.forEach((box) => {
    if (box.type === "image") return;
    const label = box.label.toLowerCase();
    let match: string | null = null;

    if (nameCol && (label.includes("name") || label.includes("nama") || label.includes("student") || label.includes("murid") || label.includes("pelajar"))) {
      match = nameCol;
    } else if (emailCol && (label.includes("email") || label.includes("e-mel"))) {
      match = emailCol;
    }

    if (!match) {
      match = parsedHeaders.find((h) => h.toLowerCase() === label) || null;
    }

    if (match) autoMap[box.id] = match;
  });

  return autoMap;
}

export async function loadFont(
  pdfDoc: PDFDocument,
  fontFamily: string,
  fontWeight: string,
  fontCache: Record<string, PDFFont>,
  greatVibesRef: { current: ArrayBuffer | null }
): Promise<PDFFont> {
  const key = `${fontFamily}:${fontWeight}`;
  if (fontCache[key]) return fontCache[key];

  let font: PDFFont;
  if (fontFamily === "Great Vibes") {
    if (!greatVibesRef.current) {
      const res = await fetch("/fonts/GreatVibes-Regular.ttf");
      if (!res.ok) throw new Error("Failed to load Great Vibes font");
      greatVibesRef.current = await res.arrayBuffer();
    }
    font = await pdfDoc.embedFont(new Uint8Array(greatVibesRef.current));
  } else if (fontFamily === "Helvetica") {
    font = fontWeight === "bold"
      ? await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold)
      : await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  } else if (fontFamily === "Times-Roman") {
    font = fontWeight === "bold"
      ? await pdfDoc.embedStandardFont(StandardFonts.TimesRomanBold)
      : await pdfDoc.embedStandardFont(StandardFonts.TimesRoman);
  } else {
    font = fontWeight === "bold"
      ? await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold)
      : await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  }
  fontCache[key] = font;
  return font;
}

export async function embedImage(pdfDoc: PDFDocument, bytes: ArrayBuffer, url: string) {
  if (url.toLowerCase().endsWith(".png")) return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

export async function drawField(
  page: PDFPage,
  box: FieldConfig,
  student: Record<string, unknown>,
  mapping: Record<string, string>,
  image: { width: number; height: number },
  pdfDoc: PDFDocument,
  fontCache: Record<string, PDFFont>,
  greatVibesRef: { current: ArrayBuffer | null },
  templateUrl: string
) {
  if (box.type === "image") {
    try {
      const res = await fetch(box.imageUrl);
      if (!res.ok) return;
      const bytes = await res.arrayBuffer();
      const img = await embedImage(pdfDoc, bytes, templateUrl);
      const px = (box.x / 100) * image.width;
      const py = (box.y / 100) * image.height;
      const pw = (box.width / 100) * image.width;
      const ph = (box.height / 100) * image.height;
      page.drawImage(img, { x: px, y: image.height - py - ph, width: pw, height: ph, opacity: box.opacity / 100 });
    } catch { /* skip */ }
    return;
  }

  const col = mapping[box.id];
  if (!col) return;

  const text = String(student[col] || "");
  if (!text) return;

  const font = await loadFont(pdfDoc, box.fontFamily, box.fontWeight, fontCache, greatVibesRef);
  const px = (box.x / 100) * image.width;
  const py = (box.y / 100) * image.height;
  const tw = font.widthOfTextAtSize(text, box.fontSize);
  let x = px;
  if (box.textAlign === "center") x = px - tw / 2;
  else if (box.textAlign === "right") x = px - tw;
  const th = font.heightAtSize(box.fontSize, { descender: false });
  page.drawText(text, { x, y: image.height - py - th / 2, size: box.fontSize, font, color: hexToRgb(box.fontColor) });
}

export async function generatePdf(
  student: Record<string, unknown>,
  templateConfig: FieldConfig[],
  templateUrl: string,
  mapping: Record<string, string>,
  templateImageBytes: ArrayBuffer,
  fontCache: Record<string, PDFFont>,
  greatVibesRef: { current: ArrayBuffer | null }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const image = await embedImage(pdfDoc, templateImageBytes, templateUrl);
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

  for (const box of templateConfig) {
    await drawField(page, box, student, mapping, image, pdfDoc, fontCache, greatVibesRef, templateUrl);
  }

  return pdfDoc.save();
}

export interface ProgressState {
  setProgress: (pct: number) => void;
  setEta: (eta: string) => void;
}

export async function generateCertificateZip(
  csvData: Record<string, unknown>[],
  templateConfig: FieldConfig[],
  templateUrl: string,
  mapping: Record<string, string>,
  csvHeaders: string[],
  nameColumn: string,
  progressState: ProgressState,
  cancelRef: { current: boolean },
  templateImageBytes: ArrayBuffer,
  fileNamePrefix: string
): Promise<Blob | null> {
  const zip = new JSZip();
  const greatVibesRef: { current: ArrayBuffer | null } = { current: null };
  const fontCache: Record<string, PDFFont> = {};
  const startTime = Date.now();

  for (let i = 0; i < csvData.length; i++) {
    if (cancelRef.current) return null;

    const student = csvData[i];
    const pdfBytes = await generatePdf(student, templateConfig, templateUrl, mapping, templateImageBytes, fontCache, greatVibesRef);
    const fileName = `${student[nameColumn] || student[csvHeaders[0]] || `${fileNamePrefix}_${i + 1}`}.pdf`;
    zip.file(fileName, pdfBytes);

    const done = i + 1;
    progressState.setProgress(Math.round((done / csvData.length) * 100));
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done / elapsed;
    const remaining = (csvData.length - done) / rate;
    if (remaining > 0) {
      const m = Math.floor(remaining / 60);
      const s = Math.round(remaining % 60);
      progressState.setEta(m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`);
    }
  }

  return zip.generateAsync({ type: "blob" });
}
