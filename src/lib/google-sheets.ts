import crypto from "crypto";

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function getCredentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new MissingCredentialsError(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set in .env"
    );
  }
  return { clientEmail: email, privateKey: key.replace(/\\n/g, "\n") };
}

export class MissingCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingCredentialsError";
  }
}

export class ColumnNotFoundError extends Error {
  constructor(column: string) {
    super(`Could not find "${column}" column in the Google Sheet headers`);
    this.name = "ColumnNotFoundError";
  }
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const { clientEmail, privateKey } = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const claimB64 = base64UrlEncode(Buffer.from(JSON.stringify(claimSet)));
  const signature = crypto.sign(
    "sha256",
    Buffer.from(`${headerB64}.${claimB64}`),
    privateKey
  );
  const sigB64 = base64UrlEncode(signature);
  const jwt = `${headerB64}.${claimB64}.${sigB64}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

function detectColumn(headers: string[], patterns: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const pattern of patterns) {
    const idx = lower.findIndex((h) => h.includes(pattern));
    if (idx !== -1) return idx;
  }
  return -1;
}

export type SheetRow = {
  teacherName: string;
  teacherEmail: string;
};

/**
 * Fetches new rows from a Google Sheet (form response sheet).
 *
 * Detects columns by matching header names against known patterns:
 * - Name column: "teacher name", "full name", "name", "nama"
 * - Email column: "email", "email address", "e-mel"
 *
 * Returns only rows after `lastProcessedRow` (1-indexed, 0 = none processed).
 */
export async function fetchNewSheetRows(
  sheetId: string,
  lastProcessedRow: number
): Promise<{ rows: SheetRow[]; totalRows: number }> {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Get the sheet metadata to find the first sheet's title
  const metaRes = await fetch(`${GOOGLE_SHEETS_API}/${sheetId}`, { headers });
  if (!metaRes.ok) {
    throw new Error(`Failed to access sheet: ${metaRes.statusText}`);
  }
  const meta = await metaRes.json();
  const sheetTitle = meta.sheets?.[0]?.properties?.title || "Sheet1";

  // Fetch all rows from the sheet
  const range = `${sheetTitle}!A:Z`;
  const dataRes = await fetch(
    `${GOOGLE_SHEETS_API}/${sheetId}/values/${range}`,
    { headers }
  );
  if (!dataRes.ok) {
    throw new Error(`Failed to read sheet data: ${dataRes.statusText}`);
  }
  const data = await dataRes.json();
  const values: string[][] = data.values || [];

  if (values.length < 2) {
    return { rows: [], totalRows: values.length };
  }

  // First row is headers
  const sheetHeaders = values[0];

  // Detect name column
  const nameCol = detectColumn(sheetHeaders, [
    "teacher name",
    "full name",
    "name",
    "nama guru",
    "nama pengajar",
    "nama",
  ]);
  if (nameCol === -1) {
    throw new ColumnNotFoundError("name");
  }

  // Detect email column
  const emailCol = detectColumn(sheetHeaders, [
    "email address",
    "email",
    "e-mel",
  ]);
  if (emailCol === -1) {
    throw new ColumnNotFoundError("email");
  }

  // Rows after the header (index 1+) are data rows
  const rows: SheetRow[] = [];
  for (let i = 1; i < values.length; i++) {
    if (i <= lastProcessedRow) continue;
    const row = values[i];
    const teacherName = (row[nameCol] || "").trim();
    const teacherEmail = (row[emailCol] || "").trim();
    if (!teacherName || !teacherEmail) continue;
    rows.push({ teacherName, teacherEmail });
  }

  return { rows, totalRows: values.length - 1 };
}
