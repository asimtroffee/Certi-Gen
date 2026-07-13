import * as XLSX from "xlsx";

export type ParsedFile = {
  headers: string[];
  data: Record<string, unknown>[];
};

const WATERMARK_PATTERNS = [
  "sampel", "view-only", "view only", "download", "score a",
  "creative learning", "olympiad", "certigen",
];

function isHeaderRow(row: unknown[], minCells = 4): boolean {
  if (row.length < minCells) return false;
  const text = row.map((c) => String(c ?? "").trim().toLowerCase());
  const nonEmpty = text.filter((c) => c.length > 0);
  if (nonEmpty.length < minCells) return false;
  const joined = nonEmpty.join(" ");
  if (WATERMARK_PATTERNS.some((p) => joined.includes(p))) return false;
  return true;
}

function cleanHeader(h: string): string {
  return h.trim().replace(/^["']|["']$/g, "").replace(/:+$/, "").trim();
}

function parseRows(rawRows: unknown[][]): ParsedFile {
  if (rawRows.length === 0) {
    return { headers: [], data: [] };
  }

  let headerIndex = rawRows.findIndex((row) => isHeaderRow(row));
  if (headerIndex === -1) {
    headerIndex = 0;
  }

  const rawHeaders = rawRows[headerIndex].map((c) => cleanHeader(String(c ?? "")));
  const uniqueHeaders = rawHeaders.map((h, i) => (h ? h : `Column${i + 1}`));
  const headers = uniqueHeaders;

  const data: Record<string, unknown>[] = [];
  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0) continue;
    const allEmpty = row.every((c) => !c || String(c).trim() === "");
    if (allEmpty) continue;
    const record: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = j < row.length ? row[j] ?? "" : "";
    }
    data.push(record);
  }

  return { headers, data };
}

export function parseFile(buffer: ArrayBuffer, fileName: string): ParsedFile {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  if (ext === "csv") {
    const decoder = new TextDecoder("utf-8");
    let text = decoder.decode(buffer);

    // Remove BOM
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const workbook = XLSX.read(text, { type: "string", raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    return parseRows(rows);
  }

  const workbook = XLSX.read(buffer, { type: "array", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  return parseRows(rows);
}
